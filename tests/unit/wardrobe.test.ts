import { describe, it, expect } from 'vitest';
import { ITEMS, QUESTS, DEFAULT_OUTFIT, isUnlocked, equip, progress, randomOutfit, loadState, saveState, lionSvg, type GameState } from '../../src/lib/wardrobe';

const fresh = (): GameState => ({ outfit: { ...DEFAULT_OUTFIT }, done: [], throws: 0, tries: 0, hidden: false });

describe('wardrobe catalogue', () => {
  it('has four categories, each with a None option, and every lock names a real quest', () => {
    for (const cat of ['hat', 'top', 'face', 'held'] as const) {
      expect(ITEMS[cat][0].id).toBe('none');
      for (const it of ITEMS[cat]) if (it.lock) expect(QUESTS.map((q) => q.id)).toContain(it.lock);
    }
  });
});

describe('pixel art', () => {
  it('every item draws only on the sprite grid: whole-number paths, nothing smoothed', () => {
    for (const cat of ['hat', 'top', 'face', 'held'] as const) {
      for (const it of ITEMS[cat]) {
        if (it.id === 'none') continue;
        expect(it.svg, it.id).toContain('<path');
        expect(it.svg, it.id).not.toMatch(/\d\.\d|<(circle|ellipse|text|filter)/);
        expect(it.box!.w, it.id).toBeGreaterThan(0);
      }
    }
  });
  it('slots every worn item into the lion, in crisp pixels', () => {
    const svg = lionSvg({ hat: 'columbia', top: 'hoodie', face: 'glasses', held: 'cup' });
    expect(svg).toContain('shape-rendering="crispEdges"');
    for (const id of ['columbia', 'hoodie', 'glasses', 'cup']) expect(svg).toContain(`data-item="${id}"`);
  });
});

describe('equip', () => {
  it('equips an unlocked item and counts the try', () => {
    const s = equip(fresh(), 'hat', 'columbia');
    expect(s.outfit.hat).toBe('columbia');
    expect(s.tries).toBe(1);
  });
  it('refuses a locked item', () => {
    const s = equip(fresh(), 'hat', 'grad');
    expect(s.outfit.hat).toBe('none');
    expect(s.tries).toBe(0);
  });
  it('allows a locked item once its quest is done', () => {
    expect(equip({ ...fresh(), done: ['read'] }, 'hat', 'grad').outfit.hat).toBe('grad');
  });
  it('completes the dress quest on the fifth try', () => {
    let s = fresh();
    for (const id of ['columbia', 'snow', 'none', 'columbia', 'snow']) s = equip(s, 'hat', id);
    expect(s.done).toContain('dress');
  });
});

describe('progress and randomness', () => {
  it('reports level and counts', () => {
    expect(progress({ ...fresh(), done: ['read', 'sort'] })).toEqual({ level: 3, count: 2, total: QUESTS.length });
  });
  it('random outfits only use unlocked items', () => {
    let seed = 0.99; const rng = () => (seed = (seed * 9301 + 49297) % 233280 / 233280);
    for (let i = 0; i < 50; i++) {
      const o = randomOutfit(rng, []);
      for (const cat of ['hat', 'top', 'face', 'held'] as const) expect(isUnlocked(ITEMS[cat].find((x) => x.id === o[cat])!, [])).toBe(true);
    }
  });
});

describe('persistence', () => {
  it('round-trips through storage', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    const s: GameState = { ...equip(fresh(), 'face', 'glasses'), done: ['read'] };
    saveState(s, storage);
    expect(loadState(storage)).toEqual(s);
  });
  it('falls back to a fresh state when storage is broken or garbage', () => {
    expect(loadState({ getItem: () => { throw new Error('blocked'); }, setItem: () => {} })).toEqual(fresh());
    expect(loadState({ getItem: () => '{not json', setItem: () => {} })).toEqual(fresh());
    expect(loadState({ getItem: () => JSON.stringify({ outfit: { hat: 'crown' } }), setItem: () => {} }).outfit.hat).toBe('none');
  });
});
