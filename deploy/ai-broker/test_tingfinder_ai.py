"""Offline tests for the Tingfinder AI broker. No models, credentials or network.

Run: python3 -I -m unittest discover -s deploy/ai-broker
"""
import base64
import http.client
import json
import os
from pathlib import Path
import socket
import sys
import tempfile
import threading
import time
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import tingfinder_ai as t

KEY = 'k' * 40
TOOLS = [{'type': 'function', 'function': {'name': 'search_things', 'description': 'Search',
          'parameters': {'type': 'object', 'properties': {'query': {'type': 'string'}}}}}]
PNG = base64.b64encode(b'\x89PNG\r\n\x1a\nfake').decode()


class FixedQuota:
    def __init__(self, provider='claude', at=None):
        self.provider, self.at, self.limits = provider, at, []

    def choose(self, providers=None):
        return self.provider, self.at or time.time()

    def limited(self, provider, seconds=900):
        self.limits.append(provider)


def body(**extra):
    b = {'model': 'tingfinder-chat', 'messages': [{'role': 'system', 'content': 'App rules'},
                                                  {'role': 'user', 'content': 'Hvor er hammeren?'}]}
    b.update(extra)
    return b


class Translate(unittest.TestCase):
    def test_refusals(self):
        cases = [(body(stream=True), 400), (body(model='gpt-4o'), 404),
                 (body(tools=[{'type': 'web_search'}]), 400),
                 (body(tools=[{'type': 'mcp', 'server_url': 'x'}]), 400),
                 (body(response_format={'type': 'json_schema'}), 400),
                 (body(messages=[{'role': 'user', 'content': [{'type': 'image_url',
                   'image_url': {'url': 'https://example.com/a.png'}}]}]), 400),
                 (body(messages=[{'role': 'user', 'content': [{'type': 'input_audio'}]}]), 400),
                 (body(messages=[{'role': 'user', 'content': [
                     {'type': 'image_url', 'image_url': {'url': 'data:image/png;base64,' + PNG}}] * 9}]), 413)]
        for b, status in cases:
            with self.subTest(b=json.dumps(b)[:80]):
                with self.assertRaises(t.Refused) as ctx: t.translate(b)
                self.assertEqual(ctx.exception.status, status)

    def test_json_object_adds_json_only_instruction(self):
        system, _, _, _, must = t.translate(body(response_format={'type': 'json_object'}))
        self.assertTrue(must)
        self.assertEqual(system, 'App rules\n\n' + t.JSON_ONLY)

    def test_tool_choice_none_forces_answer(self):
        _, _, _, functions, must = t.translate(body(tools=TOOLS, tool_choice='none'))
        self.assertEqual(functions, []); self.assertTrue(must)
        self.assertEqual(t.output_schema([])['properties']['kind']['enum'], ['answer'])

    def test_transcript_keeps_tool_roundtrip_and_images(self):
        b = body(tools=TOOLS, messages=[
            {'role': 'user', 'content': [{'type': 'text', 'text': 'Se'},
                                         {'type': 'image_url', 'image_url': {'url': 'data:image/png;base64,' + PNG}}]},
            {'role': 'assistant', 'content': None, 'tool_calls': [
                {'id': 'c1', 'type': 'function', 'function': {'name': 'search_things', 'arguments': '{}'}}]},
            {'role': 'tool', 'tool_call_id': 'c1', 'content': '[]'}])
        system, transcript, images, functions, _ = t.translate(b)
        self.assertEqual(system, '')
        self.assertEqual(transcript[0]['content'], 'Se\n[image 1]')
        self.assertEqual(transcript[1]['tool_calls'][0]['name'], 'search_things')
        self.assertEqual(transcript[2]['tool_call_id'], 'c1')
        self.assertEqual(images[0][0], 'image/png')


