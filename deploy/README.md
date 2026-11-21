# Isolated development baseline

This runs the unmodified stable Kept 1.14.7 image as a reference before changing
the fork. Its OCI revision is `f74f2f39161ab8caa5992978a5ac0aa2580e0672`
(`v1.14.7`); this is distinct from the newer fork's `main` baseline.
The image digest is pinned in `development.env.example`.

Copy the example environment outside the repository, restrict it to mode 0600,
and set a random six-character setup code using Kept's alphabet
`0123456789ABCDEFGHJKMNPQRSTVWXYZ`. Run from the repository root:

```sh
docker compose --env-file /path/to/private/runtime.env \
  -f compose.yaml -f deploy/development.compose.yaml config -q
docker compose --env-file /path/to/private/runtime.env \
  -f compose.yaml -f deploy/development.compose.yaml up -d
```

For a fresh HTTP-only baseline, open `http://127.0.0.1:18740` on the server. A small Caddy
proxy publishes only that loopback port; the app itself stays on the internal
network (Docker does not publish ports for internal-only containers). The database
has no published port; the internal Docker network blocks external AI, telemetry,
mail and update calls. No host credentials, source tree or Docker socket are
mounted into Kept. The upstream read-only app filesystem, non-root user and dropped
capabilities are retained. Named volumes use the `kept-lauge-dev` project prefix.

Use only synthetic accounts and photos. The instance is for evaluating login,
inventory, search and mobile layout. HTTP on loopback is sufficient for the original baseline browser
tests. The server now has the authenticated HTTPS preview described below.
Do not call this a production deployment or a verified iPhone installation.

Stop without deleting data with the same command and `stop` instead of `up -d`.
Do not run `down -v` against an instance containing user data.

AI provider configuration and subscription routing are a later integration step;
this baseline does not send paid model requests. To test fork code later, build a
reviewed image from the desired commit and set `KEPT_IMAGE` to that image. Keep
the source URL and image revision accurate when serving modified code.

## Acceptance test

`smoke.mjs` uses an installed Playwright module and Chromium; it never installs
dependencies. Set `KEPT_SMOKE_STATE` to the private directory containing
`runtime.env`, then run `node deploy/smoke.mjs`. If needed, set
`KEPT_PLAYWRIGHT_MODULE` to an installed module and `KEPT_CHROME_PATH` to Chrome.
It deliberately targets only the loopback development address above.

The first run completes setup with synthetic owner/other accounts and keeps their
random passwords in private `fixtures.json`. It creates one synthetic chest photo,
an item and a `Loftet` room for repeatable development checks. These are intentional
demo fixtures, not user data. Signup opens during the test and closes afterwards.
Reports and screenshots remain in the private state directory, outside Git.

Checks include item creation, search, photo decoding, description/location storage,
ten inventory/detail layouts across five viewport sizes, independent-user access,
Origin checks, logout/login and PWA manifest/cache checks. It honours login rate
limits. If WebKit is missing, the report records that gap rather than treating
Chromium as Safari. No physical-phone installation is claimed.

Kept serves photos via five-minute signed bearer URLs: someone possessing such a
URL can read it until expiry without a session. Tests verify unauthorised users
cannot obtain new URLs and tampered links fail. The HTTPS preview protects
the entire origin, including `/f/`, with the server's shared login and disables
shared caching. Private data and API endpoints must never be cached by an outer proxy.

## Authenticated HTTPS preview

