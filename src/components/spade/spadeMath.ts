// A real, small Gaussian process for the SPADE demo. Pure math with no DOM, so tests and the homepage preview can run it.
// Everything is invented: the yield function, the factors and their units. Nothing here comes from NutriGene.

export type Point = { x: number; y: number };
export type Obs = Point & { value: number };
export type Posterior = { mean: Float64Array; sd: Float64Array };
export type Campaign = { round: number; obs: Obs[]; rng: number; post: Posterior; latest: Obs[] };
export type Rect = { x0: number; x1: number; y0: number; y1: number };
export type Status = { kind: 'start' | 'hold' | 'recommend'; headline: string; detail: string };

export const GRID = 32;
export const BATCH = 8;
export const MAX_ROUNDS = 6;
export const DEFAULT_TARGET = 65;
export const TARGET_RANGE = { min: 50, max: 95, step: 1 };
export const FACTORS = {
  x: { name: 'Glucose feed', unit: 'g/L', min: 1, max: 8 },
  y: { name: 'Seeding density', unit: 'M cells/mL', min: 0.2, max: 2 },
} as const;

/** Prior standard deviation in yield points: how unsure the model is before it has seen anything. */
export const PRIOR_SD = 24;
const PRIOR_MEAN = 40;
const NOISE_SD = 6;
const LENGTH = 0.15;
/** How many standard deviations below the mean the bound sits. Two is the conservative line for a cell to be certified. */
const BETA = 2;
const SEED = 20260;
const MIN_RANGE_CELLS = 12;

/** Centre of every grid cell, row by row from the bottom left. Index with y * GRID + x. */
export const CELLS: Point[] = Array.from({ length: GRID * GRID }, (_, i) => ({ x: ((i % GRID) + 0.5) / GRID, y: (Math.floor(i / GRID) + 0.5) / GRID }));

/** The invented response the model never sees directly: one strong hill, and a smaller decoy that stays below the default target. */
export function hiddenYield(x: number, y: number): number {
  const u = x - 0.64, v = y - 0.56;
  const a = u * 0.92 + v * 0.38, b = -u * 0.38 + v * 0.92;
  const hill = 60 * Math.exp(-(a * a) / (2 * 0.23 * 0.23) - (b * b) / (2 * 0.16 * 0.16));
  const decoy = 30 * Math.exp(-((x - 0.17) ** 2 + (y - 0.8) ** 2) / (2 * 0.1 * 0.1));
  return 26 + hill + decoy;
}

function kernel(a: Point, b: Point): number {
  const dx = a.x - b.x, dy = a.y - b.y;
  return PRIOR_SD * PRIOR_SD * Math.exp(-(dx * dx + dy * dy) / (2 * LENGTH * LENGTH));
}

/** Exact GP regression with fixed hyperparameters: Cholesky of K + noise, then a triangular solve per query point. */
export function posterior(obs: Obs[], points: Point[] = CELLS): Posterior {
  const n = obs.length, m = points.length;
  const mean = new Float64Array(m).fill(PRIOR_MEAN);
  const sd = new Float64Array(m).fill(PRIOR_SD);
  if (n === 0) return { mean, sd };

  const L = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = kernel(obs[i], obs[j]) + (i === j ? NOISE_SD * NOISE_SD : 0);
      for (let k = 0; k < j; k++) s -= L[i * n + k] * L[j * n + k];
      L[i * n + j] = i === j ? Math.sqrt(s) : s / L[j * n + j];
    }
  }
  const alpha = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = obs[i].value - PRIOR_MEAN;
    for (let k = 0; k < i; k++) s -= L[i * n + k] * alpha[k];
    alpha[i] = s / L[i * n + i];
  }
  for (let i = n - 1; i >= 0; i--) {
    let s = alpha[i];
    for (let k = i + 1; k < n; k++) s -= L[k * n + i] * alpha[k];
    alpha[i] = s / L[i * n + i];
  }

  const v = new Float64Array(n);
  for (let q = 0; q < m; q++) {
    let mu = PRIOR_MEAN, known = 0;
    for (let i = 0; i < n; i++) {
      const k = kernel(points[q], obs[i]);
      mu += k * alpha[i];
      let s = k;
      for (let j = 0; j < i; j++) s -= L[i * n + j] * v[j];
      v[i] = s / L[i * n + i];
      known += v[i] * v[i];
    }
    mean[q] = mu;
    sd[q] = Math.sqrt(Math.max(PRIOR_SD * PRIOR_SD - known, 1e-9));
  }
  return { mean, sd };
}

