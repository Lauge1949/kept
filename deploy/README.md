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

Open `http://127.0.0.1:18740` on the server. There is no public route. A small Caddy
proxy publishes only that loopback port; the app itself stays on the internal
network (Docker does not publish ports for internal-only containers). The database
has no published port; the internal Docker network blocks external AI, telemetry,
mail and update calls. No host credentials, source tree or Docker socket are
mounted. The upstream read-only app filesystem, non-root user and dropped
capabilities are retained. Named volumes use the `kept-lauge-dev` project prefix.

Use only synthetic accounts and photos. The instance is for evaluating login,
inventory, search and mobile layout. HTTP on loopback is sufficient for browser
tests, but real-phone camera/PWA installation needs an authenticated HTTPS preview.
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
cannot obtain new URLs and tampered links fail. Before publishing a preview, put
the entire origin, including `/f/`, behind the server's shared login. Private data
and API endpoints must never be cached by an outer proxy.
