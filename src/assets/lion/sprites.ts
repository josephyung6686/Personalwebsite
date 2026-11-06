// The pixel lion: every sprite is a hand-drawn grid of palette letters, turned into crisp SVG paths on demand.
// This file holds the drawing helpers and the lion's rig. items.ts holds the wardrobe, poses.ts the page poses.

export const PALETTE: Record<string, string> = {
  O: '#2b1712', // outline, warm near-black so it holds up on navy and on sand
  M: '#c8741e', // mane
  H: '#eb9c35', // mane highlight
  m: '#984f16', // mane shadow
  n: '#6f3510', // mane deep shadow
  F: '#f8c84f', // fur
  L: '#ffe08a', // fur highlight
  f: '#dd9c31', // fur shadow
  C: '#fff1c9', // muzzle, belly and paws
  c: '#f2d296', // muzzle shadow
  E: '#1d1016', // eye
  W: '#ffffff',
  N: '#8c3423', // nose
  D: '#6a2f1c', // mouth
  B: '#f49a5e', // blush
  P: '#e78a58', // inner ear, toe beans, tongue
  // clothes and props
  a: '#6fb1e6', // blue
  b: '#b9d9eb', // Columbia blue
  e: '#8fbcd8', // Columbia blue, shadow
  d: '#1d4f91', // deep blue
  w: '#f2f5fb', // white cloth
  v: '#c9d4e8', // white cloth, shadow
  K: '#2a3b66', // navy
  J: '#3f5688', // navy, light
  k: '#131d38', // dark navy
  y: '#f5c04a', // gold
  z: '#a9761b', // deep gold
  s: '#aab6cc', // steel
  t: '#6f7d96', // steel, dark
  u: '#dbe3ef', // steel, light
  r: '#b5692a', // wood
  q: '#d98f4a', // wood, light
  x: '#6a3d1c', // wood, dark
  g: '#ff8a3d', // goggle lens
  h: '#ffd27a', // goggle lens, light
};

export type Part = { x: number; y: number; rows: string[] };
export type Layer = Map<number, string>;

export const part = (x: number, y: number, ...rows: string[]): Part => ({ x, y, rows });
const key = (x: number, y: number) => (y + 200) * 1000 + (x + 200);
export const unkey = (k: number): [number, number] => [(k % 1000) - 200, Math.floor(k / 1000) - 200];

/** Paints parts in order into one layer. `.` leaves what is underneath, `_` erases it. */
export function layer(...parts: (Part | Layer)[]): Layer {
  const out: Layer = new Map();
  for (const p of parts) {
    if (p instanceof Map) { for (const [k, c] of p) out.set(k, c); continue; }
    p.rows.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx++) {
        const c = row[dx];
        if (c === '.') continue;
        if (c === '_') out.delete(key(p.x + dx, p.y + dy));
        else out.set(key(p.x + dx, p.y + dy), c);
      }
    });
  }
  return out;
}

/** Adds a one-pixel outline around everything in the layer. */
export function outlined(l: Layer, ink = 'O'): Layer {
  const out: Layer = new Map(l);
  for (const k of l.keys()) {
    const [x, y] = unkey(k);
    for (const [ax, ay] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const n = key(ax, ay);
      if (!l.has(n)) out.set(n, ink);
    }
  }
  return out;
}
export const ol = (...parts: (Part | Layer)[]) => outlined(layer(...parts));

export function shifted(l: Layer, dx: number, dy: number): Layer {
  const out: Layer = new Map();
  for (const [k, c] of l) { const [x, y] = unkey(k); out.set(key(x + dx, y + dy), c); }
  return out;
}

/** Swaps palette letters, for dressing an arm in a sleeve. */
export function recolour(l: Layer, map: Record<string, string>): Layer {
  const out: Layer = new Map();
  for (const [k, c] of l) out.set(k, map[c] ?? c);
  return out;
}

