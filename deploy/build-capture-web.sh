#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Deliberately avoid building the newer development branch's server/migrations.
baseline=f74f2f39161ab8caa5992978a5ac0aa2580e0672
context=$(mktemp -d /tmp/kept-capture.XXXXXXXX)
trap 'rm -rf -- "$context"' EXIT
git archive "$baseline" | tar -x -C "$context"
for file in capture-screen.test.tsx capture-screen.tsx enqueue.ts name-field.tsx summary.tsx shared-sheet.tsx share-arrival.tsx required-details.test.tsx; do
  cp "apps/web/src/components/capture/$file" "$context/apps/web/src/components/capture/$file"
done
cp apps/web/src/offline/{store.ts,dexie-store.ts} "$context/apps/web/src/offline/"
for locale in ar de en es fr it uk vi; do
  cp "apps/web/src/locales/$locale/messages.po" "$context/apps/web/src/locales/$locale/messages.po"
done
npm pack pnpm@11.23.0 --ignore-scripts --pack-destination "$context" --silent
node --input-type=module - "$context/pnpm-11.23.0.tgz" <<'JS'
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const expected = Buffer.from('8ACC5bKDoZm3Tgedoo0VXACP4jL0TIoG6n3foBTs9xn8Ni95DsxnsoEG3awq+yTEmpoHkVnaVgss59Hpjv0Rrw==', 'base64');
if (!createHash('sha512').update(readFileSync(process.argv[2])).digest().equals(expected)) throw new Error('pnpm integrity mismatch');
JS
cp deploy/capture-web.Dockerfile "$context/Capture.Dockerfile"
docker build -f "$context/Capture.Dockerfile" --build-arg "REVISION=$(git rev-parse HEAD)" -t "${1:-kept-lauge:capture-20261121}" "$context"
