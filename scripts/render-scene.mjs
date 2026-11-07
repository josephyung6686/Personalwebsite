// Draws the hero in crayon with the wax engine: the campus (Low Library's dome and columns, the brick hall, trees, lamp posts,
// the skyline), the sky, clouds, moon, stars, sun and the name, in day, sunset and night versions. No external images.
// Run: npm run scene
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { Sheet, draw, dense, ell, hatch, rng, spline, wobble, write as writeWord, wordWidth } from '../src/lib/wax.js';
import { saveWebp } from './lib/wax-out.mjs';

const W = 1600, H = 560; // the scene's drawing box, the same 320:112 shape as the old art
export const STATES = ['day', 'sunset', 'night'];
const INK = '#16224f';
const PAL = {
  day: { ink: INK, far: '#7fa9d3', farLit: '#e8f4fc', brick: '#c0502f', brickD: '#8e3420', roof: '#2f7a70', roofD: '#1f5a54', stone: '#fffdf6', shade: '#c9d8ea', dome: '#2d6f86', domeL: '#5fa3b5', tree: '#2f9e4f', treeD: '#1d7a3b', treeL: '#7cc95f', trunk: '#6b3d1c', tall: '#8c6d57', win: '#cfe9f8', lit: '#fbe58a', road: '#9aa3b8', walk: '#d6dce6', hedge: '#23894a', hedgeD: '#176b37', lamp: INK, statue: '#2a3a68' },
  sunset: { ink: INK, far: '#9a78b0', farLit: '#ffd98a', brick: '#c9552c', brickD: '#96351f', roof: '#3f6d60', roofD: '#2a5147', stone: '#ffe8cf', shade: '#eab893', dome: '#40768a', domeL: '#e7a06e', tree: '#4a8f43', treeD: '#2a6d38', treeL: '#c9a93f', trunk: '#5e3319', tall: '#7a5468', win: '#ffd98a', lit: '#fad13b', road: '#a08ca2', walk: '#d9bfae', hedge: '#2f7a3f', hedgeD: '#1e5a30', lamp: INK, statue: '#2a2f58' },
  night: { ink: '#0d1433', far: '#3a5596', farLit: '#fad13b', brick: '#7a3b3b', brickD: '#572a30', roof: '#245560', roofD: '#173e48', stone: '#b9c7e6', shade: '#7f90bf', dome: '#34628f', domeL: '#6d8fc0', tree: '#22694f', treeD: '#134a3b', treeL: '#3a8a68', trunk: '#3b2a2a', tall: '#2f3f70', win: '#31457f', lit: '#fad13b', road: '#55618e', walk: '#7a86ad', hedge: '#1c5c46', hedgeD: '#123f33', lamp: '#0d1433', statue: '#0d1433' },
};

function painter(sh, pal) {
  const fill = (pts, color, o = {}) => hatch(sh, pts, { color, r: 5.5, gap: 5.4, angle: -14, press: 1.04, over: 1, seed: Math.round(pts[0][0] * 7 + pts[0][1] * 3) + 1, crumbs: false, wob: 0.7, ...o });
  const ink = (pts, seed = 1, o = {}) => draw(sh, wobble(pts, o.w ?? 0.9, seed), { color: o.color ?? pal.ink, r: o.r ?? 2.3, press: 1.03, seed, crumbs: false });
  const rect = (x, y, w, h) => dense([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], 4);
  const box = (x, y, w, h, color, seed, o = {}) => { const p = rect(x, y, w, h); fill(p, color, { seed, ...o }); ink(p, seed + 1, o); };
  return { fill, ink, rect, box };
}

