import { describe, it, expect } from 'vitest';
import { fitFrame, VIEWS } from '../../src/components/tuck/tuckDemo';

describe('fitting the prototype to the stage', () => {
  it('leaves it alone when the stage is big enough', () => {
    expect(fitFrame(1300, 800, 1240, 720)).toEqual({ k: 1, w: 1300, h: 800 });
  });
  it('scales to the tighter side and renders at least the minimum size', () => {
    const narrow = fitFrame(930, 700, 1240, 720);
    expect(narrow.k).toBeCloseTo(0.75);
    expect(narrow.w).toBeCloseTo(1240);
    expect(narrow.h).toBeGreaterThan(720);
    const short = fitFrame(1300, 360, 1240, 720);
    expect(short.k).toBeCloseTo(0.5);
    expect(short.h).toBeCloseTo(720);
    expect(short.w).toBeCloseTo(2600);
  });
  it('points each view at a copy on this site, with a poster', () => {
    for (const v of Object.values(VIEWS)) {
      expect(v.src).toMatch(/^\/work\/tuck\//);
      expect(v.poster).toMatch(/^\/work\/tuck\/poster-/);
    }
  });
});
