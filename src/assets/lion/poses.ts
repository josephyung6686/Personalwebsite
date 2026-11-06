// The four poses placed around the site, plus the small head used for browser-tab icons. Server-side only.
import { armLeft, body, eyes, frame, head, layer, legs, mouths, ol, part, paths, shifted, svgOpen, tailFrames, wave, SIZE, type Layer } from './sprites.ts';
import { TOP_ART } from './items.ts';

export type Pose = 'laptop' | 'phone' | 'scarf' | 'bed';

const wearSlots = '<g class="wear" data-cat="face"></g><g class="wear" data-cat="hat"></g>';
const blinkingEyes = frame('e-open', eyes.open) + frame('e-blink', eyes.blink, true);
const headWith = (eyeFrames: string, mouth: Layer = mouths.smile) =>
  `<g class="l-head">${paths(head)}${eyeFrames}${paths(mouth)}${wearSlots}</g>`;

/* ---- laptop: peeking over the lid, paws on top, a paw-print sticker on the back ---- */
const lid = ol(part(12, 31,
  'uuuuuuuuuuuuuuuuuuuu',
  'ssssssssssssssssssst',
  'ssssssssssssssssssst',
  'ssssssssbbbbbsssssst',
  'sssssssbbdbdbbsssyst',
  'sssssssbdbdbdbssyyyt',
  'sssssssbbdddbbsssyst',
  'sssssssbbdddbbssssst',
  'ssssssssbbbbbsssssst',
  'ssssssssssssssssssst',
  'tttttttttttttttttttt',
));
const deck = ol(part(9, 42, 'uuuuuuuuuuuuuuuuuuuuuuuuuu'));
const typingL = ol(part(15, 29, '.CCCc', 'CCCCc', 'cCcCc'));
const typingR = ol(part(25, 29, 'CCCCc', 'CCCCc', 'cCcCc'));
const glow = layer(part(13, 30, 'bbbbbbbbbbbbbbbbbb'));

const laptop = () => tailFrames()
  + paths(body)
  + headWith(frame('e-open', eyes.down) + frame('e-blink', eyes.blink, true))
  + `<g class="l-glow">${paths(glow)}</g>`
  + `<g class="key-a">${paths(typingL)}</g><g class="key-b">${paths(typingR)}</g>`
  + paths(lid) + paths(deck);

/* ---- phone: both paws on it, eyes down, a little gold ping of good news ---- */
const phoneBack = ol(part(18, 28,
  'bbbbbbbb',
  'bKKbbbbe',
  'bKKbbbbe',
  'bbbbbbbe',
  'bbbyybbe',
  'byyyyyye',
  'bbyyyybe',
  'bbybbybe',
  'bbbbbbbe',
  'bbbbbbbe',
  'eeeeeeee',
));
const holdL = ol(part(13, 30, '..LF', '.LFF', 'LFFf', 'LFFFf.', '.FFFCCC', '..fCCCC', '....cc'));
const holdR = ol(part(25, 30, '..Ff', '..FFf', '...FFf', '.FFFFf', 'CCCFFf', 'CCCCf', '.cc'));
const ping = ol(part(34, 8, '.yyyyyyy.', 'yyyyWyyyy', 'yWWWWWWWy', 'yyWWWWWyy', 'yyWWyWWyy', '.yyyyyyy.'), part(35, 14, 'yy', 'y'));

const phone = () => tailFrames()
  + paths(legs.stand) + paths(body)
  + headWith(frame('e-open', eyes.down) + frame('e-blink', eyes.blink, true))
  + paths(phoneBack) + paths(holdL) + paths(holdR)
  + `<g class="l-ping">${paths(ping)}</g>`;

/* ---- scarf: a hello from the about section ---- */
const scarf = () => tailFrames()
  + paths(legs.stand) + paths(body) + paths(armLeft)
  + frame('w-a', wave.a) + frame('w-b', wave.b, true)
  + TOP_ART.scarf.svg
  + headWith(blinkingEyes);

