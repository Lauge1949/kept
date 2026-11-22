# Tingfinder

This fork builds on [Kept](https://github.com/keptinventory/kept) as a simple,
self-hosted app for remembering where belongings are stored.

For the next agent session, start with [the continuation plan](CONTINUE.md).

## Repository layout

- `origin`: `https://github.com/Lauge1949/kept.git` (our fork).
- `upstream`: `https://github.com/keptinventory/kept.git` (the original project).
- `main`: upstream baseline; keep custom changes on our development branch.
- `lauge/develop`: integration branch for this edition. Use task branches for
  subsequent features and review changes before integration.
- Initial upstream baseline: `52a19f0c9060f6db3f6250a6b46d7cd9032aae66`.

Fetch upstream changes, review them, and merge selected updates into our edition.
Do not overwrite our branch with an automatic upstream sync or force push.
Preserve the upstream license and attribution.

## Agreed product direction

- Personal accounts with private inventories.
- Add a photo, required title and physical location, and optional description.
- Search and view belongings, and update their location when they move.
- Installable PWA for iPhone and Android, with a simple mobile workflow.
- Keep Kept's existing chat-thread overview; a single permanent thread is not
  required.
- Assistant replies identify existing records and show the item's own photo,
  current recorded location and a working link to its detail page.
- Search should use titles, descriptions, locations and information in photos.
- Route AI work through the existing quota-aware server integration, using the
  smallest suitable approved model and included quota without paid overage.
- Enforce user-scoped, read-only assistant access outside the model. Recheck
  access and current record fields when rendering results.

## Development status (2026-11-21)

Fork and development branch prepared. The digest-pinned stable Kept
1.14.7 server runs with its own database, storage and network, exposed
through an authenticated HTTPS development preview. See [development setup and acceptance checks](deploy/README.md).
The capture UI now requires a name and concrete room/container for new items,
with individual item deletion from the session summary. The explicit stable overlay build keeps server release 1.14.7 and its migrations.
Danish is an official selectable language across the UI, email, notifications,
reports, readable exports and the web recovery kit. Product names change while
storage keys, protocol IDs, environment names and URLs remain compatible. The preview preserves the original
UI and original amber K logo, rebranded as Tingfinder. Both shared server access and a Tingfinder account are required.

The baseline acceptance flow covers item/photo creation, recorded location,
description, search, separate-user access and Chromium mobile layouts. Physical
iPhone/PWA installation and WebKit coverage remain unverified.

HTTPS preview protection, canonical-origin login/cookies and the account invitation
form are checked. Full public authenticated phone use still needs device testing.
Next: implement and test the AI adapter. Kept's API-key-based providers
are not already connected to the existing subscription/quota runtime. Semantic
search embeddings need a separate compatibility decision.

Keep credentials, production configuration, user photos, inventory data and
database dumps out of this public repository. Use synthetic fixtures for tests.
