// The crayon lion's rig. Each layer is a wax drawing (scripts/lib/lion-art.mjs) rendered to public/lion, placed by crayon.json on a
// 44 x 44 canvas: feet at the bottom, room above for hats, tail left, held items right. CSS flips between the named frames.
import crayon from './crayon.json' with { type: 'json' };

export type Box = { x: number; y: number; w: number; h: number };
const PLACED = crayon as Record<string, Box>;

export const SIZE = 44;

/** One drawn layer, in its place on the rig. */
export const art = (key: string) => {
  const m = PLACED[key];
  return `<image href="/lion/${key}.webp" x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" preserveAspectRatio="none"/>`;
};
export const arts = (...keys: string[]) => keys.map(art).join('');

/** The box around some layers, for cropping a wardrobe icon. */
export function boxOf(...keys: string[]): Box {
  const boxes = keys.map((k) => PLACED[k]);
  const x = Math.min(...boxes.map((b) => b.x)), y = Math.min(...boxes.map((b) => b.y));
  return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}

/** A named animation frame. Alternate frames start hidden, so a still image (or reduced motion) shows the base frame. */
export const frame = (cls: string, markup: string, hidden = false) =>
  `<g class="${cls}"${hidden ? ' visibility="hidden"' : ''}>${markup}</g>`;

export const svgOpen = (w: number, h: number) =>
  `<svg class="lion-svg" viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false">`;

export const tailFrames = (cls = 'l-tail') =>
  `<g class="${cls}">${frame('t-rest', art('tail-rest'))}${frame('t-left', art('tail-left'), true)}${frame('t-right', art('tail-right'), true)}</g>`;

export const headMarkup = (face: string, hat: string, eyeFrames = true) =>
  `<g class="l-head">${art('head')}${eyeFrames
    ? frame('e-open', art('eyes-open')) + frame('e-blink', art('eyes-blink'), true) + frame('e-dizzy', art('eyes-dizzy'), true) + frame('e-squint', art('eyes-squint'), true)
      + frame('m-smile', art('mouth-smile')) + frame('m-open', art('mouth-open'), true) + frame('m-wobble', art('mouth-wobble'), true)
    : ''}${face}${hat}</g>`;

/** The full roaming lion, every animation frame included, with outfit markup slotted into its layers. */
export function rig(slots: { top: string; face: string; hat: string; held: string }): string {
  return `${tailFrames()}<g class="l-legs">${frame('lg-stand', art('legs-stand'))}${frame('lg-a', art('legs-a'), true)}${frame('lg-b', art('legs-b'), true)}${frame('lg-dangle', art('legs-dangle'), true)}${frame('lg-sit', art('legs-sit'), true)}</g>`
    + `<g class="l-upper">${art('body')}${frame('ar-down', art('arms-down'))}${frame('ar-up', art('arms-up'), true)}${slots.top}${headMarkup(slots.face, slots.hat)}<g class="l-held">${slots.held}</g></g>${frame('l-stars', art('stars'), true)}`;
}
