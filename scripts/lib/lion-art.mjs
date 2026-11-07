// The crayon lion and his wardrobe, every part drawn with the wax engine on the same 44 x 44 canvas the rig uses, so a hat lands
// on his head and a paw lands on what it holds. Each entry draws one layer; the rig stacks them and CSS flips between frames.
// Build-time only: the site loads the finished pictures, never this code.
import { dense, draw, ell, hatch, spline, wobble } from '../../src/lib/wax.js';

export const U = 8; // pixels per rig unit
export const M = 8; // room around the canvas, in units, for anything that pokes over the edge

const OUT = '#5b2c12', FUR = '#f5ab14', GOLD = '#fad13b', ORG = '#ef7b12', DEEP = '#c94f0f', RED = '#d8332a', NOSE = '#3a1d10', EYE = '#16224f', WHITE = '#fffdf6', PINK = '#ee7d97', CREAM = '#fff1c9';
const NAVY = '#16224f', COL = '#9fcdf0', COLD = '#6fa8d8', BLUE = '#1f5fd0', STEEL = '#b4bfd2', STEELD = '#7a8799', WOOD = '#b5692a', WOODL = '#d98f4a', WOODD = '#6a3d1c', LENS = '#ff8a3d', LENSL = '#ffd27a', SHADE = '#c9d4e8';

function kit(sh, start) {
  let n = start;
  const pt = ([x, y]) => [(x + M) * U, (y + M) * U];
  const sp = (pts, closed = true) => spline(pts.map(pt), closed, 3);
  const ln = (pts) => dense(pts.map(pt), 3);
  const oval = (cx, cy, rx, ry, rot = 0) => spline(ell((cx + M) * U, (cy + M) * U, rx * U, ry * U, 14, rot), true, 3);
  const tint = (poly, color, o = {}) => hatch(sh, poly, { color, r: 5, gap: 4.4, angle: -28, press: 1.1, over: 0.5, seed: ++n, crumbs: false, wob: 0.6, ...o });
  const base = (poly) => tint(poly, WHITE, { angle: 90, press: 1.02, over: 0, gap: 4.6 });
  const edge = (poly, color = OUT, r = 2.8, w = 0.7) => draw(sh, wobble(poly, w, ++n), { color, r, press: 1.06, seed: ++n, crumbs: false });
  const shape = (poly, color, o = {}) => { base(poly); tint(poly, color, o); if (o.line !== null) edge(poly, o.line ?? OUT, o.lr ?? 2.8); };
  const stroke = (line, color, r = 3, press = 1.06) => draw(sh, line, { color, r, press, seed: ++n, crumbs: false });
  /** A stubby limb from a to b with a paw on the end, as a closed outline so it can be coloured and inked. */
  const limb = (a, b, w, color, shade, paw = CREAM) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L, tx = dx / L, ty = dy / L;
    const p = sp([[a[0] + nx * w * 0.9, a[1] + ny * w * 0.9], [a[0] + dx * 0.55 + nx * w, a[1] + dy * 0.55 + ny * w], [b[0] + nx * w * 1.02, b[1] + ny * w * 1.02], [b[0] + tx * w, b[1] + ty * w], [b[0] - nx * w * 1.02, b[1] - ny * w * 1.02], [a[0] + dx * 0.55 - nx * w, a[1] + dy * 0.55 - ny * w], [a[0] - nx * w * 0.9, a[1] - ny * w * 0.9]]);
    shape(p, color);
    if (shade) stroke(ln([[a[0] + dx * 0.15 - nx * w * 0.5, a[1] + dy * 0.15 - ny * w * 0.5], [a[0] + dx * 0.75 - nx * w * 0.55, a[1] + dy * 0.75 - ny * w * 0.55]]), shade, 2.4, 0.9);
    if (paw) { const pv = oval(b[0] + tx * w * 0.25, b[1] + ty * w * 0.25, w * 0.95, w * 0.9, Math.atan2(dy, dx)); shape(pv, paw, { gap: 3.4 }); }
  };
  return { sh, pt, sp, ln, oval, tint, base, edge, shape, stroke, limb };
}

const mirror = (x) => 44 - x;

