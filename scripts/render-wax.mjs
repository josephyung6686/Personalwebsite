// The page's crayon materials: paper, wax grain, hand-drawn frames for panels and buttons, section markers and rules.
// Everything here comes out of the wax engine. Frames are 9-slice images: the wobble repeats exactly once along each edge,
// so CSS border-image can tile them to any size without a visible seam. Run: node scripts/render-wax.mjs
import { Sheet, draw, hatch, hex, rng, spline, dense, wobble, toothMap, TOOTH_SIZE, ell } from '../src/lib/wax.js';
import { saveWebp } from './lib/wax-out.mjs';

const OUT = 'public/wax';
export const INK = '#16224f', BLUE = '#1f5fd0', RED = '#d8332a', GOLD = '#fad13b', ORANGE = '#ef7b12', CREAM = '#fffdf6';

async function paper(name, base, size = 256) {
  const s = new Sheet(null, size, size, 1), r = rng(9), b = hex(base);
  for (let i = 0; i < size * size; i++) {
    const v = (r() - 0.5) * 9, j = i * 4;
    s.px[j] = b[0] + v; s.px[j + 1] = b[1] + v; s.px[j + 2] = b[2] + v * 0.8; s.px[j + 3] = 255;
  }
  // Paper fibres: short flecks, lighter and darker than the sheet, that wrap around the tile.
  for (let n = 0; n < 46; n++) {
    const up = r() < 0.5, x = r() * size, y = r() * size, dx = (r() - 0.5) * 14, dy = (r() - 0.5) * 6;
    for (let t = 0; t < 1; t += 0.08) {
      const j = (((Math.floor(y + dy * t) + size) % size) * size + ((Math.floor(x + dx * t) + size) % size)) * 4;
      for (let c = 0; c < 3; c++) s.px[j + c] = up ? s.px[j + c] + (255 - s.px[j + c]) * 0.16 : s.px[j + c] * 0.965;
    }
  }
  return saveWebp(s, `${OUT}/${name}.webp`, { quality: 86, alphaQuality: 100 });
}

/** A wrapping alpha tile cut from the same tooth the strokes use: lay it over any colour and that colour turns to wax. */
async function grain(name, press) {
  const t = toothMap(1), s = new Sheet(null, TOOTH_SIZE, TOOTH_SIZE, 1);
  for (let i = 0; i < t.length; i++) {
    const a = Math.max(0, Math.min(1, (press - t[i]) / 0.13 + 0.5)), j = i * 4;
    s.px[j] = s.px[j + 1] = s.px[j + 2] = 255; s.px[j + 3] = a * 255;
  }
  return saveWebp(s, `${OUT}/${name}.webp`, { quality: 20, alphaQuality: 55 });
}

/**
 * The outline of a 9-slice frame. Corners are arcs; edges carry a sine with a whole number of waves, so an edge tiled
 * end to end stays continuous. `c` is the corner slice, `e` the edge slice, `m` how far the line sits in from the outside.
 */
function framePath({ c, e, m, rc, amp, waves, seed }) {
  const S = c * 2 + e, r = rng(seed), pts = [];
  const ph = () => r() * 6.283;
  const edge = (x0, y0, x1, y1, nx, ny, k, p) => {
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, off = amp * Math.sin(p + k * 6.283 * t) - amp * Math.sin(p);
      pts.push([x0 + (x1 - x0) * t + nx * off, y0 + (y1 - y0) * t + ny * off]);
    }
  };
  const arc = (cx, cy, a0) => {
    for (let i = 1; i < 8; i++) { const a = a0 + (i / 8) * (Math.PI / 2); pts.push([cx + Math.cos(a) * rc, cy + Math.sin(a) * rc]); }
  };
  edge(c, m, c + e, m, 0, -1, waves, ph()); pts.push([c + e + (c - m - rc) * 0.5, m]); arc(S - m - rc, m + rc, -Math.PI / 2);
  pts.push([S - m, c - (c - m - rc) * 0.5]); edge(S - m, c, S - m, c + e, 1, 0, waves, ph()); pts.push([S - m, c + e + (c - m - rc) * 0.5]); arc(S - m - rc, S - m - rc, 0);
  pts.push([c + e + (c - m - rc) * 0.5, S - m]); edge(c + e, S - m, c, S - m, 0, 1, waves, ph()); pts.push([c - (c - m - rc) * 0.5, S - m]); arc(m + rc, S - m - rc, Math.PI / 2);
  pts.push([m, c + e + (c - m - rc) * 0.2]); edge(m, c + e, m, c, -1, 0, waves, ph()); pts.push([m, c - (c - m - rc) * 0.5]); arc(m + rc, m + rc, Math.PI);
  pts.push([(c + m + rc) * 0.5, m], [c, m]);
  return { S, pts: dense(pts, 3) };
}

