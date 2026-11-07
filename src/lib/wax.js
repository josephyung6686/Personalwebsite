/* Wax: a small crayon engine. A stroke deposits pigment where pressure beats the paper's tooth,
   so the skips, streaks and rough edges come from the same physics as the real thing.
   It paints into a plain RGBA array, so it runs in the browser (for the draw mode) and in Node (for every build-time image).
   Pass null as the canvas to paint without one. */
export function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
var TB = 9, TS = 1 << TB, TM = TS - 1, tooth = null;

function boxBlur(src, rx, ry) {
  var out = new Float32Array(src.length), tmp = new Float32Array(src.length), i, x, y, s, n;
  for (y = 0; y < TS; y++) { s = 0; n = 2 * rx + 1;
    for (i = -rx; i <= rx; i++) s += src[((i & TM)) + (y << TB)];
    for (x = 0; x < TS; x++) { tmp[x + (y << TB)] = s / n; s += src[((x + rx + 1) & TM) + (y << TB)] - src[((x - rx) & TM) + (y << TB)]; } }
  for (x = 0; x < TS; x++) { s = 0; n = 2 * ry + 1;
    for (i = -ry; i <= ry; i++) s += tmp[x + ((i & TM) << TB)];
    for (y = 0; y < TS; y++) { out[x + (y << TB)] = s / n; s += tmp[x + (((y + ry + 1) & TM) << TB)] - tmp[x + (((y - ry) & TM) << TB)]; } }
  return out;
}
function norm(a) { var m = 0, v = 0, i; for (i = 0; i < a.length; i++) m += a[i]; m /= a.length; for (i = 0; i < a.length; i++) v += (a[i] - m) * (a[i] - m); v = Math.sqrt(v / a.length); for (i = 0; i < a.length; i++) a[i] = (a[i] - m) / v; return a; }

function buildTooth(s) {
  if (tooth) return;
  var r = rng(4217), n = TS * TS, i, w = new Float32Array(n), w2 = new Float32Array(n), w3 = new Float32Array(n);
  for (i = 0; i < n; i++) { w[i] = r(); w2[i] = r(); w3[i] = r(); }
  var fine = norm(boxBlur(w, Math.round(s), Math.round(s)));
  var mid = norm(boxBlur(boxBlur(w2, Math.round(2 * s), Math.round(2 * s)), Math.round(2 * s), Math.round(2 * s)));
  var fibre = norm(boxBlur(w3, Math.round(7 * s), Math.max(1, Math.round(s * .6))));
  tooth = new Float32Array(n);
  for (i = 0; i < n; i++) { var v = .62 * fine[i] + .55 * mid[i] + .28 * fibre[i]; tooth[i] = 1 / (1 + Math.exp(-2.2 * v)); }
}
/** The paper's tooth, for making textures that match the strokes. Wraps every TOOTH_SIZE pixels. */
export function toothMap(s) { buildTooth(s || 1); return tooth; }
export var TOOTH_SIZE = TS;

export function Sheet(canvas, w, h, s) {
  this.c = canvas; this.s = s = s || 1; this.w = w; this.h = h;
  this.W = Math.ceil(w * s); this.H = Math.ceil(h * s);
  if (canvas) { canvas.width = this.W; canvas.height = this.H; this.ctx = canvas.getContext('2d'); this.img = this.ctx.createImageData(this.W, this.H); this.px = this.img.data; }
  else { this.ctx = null; this.img = null; this.px = new Uint8ClampedArray(this.W * this.H * 4); }
  this.mask = new Float32Array(this.W * this.H); this.sid = new Uint32Array(this.W * this.H);
  this.cur = 0; this.dirty = null; buildTooth(s);
}
Sheet.prototype.mark = function (x0, y0, x1, y1) { var d = this.dirty; if (!d) this.dirty = [x0, y0, x1, y1]; else { if (x0 < d[0]) d[0] = x0; if (y0 < d[1]) d[1] = y0; if (x1 > d[2]) d[2] = x1; if (y1 > d[3]) d[3] = y1; } };
Sheet.prototype.flush = function () { var d = this.dirty; if (!d) return; if (this.ctx) this.ctx.putImageData(this.img, 0, 0, d[0], d[1], d[2] - d[0] + 1, d[3] - d[1] + 1); this.dirty = null; };
Sheet.prototype.clear = function () { this.px.fill(0); if (this.ctx) this.ctx.clearRect(0, 0, this.W, this.H); this.dirty = null; };