/* ---------- head ---------- */
const HEAD = { x: 22, y: 17, k: 0.8 };
function drawHeadAt(sh, cx, cy, k) {
  // The same order a person draws a lion's head in: mane first, ears, the face on top, then the small things.
  const px = (cx + M) * U, py = (cy + M) * U, P = (x, y) => [px + x * k, py + y * k];
  const cols = [ORG, ORG, DEEP, ORG, FUR, ORG, DEEP, ORG], N = 52, r0 = 54;
  let seed = 500;
  const ray = (a, L, curl) => spline([P(Math.cos(a) * r0, Math.sin(a) * r0), P((Math.cos(a + curl * 0.5) * (r0 + L)) / 1.6, (Math.sin(a + curl * 0.5) * (r0 + L)) / 1.6), P(Math.cos(a + curl) * L * 1.04, Math.sin(a + curl) * L * 1.04)], false, 3);
  for (let i = 0; i < N; i++) draw(sh, ray((i / N) * 6.283, 104 + 15 * Math.abs(Math.sin(i * 0.98)), i % 2 ? 0.09 : -0.09), { color: WHITE, r: 9 * k, press: 0.86, seed: seed + i, crumbs: false });
  for (let i = 0; i < N * 2; i++) draw(sh, wobble(ray((i / (N * 2)) * 6.283, 100 + 17 * Math.abs(Math.sin(i * 0.49)), i % 2 ? 0.1 : -0.1), 0.7, seed + i), { color: cols[i % cols.length], r: 7.4 * k, press: 1, seed: seed + 100 + i, crumbs: false });
  const rim = []; for (let i = 0; i <= 160; i++) { const a = (i / 160) * 6.283, rr = 120 + 13 * Math.abs(Math.sin(a * 6.5)); rim.push(P(Math.cos(a) * rr, Math.sin(a) * rr)); }
  draw(sh, wobble(rim, 1, seed + 400), { color: OUT, r: 3.3, press: 1.04, seed: seed + 401, crumbs: false });
  const tint = (poly, color, o) => hatch(sh, poly, { color, crumbs: false, wob: 0.6, ...o, seed: ++seed + 500 });
  const edge = (poly, r = 3) => draw(sh, wobble(poly, 0.7, ++seed + 700), { color: OUT, r, press: 1.04, seed: seed + 701, crumbs: false });
  const circle = (x, y, rx, ry) => spline(ell(P(x, y)[0], P(x, y)[1], rx * k, ry * k, 14), true, 3);
  for (const e of [-62, 62]) {
    const ear = circle(e, -56, 23, 23);
    tint(ear, WHITE, { r: 5 * k, gap: 5, press: 1, over: 0, angle: 90 });
    tint(ear, GOLD, { r: 5 * k, gap: 4.4, press: 1.04, over: 0, angle: 40 });
    tint(circle(e, -54, 11, 11), PINK, { r: 3.6 * k, gap: 3.4, press: 1.04, over: 0, angle: -40 });
    edge(ear);
  }
  const face = circle(0, 6, 76, 70);
  tint(face, WHITE, { r: 7 * k, gap: 6, press: 1.04, over: 0, angle: 90 });
  tint(face, GOLD, { r: 7 * k, gap: 5.4, press: 1.08, over: 0.8, angle: -32 });
  edge(face);
  for (const e of [-50, 50]) { const sc = []; for (let i = 0; i < 40; i++) { const t = (i / 40) * Math.PI * 7; sc.push(P(e + Math.cos(t) * (4 + i * 0.28), 28 + Math.sin(t) * (3 + i * 0.18))); } draw(sh, spline(sc, false, 2), { color: PINK, r: 2.6 * k, press: 0.86, seed: ++seed, crumbs: false }); }
  for (const e of [-20, 20]) { const mz = circle(e, 30, 25, 20); tint(mz, WHITE, { r: 5 * k, gap: 3.6, press: 1.1, over: 0, angle: 90 }); tint(mz, WHITE, { r: 5 * k, gap: 3.6, press: 1.1, over: 0, angle: 10 }); }
  for (const e of [-30, 30]) draw(sh, wobble(spline([P(e - 16, -16 + (e > 0 ? 2 : 0)), P(e, -22), P(e + 16, -16 + (e > 0 ? 0 : 2))], false, 3), 0.5, ++seed), { color: OUT, r: 3 * k, press: 1.04, seed: ++seed, crumbs: false });
  const nose = spline([P(-16, 10), P(16, 10), P(4, 26), P(-4, 26)], true, 2);
  tint(nose, NOSE, { r: 3 * k, gap: 2.2, press: 1.14, over: 0, angle: 0 });
  tint(nose, NOSE, { r: 3 * k, gap: 2.2, press: 1.14, over: 0, angle: 70 });
  for (const d of [-1, 1]) for (const off of [-7, 2, 11]) draw(sh, wobble(spline([P(d * 40, 30 + off * 0.6), P(d * 72, 26 + off * 1.4), P(d * 90, 22 + off * 2.2)], false, 3), 0.5, ++seed), { color: OUT, r: 1.7, press: 1.04, seed: ++seed, crumbs: false });
}

/* Eyes and mouths sit on the head's own coordinates, so any frame can swap in without redrawing the face. */
const EYE_Y = HEAD.y - 0.8, EYE_X = 3;
const eyePair = (f) => { f(HEAD.x - EYE_X, -1); f(HEAD.x + EYE_X, 1); };
const openEye = (t, x, y) => {
  t.tint(t.oval(x, y, 1.55, 1.8), WHITE, { r: 3.2, gap: 2.6, press: 1.14, over: 0, angle: 90 });
  const pu = t.oval(x + 0.1, y + 0.1, 1.05, 1.3);
  t.tint(pu, EYE, { r: 2.6, gap: 2, press: 1.16, over: 0, angle: 20 });
  t.tint(pu, EYE, { r: 2.6, gap: 2, press: 1.16, over: 0, angle: 100 });
  t.stroke(t.sp([[x + 0.34, y - 0.62], [x + 0.62, y - 0.62], [x + 0.62, y - 0.34], [x + 0.34, y - 0.34]]), WHITE, 1.6, 1.16);
};
const arc = (t, pts, r = 2.8, color = OUT) => t.stroke(wobble(t.sp(pts, false), 0.3, 3), color, r, 1.1);

