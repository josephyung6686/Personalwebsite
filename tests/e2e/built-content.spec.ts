import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/* Reads the production build. The embedded onboarding keeps its own wording until its owner decides. */
const DIST = 'dist';
const EXEMPT = join(DIST, 'work/tuck/onboarding');

function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (p === EXEMPT) return [];
    return e.isDirectory() ? pages(p) : e.name.endsWith('.html') ? [p] : [];
  });
}

test('no leftover names in any built page', () => {
  const all = pages(DIST);
  expect(all).toContain(join(DIST, 'index.html'));
  expect(all).toContain(join(DIST, 'work/tuck/index.html'));
  expect(all).toContain(join(DIST, 'work/tuck/app/brain.html'));
  expect(all).not.toContain(join(EXEMPT, 'index.html'));
  const hits = all.flatMap((f) => {
    const found = readFileSync(f, 'utf8').match(/cofounder|koala|alanakwan/gi);
    return found ? [`${f}: ${[...new Set(found.map((w) => w.toLowerCase()))].join(', ')}`] : [];
  });
  expect(hits).toEqual([]);
});