export function bbox(l: Layer) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const k of l.keys()) { const [x, y] = unkey(k); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** SVG paths for a layer: one path per colour, runs merged, so the markup stays small. */
export function paths(l: Layer): string {
  const byColour = new Map<string, string>();
  const rows = new Map<number, [number, string][]>();
  for (const [k, c] of l) { const [x, y] = unkey(k); if (!rows.has(y)) rows.set(y, []); rows.get(y)!.push([x, c]); }
  for (const [y, cells] of [...rows].sort((a, b) => a[0] - b[0])) {
    cells.sort((a, b) => a[0] - b[0]);
    let i = 0;
    while (i < cells.length) {
      let j = i;
      while (j + 1 < cells.length && cells[j + 1][1] === cells[i][1] && cells[j + 1][0] === cells[j][0] + 1) j++;
      const [x, c] = cells[i];
      byColour.set(c, (byColour.get(c) ?? '') + `M${x} ${y}h${j - i + 1}v1h-${j - i + 1}z`);
      i = j + 1;
    }
  }
  return [...byColour].map(([c, d]) => `<path fill="${PALETTE[c] ?? c}" d="${d}"/>`).join('');
}

/** A named animation frame. Alternate frames start hidden, so a still image (or reduced motion) shows the base frame. */
export const frame = (cls: string, l: Layer | string, hidden = false) =>
  `<g class="${cls}"${hidden ? ' visibility="hidden"' : ''}>${typeof l === 'string' ? l : paths(l)}</g>`;

export const svgOpen = (w: number, h: number) =>
  `<svg class="lion-svg" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">`;

/* ---------- the lion, on a 44 x 44 canvas: feet on the bottom row, room above for hats, tail left, held items right ---------- */
export const SIZE = 44;

const mane = part(9, 6,
  '..........HHM.HMM.........',
  '.......HM.HMMmHMMm.HM.....',
  '.....HHMMmHMMMMMMMmHMMm...',
  '....HMMMMMMMMMMMMMMMMMMm..',
  '..HHMMMMMMMMMMMMMMMMMMMMm.',
  '..HMMmMMMMMMMMMMMMMMMmMMm.',
  'HHMMMMMMMMMMMMMMMMMMMMMMMm',
  '.HMmMMMMMMMMMMMMMMMMMMmMm.',
  '..HMMMMMMMMMMMMMMMMMMMMMm.',
  'HHMMMMMMMMMMMMMMMMMMMMMMMm',
  'HMMmMMMMMMMMMMMMMMMMMMmMMm',
  '.HMMMMMMMMMMMMMMMMMMMMMMm.',
  '..HMMMMMMMMMMMMMMMMMMMMMm.',
  'HHMMMMMMMMMMMMMMMMMMMMMMMm',
  'HMMmMMMMMMMMMMMMMMMMMMmMMm',
  '.MMMMMMMMMMMMMMMMMMMMMMMm.',
  '..HMMMMMMMMMMMMMMMMMMMMm..',
  '.HMMmMMMMMMMMMMMMMMMmMMMm.',
  '..MMMMMMMMMMMMMMMMMMMMMm..',
  '...MMMmMMMMMMMMMMmMMMmm...',
  '....MMMMMmMMMMmMMMMMm.....',
  '.....mMm.mMMm.mMMm.mm.....',
  '......m...mm...mm...m.....',
);
const earL = part(11, 7, '.FFF.', 'FPPPF', 'FPPPf', 'fFPFf', '.ff..');
const earR = part(28, 7, '.FFF.', 'FPPPF', 'FPPPf', 'fFPFf', '..ff.');
const face = part(14, 11,
  '.....LLLLLL.....',
  '...LLFFFFFFFf...',
  '..LFFFFFFFFFFf..',
  '.LFFFFFFFFFFFFf.',
  '.LFFFFFFFFFFFFf.',
  'LFFFFFFFFFFFFFFf',
  'FFFFFFFFFFFFFFFf',
  'FFFFFFFFFFFFFFFf',
  'FBBFFFCCCCFFFBBf',
  'FFFFFCCCCCCFFFFf',
  '.FFFCCCCCCCCFFf.',
  '.fFFCCCCCCCCFff.',
  '..fFFcCCCCcFff..',
  '....ffffffff....',
);
const fringe = part(19, 10, '.mHMHm', 'mHMmMHm', '.mM.Mm');
const nose = part(20, 19, 'NNNN', '.NN.');

/** Mane, ears, face and nose, without eyes or mouth. */
export const head = layer(ol(mane), ol(earL), ol(earR), outlined(layer(face), 'm'), layer(fringe), layer(nose));

export const eyes = {
  open: layer(part(17, 15, 'WE......WE', 'EE......EE', 'EE......EE')),
  blink: layer(part(16, 16, 'EEE......EEE')),
  sleep: layer(part(15, 16, 'E...E....E...E', '.EEE......EEE.')),
  down: layer(part(17, 16, 'WE......WE', 'EE......EE')),
  dizzy: layer(part(16, 15, 'E.E......E.E', '.E........E.', 'E.E......E.E')),
  squint: layer(part(16, 15, 'E..........E', '.EE......EE.', 'E..........E')),
};
export const mouths = {
  smile: layer(part(18, 21, '...DD...', '.D.DD.D.', '..D..D..')),
  open: layer(part(19, 21, '.DDDD.', '.DPPD.', '..DD..')),
  wobble: layer(part(18, 22, '.D.DD.D.', 'D.D..D.D')),
};

const torso = part(15, 27,
  '....FFFFFF....',
  '...FFFFFFFf...',
  '..LFFCCCCFFf..',
  '..LFCCCCCCFf..',
  '.LFFCCCCCCFFf.',
  '.FFCCCCCCCCFf.',
  '.FFCCCCCCCCFf.',
  'LFFCCCCCCCCFFf',
  'FFFCCCCCCCCFFf',
  'FFFFCCCCCCFFFf',
  '.fFFFFFFFFFFf.',
  '..ffffffffff..',
);
export const body = ol(torso);

export const armLeft = ol(part(13, 29, '..LF', '.LFF', '.LFF', 'LFFf', 'LFFf', 'FFFf', 'CCCf', '.cc.'));
export const arms = {
  down: layer(armLeft,
    ol(part(27, 29, 'Ff..', 'FFf.', 'FFf.', 'FFFf', 'FFFf', 'FFFf', 'CCCf', '.cc.'))),
  up: layer(ol(part(7, 24, 'CCc......', 'CCCc.....', 'LFFf.....', 'LFFFf....', '.LFFFF...', '..LFFFFFF', '....fFFFF')),
    ol(part(28, 24, '......cCC', '.....cCCC', '.....fFFF', '....fFFFF', '...FFFFf.', 'FFFFFFf..', 'FFFFf....'))),
};
// A raised right arm, for a wave, in two frames. Used by the scarf pose.
export const wave = {
  a: ol(part(30, 21, '...CCc', '...CCC', '...FFf', '...FFf', '..FFf.', '.FFFf.', 'FFFf..', 'FFf...', 'Ff....')),
  b: ol(part(30, 21, '.CCc..', '.CCC..', '.FFf..', '.FFf..', '.FFf..', '.FFFf.', 'FFFf..', 'FFf...', 'Ff....')),
};

export const legs = {
  stand: ol(part(15, 38, '.FFFF....FFFF.', '.FFFf....FFFf.', 'LFFFFf..LFFFFf', 'CCCCCc..CCCCCc', 'CcCcCc..CcCcCc')),
  a: ol(part(15, 38, '.FFFF....FFFF.', 'LFFFFf...FFFf.', 'CCCCCc..LFFFFf', 'CcCcCc..CCCCCc', '........CcCcCc')),
  b: ol(part(15, 38, '.FFFF....FFFF.', '.FFFf...LFFFFf', 'LFFFFf..CCCCCc', 'CCCCCc..CcCcCc', 'CcCcCc........')),
  dangle: ol(part(16, 38, '.FFF....FFF.', '.FFf....FFf.', '.FFf....FFf.', '.CCc....CCc.', '.cc......cc.')),
  sit: layer(
    ol(part(10, 38, '.CCCC.', 'CPCPCc', 'CCCCCc', 'CPPPCc', '.cccc.')),
    ol(part(28, 38, '.CCCC.', 'CPCPCc', 'CCCCCc', 'CPPPCc', '.cccc.'))),
};

const tailRoot = ['......fFFFFFF', '........ffFFF'];
export const tails = {
  rest: ol(part(2, 23, '...HM....', '..HHMM...', '..HMMMm..', '..MMMmm..', '...mmm...', '....FF...', '....FFf..', '....LFf..', '....LFf..', '....fFF..', '.....FFf.', '.....fFFF', ...tailRoot)),
  left: ol(part(2, 24, '..HM.....', '.HHMM....', '.HMMMm...', '.MMMmm...', '..mmm....', '...FF....', '...FFf...', '...LFf...', '....FFf..', '.....FFf.', '.....fFFF', ...tailRoot)),
  right: ol(part(2, 22, '.....HM..', '....HHMM.', '....HMMMm', '....MMMmm', '.....mmm.', '....FFf..', '....FFf..', '...LFf...', '...LFf...', '...LFf...', '....fFF..', '.....FFf.', '.....fFFF', ...tailRoot)),
};
export const tailFrames = (cls = 'l-tail') =>
  `<g class="${cls}">${frame('t-rest', tails.rest)}${frame('t-left', tails.left, true)}${frame('t-right', tails.right, true)}</g>`;

export const headMarkup = (face: string, hat: string, eyeFrames = true) =>
  `<g class="l-head">${paths(head)}${eyeFrames
    ? frame('e-open', eyes.open) + frame('e-blink', eyes.blink, true) + frame('e-dizzy', eyes.dizzy, true) + frame('e-squint', eyes.squint, true)
      + frame('m-smile', mouths.smile) + frame('m-open', mouths.open, true) + frame('m-wobble', mouths.wobble, true)
    : ''}${face}${hat}</g>`;

// Three stars that circle a dizzy lion.
const star = (x: number, y: number) => part(x, y, '.y.', 'yyy', '.y.');
export const stars = layer(star(13, 1), star(21, 0), star(29, 1));

/** The full roaming lion, every animation frame included, with outfit markup slotted into its layers. */
export function rig(slots: { top: string; face: string; hat: string; held: string }): string {
  return `${tailFrames()}<g class="l-legs">${frame('lg-stand', legs.stand)}${frame('lg-a', legs.a, true)}${frame('lg-b', legs.b, true)}${frame('lg-dangle', legs.dangle, true)}${frame('lg-sit', legs.sit, true)}</g>`
    + `<g class="l-upper">${paths(body)}${frame('ar-down', arms.down)}${frame('ar-up', arms.up, true)}${slots.top}${headMarkup(slots.face, slots.hat)}<g class="l-held">${slots.held}</g></g>${frame('l-stars', stars, true)}`;
}
