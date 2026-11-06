// Rasterises the pixel lion with hard pixels. Run it to get a contact sheet of every frame, pose and wardrobe item,
// for checking the art by eye: node scripts/render-lion.mjs [out.png] [scale]
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { layer, paths, arms, body, eyes, head, legs, mouths, tails, SIZE } from '../src/assets/lion/sprites.ts';
import { HAT_ART, TOP_ART, FACE_ART, HELD_ART } from '../src/assets/lion/items.ts';
import { poseSvg, tinyHead } from '../src/assets/lion/poses.ts';

/** Sprite markup as a PNG buffer: drawn at native size on the given viewBox, then scaled with nearest-neighbour. */
export async function spritePng(markup, { x = 0, y = 0, w, h, scale = 1 }) {
  const inner = markup.replace(/<svg[^>]*>/, '').replace('</svg>', '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}" shape-rendering="crispEdges">${inner}</svg>`;
  return sharp(Buffer.from(svg)).ensureAlpha().resize(w * scale, h * scale, { kernel: 'nearest' }).png().toBuffer();
}

async function contactSheet(out, S) {
  const CELL = SIZE * S + 10;
  const NAVY = '#0b1226', SAND = '#e9d9a8';
  const on = async (markup, w, h, bg, scale = S) => sharp({ create: { width: w * scale, height: h * scale, channels: 4, background: bg } })
    .composite([{ input: await spritePng(markup, { w, h, scale }) }]).png().toBuffer();

  const panels = [];
  let col = 0, row = 0;
  const add = (input, w = CELL) => { panels.push({ input, left: col, top: row }); col += w; };
  const nextRow = () => { col = 0; row += CELL; };

  const standing = (o = {}) => paths(layer(o.tail ?? tails.rest, o.legs ?? legs.stand, body, o.arms ?? arms.down, head, o.eyes ?? eyes.open, o.mouth ?? mouths.smile));
  for (const f of [
    standing(), standing({ legs: legs.a, tail: tails.left }), standing({ legs: legs.b, tail: tails.right }),
    standing({ eyes: eyes.blink }), standing({ legs: legs.sit, eyes: eyes.dizzy, mouth: mouths.wobble }),
    standing({ legs: legs.dangle, arms: arms.up, eyes: eyes.squint, mouth: mouths.open }),
  ]) add(await on(f, SIZE, SIZE, NAVY));
  nextRow();

  for (const pose of ['laptop', 'phone', 'scarf']) add(await on(poseSvg(pose), SIZE, SIZE, pose === 'laptop' ? SAND : NAVY));
  add(await on(poseSvg('bed'), 64, 40, NAVY), 64 * S + 10);
  nextRow();

  const dressed = (slot, a) => {
    const lower = paths(tails.rest) + paths(legs.stand) + paths(body) + paths(arms.down);
    const face = paths(layer(head, eyes.open, mouths.smile));
    return on(lower + (slot === 'top' ? a.svg + face : face + a.svg), SIZE, SIZE, NAVY);
  };
  for (const a of Object.values(HAT_ART)) add(await dressed('hat', a));
  for (const a of Object.values(FACE_ART)) add(await dressed('face', a));
  nextRow();
  for (const a of Object.values(TOP_ART)) add(await dressed('top', a));
  nextRow();
  for (const a of Object.values(HELD_ART)) add(await dressed('held', a));
  add(await on(paths(tinyHead), 16, 16, NAVY, 8), 140);
  add(await on(paths(tinyHead), 16, 16, NAVY, 1), 30);
  nextRow();

  await sharp({ create: { width: CELL * 6 + 40, height: row, channels: 4, background: '#333' } }).composite(panels).png().toFile(out);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const out = process.argv[2] ?? 'lion-sheet.png';
  await contactSheet(out, Number(process.argv[3] ?? 5));
  console.log(`wrote ${out}`);
}