/** mulberry32: returns a uniform draw and the next state, so a campaign stays a plain immutable value. */
function draw(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

function halton(i: number, base: number): number {
  let f = 1, r = 0;
  for (let k = i; k > 0; k = Math.floor(k / base)) { f /= base; r += f * (k % base); }
  return r;
}
const cellAt = (x: number, y: number): Point => CELLS[Math.min(GRID - 1, Math.floor(y * GRID)) * GRID + Math.min(GRID - 1, Math.floor(x * GRID))];

/** Round one spreads out with a space-filling design. Later rounds test where the model is unsure AND near the target. */
function pickBatch(c: Campaign, target: number): Point[] {
  if (c.round === 0) return Array.from({ length: BATCH }, (_, i) => cellAt(halton(i + 1, 2), halton(i + 1, 3)));
  const picks: Point[] = [];
  const fantasy = [...c.obs];
  const tested = new Set(c.obs.map((o) => CELLS.indexOf(cellAt(o.x, o.y))));
  let sd = c.post.sd;
  for (let b = 0; b < BATCH; b++) {
    let best = 0, bestScore = -Infinity;
    for (let i = 0; i < CELLS.length; i++) {
      if (tested.has(i)) continue;
      const score = BETA * sd[i] - Math.abs(c.post.mean[i] - target);
      if (score > bestScore) { bestScore = score; best = i; }
    }
    tested.add(best);
    picks.push(CELLS[best]);
    // Believing its own mean at the pick leaves the mean alone but shrinks uncertainty there, which spreads out the batch.
    fantasy.push({ ...CELLS[best], value: c.post.mean[best] });
    sd = posterior(fantasy).sd;
  }
  return picks;
}

export function newCampaign(seed = SEED): Campaign {
  return { round: 0, obs: [], rng: seed, post: posterior([]), latest: [] };
}

/** Plan a batch, run it with noise, refit. At the budget it returns the same campaign. */
export function runRound(c: Campaign, target: number): Campaign {
  if (c.round >= MAX_ROUNDS) return c;
  let rng = c.rng;
  const latest = pickBatch(c, target).map((p): Obs => {
    let u1: number, u2: number;
    [u1, rng] = draw(rng);
    [u2, rng] = draw(rng);
    const gauss = Math.sqrt(-2 * Math.log(1 - u1)) * Math.cos(2 * Math.PI * u2);
    return { ...p, value: hiddenYield(p.x, p.y) + NOISE_SD * gauss };
  });
  const obs = [...c.obs, ...latest];
  return { round: c.round + 1, obs, rng, latest, post: posterior(obs) };
}

/** 1 where the lower confidence bound clears the target. */
export function certify(post: Posterior, target: number): Uint8Array {
  const out = new Uint8Array(post.mean.length);
  for (let i = 0; i < out.length; i++) out[i] = post.mean[i] - BETA * post.sd[i] >= target ? 1 : 0;
  return out;
}

/** Largest fully certified rectangle at least two cells each way. A bounding box would claim settings that are not certified. */
export function largestRect(mask: Uint8Array, n = GRID): Rect | null {
  const heights = new Int32Array(n);
  let best: Rect | null = null, bestArea = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) heights[x] = mask[y * n + x] ? heights[x] + 1 : 0;
    for (let x = 0; x < n; x++) {
      let h = heights[x];
      for (let left = x; left >= 0 && h > 0; left--) {
        h = Math.min(h, heights[left]);
        const w = x - left + 1, area = w * h;
        if (w >= 2 && h >= 2 && area > bestArea) { bestArea = area; best = { x0: left, x1: x, y0: y - h + 1, y1: y }; }
      }
    }
  }
  return best;
}

const area = (r: Rect) => (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1);

/** The range to recommend, or null when it should hold off. */
export function recommend(post: Posterior, target: number): Rect | null {
  const r = largestRect(certify(post, target));
  return r && area(r) >= MIN_RANGE_CELLS ? r : null;
}