class Completion(unittest.TestCase):
    def test_unknown_tool_and_bad_arguments_are_dropped(self):
        functions = [{'name': 'search_things'}]
        r = t.to_completion({'kind': 'tool_calls', 'content': '', 'tool_calls': [
            {'name': 'delete_everything', 'arguments_json': '{}'},
            {'name': 'search_things', 'arguments_json': 'not json'}]}, functions, 'tingfinder-chat', (1, 2))
        calls = r['choices'][0]['message']['tool_calls']
        self.assertEqual([c['function']['name'] for c in calls], ['search_things'])
        self.assertEqual(calls[0]['function']['arguments'], '{}')
        self.assertEqual(r['choices'][0]['finish_reason'], 'tool_calls')

    def test_tool_calls_without_offered_tools_become_answer(self):
        r = t.to_completion({'kind': 'tool_calls', 'content': 'hej', 'tool_calls': [
            {'name': 'search_things', 'arguments_json': '{}'}]}, [], 'tingfinder-chat', (0, 0))
        self.assertEqual(r['choices'][0]['message'], {'role': 'assistant', 'content': 'hej'})


class Quota(unittest.TestCase):
    def test_unknown_is_bounded_trial_and_exhausted_waits(self):
        now = 1000.0
        self.assertEqual(t.select_provider({}, {}, now), ('claude', now))
        exhausted = {'claude': {'windows': [{'remaining_percent': 0, 'resets_at': now + 50}]},
                     'codex': {'state': 'exhausted', 'retry_at': now + 80}}
        self.assertEqual(t.select_provider(exhausted, {}, now), (None, now + 50))
        self.assertEqual(t.select_provider({'claude': exhausted['claude']}, {}, now)[0], 'codex')
        self.assertEqual(t.select_provider({}, {'claude': now + 10}, now)[0], 'codex')

    def test_broker_returns_429_with_retry(self):
        broker = t.Broker(KEY, quota=FixedQuota(None, time.time() + 120), runner=None)
        with self.assertRaises(t.Refused) as ctx: broker.complete(body())
        self.assertEqual(ctx.exception.status, 429)
        self.assertGreaterEqual(ctx.exception.retry_after, 100)

    def test_provider_limit_sets_cooldown(self):
        quota = FixedQuota()
        def runner(*a): raise t.Refused(429, 'limit', 900)
        with self.assertRaises(t.Refused): t.Broker(KEY, quota=quota, runner=runner).complete(body())
        self.assertEqual(quota.limits, ['claude'])


