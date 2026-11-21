#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Keep the installed server release and migrations. Only the reviewed overlay is copied.
baseline=f74f2f39161ab8caa5992978a5ac0aa2580e0672
context=$(mktemp -d /tmp/tingfinder-build.XXXXXXXX)
trap 'rm -rf -- "$context"' EXIT
git archive "$baseline" | tar -x -C "$context"
while IFS= read -r file; do
  [[ -z "$file" || "$file" == \#* ]] && continue
  # A tools-only build may start while translators are still writing the new catalogue.
  if [[ "${TINGFINDER_BUILD_TARGET:-checked}" == tools && "$file" == apps/web/src/locales/da/messages.po && ! -f "$file" ]]; then continue; fi
  mkdir -p "$context/$(dirname "$file")"
  cp -- "$file" "$context/$file"
done < deploy/tingfinder-files.txt
git -C "$context" apply "$PWD/deploy/stable-locales.patch" "$PWD/deploy/stable-map-shapes.patch"
npm pack pnpm@11.23.0 --ignore-scripts --pack-destination "$context" --silent
node --input-type=module - "$context/pnpm-11.23.0.tgz" <<'JS'
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const expected = Buffer.from('8ACC5bKDoZm3Tgedoo0VXACP4jL0TIoG6n3foBTs9xn8Ni95DsxnsoEG3awq+yTEmpoHkVnaVgss59Hpjv0Rrw==', 'base64');
if (!createHash('sha512').update(readFileSync(process.argv[2])).digest().equals(expected)) throw new Error('pnpm integrity mismatch');
JS
cp deploy/tingfinder.Dockerfile "$context/Tingfinder.Dockerfile"
args=()
if [[ -n "${TINGFINDER_BUILD_TARGET:-}" ]]; then args+=(--target "$TINGFINDER_BUILD_TARGET"); fi
docker build "${args[@]}" -f "$context/Tingfinder.Dockerfile" --build-arg "REVISION=$(git rev-parse HEAD)" -t "${1:-tingfinder:20261121}" "$context"