function skyline(sh, pal) {
  const { fill, rect } = painter(sh, pal), r = rng(21);
  [[370, 92, 330], [462, 70, 285], [532, 104, 352], [636, 62, 305], [698, 80, 360], [1236, 62, 235], [1298, 72, 300]].forEach(([x, w, top], n) => {
    fill(rect(x, top, w, 490 - top), pal.far, { r: 6, gap: 7, seed: 400 + n, angle: 78 });
    for (let wy = top + 16; wy < 470; wy += 26) for (let wx = x + 10; wx < x + w - 10; wx += 16) {
      if (r() < 0.46) draw(sh, dense([[wx, wy], [wx, wy + 9]], 3), { color: pal.farLit, r: 2.6, press: 1.05, seed: wx + wy, crumbs: false });
    }
  });
}

function library(sh, pal) {
  const { fill, ink, rect, box } = painter(sh, pal), cx = 1000;
  // dome, ribs and a highlight down one side
  const dome = spline([[cx - 150, 150], [cx - 138, 96], [cx - 96, 40], [cx - 38, 14], [cx + 38, 14], [cx + 96, 40], [cx + 138, 96], [cx + 150, 150]], false, 3);
  dome.push(dome[0]);
  fill(dome, pal.dome, { r: 6.5, gap: 6, angle: 72, seed: 31 });
  fill(dome, pal.dome, { r: 6, gap: 7, angle: 58, seed: 33 });
  fill(spline([[cx - 118, 146], [cx - 104, 92], [cx - 66, 48], [cx - 44, 62], [cx - 74, 104], [cx - 84, 146]], true, 3), pal.domeL, { r: 4, gap: 8, angle: 68, press: 0.9, seed: 34 });
  [-92, -46, 0, 46, 92].forEach((o, n) => ink(spline([[cx + o * 0.22, 15], [cx + o * 0.74, 60], [cx + o, 150]], false, 3), 35 + n, { r: 1.6 }));
  ink(dome, 40, { r: 2.6 });
  // drum, with its row of small windows
  box(cx - 138, 146, 276, 60, pal.stone, 41);
  for (let i = 0; i < 6; i++) box(cx - 112 + i * 40, 160, 22, 32, pal.shade, 42 + i * 2, { r: 3, gap: 3.4, w: 0.5 });
  // the long entablature
  box(cx - 236, 206, 472, 22, pal.stone, 56);
  box(cx - 246, 226, 492, 30, pal.stone, 58);
  ink(dense([[cx - 240, 244], [cx + 240, 244]], 4), 60, { r: 1.4 });
  // back wall in shadow, then the columns standing in front of it
  fill(rect(cx - 236, 256, 472, 168), pal.shade, { r: 6, gap: 6, angle: 84, seed: 61 });
  fill(rect(cx - 236, 256, 472, 168), pal.shade, { r: 6, gap: 8, angle: 12, seed: 62 });
  for (let i = 0; i < 10; i++) {
    const x = cx - 226 + i * 47.4, p = rect(x, 258, 24, 165);
    fill(p, pal.stone, { r: 4, gap: 3.6, angle: 86, seed: 63 + i, over: 0.4 });
    ink(dense([[x, 258], [x, 423]], 4), 80 + i, { r: 1.9, w: 0.5 });
    ink(dense([[x + 24, 258], [x + 24, 423]], 4), 90 + i, { r: 1.9, w: 0.5 });
    ink(dense([[x - 4, 258], [x + 28, 258]], 3), 100 + i, { r: 1.7, w: 0.3 });
    ink(dense([[x - 4, 423], [x + 28, 423]], 3), 110 + i, { r: 1.7, w: 0.3 });
  }
  // the wide steps
  [[-250, 423, 500, 22], [-276, 445, 552, 22], [-302, 467, 604, 24]].forEach(([dx, y, w, h], n) => box(cx + dx, y, w, h, pal.stone, 120 + n * 2));
  // a seated statue on the steps, a simple shape and nothing more
  const st = spline([[cx - 16, 448], [cx - 22, 410], [cx - 12, 392], [cx - 8, 372], [cx + 6, 370], [cx + 10, 392], [cx + 26, 404], [cx + 28, 448]], true, 3);
  fill(st, pal.statue, { r: 3.4, gap: 3, angle: 40, press: 1.1, seed: 130 });
  fill(st, pal.statue, { r: 3.4, gap: 3, angle: -30, press: 1.1, seed: 131 });
  box(cx - 34, 448, 68, 18, pal.statue, 132, { r: 3, gap: 3 });
}