const mouthSmile = (t, cy = HEAD.y) => { const c = HEAD.x; arc(t, [[c, cy + 2.6], [c, cy + 3.7]], 2.2); arc(t, [[c - 2.3, cy + 3.5], [c - 1.2, cy + 4.4], [c, cy + 3.7], [c + 1.2, cy + 4.4], [c + 2.3, cy + 3.5]], 2.4); };

/* ---------- body parts ---------- */
const armDown = (t, color = FUR, shade = ORG) => { t.limb([16.4, 29.4], [14.9, 35.2], 1.75, color, shade); t.limb([mirror(16.4), 29.4], [mirror(14.9), 35.2], 1.75, color, shade); };
const armUp = (t, color = FUR, shade = ORG) => { t.limb([16.4, 30.2], [9.6, 25], 1.75, color, shade); t.limb([mirror(16.4), 30.2], [mirror(9.6), 25], 1.75, color, shade); };
function leg(t, x, lift, dx = 0) {
  const fy = 42.9 - lift, fx = x + dx;
  t.shape(t.sp([[x - 2.6, 37.4], [x + 2.6, 37.4], [fx + 2.7, fy - 2], [fx + 2.7, fy - 0.8], [fx - 2.7, fy - 0.8], [fx - 2.7, fy - 2]]), FUR);
  t.shape(t.oval(fx, fy - 0.3, 3.2, 1.45), CREAM, { gap: 3.4 });
  for (const o of [-1.05, 1.05]) arc(t, [[fx + o, fy - 0.8], [fx + o, fy + 0.5]], 1.5);
}
const LEG_L = 17.8, LEG_R = 26.2;
function tail(t, tip) {
  const line = t.sp([[16.5, 37], [10.5, 37], [6.8, 33.8], [5.8, 30], tip[0]], false);
  t.stroke(line, OUT, 8.6, 1.1); t.stroke(line, FUR, 5.6, 1.12);
  const [tx, ty] = tip[1];
  for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.283 + 0.4, rr = 1.4 + (i % 3) * 0.55; t.stroke(wobble(t.sp([[tx, ty], [tx + Math.cos(a) * rr * 0.6, ty + Math.sin(a) * rr * 0.6], [tx + Math.cos(a + 0.3) * rr, ty + Math.sin(a + 0.3) * rr]], false), 0.5, i), i % 2 ? DEEP : ORG, 4.6, 1.06); }
}
const star = (t, x, y, k = 1) => { const p = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.283 - Math.PI / 2, r = (i % 2 ? 0.8 : 1.8) * k; p.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); } p.push(p[0]); const l = t.ln(p); t.tint(l, GOLD, { r: 3, gap: 2.4, over: 0.2, press: 1.14 }); t.edge(l, DEEP, 1.5, 0.3); };

/* ---------- laptop, phone and bed ---------- */
const pawPrint = (t, x, y, col) => { t.tint(t.oval(x, y + 0.7, 1.5, 1.2), col, { r: 2.2, gap: 1.8, over: 0, press: 1.14 }); for (const [dx, dy] of [[-1.7, -0.5], [-0.6, -1.5], [0.6, -1.5], [1.7, -0.5]]) t.tint(t.oval(x + dx, y + dy, 0.55, 0.6), col, { r: 1.6, gap: 1.2, over: 0, press: 1.16 }); };
const quad = (t, x, y, w, h, rr = 0.8) => t.sp([[x + rr, y], [x + w - rr, y], [x + w, y + rr], [x + w, y + h - rr], [x + w - rr, y + h], [x + rr, y + h], [x, y + h - rr], [x, y + rr]]);
const zed = (t, x, y, k, color) => t.stroke(wobble(t.ln([[x, y], [x + k, y], [x, y + k * 1.1], [x + k, y + k * 1.1]]), 0.5, x), color, 3.2, 1.12);

