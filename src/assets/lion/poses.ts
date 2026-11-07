// The four poses placed around the site. Server-side only.
import { art, arts, frame, svgOpen, tailFrames, SIZE } from './sprites.ts';
import { TOP_ART } from './items.ts';

export type Pose = 'laptop' | 'phone' | 'scarf' | 'bed';

const wearSlots = '<g class="wear" data-cat="face"></g><g class="wear" data-cat="hat"></g>';
const headWith = (eyeFrames: string) => `<g class="l-head">${art('head')}${eyeFrames}${art('mouth-smile')}${wearSlots}</g>`;
const lookingDown = frame('e-open', art('eyes-down')) + frame('e-blink', art('eyes-blink'), true);
const blinking = frame('e-open', art('eyes-open')) + frame('e-blink', art('eyes-blink'), true);

/* laptop: peeking over the lid, paws on top, a paw-print sticker on the back */
const laptop = () => tailFrames()
  + art('body')
  + headWith(lookingDown)
  + `<g class="l-glow">${art('glow')}</g>`
  + `<g class="key-a">${art('typing-l')}</g><g class="key-b">${art('typing-r')}</g>`
  + arts('lid', 'deck');

/* phone: both paws on it, eyes down, a little gold ping of good news */
const phone = () => tailFrames()
  + arts('legs-stand', 'body')
  + headWith(lookingDown)
  + arts('phone-back', 'hold-l', 'hold-r')
  + `<g class="l-ping">${art('ping')}</g>`;

/* scarf: a hello from the about section */
const scarf = () => tailFrames()
  + arts('legs-stand', 'body', 'arm-left')
  + frame('w-a', art('wave-a')) + frame('w-b', art('wave-b'), true)
  + TOP_ART.scarf.svg
  + headWith(blinking);

/* bed: asleep under the Columbia-blue blanket, on a 64 x 40 canvas */
const bed = () => arts('bed-frame', 'pillow', 'sleep-head')
  + frame('t-rest', art('bed-tail-a')) + frame('t-left', art('bed-tail-b'), true)
  + frame('b-down', art('blanket-a')) + frame('b-up', art('blanket-b'), true)
  + frame('zz z1', art('z1')) + frame('zz z2', art('z2')) + frame('zz z3', art('z3'));

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