function window4(sh, pal, x, y, w, h, on, seed) {
  const { fill, ink, rect } = painter(sh, pal), p = rect(x, y, w, h);
  fill(p, on ? pal.lit : pal.win, { r: 3.4, gap: 3.2, angle: -30, press: 1.1, seed, over: 0.4 });
  ink(p, seed + 1, { r: 2, w: 0.5 });
  ink(dense([[x + w / 2, y], [x + w / 2, y + h]], 3), seed + 2, { r: 1.5, w: 0.3 });
  ink(dense([[x, y + h * 0.42], [x + w, y + h * 0.42]], 3), seed + 3, { r: 1.5, w: 0.3 });
}

function hall(sh, pal) {
  const { fill, ink, rect } = painter(sh, pal);
  // the spire behind the roof
  const spire = dense([[300, 110], [322, 28], [344, 110], [300, 110]], 3);
  fill(spire, pal.roofD, { r: 3.6, gap: 3.4, angle: 80, seed: 200 });
  ink(spire, 201, { r: 2 });
  // brick walls, with mortar rows scratched across
  const wall = rect(-12, 176, 382, 330);
  fill(wall, pal.brick, { r: 6.5, gap: 5.6, angle: -6, seed: 202, over: 0 });
  fill(wall, pal.brickD, { r: 3.4, gap: 19, angle: 2, press: 0.8, seed: 204, over: 0 });
  ink(dense([[370, 176], [370, 506]], 4), 205);
  // mansard roof and two dormers
  const roof = dense([[-12, 176], [28, 102], [340, 102], [382, 176], [-12, 176]], 4);
  fill(roof, pal.roof, { r: 6, gap: 5.6, angle: 76, seed: 206 });
  fill(roof, pal.roofD, { r: 3.6, gap: 22, angle: 4, press: 0.8, seed: 207 });
  ink(roof, 208);
  [62, 210].forEach((x, n) => {
    const d = rect(x, 118, 48, 40);
    fill(d, pal.stone, { r: 3.6, gap: 3.4, seed: 210 + n });
    ink(d, 212 + n, { r: 2 });
    window4(sh, pal, x + 12, 126, 24, 28, n === 1, 214 + n * 5);
    ink(dense([[x - 7, 118], [x + 24, 104], [x + 55, 118]], 3), 224 + n, { r: 2.3 });
  });
  // the stone band under the roof, and between the floors
  [[176, 18], [306, 12]].forEach(([y, h], n) => { const b = rect(-12, y, 382, h); fill(b, pal.shade, { r: 3.6, gap: 3.4, angle: 0, seed: 226 + n, over: 0 }); ink(b, 228 + n, { r: 1.8 }); });
  // two rows of tall windows, some lit
  const lit = [[1, 0, 1, 1, 0], [1, 1, 0, 1, 1]];
  [214, 338].forEach((y, row) => [14, 86, 158, 230, 300].forEach((x, i) => window4(sh, pal, x, y, 50, 74, !!lit[row][i], 240 + row * 40 + i * 6)));
}

function eastTower(sh, pal) {
  const { fill, ink, rect, box } = painter(sh, pal), r = rng(5);
  const t = rect(1350, 174, 262, 330);
  fill(t, pal.tall, { r: 6.5, gap: 6, angle: 82, seed: 300, over: 0 });
  ink(t, 301);
  for (let y = 192; y < 470; y += 40) for (let x = 1368; x < 1590; x += 44) {
    const seed = Math.round(300 + x + y), w = rect(x, y, 22, 26);
    fill(w, r() < 0.62 ? pal.lit : pal.win, { r: 3.4, gap: 3.2, angle: -30, press: 1.1, seed, over: 0.4 });
    ink(w, seed + 1, { r: 1.5, w: 0.4 });
  }
  // water tower on the roof
  [[1436, 174, 1450, 132], [1496, 174, 1482, 132]].forEach(([a, b, c, d], n) => ink(dense([[a, b], [c, d]], 3), 310 + n, { r: 2.6 }));
  box(1438, 92, 56, 42, pal.trunk, 312, { r: 4, gap: 4, angle: 88 });
  const cap = dense([[1432, 92], [1466, 64], [1500, 92], [1432, 92]], 3);
  fill(cap, pal.roofD, { r: 3.4, gap: 3.2, seed: 314 });
  ink(cap, 315, { r: 2.2 });
}