function bedTailArt(t, x, tipY) {
  const line = t.sp([[x, 23], [x + 0.3, 18], [x - 0.3, 14], [x, tipY]], false);
  t.stroke(line, OUT, 8.6, 1.1); t.stroke(line, FUR, 5.6, 1.12);
  for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.283, rr = 1.4 + (i % 3) * 0.55; t.stroke(wobble(t.sp([[x, tipY], [x + Math.cos(a) * rr * 0.6, tipY + Math.sin(a) * rr * 0.6], [x + Math.cos(a + 0.3) * rr, tipY + Math.sin(a + 0.3) * rr]], false), 0.5, i), i % 2 ? DEEP : ORG, 4.6, 1.06); }
}
function blanket(t, lift) {
  const y = 21 - lift;
  const cover = t.sp([[30, 33.4], [27.4, 28], [31, 24], [38, y + 0.6], [46, y], [53, y + 1.6], [58, 25.5], [59, 33.4]]);
  t.shape(cover, COL, { angle: -12 });
  t.stroke(t.sp([[29.4, 27], [38, 25.4 - lift * 0.5], [50, 25 - lift * 0.5], [58.5, 27]], false), GOLD, 4.6, 1.12);
  t.stroke(t.sp([[29.6, 30], [40, 29], [50, 29], [59, 30]], false), GOLD, 3, 1.1);
  t.shape(t.sp([[28, 33.2], [26.4, 27.4], [28.2, 23.6], [32, 24.6], [31.4, 33.2]]), WHITE, { line: OUT });
}
const hoodGeom = (t) => t.sp([[17.4, 27.2], [26.6, 27.2], [29.2, 32], [29.8, 36.4], [27.6, 39.2], [16.4, 39.2], [14.2, 36.4], [14.8, 32]]);