/** Cell index to factor units, at the cell centre: the only place the model was actually evaluated. */
export function factorValue(axis: 'x' | 'y', cell: number): number {
  const f = FACTORS[axis];
  return f.min + ((cell + 0.5) / GRID) * (f.max - f.min);
}
const rangeText = (axis: 'x' | 'y', a: number, b: number) =>
  `${FACTORS[axis].name} ${factorValue(axis, a).toFixed(1)} to ${factorValue(axis, b).toFixed(1)} ${FACTORS[axis].unit}`;

export function describeStatus(c: Campaign, target: number): Status {
  if (c.round === 0) {
    return { kind: 'start', headline: 'No experiments yet.', detail: `Press Run next round to spend the first ${BATCH}.` };
  }
  const r = recommend(c.post, target);
  if (r) {
    return {
      kind: 'recommend',
      headline: `Recommend: ${rangeText('x', r.x0, r.x1)}, ${rangeText('y', r.y0, r.y1)}.`,
      detail: `Every setting in this range has a lower confidence bound above ${target}%.`,
    };
  }
  const cleared = certify(c.post, target).reduce((a, b) => a + b, 0);
  return {
    kind: 'hold',
    headline: c.round >= MAX_ROUNDS ? 'Budget spent: still holding off.' : 'Not confident yet: holding off.',
    detail: cleared > 0
      ? `${cleared} of ${GRID * GRID} settings clear ${target}%, which is not yet a range you could run.`
      : `No setting clears ${target}% with enough confidence.`,
  };
}

/** What one cell of the map says, for the readout under the chart. */
export function describeCell(c: Campaign, i: number, target: number): string {
  const m = c.post.mean[i], band = BETA * c.post.sd[i], bound = m - band;
  const x = factorValue('x', i % GRID).toFixed(1), y = factorValue('y', Math.floor(i / GRID)).toFixed(1);
  return `${FACTORS.x.name} ${x} ${FACTORS.x.unit}, ${FACTORS.y.name} ${y} ${FACTORS.y.unit}: predicted ${Math.round(m)}% ± ${Math.round(band)}. Lower bound ${Math.round(bound)}%, ${bound >= target ? 'clears' : 'below'} the target.`;
}

/** The chart as a sentence, for screen readers and anyone who wants the numbers. */
export function summarize(c: Campaign, target: number): string {
  if (c.round === 0) return `Round 0 of ${MAX_ROUNDS}. No experiments yet, so the map is blank.`;
  let top = 0;
  c.post.mean.forEach((v, i) => { if (v > c.post.mean[top]) top = i; });
  const cleared = certify(c.post, target).reduce((a, b) => a + b, 0);
  const share = Math.round((cleared / (GRID * GRID)) * 100);
  const peak = `${FACTORS.x.name} ${factorValue('x', top % GRID).toFixed(1)} ${FACTORS.x.unit}, ${FACTORS.y.name} ${factorValue('y', Math.floor(top / GRID)).toFixed(1)} ${FACTORS.y.unit}`;
  return `Round ${c.round} of ${MAX_ROUNDS}. ${c.obs.length} experiments so far. Highest predicted yield is ${Math.round(c.post.mean[top])}% at ${peak}. ${share}% of settings are certified above ${target}%.`;
}

/** Sequential teal, dark to bright as predicted yield rises, then faded toward the background where the model is still unsure. */
const RAMP: [number, number, number][] = [[20, 58, 58], [44, 143, 126], [165, 247, 226]];
const FOG: [number, number, number] = [11, 26, 28];
export const YIELD_SCALE = { min: 30, max: 90 };

export function heatColor(mean: number, sd: number): [number, number, number] {
  const t = Math.min(1, Math.max(0, (mean - YIELD_SCALE.min) / (YIELD_SCALE.max - YIELD_SCALE.min))) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(t));
  const f = t - i;
  const unsure = Math.min(1, sd / PRIOR_SD);
  const keep = 1 - 0.9 * unsure * unsure;
  return [0, 1, 2].map((k) => {
    const c = RAMP[i][k] + (RAMP[i + 1][k] - RAMP[i][k]) * f;
    return Math.round(FOG[k] + (c - FOG[k]) * keep);
  }) as [number, number, number];
}
