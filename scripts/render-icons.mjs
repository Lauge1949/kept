// Generate all Tingfinder brand assets from the custom storage-search symbol.
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const TAPE = '#F0B03A';
const INK = '#2E2100';
/** Paper background for the Home Assistant lockup. */
const HOLE = '#FBFAF7';

const root = fileURLToPath(new URL('../', import.meta.url));

/** Custom Tingfinder geometry, shared visually with components/brand.tsx. */
export const LOCKUP_W = 360;
const WORDMARK = '<text x="76" y="46" font-family="IBM Plex Mono, monospace" font-size="42" font-weight="600" letter-spacing="1">TINGFINDER</text>';
function markArt() {
  return `<rect width="64" height="64" rx="14" fill="${TAPE}"/><g fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><circle cx="28" cy="27" r="17"/><path d="m41 40 12 13 M19 22l9-5 9 5v11l-9 5-9-5Z M19 22l9 5 9-5 M28 27v11"/></g>`;
}
export function markSvg({ bleed = false, inset = 0, size = 64 } = {}) {
  const scale = 1 - inset * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"><title>Tingfinder</title>${bleed ? `<rect width="64" height="64" fill="${TAPE}"/>` : ''}<g transform="translate(${64 * inset} ${64 * inset}) scale(${scale})">${markArt()}</g></svg>`;
}

/** The Tingfinder mark and wordmark in the requested text colour. */
export function lockupSvg({ ink, height = 64 } = {}) {
  const width = +((height * LOCKUP_W) / 64).toFixed(1);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${LOCKUP_W} 64" role="img" aria-label="Tingfinder"><title>Tingfinder</title>`,
    markArt(),
    `<g fill="${ink}">${WORDMARK}</g>`,
    '</svg>',
  ].join('');
}

/** The Home Assistant app's logo (D272): the lockup in the kit's ink on a rounded paper label,
 * `width`×`height`. Home Assistant shows it on its light and its dark theme. */
export function haLogoSvg({ width = 256, height = 100 } = {}) {
  const pad = 14;
  const h = Math.min(height - pad * 2, ((width - pad * 2) * 64) / LOCKUP_W);
  const w = +((h * LOCKUP_W) / 64).toFixed(1);
  const x = +((width - w) / 2).toFixed(1);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="14" fill="${HOLE}" stroke="#E4E1D8" stroke-width="2"/>`,
    `<svg x="${x}" y="${(height - h) / 2}" width="${w}" height="${h}" viewBox="0 0 ${LOCKUP_W} 64">`,
    markArt(),
    `<g fill="#1C1B19">${WORDMARK}</g>`,
    '</svg></svg>',
  ].join('');
}

/** Writes beside the target and renames into place, so a tracked file is never half-written. */
function write(rel, data) {
  const file = join(root, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(`${file}.tmp`, data);
  renameSync(`${file}.tmp`, file);
  console.log(`wrote ${rel}`);
}

async function png(svg, px, rel) {
  const buf = await sharp(Buffer.from(svg), { density: 72 * (px / 64) })
    .resize(px, px)
    .png({ compressionLevel: 9 })
    .toBuffer();
  write(rel, buf);
}

async function main() {
  const favicon = `${markSvg()}\n`;
  write('apps/web/public/favicon.svg', favicon);
  write('apps/docs/public/favicon.svg', favicon);
  write('apps/docs/src/assets/logo.svg', favicon);
  await png(markSvg(), 32, 'apps/web/public/favicon-32.png');
  await png(markSvg({ bleed: true }), 180, 'apps/web/public/apple-touch-icon.png');
  await png(markSvg(), 192, 'apps/web/public/icon-192.png');
  await png(markSvg(), 512, 'apps/web/public/icon-512.png');
  // Maskable: the platform may cut the icon to a circle of 80% diameter; keep the art inside.
  await png(markSvg({ bleed: true, inset: 0.1 }), 512, 'apps/web/public/icon-maskable-512.png');
  // The README's lockup, in the kit's ink for each GitHub theme (light: --ink; dark: dark --ink).
  write('docs/assets/kept-lockup-light.svg', `${lockupSvg({ ink: '#1C1B19', height: 80 })}\n`);
  write('docs/assets/kept-lockup-dark.svg', `${lockupSvg({ ink: '#F2EFE9', height: 80 })}\n`);
  // Home Assistant icon and lockup, with upstream-compatible file paths.
  await png(markSvg(), 128, 'homeassistant/kept/icon.png');
  write(
    'homeassistant/kept/logo.png',
    await sharp(Buffer.from(haLogoSvg()), { density: 144 })
      .resize(256, 100)
      .png({ compressionLevel: 9 })
      .toBuffer(),
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