/** Every layer, by name. Item ids match the wardrobe's. */
export const PARTS = {
  'tail-rest': (t) => tail(t, [[6.6, 26.8], [6.6, 25.2]]),
  'tail-left': (t) => tail(t, [[4.8, 27.2], [4.4, 25.8]]),
  'tail-right': (t) => tail(t, [[8.4, 26.2], [8.8, 24.6]]),
  'legs-stand': (t) => { leg(t, LEG_L, 0); leg(t, LEG_R, 0); },
  'legs-a': (t) => { leg(t, LEG_L, 1.4, 0.6); leg(t, LEG_R, 0, -0.6); },
  'legs-b': (t) => { leg(t, LEG_L, 0, -0.6); leg(t, LEG_R, 1.4, 0.6); },
  'legs-dangle': (t) => { for (const x of [18.6, 25.4]) { t.shape(t.sp([[x - 1.8, 37.2], [x + 1.8, 37.2], [x + 1.7, 42.4], [x - 1.7, 42.4]]), FUR); t.shape(t.oval(x, 42.6, 2.1, 1.4), CREAM, { gap: 3.2 }); } },
  'legs-sit': (t) => { for (const x of [12.8, 31.2]) { t.shape(t.oval(x, 40.6, 3.5, 3.1), CREAM, { gap: 3.4 }); t.tint(t.oval(x, 41.4, 1.5, 1.05), PINK, { r: 2.2, gap: 1.8, over: 0, press: 1.14 }); for (const dx of [-1.5, 0, 1.5]) t.tint(t.oval(x + dx, 38.9 + Math.abs(dx) * 0.2, 0.55, 0.55), PINK, { r: 1.5, gap: 1.2, over: 0, press: 1.14 }); } },
  body: (t) => { const p = hoodGeom(t); t.base(p); t.tint(p, FUR, { r: 6, gap: 5, angle: -24 }); t.tint(p, ORG, { r: 3.4, gap: 16, angle: 16, press: 0.74, over: 0 }); t.tint(t.oval(22, 33.8, 5, 5), CREAM, { r: 4, gap: 3.6, angle: 12, over: 0, press: 1.08 }); t.edge(p); },
  'arms-down': (t) => armDown(t),
  'arms-up': (t) => armUp(t),
  'arm-left': (t) => t.limb([16.4, 29.4], [14.9, 35.2], 1.75, FUR, ORG),
  'wave-a': (t) => t.limb([27.6, 30], [33.4, 23.2], 1.75, FUR, ORG),
  'wave-b': (t) => t.limb([27.6, 30], [31.2, 22.4], 1.75, FUR, ORG),
  head: (t) => drawHeadAt(t.sh, HEAD.x, HEAD.y, HEAD.k),
  'eyes-open': (t) => eyePair((x) => openEye(t, x, EYE_Y)),
  'eyes-blink': (t) => eyePair((x) => arc(t, [[x - 1.6, EYE_Y], [x, EYE_Y + 0.9], [x + 1.6, EYE_Y]], 2.8)),
  'eyes-sleep': (t) => eyePair((x) => arc(t, [[x - 1.7, EYE_Y - 0.1], [x, EYE_Y + 1], [x + 1.7, EYE_Y - 0.1]], 2.8)),
  'eyes-down': (t) => eyePair((x) => { openEye(t, x, EYE_Y + 0.5); arc(t, [[x - 1.8, EYE_Y - 0.3], [x, EYE_Y - 0.65], [x + 1.8, EYE_Y - 0.3]], 2.7); }),
  'eyes-dizzy': (t) => eyePair((x) => { const s = []; for (let i = 0; i < 26; i++) { const a = (i / 26) * 13; s.push([x + Math.cos(a) * (0.1 + i * 0.062), EYE_Y + Math.sin(a) * (0.1 + i * 0.062)]); } t.stroke(t.sp(s, false), EYE, 1.9, 1.14); }),
  'eyes-squint': (t) => { arc(t, [[HEAD.x - 4.6, EYE_Y - 1], [HEAD.x - 2.2, EYE_Y], [HEAD.x - 4.6, EYE_Y + 1]], 2.8); arc(t, [[HEAD.x + 4.6, EYE_Y - 1], [HEAD.x + 2.2, EYE_Y], [HEAD.x + 4.6, EYE_Y + 1]], 2.8); },
  'mouth-smile': (t) => mouthSmile(t),
  'mouth-open': (t) => { const m = t.oval(HEAD.x, HEAD.y + 4.3, 2, 1.8); t.tint(m, RED, { r: 3, gap: 2.4, over: 0, press: 1.14 }); t.tint(t.oval(HEAD.x, HEAD.y + 5, 1.1, 0.8), PINK, { r: 2, gap: 1.6, over: 0, press: 1.14 }); t.edge(m, OUT, 2.5, 0.4); },
  'mouth-wobble': (t) => arc(t, [[HEAD.x - 2.6, HEAD.y + 4], [HEAD.x - 1.4, HEAD.y + 3.5], [HEAD.x - 0.4, HEAD.y + 4.2], [HEAD.x + 0.6, HEAD.y + 3.5], [HEAD.x + 1.6, HEAD.y + 4.2], [HEAD.x + 2.6, HEAD.y + 3.6]], 2.4),
  stars: (t) => { star(t, 14.5, 2.4); star(t, 22, 1.2); star(t, 29.5, 2.4); },

  /* hats */
  columbia: (t) => {
    t.shape(t.sp([[15, 10.2], [15.4, 5.6], [18.2, 2.6], [22, 1.8], [25.8, 2.6], [28.6, 5.6], [29, 10.2]]), COL, { line: NAVY, angle: -18 });
    t.stroke(t.sp([[22, 2], [20.4, 5.4], [20, 10]], false), COLD, 2, 1);
    t.stroke(t.sp([[22, 2], [23.6, 5.4], [24, 10]], false), COLD, 2, 1);
    star(t, 22, 6.4, 1.05);
    t.shape(t.sp([[14.2, 10], [29.8, 10], [32.4, 11.4], [29.8, 12.8], [14.2, 12.2]]), COLD, { line: NAVY, angle: 2 });
  },
  snow: (t) => {
    t.shape(t.sp([[15.4, 9.4], [15.8, 6], [18.4, 3.6], [22, 3], [25.6, 3.6], [28.2, 6], [28.6, 9.4]]), BLUE, { line: NAVY });
    for (const x of [17.6, 20.8, 24, 27]) t.stroke(t.sp([[x, 4.6], [x - 0.2, 7], [x, 9.2]], false), COL, 1.8, 1);
    t.shape(quad(t, 14.2, 8.6, 15.6, 3.2, 1.2), WHITE, { line: NAVY, angle: 86 });
    t.shape(t.oval(22, 2.4, 2.5, 2.2), WHITE, { line: NAVY, gap: 3 });
  },
  grad: (t) => {
    t.shape(t.sp([[15.4, 7.4], [28.6, 7.4], [28.8, 11.4], [22, 12.6], [15.2, 11.4]]), NAVY, { line: NOSE, angle: 8, gap: 3.4 });
    t.shape(dense([[9.4, 6.6], [22.2, 2.2], [35.6, 6.8], [22.2, 11], [9.4, 6.6]].map(t.pt), 3), '#26366e', { line: NOSE, gap: 3.4, angle: -10 });
    t.stroke(t.sp([[22.2, 6.4], [28, 7], [32.4, 7.6], [32.6, 12.6]], false), GOLD, 2.6, 1.12);
    t.tint(t.oval(32.6, 13.6, 0.9, 1.4), GOLD, { r: 2.2, gap: 1.8, over: 0.2, press: 1.14 });
  },

  /* tops, and the sleeves that follow his arms */
  scarf: (t) => {
    t.shape(t.sp([[24.4, 31], [28.6, 31], [29.2, 37.6], [24.8, 37.8]]), COLD, { line: NAVY, angle: 80 });
    t.stroke(t.ln([[24.6, 33.2], [29, 33]]), GOLD, 3, 1.12); t.stroke(t.ln([[24.8, 35.6], [29.1, 35.4]]), GOLD, 3, 1.12);
    for (const x of [25.2, 26.7, 28.2]) t.stroke(t.ln([[x, 37.8], [x, 39.2]]), NAVY, 1.5, 1);
    t.shape(t.sp([[15, 28.6], [18, 27], [26, 27], [29.2, 28.6], [29.4, 31.2], [26, 32.4], [18, 32.4], [14.8, 31.2]]), COLD, { line: NAVY, angle: 4 });
    t.stroke(t.sp([[15.2, 29.8], [22, 30.8], [29.2, 29.8]], false), GOLD, 3, 1.12);
  },
  labcoat: (t) => {
    t.shape(hoodGeom(t), WHITE, { line: NAVY, angle: 80 });
    t.stroke(t.ln([[22, 30], [22, 39]]), SHADE, 2, 1);
    t.shape(dense([[19, 27.2], [22, 30.6], [25, 27.2], [19, 27.2]].map(t.pt), 3), FUR, { line: NAVY, gap: 3 });
    t.edge(t.sp([[18.4, 27.4], [21.6, 31.4], [20, 33]], false), NAVY, 1.9, 0.3);
    t.edge(t.sp([[25.6, 27.4], [22.4, 31.4], [24, 33]], false), NAVY, 1.9, 0.3);
    t.shape(quad(t, 24.2, 34, 3.2, 3, 0.4), COL, { line: NAVY, gap: 2.8, lr: 1.9 });
  },
  'labcoat-sl-down': (t) => armDown(t, WHITE, SHADE),
  'labcoat-sl-up': (t) => armUp(t, WHITE, SHADE),
  tie: (t) => {
    t.shape(t.sp([[17.6, 27.8], [22, 29.8], [26.4, 27.8], [26.6, 29.2], [22.2, 31.2], [21.8, 31.2], [17.4, 29.2]]), WHITE, { line: NAVY, gap: 3 });
    t.shape(t.sp([[20.6, 30.4], [23.4, 30.4], [23, 31.8], [24.2, 37], [22, 39], [19.8, 37], [21, 31.8]]), '#26366e', { line: NOSE, gap: 2.8, angle: 80 });
    t.stroke(t.ln([[21, 33.4], [23.2, 33]]), GOLD, 2.2, 1.14); t.stroke(t.ln([[20.8, 35.4], [23.4, 35]]), GOLD, 2.2, 1.14);
  },
  hoodie: (t) => {
    t.shape(hoodGeom(t), COL, { line: NAVY, angle: -30 });
    t.shape(t.sp([[17.2, 27.6], [26.8, 27.6], [26.2, 30.2], [22, 31.4], [17.8, 30.2]]), COLD, { line: NAVY, gap: 3.4 });
    for (const x of [20.6, 23.4]) { t.stroke(t.sp([[x, 30.6], [x + 0.2, 32.4], [x, 33.8]], false), WHITE, 1.9, 1.14); }
    t.shape(t.sp([[17.8, 34.6], [26.2, 34.6], [27.6, 38.4], [16.4, 38.4]]), COLD, { line: NAVY, gap: 3.2, lr: 2.2 });
  },
  'hoodie-sl-down': (t) => armDown(t, COL, COLD),
  'hoodie-sl-up': (t) => armUp(t, COL, COLD),

  /* on the face */
  glasses: (t) => { for (const x of [HEAD.x - EYE_X, HEAD.x + EYE_X]) t.stroke(t.oval(x, EYE_Y, 2.4, 2.4), NAVY, 2.2, 1.14); t.stroke(t.sp([[HEAD.x - 0.7, EYE_Y - 0.3], [HEAD.x, EYE_Y - 0.8], [HEAD.x + 0.7, EYE_Y - 0.3]], false), NAVY, 2, 1.14); t.stroke(t.ln([[HEAD.x - 5.4, EYE_Y - 0.4], [HEAD.x - 7.4, EYE_Y - 1]]), NAVY, 1.8, 1.1); t.stroke(t.ln([[HEAD.x + 5.4, EYE_Y - 0.4], [HEAD.x + 7.4, EYE_Y - 1]]), NAVY, 1.8, 1.1); },
  phones: (t) => {
    const band = t.sp([[8.8, 14], [10, 8.4], [15, 4.4], [22, 3], [29, 4.4], [34, 8.4], [35.2, 14]], false);
    t.stroke(band, NAVY, 5.4, 1.12); t.stroke(band, COLD, 3.4, 1.14);
    for (const x of [7.8, 36.2]) { t.shape(quad(t, x - 2, 12.6, 4, 8.4, 1.4), BLUE, { line: NAVY, gap: 3 }); t.stroke(t.ln([[x, 14.4], [x, 19]]), COL, 2.2, 1.1); }
  },
  goggles: (t) => {
    for (const [x0, x1] of [[9.6, 15], [29, 34.4]]) t.stroke(t.ln([[x0, 16.2], [x1, 16.2]]), NAVY, 5.2, 1.14);
    const frameP = quad(t, 14.2, 12.8, 15.6, 6.8, 2.2);
    t.shape(frameP, WHITE, { line: NAVY, gap: 3 });
    const lens = quad(t, 15.2, 13.7, 13.6, 5, 1.6);
    t.tint(lens, LENS, { r: 3.4, gap: 2.8, over: 0, press: 1.14 });
    t.tint(t.sp([[17, 14.2], [20, 14.2], [18, 18.2], [15.8, 18.2]]), LENSL, { r: 2.2, gap: 2.4, over: 0, press: 1.1 });
    t.stroke(t.ln([[24, 18.2], [26.6, 14.2]]), WHITE, 2, 1.14);
  },

  /* held items, and the paw that closes round them */
  grip: (t) => t.shape(t.oval(28.8, 35.6, 1.9, 1.5), CREAM, { gap: 3 }),
  cup: (t) => {
    for (const x of [33, 35.4]) t.stroke(wobble(t.sp([[x, 26.2], [x + 0.6, 25], [x - 0.3, 24], [x + 0.4, 22.8]], false), 0.4, x), STEEL, 2, 0.96);
    t.shape(t.sp([[31, 28.4], [37.4, 28.4], [36.6, 35], [31.8, 35]]), WHITE, { line: NAVY, gap: 3 });
    t.tint(t.sp([[31.3, 30.4], [37.1, 30.4], [36.8, 33], [31.6, 33]]), COLD, { r: 2.8, gap: 2.2, over: 0, press: 1.12 });
    t.shape(quad(t, 30.4, 27, 7.6, 1.7, 0.6), SHADE, { line: NAVY, gap: 2.6, lr: 2 });
  },
  phone: (t) => {
    t.shape(quad(t, 29.2, 25, 6.6, 11, 1), NAVY, { line: NOSE, gap: 2.6 });
    t.tint(quad(t, 30.2, 26.2, 4.6, 8.4, 0.4), COL, { r: 2.8, gap: 2.2, over: 0, press: 1.14 });
    t.stroke(t.ln([[30.9, 27.8], [33, 27.8]]), WHITE, 1.7, 1.14); t.stroke(t.ln([[30.9, 29.8], [34.1, 29.8]]), WHITE, 1.7, 1.14); t.stroke(t.ln([[30.9, 31.8], [32.8, 31.8]]), WHITE, 1.7, 1.14);
  },
  guitar: (t) => {
    t.shape(quad(t, 35.3, 13.6, 1.6, 9, 0.2), WOODD, { line: NOSE, gap: 2.2, lr: 1.8 });
    t.shape(t.sp([[34.6, 10.8], [37.4, 10.8], [37.4, 13.8], [34.6, 13.8]]), WOODL, { line: NOSE, gap: 2.4, lr: 1.8 });
    t.shape(t.sp([[33.4, 22.2], [38.8, 22.2], [39.6, 24.4], [38.4, 26], [40.6, 28.8], [39.4, 32], [36, 33], [32.6, 32], [31.4, 28.8], [33.6, 26], [32.6, 24.4]]), WOOD, { line: NOSE, angle: 70 });
    t.tint(t.oval(36, 27.2, 1.5, 1.5), NOSE, { r: 2.4, gap: 1.8, over: 0, press: 1.14 });
    t.stroke(t.ln([[34.2, 30.4], [37.8, 30.4]]), WOODD, 2.4, 1.1);
  },
  foil: (t) => {
    t.stroke(wobble(t.ln([[41.4, 6], [35.2, 25]]), 0.3, 4), STEEL, 2.6, 1.14);
    t.stroke(wobble(t.ln([[41.4, 6], [35.2, 25]]), 0.3, 5), NAVY, 1, 1);
    t.shape(t.sp([[31.6, 26.2], [34, 24.8], [37.4, 25], [38.6, 26.4], [36.6, 28], [33, 28]]), STEEL, { line: NAVY, gap: 2.6, lr: 2 });
    t.shape(t.sp([[33.2, 28], [34.8, 28.2], [33, 33.6], [31.4, 33.2]]), WOODD, { line: NOSE, gap: 2.4, lr: 1.8 });
  },

  /* the crayon he carries when he walks a drawn line: same paw as a held item, tip down at the line */
  ...Object.fromEntries(Object.entries({ blue: '#1f5fd0', red: '#d8332a', green: '#23894a', yellow: '#f2b518', purple: '#6f3fb0', brown: '#8a4b22', orange: '#ef7b12', white: '#fffdf6' }).map(([name, hex]) => [`crayon-${name}`, (t) => {
    const stick = t.sp([[30.1, 27.4], [31.9, 27.8], [30.3, 38.6], [28.5, 38.2]]);
    t.shape(stick, hex, { line: NOSE, gap: 2.6, lr: 1.8, angle: 76 });
    t.stroke(t.ln([[29.8, 29.4], [31.5, 29.7]]), NOSE, 1.4, 0.96);
    const tip = t.sp([[28.5, 38.2], [30.3, 38.6], [29.1, 42.4], [28.8, 42.3]]);
    t.shape(tip, hex, { line: NOSE, gap: 2.2, lr: 1.6, angle: 76 });
  }])),

  /* laptop pose */
  lid: (t) => { const l = quad(t, 12, 31, 20, 11, 1); t.shape(l, STEEL, { line: NAVY, angle: -20 }); t.stroke(t.ln([[13, 32], [31, 32]]), WHITE, 2.2, 1.1); pawPrint(t, 22, 36.4, COLD); t.tint(t.oval(29, 35.4, 1, 1), GOLD, { r: 2, gap: 1.6, over: 0, press: 1.14 }); },
  deck: (t) => t.shape(quad(t, 9, 41.8, 26, 1.9, 0.7), SHADE, { line: NAVY, gap: 2.6, lr: 2.2 }),
  'typing-l': (t) => t.shape(t.oval(17.2, 30.2, 2.7, 1.7), CREAM, { gap: 3 }),
  'typing-r': (t) => t.shape(t.oval(26.8, 30.2, 2.7, 1.7), CREAM, { gap: 3 }),
  glow: (t) => t.tint(quad(t, 13, 30.2, 18, 1.2, 0.3), COL, { r: 2.4, gap: 2, over: 0, press: 1.12 }),

  /* phone pose */
  'phone-back': (t) => { const b = quad(t, 18, 28, 8, 11, 1); t.shape(b, COL, { line: NAVY, gap: 3.4 }); t.tint(quad(t, 19.2, 29.2, 2, 2, 0.5), NAVY, { r: 2, gap: 1.6, over: 0, press: 1.14 }); star(t, 22, 34, 1.05); },
  'hold-l': (t) => t.limb([15.6, 30.4], [18.2, 34.4], 1.7, FUR, ORG),
  'hold-r': (t) => t.limb([mirror(15.6), 30.4], [mirror(18.2), 34.4], 1.7, FUR, ORG),
  ping: (t) => { const b = t.sp([[34.6, 9], [40.8, 8.2], [42.6, 10], [42.2, 13], [37.4, 13.6], [35.4, 15.8], [35.6, 13.4], [33.8, 12]]); t.shape(b, GOLD, { line: NOSE, gap: 3, lr: 2.2 }); t.stroke(wobble(t.ln([[36, 11], [37.6, 12.4], [40.6, 9.6]]), 0.3, 3), WHITE, 2.6, 1.16); },

  /* bed pose, on a 64 x 40 canvas */
  'bed-frame': (t) => {
    t.shape(quad(t, 1, 8, 4, 28, 1.6), WOOD, { line: NOSE, angle: 86 });
    t.shape(quad(t, 58.6, 20, 3.4, 16, 1.2), WOOD, { line: NOSE, angle: 86 });
    t.shape(quad(t, 3, 33, 57, 3.4, 0.6), WOODL, { line: NOSE, angle: 2 });
  },
  pillow: (t) => { const p = t.sp([[5.6, 23.6], [8, 21.6], [28, 21.6], [31.4, 23.8], [31.4, 30.4], [28, 32], [8, 32], [5.4, 30.2]]); t.shape(p, WHITE, { line: NAVY, angle: 6 }); t.stroke(t.sp([[8, 30.2], [18, 30.8], [29, 30]], false), SHADE, 2.2, 1); },
  'sleep-head': (t) => { drawHeadAt(t.sh, 16, 21, HEAD.k); for (const x of [13, 19]) { const y = 20.2; arc(t, [[x - 1.7, y - 0.1], [x, y + 1], [x + 1.7, y - 0.1]], 2.8); } arc(t, [[15.2, 25], [16, 25.5], [16.8, 25]], 2.3); },
  'bed-tail-a': (t) => bedTailArt(t, 51.4, 10.4),
  'bed-tail-b': (t) => bedTailArt(t, 52.8, 11.4),
  'blanket-a': (t) => blanket(t, 0),
  'blanket-b': (t) => blanket(t, 1.2),
  z1: (t) => zed(t, 30, 15, 2.6, COLD),
  z2: (t) => zed(t, 35, 8, 3.4, COL),
  z3: (t) => zed(t, 41, 1.4, 4.4, WHITE),

  /* the site's icon: one big, bold head that still reads at tab size */
  'icon-head': (t) => {
    const cx = 22, cy = 22, sq = (x, y, rx, ry) => t.oval(x, y, rx, ry);
    for (let i = 0; i < 40; i++) { const a = (i / 40) * 6.283, L = 19 + 2.5 * Math.abs(Math.sin(i * 1.3)); t.stroke(wobble(t.ln([[cx + Math.cos(a) * 10, cy + Math.sin(a) * 10], [cx + Math.cos(a) * L, cy + Math.sin(a) * L]]), 0.8, i), i % 3 === 0 ? DEEP : ORG, 12, 1.1); }
    const face = sq(cx, cy + 1, 12.4, 11.6); t.base(face); t.tint(face, GOLD, { r: 9, gap: 7, press: 1.14 }); t.edge(face, OUT, 5);
    for (const x of [cx - 5, cx + 5]) t.tint(sq(x, cy - 1, 2.2, 2.6), EYE, { r: 5, gap: 3.6, over: 0, press: 1.18 });
    t.tint(t.sp([[cx - 3, cy + 3.4], [cx + 3, cy + 3.4], [cx + 0.8, cy + 6.4], [cx - 0.8, cy + 6.4]]), NOSE, { r: 4.6, gap: 3, over: 0, press: 1.18 });
    t.stroke(t.sp([[cx - 4.4, cy + 7.2], [cx - 2, cy + 8.8], [cx, cy + 7.4], [cx + 2, cy + 8.8], [cx + 4.4, cy + 7.2]], false), OUT, 4.6, 1.14);
  },
};

/** Bed parts draw on a wider canvas than the rest; the sheet just needs to be big enough. */
export const canvasFor = (key) => (key.startsWith('bed-') || ['pillow', 'sleep-head', 'blanket-a', 'blanket-b', 'z1', 'z2', 'z3'].includes(key) ? { w: 64, h: 40 } : { w: 44, h: 44 });

export function drawPart(sh, key, seedBase) { PARTS[key](kit(sh, seedBase)); }