Sheet.prototype.stamp = function (cx, cy, r, press, nx, ny, streak, col, op) {
  var W = this.W, H = this.H, px = this.px, mask = this.mask, sid = this.sid, cur = this.cur, t = tooth;
  var x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r)), y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
  if (x0 > x1 || y0 > y1) return; var r2 = r * r, sl = streak.length, soft = 0.13;
  for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
    var dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy; if (d2 > r2) continue;
    var d = d2 / r2, u = (dx * nx + dy * ny) / r, k = ((u + 1) * .5 * (sl - 1)) | 0; if (k < 0) k = 0; else if (k >= sl) k = sl - 1;
    var v = press * (1 - d * d * .85) * streak[k], tv = t[(x & TM) + ((y & TM) << TB)];
    var c = (v - tv) / soft + .5; if (c <= 0) continue; if (c > 1) c = 1; c *= op;
    var i = y * W + x, m = sid[i] === cur ? mask[i] : 0; if (c <= m) continue;
    var a = c - m; mask[i] = c; sid[i] = cur;
    var j = i * 4, da = px[j + 3] / 255, ka = da * (1 - a), na = a + ka;
    px[j] = (col[0] * a + px[j] * ka) / na; px[j + 1] = (col[1] * a + px[j + 1] * ka) / na; px[j + 2] = (col[2] * a + px[j + 2] * ka) / na; px[j + 3] = na * 255;
  }
  this.mark(x0, y0, x1, y1);
};

export function hex(c) { if (typeof c !== 'string') return c; var n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }

/* A live stroke: feed it points, it lays pigment as it goes. */
export function Stroke(wax, o) {
  this.wax = wax; o = o || {}; var r = this.rand = rng(o.seed == null ? (Math.random() * 1e9) | 0 : o.seed);
  this.col = hex(o.color || '#1b2a5b'); this.r = (o.r || 6) * wax.s; this.press = o.press == null ? .82 : o.press; this.op = o.op == null ? .96 : o.op;
  this.crumbs = o.crumbs !== false; this.lx = null; this.ly = null; this.left = 0; this.dist = 0; this.ph = r() * 100;
  var st = new Float32Array(26), i, prev = 1; for (i = 0; i < st.length; i++) { prev = prev * .55 + (.82 + r() * .42) * .45; st[i] = prev; } this.st = st;
  wax.cur++;
}
Stroke.prototype.to = function (x, y) {
  var w = this.wax, s = w.s; x *= s; y *= s;
  if (this.lx === null) { this.lx = x; this.ly = y; return this; }
  var dx = x - this.lx, dy = y - this.ly, L = Math.sqrt(dx * dx + dy * dy); if (L < .01) return this;
  var ux = dx / L, uy = dy / L, step = Math.max(1, this.r * .28), at = this.left;
  while (at <= L) {
    var px = this.lx + ux * at, py = this.ly + uy * at; this.dist += step;
    var ramp = Math.min(1, .86 + this.dist / (this.r * 7));
    var p = this.press * ramp * (.88 + .12 * Math.sin(this.ph + this.dist * .021 / s) + .05 * Math.sin(this.ph * 2 + this.dist * .09 / s));
    w.stamp(px, py, this.r * (.94 + .06 * Math.sin(this.ph + this.dist * .05 / s)), p, -uy, ux, this.st, this.col, this.op);
    if (this.crumbs && this.rand() < .012) w.stamp(px + (this.rand() - .5) * this.r * 3.4, py + (this.rand() - .5) * this.r * 3.4, Math.max(1, s * (.7 + this.rand() * .9)), .95, 0, 1, this.st, this.col, this.op * .9);
    at += step;
  }
  this.left = at - L; this.lx = x; this.ly = y; return this;
};

