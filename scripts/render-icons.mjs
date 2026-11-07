// The site's logo: the lion's head, in crayon, on a square of Columbia-blue paper. Writes favicon.ico and the PNG icons.
// Run after render-lion.mjs: node scripts/render-icons.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const manifest = JSON.parse(readFileSync('src/assets/lion/crayon.json', 'utf8'));

/** The bold head on a paper tile. Rounded for browsers; full-bleed for phones, which round it themselves. */
async function tile(size, rounded = true) {
  const r = rounded ? Math.round(size * 0.2) : 0, head = manifest['icon-head'];
  const k = (size * 0.94) / Math.max(head.w, head.h);
  const art = await sharp('public/lion/icon-head.webp').resize(Math.round(head.w * k), Math.round(head.h * k), { kernel: 'lanczos3' }).png().toBuffer();
  const meta = await sharp(art).metadata();
  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="#a9d3ef"/></svg>`);
  return sharp(bg).composite([{ input: art, left: Math.round((size - meta.width) / 2), top: Math.round((size - meta.height) / 2) }]).png().toBuffer();
}

writeFileSync('public/favicon-48.png', await tile(48));
writeFileSync('public/favicon-96.png', await tile(96));
writeFileSync('public/apple-touch-icon.png', await tile(180, false));
writeFileSync('public/icon-192.png', await tile(192));
writeFileSync('public/icon-512.png', await tile(512));

// favicon.ico holding 16, 32 and 48 px PNGs (the ICO format allows PNG entries).
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map((s) => tile(s)));
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