async function frame(name, o) {
  const { c, e = 420, m = c * 0.24, rc = c * 0.42, amp = 1, waves = 2, color, r = 3, fill, press = 1.02, seed = 5, doubled = true } = o;
  const { S, pts } = framePath({ c, e, m, rc, amp, waves, seed });
  const s = new Sheet(null, S, S, 1);
  if (fill) {
    hatch(s, pts, { color: fill, r: 5, gap: 4, angle: -12, press: 1.12, over: 0, seed: seed + 1, crumbs: false, wob: 0.6, sample: 2 });
    hatch(s, pts, { color: fill, r: 5, gap: 4.4, angle: 8, press: 1.12, over: 0, seed: seed + 2, crumbs: false, wob: 0.6, sample: 2 });
  }
  draw(s, pts, { color, r, press, seed: seed + 3, crumbs: false });
  if (doubled) draw(s, pts, { color, r: r * 0.8, press: press * 0.92, seed: seed + 4, crumbs: false });
  return saveWebp(s, `${OUT}/${name}.webp`, { quality: 78, alphaQuality: 72 });
}

/** A crayon line that tiles left to right, for rules between rows. */
async function rule(name, color, r, w = 480) {
  const h = 12, s = new Sheet(null, w, h, 1), pts = [];
  for (let x = -6; x <= w + 6; x += 3) pts.push([x, h / 2 + 1.1 * Math.sin((x / w) * 6.283 * 3) + 0.5 * Math.sin((x / w) * 6.283 * 7)]);
  draw(s, pts, { color, r, press: 0.92, seed: 3, crumbs: false });
  return saveWebp(s, `${OUT}/${name}.webp`, { quality: 72, alphaQuality: 72 });
}

/** A scrawled underline, drawn once, for stretching under a heading. */
async function scrawl(name, color) {
  const w = 360, h = 22, s = new Sheet(null, w, h, 1);
  draw(s, wobble(spline([[5, 9], [120, 13], [240, 7], [354, 10], [250, 14], [130, 17], [60, 16]], false, 3), 0.8, 8), { color, r: 2.6, press: 1.04, seed: 8 });
  return saveWebp(s, `${OUT}/${name}.webp`, { quality: 76, alphaQuality: 76 });
}

/** The hand-drawn section marker: a little star, coloured in and outlined. It replaces the old square. */
async function star(name, fill, line) {
  const n = 48, s = new Sheet(null, n, n, 1), pts = [], cx = n / 2, cy = n / 2 + 1;
  for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.283 - Math.PI / 2, rr = i % 2 ? 9 : 20; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  pts.push(pts[0]);
  const line0 = dense(pts, 2);
  hatch(s, line0, { color: fill, r: 3.4, gap: 3, angle: -24, press: 1.1, over: 0.4, seed: 4, crumbs: false, wob: 0.4 });
  draw(s, wobble(line0, 0.5, 3), { color: line, r: 2, press: 1.02, seed: 6, crumbs: false });
  return saveWebp(s, `${OUT}/${name}.webp`, { quality: 84, alphaQuality: 90 });
}

