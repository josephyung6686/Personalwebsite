// Draws every part of the crayon lion with the wax engine, crops each to its marks, and writes the pictures to public/lion plus
// a manifest saying where each one sits on the rig. Run: node scripts/render-lion.mjs
// With an output path, it also makes a contact sheet for checking the art by eye: node scripts/render-lion.mjs sheet.png
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { Sheet } from '../src/lib/wax.js';
import { PARTS, U, M, canvasFor, drawPart } from './lib/lion-art.mjs';

const OUT = 'public/lion', MANIFEST = 'src/assets/lion/crayon.json';

function crop(sheet) {
  const { W, H, px } = sheet;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (px[(y * W + x) * 4 + 3] > 6) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) throw new Error('nothing was drawn');
  const pad = 2;
  return { left: Math.max(0, x0 - pad), top: Math.max(0, y0 - pad), width: Math.min(W, x1 + pad + 1) - Math.max(0, x0 - pad), height: Math.min(H, y1 + pad + 1) - Math.max(0, y0 - pad) };
}

const raw = (sheet) => sharp(Buffer.from(sheet.px.buffer, sheet.px.byteOffset, sheet.px.byteLength), { raw: { width: sheet.W, height: sheet.H, channels: 4 } });

export async function renderLion(outDir = OUT, manifestPath = MANIFEST) {
  mkdirSync(outDir, { recursive: true });
  const manifest = {};
  let seed = 100;
  for (const key of Object.keys(PARTS)) {
    const { w, h } = canvasFor(key);
    const sheet = new Sheet(null, (w + M * 2) * U, (h + M * 2) * U, 1);
    drawPart(sheet, key, (seed += 37));
    const c = crop(sheet);
    await raw(sheet).extract(c).webp({ quality: 80, alphaQuality: 84, effort: 6 }).toFile(`${outDir}/${key}.webp`);
    const r = (v) => Math.round(v * 100) / 100;
    manifest[key] = { x: r(c.left / U - M), y: r(c.top / U - M), w: r(c.width / U), h: r(c.height / U) };
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 0).replace(/},/g, '},\n')}\n`);
  return manifest;
}

/** Layers stacked on the rig's canvas into one PNG buffer, for icons, the share image and the contact sheet. */
export async function stackPng(keys, manifest, { w = 44, h = 44, scale = 8, dir = OUT } = {}) {
  const comps = [];
  for (const k of keys) {
    const m = manifest[k], width = Math.round(m.w * scale), height = Math.round(m.h * scale);
    const left = Math.round((m.x + M) * scale), top = Math.round((m.y + M) * scale);
    comps.push({ input: await sharp(`${dir}/${k}.webp`).resize(width, height).png().toBuffer(), left, top });
  }
  return sharp({ create: { width: (w + M * 2) * scale, height: (h + M * 2) * scale, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(comps).png().toBuffer();
}

async function contactSheet(out, manifest) {
  const stand = ['tail-rest', 'legs-stand', 'body', 'arms-down'], top = ['head', 'eyes-open', 'mouth-smile'];
  const looks = [
    [...stand, ...top], ['tail-left', 'legs-a', 'body', 'arms-down', ...top], ['tail-right', 'legs-b', 'body', 'arms-down', 'head', 'eyes-blink', 'mouth-smile'],
    ['tail-rest', 'legs-dangle', 'body', 'arms-up', 'head', 'eyes-squint', 'mouth-open'], ['tail-rest', 'legs-sit', 'body', 'arms-down', 'head', 'eyes-dizzy', 'mouth-wobble', 'stars'],
    [...stand, 'scarf', ...top, 'columbia'], [...stand, 'labcoat', 'labcoat-sl-down', ...top, 'glasses', 'grad'], [...stand, 'tie', ...top, 'phones', 'grip', 'cup'], [...stand, 'hoodie', 'hoodie-sl-down', ...top, 'goggles', 'snow', 'grip', 'phone'],
    [...stand, ...top, 'grip', 'guitar'], [...stand, ...top, 'grip', 'foil'],
    ['tail-rest', 'body', 'head', 'eyes-down', 'mouth-smile', 'glow', 'typing-l', 'typing-r', 'lid', 'deck'], ['tail-rest', 'legs-stand', 'body', 'head', 'eyes-down', 'mouth-smile', 'phone-back', 'hold-l', 'hold-r', 'ping'], ['tail-rest', 'legs-stand', 'body', 'arm-left', 'wave-a', 'scarf', ...top],
  ];
  const cell = (44 + M * 2) * 5, cols = 5, rows = Math.ceil((looks.length + 2) / cols);
  const panels = [];
  for (const [i, l] of looks.entries()) panels.push({ input: await stackPng(l, manifest, { scale: 5 }), left: (i % cols) * cell, top: Math.floor(i / cols) * cell });
  const bed = await stackPng(['bed-frame', 'pillow', 'sleep-head', 'bed-tail-a', 'blanket-a', 'z1', 'z2', 'z3'], manifest, { w: 64, h: 40, scale: 5 });
  panels.push({ input: bed, left: (looks.length % cols) * cell, top: Math.floor(looks.length / cols) * cell });
  await sharp({ create: { width: cols * cell + 100, height: rows * cell, channels: 4, background: '#a9d3ef' } }).composite(panels).png().toFile(out);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const manifest = await renderLion();
  console.log(`wrote ${Object.keys(manifest).length} parts`);
  if (process.argv[2]) await contactSheet(process.argv[2], manifest);
}