/* Catmull-Rom through points, returned as a dense polyline. */
export function spline(p, closed, step) {
  step = step || 3; var out = [], n = p.length, i, t;
  function g(k) { return closed ? p[(k + n) % n] : p[Math.max(0, Math.min(n - 1, k))]; }
  var segs = closed ? n : n - 1;
  for (i = 0; i < segs; i++) {
    var a = g(i - 1), b = g(i), c = g(i + 1), d = g(i + 2), L = Math.hypot(c[0] - b[0], c[1] - b[1]), m = Math.max(2, Math.ceil(L / step));
    for (t = 0; t < m; t++) { var u = t / m, u2 = u * u, u3 = u2 * u;
      out.push([.5 * (2 * b[0] + (c[0] - a[0]) * u + (2 * a[0] - 5 * b[0] + 4 * c[0] - d[0]) * u2 + (3 * b[0] - a[0] - 3 * c[0] + d[0]) * u3),
                .5 * (2 * b[1] + (c[1] - a[1]) * u + (2 * a[1] - 5 * b[1] + 4 * c[1] - d[1]) * u2 + (3 * b[1] - a[1] - 3 * c[1] + d[1]) * u3)]); }
  }
  if (closed) out.push(out[0].slice()); else out.push(p[n - 1].slice());
  return out;
}
/* The hand shakes a little: offset along the path with two slow sine waves. */
export function wobble(line, amp, seed) {
  if (!amp) return line; var r = rng(seed || 7), a = r() * 9, b = r() * 9, c = r() * 9, f1 = .018 + r() * .012, f2 = .055 + r() * .03, d = 0, out = [], i;
  for (i = 0; i < line.length; i++) {
    var q = line[Math.min(i + 1, line.length - 1)], p = line[i], o = line[Math.max(i - 1, 0)], tx = q[0] - o[0], ty = q[1] - o[1], l = Math.hypot(tx, ty) || 1;
    if (i) d += Math.hypot(p[0] - o[0], p[1] - o[1]) / 2;
    var k = amp * (Math.sin(a + d * f1) * .75 + Math.sin(b + d * f2) * .35); var k2 = amp * .4 * Math.sin(c + d * f1 * 1.6);
    out.push([p[0] - ty / l * k + tx / l * k2, p[1] + tx / l * k]);
  }
  return out;
}
export function draw(wax, line, o) { var st = new Stroke(wax, o), i; for (i = 0; i < line.length; i++) st.to(line[i][0], line[i][1]); return st; }

/* Colouring-in: back-and-forth strokes across a shape, running slightly over the edges like a real hand does. */
export function hatchLines(inside, bbox, o) {
  var ang = (o.angle == null ? -28 : o.angle) * Math.PI / 180, cs = Math.cos(ang), sn = Math.sin(ang), gap = o.gap || 7, over = o.over == null ? 2 : o.over, r = rng(o.seed || 11);
  var cx = (bbox[0] + bbox[2]) / 2, cy = (bbox[1] + bbox[3]) / 2, R = Math.hypot(bbox[2] - bbox[0], bbox[3] - bbox[1]) / 2 + 2, sample = o.sample || 2, runs = [], v, u, flip = false;
  for (v = -R; v <= R; v += gap * (.8 + r() * .4)) {
    var row = [], on = false, st = 0;
    for (u = -R; u <= R; u += sample) { var x = cx + u * cs - v * sn, y = cy + u * sn + v * cs, inn = inside(x, y);
      if (inn && !on) { on = true; st = u; } else if (!inn && on) { on = false; if (u - st > 1.5) row.push([st, u]); } }
    if (on) row.push([st, R]);
    if (flip) row.reverse();
    for (var k = 0; k < row.length; k++) { var a = row[k][0] - over * r(), b = row[k][1] + over * r(); if (flip) { var tt = a; a = b; b = tt; }
      var vj = v + (r() - .5) * gap * .25;
      runs.push([[cx + a * cs - vj * sn, cy + a * sn + vj * cs], [cx + b * cs - (vj + gap * .2) * sn, cy + b * sn + (vj + gap * .2) * cs]]); }
    flip = !flip;
  }
  /* join neighbouring runs with the pen down when they are close, otherwise lift */
  var lines = [], cur = null;
  runs.forEach(function (s) { if (cur) { var e = cur[cur.length - 1]; if (Math.hypot(e[0] - s[0][0], e[1] - s[0][1]) < gap * (o.join || 3)) { cur.push(s[0], s[1]); return; } lines.push(cur); } cur = [s[0], s[1]]; });
  if (cur) lines.push(cur);
  return lines;
}
export function poly(all) { /* point-in-polygon test, on a thinned copy of a dense closed polyline */
  var pts = all.length > 150 ? all.filter(function (_, i) { return i % 3 === 0; }) : all, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; pts.forEach(function (p) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; });
  return { bbox: [x0, y0, x1, y1], inside: function (x, y) { var c = false, n = pts.length, i, j; for (i = 0, j = n - 1; i < n; j = i++) { var a = pts[i], b = pts[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; } };
}
export function dense(line, step) { var out = [], i; for (i = 0; i < line.length - 1; i++) { var a = line[i], b = line[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / step)); for (var k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); } out.push(line[line.length - 1]); return out; }
export function hatch(wax, pts, o) { var P = poly(pts), L = hatchLines(P.inside, P.bbox, o), i; for (i = 0; i < L.length; i++) draw(wax, wobble(dense(L[i], 4), o.wob == null ? .8 : o.wob, (o.seed || 1) + i), { color: o.color, r: o.r || 6, press: o.press == null ? .8 : o.press, seed: (o.seed || 1) + i * 3, crumbs: o.crumbs, op: o.op }); }
export function ell(cx, cy, rx, ry, n, rot) { var o = [], i; n = n || 18; rot = rot || 0; var c = Math.cos(rot), s = Math.sin(rot); for (i = 0; i < n; i++) { var a = i / n * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry; o.push([cx + x * c - y * s, cy + x * s + y * c]); } return o; }