function tree(sh, pal, x, y, rx, ry, trunkX, seed) {
  const { fill, ink } = painter(sh, pal), r = rng(seed);
  const trunk = spline([[trunkX - 11, 498], [trunkX - 8, y + ry * 0.5], [trunkX - 22, y + ry * 0.1], [trunkX, y + ry * 0.4], [trunkX + 22, y + ry * 0.05], [trunkX + 8, y + ry * 0.5], [trunkX + 11, 498]], true, 3);
  fill(trunk, pal.trunk, { r: 4, gap: 4, angle: 86, seed: seed + 1 });
  ink(trunk, seed + 2, { r: 2.1 });
  // A bumpy crown: coloured in dark, then lighter clumps on top, then outlined along the same bumps, so the line always fits.
  const edge = [];
  for (let i = 0; i < 36; i++) { const a = (i / 36) * 6.283, k = 0.9 + 0.13 * Math.abs(Math.sin(a * 4.5 + seed)); edge.push([x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k]); }
  const crown = spline(edge, true, 3);
  fill(crown, pal.treeD, { r: 7, gap: 6, angle: -34, seed: seed + 3 });
  fill(crown, pal.treeD, { r: 6, gap: 8, angle: 28, seed: seed + 4 });
  const n = Math.round((rx * ry) / 1300);
  for (let i = 0; i < n; i++) {
    const a = r() * 6.283, d = Math.sqrt(r()) * 0.72, bx = x + Math.cos(a) * rx * d, by = y + Math.sin(a) * ry * d, brx = rx * (0.16 + r() * 0.12), bry = ry * (0.14 + r() * 0.1);
    fill(spline(ell(bx, by, brx, bry, 10), true, 3), by < y + ry * 0.18 ? pal.tree : pal.treeD, { r: 5, gap: 6, angle: -40 + i * 17, seed: seed + 10 + i, press: 0.98 });
    if (i % 3 === 0 && by < y + ry * 0.1) fill(spline(ell(bx - brx * 0.2, by - bry * 0.3, brx * 0.5, bry * 0.42, 9), true, 3), pal.treeL, { r: 3.4, gap: 6, angle: -20, press: 0.92, seed: seed + 120 + i });
  }
  ink(crown, seed + 200, { r: 2.3, w: 1.2 });
}

function lamp(sh, pal, x, seed) {
  const { fill, ink, rect } = painter(sh, pal);
  const post = rect(x - 5, 300, 10, 200);
  fill(post, pal.lamp, { r: 3, gap: 2.8, angle: 88, press: 1.12, seed, over: 0.3 });
  fill(rect(x - 13, 482, 26, 18), pal.lamp, { r: 3, gap: 2.8, press: 1.12, seed: seed + 1, over: 0.3 });
  fill(rect(x - 8, 336, 16, 8), pal.lamp, { r: 2.4, gap: 2.4, press: 1.12, seed: seed + 2, over: 0.3 });
  fill(rect(x - 16, 290, 32, 12), pal.lamp, { r: 2.6, gap: 2.4, press: 1.12, seed: seed + 3, over: 0.3 });
  const globe = spline(ell(x, 262, 26, 30, 12), true, 3);
  fill(globe, pal.stone, { r: 4, gap: 3.6, press: 1.1, seed: seed + 4 });
  fill(spline(ell(x, 262, 15, 18, 10), true, 3), pal.lit, { r: 3.6, gap: 3.2, press: 1.08, seed: seed + 5 });
  ink(globe, seed + 6, { r: 2.2 });
}

