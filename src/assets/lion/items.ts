// The wardrobe: fourteen crayon drawings on the lion's 44 x 44 canvas, so each item lands on the right part of its body.
import { art, boxOf, frame, type Box } from './sprites.ts';

type Art = { svg: string; icon?: string; box: Box };
const worn = (key: string): Art => ({ svg: art(key), box: boxOf(key) });

/** A top with sleeves: the sleeve has its own raised and lowered drawing, so it follows the arm frames too. */
const sleeved = (key: string): Art => ({
  svg: art(key) + frame('sl-down', art(`${key}-sl-down`)) + frame('sl-up', art(`${key}-sl-up`), true),
  box: boxOf(key, `${key}-sl-down`),
});

/** The paw that closes over a held item. It belongs on the lion, so the item's wardrobe icon leaves it out. */
const held = (key: string): Art => ({ svg: art(key) + art('grip'), icon: art(key), box: boxOf(key) });

export const HAT_ART = { columbia: worn('columbia'), snow: worn('snow'), grad: worn('grad') };
export const TOP_ART = { scarf: worn('scarf'), labcoat: sleeved('labcoat'), tie: worn('tie'), hoodie: sleeved('hoodie') };
export const FACE_ART = { glasses: worn('glasses'), phones: worn('phones'), goggles: worn('goggles') };
export const HELD_ART = { cup: held('cup'), phone: held('phone'), guitar: held('guitar'), foil: held('foil') };