/* Block capitals as pen strokes in a unit box. [points, curved?]; curved strokes go through a spline. */
const G = {
  A: [[[[.08, 1], [.5, 0], [.92, 1]]], [[[.24, .62], [.76, .62]]]], E: [[[[.85, 0], [.13, 0], [.13, 1], [.88, 1]]], [[[.13, .5], [.72, .5]]]],
  G: [[[[.9, .18], [.64, 0], [.3, .03], [.08, .36], [.08, .64], [.3, .97], [.66, 1], [.92, .8], [.92, .56], [.56, .56]], 1]],
  H: [[[[.12, 0], [.12, 1]]], [[[.88, 0], [.88, 1]]], [[[.12, .5], [.88, .5]]]], J: [[[[.34, 0], [.98, 0]]], [[[.74, 0], [.74, .7], [.58, .96], [.3, .98], [.08, .76]], 1]],
  N: [[[[.12, 1], [.12, 0], [.88, 1], [.88, 0]]]], O: [[[[.5, 0], [.14, .14], [.04, .5], [.14, .86], [.5, 1], [.86, .86], [.96, .5], [.86, .14], [.5, 0], [.2, .08]], 1]],
  P: [[[[.14, 1], [.14, 0]]], [[[.14, 0], [.62, .01], [.88, .25], [.62, .5], [.14, .52]], 1]], S: [[[[.88, .17], [.62, 0], [.3, .02], [.12, .22], [.3, .44], [.7, .56], [.9, .78], [.7, .98], [.32, 1], [.08, .82]], 1]],
  U: [[[[.1, 0], [.1, .68], [.3, .98], [.7, .98], [.9, .68], [.9, 0]], 1]], Y: [[[[.08, 0], [.5, .5]]], [[[.92, 0], [.5, .5], [.5, 1]]]],
};
const ADV = { J: .92 };
export function wordWidth(t, size, ls = .1) { let x = 0; for (const ch of t) x += (ADV[ch] || .94) * size * .86 + size * ls; return x - size * ls; }
/** Writes a word in wax, two passes of the pen per letter. Only the letters in JOSEPH YUNG are drawn. */
export function write(sheet, text, x, y, size, col, o = {}) {
  const r = rng(text.length * 31 + (o.seed || 3)), pen = o.r || size * .1, ls = o.ls == null ? .1 : o.ls, sw = size * .86;
  [...text].forEach((ch, i) => {
    const g = G[ch], adv = (ADV[ch] || .94) * sw;
    if (g) {
      const rot = (r() - .5) * .07, dy = (r() - .5) * size * .05, cs = Math.cos(rot), sn = Math.sin(rot);
      for (let pass = 0; pass < (o.passes || 2); pass++) g.forEach((st, k) => {
        const pts = st[0].map((p) => { const px = p[0] * adv, py = p[1] * size; return [x + px * cs - py * sn, y + dy + px * sn + py * cs]; });
        const line = st[1] ? spline(pts, false, 3) : dense(pts, 3);
        draw(sheet, wobble(line, size * .009 + pass * .5, i * 9 + k + pass * 40 + (o.seed || 0)), { color: col, r: pen * (pass ? .86 : 1), press: pass ? .9 : 1.04, seed: i * 13 + k * 3 + pass * 7 });
      });
    }
    x += adv + size * ls;
  });
}