function ground(sh, pal) {
  const { fill, rect, ink } = painter(sh, pal);
  // pavement, then the road, both running off the bottom of the sheet
  fill(rect(-20, 496, W + 40, 18), pal.walk, { r: 6, gap: 6, angle: 1, seed: 500, over: 0, sample: 4 });
  fill(rect(-20, 512, W + 40, 44), pal.road, { r: 7.5, gap: 7, angle: 1, seed: 502, over: 0, sample: 4, join: 5 });
  ink(dense([[-10, 496], [W + 10, 494]], 4), 504, { r: 1.8, w: 1.2 });
  // the hedge: dark scribble, then blades drawn upward, as far as the campus runs
  const hedge = (x0, x1) => {
    fill(rect(x0, 468, x1 - x0, 28), pal.hedgeD, { r: 5, gap: 5, angle: 4, seed: 510 + x0, over: 0, sample: 3 });
    const r = rng(x0 + 3);
    for (let x = x0; x < x1; x += 7) {
      const top = 448 + r() * 16, lean = (r() - 0.5) * 10;
      draw(sh, dense([[x, 494], [x + lean, top]], 3), { color: r() < 0.5 ? pal.hedge : pal.treeL, r: 3, press: 1.03, seed: x, crumbs: false });
    }
  };
  hedge(372, 690); hedge(1300, W + 10);
}

export function drawScene(sh, state) {
  const pal = PAL[state];
  skyline(sh, pal);
  library(sh, pal);
  tree(sh, pal, 836, 288, 70, 68, 822, 610); // the small tree beside the steps, behind the lamp
  eastTower(sh, pal);
  hall(sh, pal);
  ground(sh, pal);
  tree(sh, pal, 556, 240, 158, 124, 560, 640);
  tree(sh, pal, 1526, 202, 118, 132, 1558, 680);
  lamp(sh, pal, 756, 700);
  lamp(sh, pal, 1264, 720);
}

function emissive(sh) {
  // Lamp glow, for the dark: a wide soft halo of pale wax, and a pool of light on the pavement.
  [756, 1264].forEach((x, n) => {
    for (const [rr, op] of [[62, 0.28], [44, 0.34]]) hatch(sh, spline(ell(x, 262, rr, rr, 14), true, 3), { color: '#ffe9a0', r: 5, gap: 9, angle: 30 + n * 40, press: 0.76, op, over: 0, seed: 800 + rr + n, crumbs: false, wob: 0.8 });
    hatch(sh, spline(ell(x, 508, 74, 11, 14), true, 3), { color: '#ffe9a0', r: 4, gap: 5, angle: 1, press: 0.92, op: 0.75, over: 1, seed: 820 + n, crumbs: false });
  });
}

function sky(sh, state) {
  const w = sh.w, h = sh.h, all = dense([[-30, -30], [w + 30, -30], [w + 30, h + 30], [-30, h + 30], [-30, -30]], 8);
  const band = (y0, y1, color, seed, o = {}) => hatch(sh, dense([[-30, y0], [w + 30, y0], [w + 30, y1], [-30, y1], [-30, y0]], 8), { color, r: 13, gap: 15, angle: -2, press: 0.88, over: 0, seed, sample: 5, crumbs: false, wob: 2.4, join: 5, ...o });
  if (state === 'night') {
    hatch(sh, all, { color: '#16224f', r: 15, gap: 8.5, angle: -17, press: 1.14, over: 0, seed: 900, sample: 5, crumbs: false, wob: 1.8, join: 5 });
    hatch(sh, all, { color: '#22377a', r: 9, gap: 30, angle: 10, press: 0.84, over: 0, seed: 902, sample: 5, crumbs: false, wob: 2.2, join: 5 });
  } else if (state === 'sunset') {
    band(h * 0.72, h, '#f7a35c', 910);
    band(h * 0.52, h * 0.78, '#f48a6a', 911);
    band(h * 0.3, h * 0.58, '#e88fb0', 912, { press: 0.8 });
    band(h * 0.1, h * 0.36, '#c9a7dc', 913, { press: 0.66, gap: 20 });
  } else {
    band(h * 0.56, h, '#fffdf6', 920, { press: 0.62, gap: 26, op: 0.55 });
    band(0, h * 0.26, '#7fb2dc', 921, { press: 0.6, gap: 24, op: 0.6 });
  }
}

