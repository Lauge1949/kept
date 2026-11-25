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
cannot obtain new URLs and tampered links fail. Native app authentication protects
private API data; possession of a valid signed photo URL grants temporary access.
Private data must never be cached by an outer proxy.

## HTTPS instance with native authentication

Per owner decision 2026-11-25, [Tingfinder](https://tingfinder.laugesbin.win/)
uses only its own account login. The extra device-access login is removed for both
this hostname and `dev-kept.laugesbin.win`. The old origin still serves the app so
installed PWAs can sync their origin-bound offline queues. Never clear their data.
Ordinary signup remains closed. The owner already has an account; do not reset it.

`https-preview.caddy` is the source for the shared gateway's `kept.preview` on
loopback 18600, proxying Kept's loopback 18740. Preserve the CLI collision guard.
The private onboarding include and gate worker-reset route are no longer imported.
Retired `/_device/*`, `/start` and `/api/preview-start` redirect to native `/signin`
with 303; `/_device/verify` returns 404. `/sw.js` always reaches Kept's real worker.
Other sites retain their existing authentication. Dormant device-access host entries
are retained, but these two proxy routes never call that service.

The gateway preserves public Host, HTTPS forwarding and private/no-store responses;
it still strips Authorization, so personal API-token/MCP access remains unsupported.
Validate the complete gateway config before restart; its admin API is disabled.
No app rebuild, database change or device-access restart is needed for this change.

Run `tingfinder-smoke.mjs` with the private fixture directory and installed
Playwright/Chrome variables. It now uses actual public HTTPS, checks unauthenticated
API denial on both hosts, retired login links, native account sign-in, Danish/English
and mobile layouts. `preview-smoke.mjs` and `capture-smoke.mjs` record historical
acceptance for the retired outer gate; their perimeter assertions no longer apply.
Physical iPhone/Android installation and WebKit still require device testing.

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

### Tingfinder and Danish

`deploy/build-tingfinder.sh tingfinder:20261121` archives the same pinned 1.14.7
source and applies the explicit overlay plus task-only stable patches. It compiles
the stable server without running migrations, retains existing runtime assets, and
copies the renamed report templates. It runs capture/preferences tests, TypeScript
checks, Danish mail/report/assistant checks, shared shape tests, the full catalogue
check and the production web build offline. The custom Tingfinder mark is a magnifying glass around a storage box.

The product is Tingfinder; Danish (`da`, including browser tags such as `da-DK`)
is selectable alongside all existing languages. Technical Kept identifiers remain
compatible. The canonical URL is https://tingfinder.laugesbin.win; the old dev-kept host remains an authenticated compatibility origin so installed PWAs retain access to their offline queues. Danish is bundled in the offline shell, with a deliberate 3900 KiB precache budget, so a failed on-demand language load falls back to readable Danish rather than raw message IDs. Build after committing so the
image revision and source link identify the actual fork commit.

`deploy/tingfinder-smoke.mjs` checks Danish startup, language switching, installation
metadata, account locale persistence and 320–1440 px layouts using the same private
synthetic fixture and loopback browser transport. Run `deploy/capture-smoke.mjs`
afterwards for capture/create/delete and the real public unauthenticated perimeter.
Neither script claims physical iPhone, Android or WebKit coverage.