class Approval(unittest.TestCase):
    LIMITS = {'memory.max': str(2 * 1024**3), 'memory.swap.max': '0', 'pids.max': '128', 'cpu.max': '200000 100000'}

    def manifest(self, **extra):
        data = {'schema': 1, 'profile': t.PROFILE, 'providers': list(t.PROVIDERS), 'models': t.MODELS,
                'exposed': list(t.EXPOSED), 'hashes': {'a': '1'}, 'native_canaries': {'claude': True, 'codex': True},
                'negative_tests': True}
        data.update(extra)
        return data

    def test_exact_approval_only(self):
        self.assertTrue(t.approved(self.manifest(), {'a': '1'}, self.LIMITS))
        for bad in ({'hashes': {'a': '2'}}, {'profile': 'dba-typed-v1'}, {'models': {'claude': 'opus', 'codex': 'gpt-6-luna'}},
                    {'providers': ['claude', 'codex', 'cursor']}, {'native_canaries': {'claude': True, 'codex': False}},
                    {'negative_tests': False}, {'exposed': ['tingfinder-chat', 'gpt-4o']}):
            with self.subTest(bad=bad): self.assertFalse(t.approved(self.manifest(**bad), {'a': '1'}, self.LIMITS))
        self.assertFalse(t.approved(self.manifest(), None, self.LIMITS))
        for key, value in (('memory.swap.max', '1'), ('memory.max', 'max'), ('pids.max', 'max'), ('cpu.max', 'max 100000')):
            with self.subTest(limit=key):
                self.assertFalse(t.approved(self.manifest(), {'a': '1'}, dict(self.LIMITS, **{key: value})))

    def test_user_owned_manifest_is_untrusted(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / 'tingfinder-ai.json'; path.write_text(json.dumps(self.manifest()))
            with self.assertRaises(ValueError): t.read_manifest(path)

    def test_gate_fails_closed_outside_service(self):
        self.assertFalse(t.make_gate({'a': '1'})())

    def test_unapproved_broker_answers_503(self):
        broker = t.Broker(KEY, quota=FixedQuota(), runner=None, gate=lambda: False)
        with self.assertRaises(t.Refused) as ctx: broker.complete(body())
        self.assertEqual(ctx.exception.status, 503)


class Http(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.path = os.path.join(self.dir, 's.sock')
        self.seen = []
        def runner(provider, system, prompt, images, schema):
            self.seen.append((provider, system, prompt))
            if 'LOGIN' in prompt: raise t.Refused(503, 'Subscription login unavailable')
            return {'kind': 'answer', 'content': 'ok', 'tool_calls': []}, (3, 4)
        self.server = t.UnixServer(self.path, t.make_handler(t.Broker(KEY, quota=FixedQuota(), runner=runner)))
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); os.unlink(self.path); os.rmdir(self.dir)

    def call(self, method, path, payload=None, key=KEY):
        class Conn(http.client.HTTPConnection):
            def connect(conn):
                conn.sock = socket.socket(socket.AF_UNIX); conn.sock.connect(self.path)
        c = Conn('localhost', timeout=10)
        data = json.dumps(payload).encode() if payload is not None else None
        headers = {'Authorization': 'Bearer ' + key} if key else {}
        if data is not None: headers['Content-Type'] = 'application/json'
        c.request(method, path, data, headers)
        r = c.getresponse(); out = (r.status, json.loads(r.read() or b'null'), r.getheader('Retry-After')); c.close()
        return out

    def test_auth_models_and_completion(self):
        self.assertEqual(self.call('GET', '/v1/models', key='wrong' * 10)[0], 401)
        self.assertEqual(self.call('POST', '/v1/chat/completions', body(), key=None)[0], 401)
        status, models, _ = self.call('GET', '/v1/models')
        self.assertEqual([m['id'] for m in models['data']], list(t.EXPOSED))
        status, r, _ = self.call('POST', '/v1/chat/completions', body())
        self.assertEqual((status, r['choices'][0]['message']['content'], r['usage']['total_tokens']), (200, 'ok', 7))
        self.assertEqual(self.seen[0][1], t.PROTOCOL)  # app text never replaces the broker protocol
        self.assertIn('App rules', self.seen[0][2])
        self.assertEqual(self.call('POST', '/v1/responses', body())[0], 404)
        self.assertEqual(self.call('DELETE', '/v1/models')[0], 405)

    def test_keyless_mode_accepts_without_header(self):
        self.server.RequestHandlerClass = t.make_handler(t.Broker(None, quota=FixedQuota(),
                                                                  runner=lambda *a: ({'kind': 'answer', 'content': 'ok', 'tool_calls': []}, (1, 1))))
        self.assertEqual(self.call('GET', '/v1/models', key=None)[0], 200)
        self.assertEqual(self.call('POST', '/v1/chat/completions', body(), key=None)[0], 200)

    def test_missing_login_is_503_not_401(self):
        status, r, _ = self.call('POST', '/v1/chat/completions',
                                 body(messages=[{'role': 'user', 'content': 'LOGIN'}]))
        self.assertEqual(status, 503)

    def test_oversized_request(self):
        class Conn(http.client.HTTPConnection):
            def connect(conn):
                conn.sock = socket.socket(socket.AF_UNIX); conn.sock.connect(self.path)
        c = Conn('localhost', timeout=10)
        c.putrequest('POST', '/v1/chat/completions'); c.putheader('Authorization', 'Bearer ' + KEY)
        c.putheader('Content-Length', str(t.MAX_BODY + 1)); c.endheaders()
        self.assertEqual(c.getresponse().status, 413); c.close()


if __name__ == '__main__':
    unittest.main()