const CLOUD_COL = { day: '#fffdf6', sunset: '#ffdcc0', night: '#3b5091' };
function clouds(sh, state) {
  const puff = (cx, cy, k, seed) => [[-58, 10, 46, 26], [-6, -8, 62, 38], [54, 8, 48, 26], [14, 14, 56, 22]].forEach(([dx, dy, rx, ry], n) => hatch(sh, spline(ell(cx + dx * k, cy + dy * k, rx * k, ry * k, 12), true, 4), { color: CLOUD_COL[state], r: 6.5, gap: 6.5, press: state === 'night' ? 0.82 : 0.98, over: 2, angle: -8 + n * 5, seed: seed + n, crumbs: false }));
  const { w, h } = sh;
  puff(w * 0.62, h * 0.07, 0.95, 950);
  puff(w * 0.86, h * 0.46, 1.15, 960);
}

function moon(sh) {
  // A crescent, coloured in hard.
  const c = sh.w / 2, R = c * 0.62, r2 = R * 0.84, ix = c + R * 0.46, iy = c - R * 0.08, out = [];
  for (let i = 0; i <= 80; i++) { const f = -Math.PI + (i / 80) * 6.283, x = c - Math.cos(f) * R, y = c + Math.sin(f) * R; if (Math.hypot(x - ix, y - iy) > r2) out.push([x, y]); }
  for (let i = 80; i >= 0; i--) { const f = -Math.PI + (i / 80) * 6.283, x = ix - Math.cos(f) * r2, y = iy + Math.sin(f) * r2; if (Math.hypot(x - c, y - c) < R) out.push([x, y]); }
  const line = dense([...out, out[0]], 3);
  hatch(sh, line, { color: '#fff3b8', r: 5, gap: 3.4, angle: -32, press: 1.16, over: 0.6, seed: 982, crumbs: false });
  hatch(sh, line, { color: '#fffdf6', r: 4, gap: 4, angle: 24, press: 1.1, over: 0, seed: 983, crumbs: false });
}

function stars(sh, seed) {
  const r = rng(seed);
  for (let i = 0; i < 9; i++) {
    const x = 14 + r() * (sh.w - 28), y = 14 + r() * (sh.h - 28), k = 2.5 + r() * 5, col = r() < 0.3 ? '#fad13b' : '#fffdf6', lean = (r() - 0.5) * 2;
    if (r() < 0.35) { draw(sh, dense([[x, y], [x + 1.5, y + 1]], 1), { color: col, r: 2.3, press: 1.14, seed: seed + i, crumbs: false }); continue; }
    [[[x - k, y + lean], [x + k, y - lean]], [[x - lean, y - k], [x + lean, y + k]]].forEach((l, n) => draw(sh, dense(l, 2), { color: col, r: 1.7, press: 1.12, seed: seed + i * 2 + n, crumbs: false }));
  }
}

function sun(sh) {
  const c = sh.w / 2, r = c * 0.5;
  hatch(sh, spline(ell(c, c, r, r, 14), true, 4), { color: '#fbc61d', r: 7, gap: 8, press: 1.05, over: 2, seed: 990 });
  hatch(sh, spline(ell(c, c, r * 0.9, r * 0.9, 14), true, 4), { color: '#fad13b', r: 6, gap: 11, angle: 40, press: 1, over: 0, seed: 991 });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * 6.283, r0 = r * 1.24, r1 = r * (1.56 + (i % 2) * 0.34);
    draw(sh, wobble(dense([[c + Math.cos(a) * r0, c + Math.sin(a) * r0], [c + Math.cos(a) * r1, c + Math.sin(a) * r1]], 3), 0.6, i), { color: i % 2 ? '#ef7b12' : '#fbc61d', r: 4.4, press: 1, seed: i + 992 });
  }
}

