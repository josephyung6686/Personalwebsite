// The lion's wardrobe: the item catalogue, quests, and the rules for unlocking and saving an outfit.
import { FACE_ART, HAT_ART, HELD_ART, TOP_ART } from '../assets/lion/items.ts';
import { rig, svgOpen, SIZE } from '../assets/lion/sprites.ts';

export type Category = 'hat' | 'top' | 'face' | 'held';
export type QuestId = 'read' | 'sort' | 'devpost' | 'throw' | 'dress';
export type Box = { x: number; y: number; w: number; h: number };
export type Item = { id: string; name: string; svg: string; icon?: string; box?: Box; lock?: QuestId };
export type Quest = { id: QuestId; name: string; reward: string };
export type Outfit = Record<Category, string>;
export type GameState = { outfit: Outfit; done: QuestId[]; throws: number; tries: number; hidden: boolean };
export type Storage = { getItem(k: string): string | null; setItem(k: string, v: string): void };

export const CATEGORIES: { id: Category; label: string; icon: string }[] = [
  { id: 'hat', label: 'Hats', icon: 'cap' },
  { id: 'top', label: 'Tops', icon: 'shirt' },
  { id: 'face', label: 'Accessories', icon: 'glasses' },
  { id: 'held', label: 'Held items', icon: 'cup' },
];

const NONE: Item = { id: 'none', name: 'None', svg: '' };
const item = (id: string, name: string, art: { svg: string; icon?: string; box: Box }, lock?: QuestId): Item => ({ id, name, ...art, ...(lock ? { lock } : {}) });

export const ITEMS: Record<Category, Item[]> = {
  hat: [
    NONE,
    item('columbia', 'Columbia cap', HAT_ART.columbia),
    item('snow', 'Snow beanie', HAT_ART.snow),
    item('grad', 'Grad cap', HAT_ART.grad, 'read'),
  ],
  top: [
    NONE,
    item('scarf', 'Campus scarf', TOP_ART.scarf),
    item('labcoat', 'Lab coat', TOP_ART.labcoat, 'sort'),
    item('tie', 'Fund manager tie', TOP_ART.tie),
    item('hoodie', 'Columbia hoodie', TOP_ART.hoodie, 'devpost'),
  ],
  face: [
    NONE,
    item('glasses', 'Round glasses', FACE_ART.glasses),
    item('phones', 'Headphones', FACE_ART.phones),
    item('goggles', 'Ski goggles', FACE_ART.goggles, 'sort'),
  ],
  held: [
    NONE,
    item('cup', 'Late-night coffee', HELD_ART.cup),
    item('phone', 'Phone', HELD_ART.phone),
    item('guitar', 'Guitar', HELD_ART.guitar, 'read'),
    item('foil', 'Fencing foil', HELD_ART.foil, 'devpost'),
  ],
};

export const QUESTS: Quest[] = [
  { id: 'read', name: 'Read a case study', reward: 'Grad cap · Guitar' },
  { id: 'sort', name: 'Finish a decision in the Tuck demo', reward: 'Lab coat · Ski goggles' },
  { id: 'devpost', name: 'Open a hackathon Devpost', reward: 'Columbia hoodie · Fencing foil' },
  { id: 'throw', name: 'Throw the lion 3 times', reward: 'Bragging rights' },
  { id: 'dress', name: 'Try on 5 things', reward: 'Bragging rights' },
];

export const DEFAULT_OUTFIT: Outfit = { hat: 'none', top: 'scarf', face: 'none', held: 'none' };
const KEY = 'pixel-lion-v1';
const fresh = (): GameState => ({ outfit: { ...DEFAULT_OUTFIT }, done: [], throws: 0, tries: 0, hidden: false });

export const findItem = (cat: Category, id: string) => ITEMS[cat].find((i) => i.id === id);
export const isUnlocked = (item: Item, done: QuestId[]) => !item.lock || done.includes(item.lock);
export const questName = (id: QuestId) => QUESTS.find((q) => q.id === id)!.name;

export function complete(s: GameState, id: QuestId): GameState {
  return s.done.includes(id) ? s : { ...s, done: [...s.done, id] };
}

/** Puts an item on the lion; locked or unknown items are ignored. The fifth try completes the dress quest. */
export function equip(s: GameState, cat: Category, id: string): GameState {
  const item = findItem(cat, id);
  if (!item || !isUnlocked(item, s.done)) return s;
  const next = { ...s, outfit: { ...s.outfit, [cat]: id }, tries: s.tries + 1 };
  return next.tries >= 5 ? complete(next, 'dress') : next;
}

export function recordThrow(s: GameState): GameState {
  const next = { ...s, throws: s.throws + 1 };
  return next.throws >= 3 ? complete(next, 'throw') : next;
}

export function progress(s: GameState) {
  return { level: s.done.length + 1, count: s.done.length, total: QUESTS.length };
}

export function randomOutfit(rng: () => number, done: QuestId[]): Outfit {
  const pick = (cat: Category) => { const ok = ITEMS[cat].filter((i) => isUnlocked(i, done)); return ok[Math.floor(rng() * ok.length) % ok.length].id; };
  return { hat: pick('hat'), top: pick('top'), face: pick('face'), held: pick('held') };
}

export function loadState(storage: Storage): GameState {
  try {
    const raw = JSON.parse(storage.getItem(KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return fresh();
    const base = fresh();
    const done = Array.isArray(raw.done) ? raw.done.filter((d: unknown) => QUESTS.some((q) => q.id === d)) : [];
    const outfit = { ...base.outfit };
    for (const c of CATEGORIES) {
      const id = raw.outfit?.[c.id];
      const item = typeof id === 'string' ? findItem(c.id, id) : undefined;
      if (item && isUnlocked(item, done)) outfit[c.id] = item.id;
    }
    return { outfit, done, throws: Number(raw.throws) || 0, tries: Number(raw.tries) || 0, hidden: raw.hidden === true };
  } catch {
    return fresh();
  }
}

export function saveState(s: GameState, storage: Storage): void {
  try { storage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode or blocked storage: the game still works for this visit */ }
}

/** The full pixel lion for an outfit, with every animation frame ready for the CSS to switch between. */
export function lionSvg(o: Outfit): string {
  const slot = (c: Category) => `<g data-item="${o[c]}">${findItem(c, o[c])?.svg ?? ''}</g>`;
  return svgOpen(SIZE, SIZE) + rig({ top: slot('top'), face: slot('face'), hat: slot('hat'), held: slot('held') }) + '</svg>';
}