The server's reference instance uses `KEPT_PUBLIC_URL=https://dev-kept.laugesbin.win`.
Open [Kept](https://dev-kept.laugesbin.win/). Its entire origin is behind the
existing device-access server password, followed by Kept's own user login.
A single-use, seven-day invitation is exposed only after shared login at `/api/preview-start`.
It creates the owner's chosen account in the synthetic `Prøvehjem` location;
ordinary sign-up remains closed. After joining, use `/` to reopen the app. The
onboarding entry uses `/api/` because Kept's service worker excludes it from the
navigation fallback; the original `/start` can be swallowed by an existing worker.
The invitation URL and all test credentials live only in private server files.

`https-preview.caddy` is the reviewed site for the existing shared gateway on
loopback 18600, which proxies Kept's loopback 18740. The live site has the extension
`.preview`, outside the `dev-preview` CLI's managed `*.caddy` files. The gateway's
main Caddyfile imports `*.preview`; a CLI guard reserves names with that extension.
Its `kept-entry.inc` import contains only the private onboarding redirect, under
the same auth gate. This is a mandatory import: after the invitation is consumed or
expires, retain an empty/comment-only include unless removing the importing site
at the same time. Preserve the CLI collision guard when updating that tool.
Auth registration is marked `managed_by: kept-development`,
so CLI sync does not remove it. Gateway configuration must validate before restart.
The Cloudflare tunnel and proxied DNS add only this exact hostname.

The upstream application and storage remain isolated. No AI keys are connected.
The outer proxy strips Authorization, so this preview is for browser use, without
personal API-token, MCP or unauthenticated feed/webhook access. All users currently
share Kept's inner proxy IP for login rate limits. Synthetic SMTP/AI traffic remains
blocked by the internal network. Private configuration and rollback locations are
recorded in the server's canonical development documentation.

The original `smoke.mjs` expects an HTTP-only instance and is not the acceptance
command for the running HTTPS configuration: its Origin and Secure cookies differ.
Do not switch a published instance to HTTP to run it. Run `preview-smoke.mjs` with
the same Playwright/Chrome/private-state variables instead. That checks public
unauthenticated HTTPS gating, real signed-photo and JavaScript URLs, no-store and
Secure Kept cookies. An optional `KEPT_PREVIEW_RESOLVER=1.1.1.1` avoids stale local
NXDOMAIN immediately after hostname creation; TLS verification stays enabled.

For inner UI checks the browser keeps the canonical HTTPS origin, but Playwright
routes requests directly to the isolated loopback backend. This verifies Kept's
Origin/cookie behavior and existing data independently of the outer password.
It does **not** prove a successful device-access password login through Cloudflare.
It previews the unconsumed invitation form without submitting it. Physical iPhone,
Android installation, WebKit and full public authenticated flows remain to test
on the owner's devices. Browser service workers are blocked in this inner check;
the original baseline separately checked the manifest and private cache behavior.

### Required capture details and web-only builds

`./deploy/build-capture-web.sh kept-lauge:capture-20261121` builds the pinned
1.14.7 source (`f74f2f3`) with the listed capture files and the guarded local-queue removal method and their message catalogues from this fork.
It replaces only the web bundle in the exact existing runtime image; no server
upgrade or database migration. The client protocol version stays 1.14.7.
The script verifies pnpm11.23.0 integrity, installs the existing frozen lockfile
with all install hooks disabled in Docker, then tests/typechecks/builds offline.
Build containers have no runtime credentials, data volumes or host sockets.
No package installation on the host. The original server/API capture rules are
unchanged; required name and concrete room/container are enforced by this UI
for new Thing/Label captures. Existing things can receive extra photos without
renaming. Receipt, meter and AI room modes retain their existing rules.
Single-item Delete in the session summary cancels unsent creation/dependent
operations or moves the synced thing to trash. An in-flight sync may require a
retry; failure keeps the capture visible. Removing an item also removes its
extra photos from this session; extra-photo tiles are not independent items.

The final image source URL must name the committed fork revision. Commit the
reviewed source before the final build. `deploy/capture-smoke.mjs` checks the
HTTPS perimeter separately and uses only the existing synthetic account for the
inner capture/create/delete flow; it never consumes an invitation. Its report
and screenshots stay in `KEPT_SMOKE_STATE`. Synced deletion waits for dependent
photo uploads to finish; no pending photos are discarded after a failed delete.
