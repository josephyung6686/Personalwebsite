import { describe, it, expect } from 'vitest';
import { mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import sharp from 'sharp';
// @ts-expect-error plain JS module
import { renderAll } from '../../scripts/render-scene.mjs';

describe('renderAll', () => {
  it('writes 10 native-size PNGs under the weight budget', async () => {
    const out = mkdtempSync(join(tmpdir(), 'scene-'));
    const files: string[] = await renderAll('design/scene-src', out);
    expect(files).toHaveLength(10);
    let heroBytes = 0;
    for (const f of files) {
      const { width, height } = await sharp(f).metadata();
      const name = basename(f);
      expect(width).toBe(320);
      expect(height).toBe(name.startsWith('scene-') || name === 'emissive.png' ? 112 : 200);
      if (name.startsWith('scene-') || name.startsWith('sky-')) heroBytes += statSync(f).size;
    }
    expect(heroBytes).toBeLessThan(250_000);
  });
});

describe('renderOg', () => {
  it('writes a 1200x630 share image', async () => {
    // @ts-expect-error plain JS module
    const { renderOg } = await import('../../scripts/render-scene.mjs');
    const out = join(mkdtempSync(join(tmpdir(), 'og-')), 'og.png');
    await renderOg(out);
    const { width, height } = await sharp(out).metadata();
    expect([width, height]).toEqual([1200, 630]);
  });
});
