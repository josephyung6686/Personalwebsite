// The site's logo: the lion's head. Tab-sized icons use a dedicated 16 x 16 drawing, scaled by whole numbers;
// larger icons put the full head on a navy tile. Writes favicon.ico and the PNG icons. Run: node scripts/render-icons.mjs
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { bbox, paths } from '../src/assets/lion/sprites.ts';
import { fullHead, tinyHead } from '../src/assets/lion/poses.ts';
import { spritePng } from './render-lion.mjs';

const tiny = (scale) => spritePng(paths(tinyHead), { w: 16, h: 16, scale });

/** The full head centred on a navy tile. A rounded tile for browsers; a full-bleed one for phones, which round it themselves. */
async function tile(size, scale, rounded = true) {
  const box = bbox(fullHead);
  const art = await spritePng(paths(fullHead), { ...box, scale });
  const r = rounded ? Math.round(size * 0.2) : 0;
  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" rx="${r}" fill="#131d38"/></svg>`);
  return sharp(bg).composite([{ input: art, left: Math.round((size - box.w * scale) / 2), top: Math.round((size - box.h * scale) / 2) }]).png().toBuffer();
}

writeFileSync('public/favicon-48.png', await tiny(3));
writeFileSync('public/favicon-96.png', await tile(96, 3));
writeFileSync('public/apple-touch-icon.png', await tile(180, 6, false));
writeFileSync('public/icon-192.png', await tile(192, 6));
writeFileSync('public/icon-512.png', await tile(512, 16));

// favicon.ico holding 16, 32 and 48 px PNGs (the ICO format allows PNG entries).
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map((s) => tiny(s / 16)));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((s, i) => {
  const e = 6 + 16 * i;
  header.writeUInt8(s, e); header.writeUInt8(s, e + 1); header.writeUInt8(0, e + 2); header.writeUInt8(0, e + 3);
  header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(images[i].length, e + 8); header.writeUInt32LE(offset, e + 12);
  offset += images[i].length;
});
writeFileSync('public/favicon.ico', Buffer.concat([header, ...images]));
console.log('wrote icons');