/** A small scribbled dot, for list bullets. */
async function dot(name, color) {
  const n = 28, s = new Sheet(null, n, n, 1), p = spline(ell(n / 2, n / 2, 7, 7, 10), true, 2);
  hatch(s, p, { color, r: 3, gap: 2.6, angle: -30, press: 1.12, over: 0.5, seed: 2, crumbs: false, wob: 0.3 });
  return saveWebp(s, `${OUT}/${name}.webp`, { quality: 84, alphaQuality: 90 });
}

/** The torn bottom edge of a drawing: paper-coloured, ragged, and it tiles left to right. */
async function torn(name, base, w = 480, h = 16) {
  const s = new Sheet(null, w, h, 1), r = rng(17), b = hex(base);
  for (let x = 0; x < w; x++) {
    const t = (x / w) * 6.283, top = 7 + 2.2 * Math.sin(t * 3) + 1.5 * Math.sin(t * 8 + 1) + 1 * Math.sin(t * 19 + 2);
    for (let y = 0; y < h; y++) {
      const a = Math.max(0, Math.min(1, y - top + 0.5 + (r() - 0.5))), j = (y * w + x) * 4, v = (r() - 0.5) * 8;
      s.px[j] = b[0] + v; s.px[j + 1] = b[1] + v; s.px[j + 2] = b[2] + v * 0.8; s.px[j + 3] = a * 255;
    }
  }
  return saveWebp(s, `${OUT}/${name}.webp`, { quality: 84, alphaQuality: 90 });
}

const CRAYONS = { blue: '#1f5fd0', red: '#d8332a', green: '#23894a', yellow: '#f2b518', purple: '#6f3fb0', brown: '#8a4b22', orange: '#ef7b12', white: '#fffdf6' };
const solid = (s, poly, color, seed, o = {}) => {
  hatch(s, poly, { color, r: 4.5, gap: 3, angle: -8, press: 1.22, over: 0.4, seed, crumbs: false, wob: 0.5, ...o });
  hatch(s, poly, { color, r: 4, gap: 3.4, angle: 12, press: 1.18, over: 0, seed: seed + 1, crumbs: false, wob: 0.5, ...o });
};

/** A crayon on its side, tip to the left, with a cream paper wrapper for its label. */
async function crayonSide(name, hex, seed) {
  const s = new Sheet(null, 260, 68, 1);
  const tip = dense([[5, 34], [13, 27], [42, 7], [42, 61], [13, 41], [5, 34]], 3);
  const body = dense([[42, 6], [250, 6], [256, 13], [256, 55], [250, 62], [42, 62], [42, 6]], 3);
  const paper = dense([[50, 19], [242, 19], [242, 49], [50, 49], [50, 19]], 3);
  solid(s, tip, hex, seed);
  solid(s, body, hex, seed + 2);
  solid(s, paper, CREAM, seed + 4);
  for (const y of [19, 49]) draw(s, wobble(dense([[50, y], [242, y]], 3), 0.6, seed + y), { color: INK, r: 1.3, press: 1, seed: seed + y, crumbs: false });
  draw(s, wobble(tip, 0.6, seed + 6), { color: INK, r: 2.1, press: 1.06, seed: seed + 6, crumbs: false });
  draw(s, wobble(body, 0.7, seed + 7), { color: INK, r: 2.3, press: 1.06, seed: seed + 7, crumbs: false });
  return saveWebp(s, `${OUT}/crayon-${name}.webp`, { quality: 82, alphaQuality: 88 });
}

