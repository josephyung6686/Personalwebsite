// Recolours her Columbia scene to blue and gold: brick becomes Columbia dark blue, limestone and pavement become gold,
// trees and copper become blue-teal, lavender shadows become indigo. Reads originals, writes design/scene-src.
// Usage: node scripts/recolor-scene.mjs <dir-with-original-svgs>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function toHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function toHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}
export function remap(hex) {
  const [h, s, l] = toHsl(hex);
  if (s < 0.06) return hex;
  if (h < 22 || h >= 330) return toHex(215, Math.min(0.62, s), l * 0.92);          // brick to Columbia dark blue
  if (h < 70) return toHex(43, Math.min(0.92, s * 1.1), l);                         // limestone, pavement, windows to gold
  if (h < 175) return toHex(190 + (h - 120) * 0.15, s * 0.75, l);                   // trees, copper to blue-teal
  if (h >= 240) return toHex(228 + (h - 240) * 0.05, s * 0.9, l);                   // lavender shadows to indigo
  return hex;                                                                       // sky blues stay
}

const src = process.argv[2];
if (src) {
  const files = ['scene-day.svg', 'scene-sunset.svg', 'scene-night.svg', 'clouds-day.svg', 'clouds-sunset.svg', 'clouds-night.svg', 'emissive.svg', 'skies.html'];
  for (const f of files) {
    const out = readFileSync(join(src, f), 'utf8').replace(/#[0-9a-fA-F]{6}\b/g, (m) => remap(m));
    writeFileSync(join('design/scene-src', f), out);
  }
  console.log(`recoloured ${files.length} files`);
}