const NAME_SIZE = 124, NAME_PAD = 18;
function name(col) {
  const widest = wordWidth('JOSEPH', NAME_SIZE), w = Math.ceil(widest + NAME_PAD * 2), h = Math.ceil(NAME_SIZE * 2.24 + NAME_PAD * 2);
  const sh = new Sheet(null, w, h, 1);
  writeWord(sh, 'JOSEPH', NAME_PAD, NAME_PAD, NAME_SIZE, col, { seed: 2, r: 13 });
  writeWord(sh, 'YUNG', NAME_PAD, NAME_PAD + NAME_SIZE * 1.24, NAME_SIZE, col, { seed: 5, r: 13 });
  return sh;
}

export async function renderAll(outDir) {
  mkdirSync(outDir, { recursive: true });
  const files = [], out = (f) => join(outDir, f);
  const save = async (sh, f, o) => { files.push(await saveWebp(sh, out(f), o)); };
  for (const state of STATES) {
    const big = new Sheet(null, W, H, 1); drawScene(big, state); await save(big, `scene-${state}.webp`, { quality: 60, alphaQuality: 70 });
    const small = new Sheet(null, W, H, 0.5); drawScene(small, state); await save(small, `scene-${state}-sm.webp`, { quality: 58, alphaQuality: 70 });
    const s = new Sheet(null, 1000, 625, 1); sky(s, state); await save(s, `sky-${state}.webp`, { quality: 52, alphaQuality: 60 });
    const c = new Sheet(null, 1000, 625, 1); clouds(c, state); await save(c, `clouds-${state}.webp`, { quality: 58, alphaQuality: 60 });
  }
  const glow = new Sheet(null, W, H, 1); emissive(glow); await save(glow, 'emissive.webp', { quality: 55, alphaQuality: 60 });
  const m = new Sheet(null, 240, 240, 1); moon(m); await save(m, 'moon.webp', { quality: 76, alphaQuality: 80 });
  const su = new Sheet(null, 320, 320, 1); sun(su); await save(su, 'sun.webp', { quality: 76, alphaQuality: 80 });
  for (const [i, seed] of [[1, 31], [2, 47], [3, 73]]) { const st = new Sheet(null, 620, 300, 1); stars(st, seed); await save(st, `stars-${i}.webp`, { quality: 70, alphaQuality: 70 }); }
  await save(name('#16224f'), 'name-navy.webp', { quality: 74, alphaQuality: 80 });
  await save(name('#fffdf6'), 'name-cream.webp', { quality: 74, alphaQuality: 80 });
  return files;
}

/** 1200 x 630: sky, clouds and campus, for checking a state at share-image size. */
export async function renderOg(outPath, heroDir = 'public/hero', state = 'night') {
  const WW = 1200, HH = 630, sceneH = Math.round((WW * H) / W);
  const sky1 = await sharp(join(heroDir, `sky-${state}.webp`)).resize(WW, HH, { fit: 'fill' }).toBuffer();
  const cl = await sharp(join(heroDir, `clouds-${state}.webp`)).resize(WW, HH, { fit: 'cover', position: 'bottom' }).toBuffer();
  const sc = await sharp(join(heroDir, `scene-${state}.webp`)).resize(WW, sceneH).toBuffer();
  await sharp({ create: { width: WW, height: HH, channels: 4, background: state === 'night' ? '#22376f' : '#a9d3ef' } })
    .composite([{ input: sky1 }, { input: cl }, { input: sc, top: HH - sceneH, left: 0 }]).png().toFile(outPath);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const files = await renderAll('public/hero');
  console.log(`wrote ${files.length} files`);
}