/** The same crayon standing up, for picking a colour in draw mode. */
async function crayonUp(name, hex, seed) {
  const s = new Sheet(null, 54, 92, 1);
  const tip = dense([[27, 4], [33, 11], [47, 32], [7, 32], [21, 11], [27, 4]], 3);
  const body = dense([[7, 32], [47, 32], [47, 83], [42, 88], [12, 88], [7, 83], [7, 32]], 3);
  solid(s, tip, hex, seed, { r: 3.6, gap: 2.6 });
  solid(s, body, hex, seed + 2, { r: 3.6, gap: 2.6 });
    draw(s, wobble(tip, 0.4, seed + 6), { color: INK, r: 1.9, press: 1.06, seed: seed + 6, crumbs: false });
  draw(s, wobble(body, 0.5, seed + 7), { color: INK, r: 2.1, press: 1.06, seed: seed + 7, crumbs: false });
  return saveWebp(s, `${OUT}/pick-${name}.webp`, { quality: 84, alphaQuality: 90 });
}

/** A rough navy slab of wax: the carton the crayons sit in, and the tab it folds into on small screens. */
async function slab(name, w, h, pts, seed) {
  const s = new Sheet(null, w, h, 1), edge = spline(pts, true, 3);
  solid(s, edge, INK, seed, { r: 5, gap: 3.2, angle: 84 });
  draw(s, wobble(edge, 0.7, seed + 2), { color: '#0d1433', r: 2.4, press: 1.08, seed: seed + 2, crumbs: false });
  return saveWebp(s, `${OUT}/${name}.webp`, { quality: 80, alphaQuality: 84 });
}

/** Three crayon tips poking out of the tab. */
async function tips(name) {
  const s = new Sheet(null, 36, 60, 1);
  [[RED, 4, 0], [GOLD, 22, 4], ['#23894a', 40, 0]].forEach(([col, y, dx], i) => {
    const t = dense([[3 + dx, y + 8], [13 + dx, y + 1], [33, y + 1], [33, y + 15], [13 + dx, y + 15], [3 + dx, y + 8]], 2);
    solid(s, t, col, 300 + i * 5, { r: 3, gap: 2.2 });
    draw(s, wobble(t, 0.3, 310 + i), { color: '#0d1433', r: 1.5, press: 1.06, seed: 310 + i, crumbs: false });
  });
  return saveWebp(s, `${OUT}/${name}.webp`, { quality: 84, alphaQuality: 90 });
}

let crayonSeed = 400;
for (const [name, hex] of Object.entries(CRAYONS)) { await crayonSide(name, hex, (crayonSeed += 20)); await crayonUp(name, hex, crayonSeed + 10); }
await slab('carton', 44, 400, [[10, 4], [40, 4], [40, 396], [8, 396], [12, 300], [5, 200], [12, 100]], 340);
await slab('tab', 48, 216, [[16, 4], [46, 3], [46, 213], [16, 212], [5, 200], [4, 108], [5, 16]], 350);
await tips('tips');

await torn('torn-paper', '#a9d3ef');
await paper('paper', '#a9d3ef');
await paper('paper-white', '#f6fbff');
await grain('grain', 0.9);
await frame('frame-ink', { c: 28, color: INK, r: 2.7, seed: 11 });
await frame('frame-hot', { c: 28, color: ORANGE, r: 3.2, seed: 12 });
await frame('chip-ink', { c: 14, e: 120, rc: 6, m: 5, r: 1.6, amp: 0.8, color: INK, seed: 13, waves: 2 });
await frame('btn-ink', { c: 18, e: 150, rc: 8, m: 6, r: 2.4, amp: 1.1, color: INK, fill: INK, seed: 14, waves: 2 });
await frame('btn-line', { c: 18, e: 150, rc: 8, m: 6, r: 2.4, amp: 1.1, color: INK, seed: 15, waves: 2 });
await frame('btn-gold', { c: 18, e: 150, rc: 8, m: 6, r: 2.4, amp: 1.1, color: INK, fill: GOLD, seed: 16, waves: 2 });
await rule('rule-ink', INK, 1.5);
await scrawl('scrawl-red', RED);
await star('mark-star', GOLD, '#a51d15');
await dot('dot-red', RED);
console.log('wrote public/wax');
