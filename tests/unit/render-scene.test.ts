import { describe, it, expect } from 'vitest';
import { mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import sharp from 'sharp';
// @ts-expect-error plain JS module
import { renderAll, renderOg, STATES } from '../../scripts/render-scene.mjs';

describe('the crayon campus', () => {
  it('draws every layer for each time of day, at the old 320:112 shape and within budget', async () => {
    const out = mkdtempSync(join(tmpdir(), 'scene-'));
    const files: string[] = await renderAll(out);
    const names = files.map((f) => basename(f));
    for (const s of STATES) for (const layer of [`scene-${s}.webp`, `scene-${s}-sm.webp`, `sky-${s}.webp`, `clouds-${s}.webp`]) expect(names).toContain(layer);
    for (const layer of ['emissive.webp', 'moon.webp', 'sun.webp', 'name-navy.webp', 'name-cream.webp']) expect(names).toContain(layer);

    const big = await sharp(join(out, 'scene-night.webp')).metadata();
    expect(big.width! / big.height!).toBeCloseTo(320 / 112, 2);
    const small = await sharp(join(out, 'scene-night-sm.webp')).metadata();
    expect(small.width).toBe(big.width! / 2);

    // One time of day downloads at a time: the visitor gets its sky, clouds and scene.
    for (const s of STATES) {
      const bytes = [`scene-${s}`, `sky-${s}`, `clouds-${s}`].reduce((n, f) => n + statSync(join(out, `${f}.webp`)).size, 0);
      expect(bytes, s).toBeLessThan(600_000);
    }

    const og = join(out, 'og.png');
    await renderOg(og, out);
    const { width, height } = await sharp(og).metadata();
    expect([width, height]).toEqual([1200, 630]);
  }, 180_000);
});
