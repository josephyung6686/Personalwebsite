// Fails a production build while any [TODO …] placeholder is left in the site's data.
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Dotted paths of every string value that still contains "[TODO". */
export function findPlaceholders(value, path = '') {
  if (typeof value === 'string') return value.includes('[TODO') ? [path] : [];
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => findPlaceholders(v, path ? `${path}.${k}` : k));
  }
  return [];
}

export function checkRelease(env, data) {
  if (env !== 'production') return;
  const left = findPlaceholders(data);
  if (left.length) throw new Error(`Placeholders left before a production deploy: ${left.join(', ')}`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  // Data files are TypeScript; read them as text and check the literal source for placeholders.
  const sources = ['src/data/site.ts', 'src/data/wins.ts', 'src/data/projects.ts', 'src/data/experience.ts',
    ...['tuck', 'doom-drive', 'kwungfund', 'nutrigene', 'aikonic', 'grc', 'ey', 'morphogenesis'].map((f) => `src/content/work/${f}.md`)];
  const data = Object.fromEntries(sources.map((f) => [f, readFileSync(f, 'utf8')]));
  checkRelease(process.env.VERCEL_ENV, data);
  console.log(process.env.VERCEL_ENV === 'production' ? 'release check passed' : 'release check skipped (not a production build)');
}