/* ---- bed: asleep under the Columbia-blue blanket, on a 64 x 40 canvas ---- */
const rows = (n: number, row: string) => Array<string>(n).fill(row);
const bedFrame = layer(
  ol(part(1, 8, 'qrrr', 'rrrr', 'rrrr', ...rows(27, 'rrrx'))),
  ol(part(59, 20, 'qrr', 'rrr', ...rows(16, 'rrx'))),
  ol(part(5, 33, 'q'.repeat(54), 'r'.repeat(54), 'x'.repeat(54))),
);
const pillow = ol(part(5, 21,
  '..wwwwwwwwwwwwwwwwwwwwwww.',
  '.wwwwwwwwwwwwwwwwwwwwwwwwv',
  'wwwwwwwwwwwwwwwwwwwwwwwwwv',
  'wwwwwwwwwwwwwwwwwwwwwwwwwv',
  'wwwwwwwwwwwwwwwwwwwwwwwwwv',
  'wwwwwwwwwwwwwwwwwwwwwwwwwv',
  'wwwwwwwwwwwwwwwwwwwwwwwwwv',
  'wwwwwwwwwwwwwwwwwwwwwwwwwv',
  'wwwwwwwwwwwwwwwwwwwwwwwwwv',
  'vvvvvvvvvvvvvvvvvvvvvvvvv.',
));
const sleepHead = layer(shifted(layer(head, eyes.sleep, part(21, 22, 'DD')), -6, 4));
const hump = [
  '...........bbbbbbbbbbbbbbb.....',
  '.......bbbbbbbbbbbbbbbbbbbbbb..',
];
const blanket = (lift: number) => ol(part(26, 21 - lift,
  ...(lift ? ['...............bbbbbbb.........'] : []),
  ...hump,
  '....bbbbbbbbbbbbbbbbbbbbbbbbbbb',
  '.wwbbbbbbbbbbbbbbbbbbbbbbbbbbbe',
  'wwwwbbbbbbbbbbbbbbbbbbbbbbbbbbbe',
  'wwwwyyyyyyyyyyyyyyyyyyyyyyyyyyyz',
  'wwwwbbbbbbbbbbbbbbbbbbbbbbbbbbbe',
  'vwwwyyyyyyyyyyyyyyyyyyyyyyyyyyyz',
  'vwwwbbbbbbbbbbbbbbbbbbbbbbbbbbbe',
  'vvwwbbbbbbbbbbbbbbbbbbbbbbbbbbbe',
  'vvvweeeeeeeeeeeeeeeeeeeeeeeeeeee',
));
const bedTail = {
  a: ol(part(49, 8, '.HM..', 'HHMM.', 'HMMMm', 'MMMmm', '.mmm.', '..FF.', '..FFf', '..LFf', '..LFf', '..LFf', '..LFf', '..LFf', '..LFf', '..LFf')),
  b: ol(part(50, 9, '.HM..', 'HHMM.', 'HMMMm', 'MMMmm', '.mmm.', '.FF..', '.FFf.', '.LFf.', '.LFf.', '.LFf.', '.LFf.', '.LFf.', '.LFf.')),
};
const zee = (x: number, y: number, ...rows: string[]) => layer(part(x, y, ...rows));
const zs = {
  z1: zee(30, 15, 'bbb', '..b', '.b.', 'b..', 'bbb'),
  z2: zee(35, 8, 'bbbb', '...b', '..b.', '.b..', 'b...', 'bbbb'),
  z3: zee(41, 1, 'wwwww', '....w', '...w.', '..w..', '.w...', 'w....', 'wwwww'),
};
const bed = () => paths(bedFrame) + paths(pillow) + paths(sleepHead)
  + frame('t-rest', bedTail.a) + frame('t-left', bedTail.b, true)
  + frame('b-down', blanket(0)) + frame('b-up', blanket(1), true)
  + frame('zz z1', zs.z1) + frame('zz z2', zs.z2) + frame('zz z3', zs.z3);

const BUILDERS: Record<Pose, { w: number; h: number; draw: () => string }> = {
  laptop: { w: SIZE, h: SIZE, draw: laptop },
  phone: { w: SIZE, h: SIZE, draw: phone },
  scarf: { w: SIZE, h: SIZE, draw: scarf },
  bed: { w: 64, h: 40, draw: bed },
};

export function poseSvg(pose: Pose): string {
  const { w, h, draw } = BUILDERS[pose];
  return svgOpen(w, h) + draw() + '</svg>';
}

/** A dedicated 16 x 16 head: a shrunken 26 x 23 one turns to mush at tab size. */
export const tinyHead = layer(part(0, 0,
  '....OO.OO.OO....',
  '..OOHMOMMOMMOO..',
  '.OHFPMMMMMMPFmO.',
  '.OMFFMMMMMMFFmO.',
  'OHMMFFFFFFFFMMmO',
  'OMMFFFFFFFFFFMmO',
  '.OMFEEFFFFEEFMO.',
  'OHMFEEFFFFEEFMmO',
  'OMMFFFFFFFFFFMmO',
  '.OMFBFCNNCFBFMO.',
  'OHMFFCCDDCCFFMmO',
  'OMMMFFCCCCFFMMmO',
  '.OMMMFFFFFFMMmO.',
  '..OmMMMMMMMMmO..',
  '...OmOmMMmOmO...',
  '....O.OOOO.O....',
));

/** The full head with its face on, for larger icons. */
export const fullHead = layer(head, eyes.open, mouths.smile);
