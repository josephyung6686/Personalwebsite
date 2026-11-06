import { describe, it, expect } from 'vitest';
import { MEETINGS, PASSAGES, SUGGESTIONS, conceptsOf, crossesLanguage, fold, formatTime, search, segments, tokenize } from '../../src/components/aikonic/aikonicSearch';

const ids = (q: string, mode: 'keyword' | 'semantic' | 'both') => search(q, mode).map((h) => h.passage.id);

describe('sample transcripts', () => {
  it('cover English, Cantonese and Mandarin', () => {
    expect(new Set(MEETINGS.map((m) => m.lang))).toEqual(new Set(['en', 'yue', 'cmn']));
  });
  it('every passage maps back to a timestamp inside its meeting, in order', () => {
    for (const m of MEETINGS) {
      const starts = m.passages.map((p) => p.start);
      expect(starts).toEqual([...starts].sort((a, b) => a - b));
      expect(Math.max(...starts)).toBeLessThan(m.duration);
    }
  });
  it('passage ids are unique', () => {
    expect(new Set(PASSAGES.map((p) => p.id)).size).toBe(PASSAGES.length);
  });
  it('formats a timestamp as minutes and seconds', () => {
    expect(formatTime(562)).toBe('09:22');
    expect(formatTime(61)).toBe('01:01');
  });
});

describe('tokenizing', () => {
  it('folds case and Traditional to Simplified without changing length, so highlights line up', () => {
    expect(fold('供應商 PO-8812')).toBe('供应商 po-8812');
    for (const p of PASSAGES) expect(fold(p.text)).toHaveLength(p.text.length);
  });
  it('splits Latin into words, drops stop words, and light-stems plurals', () => {
    expect(tokenize('Why are the refunds late?', true)).toEqual(['refund', 'late']);
  });
  it('keeps a code whole and also searchable by its parts', () => {
    expect(tokenize('PO-8812', true)).toEqual(['po-8812', 'po', '8812']);
  });
  it('uses character pairs for Chinese, and the single character for a one-character query', () => {
    expect(tokenize('退款', true)).toEqual(['退款']);
    expect(tokenize('供应商', true)).toEqual(['供应', '应商']);
    expect(tokenize('货', true)).toEqual(['货']);
  });
});

describe('concept map', () => {
  it('links the same idea across English, Traditional and Simplified', () => {
    expect(conceptsOf('refund')).toEqual(conceptsOf('退款'));
    expect(conceptsOf('回水')).toEqual(conceptsOf('退款'));
    expect(conceptsOf('供應商')).toEqual(conceptsOf('supplier'));
  });
  it('matches whole words only, so "translate" is not "late"', () => {
    expect(conceptsOf('translate')).toEqual(conceptsOf('xylophone'));
    expect(conceptsOf('late').size).toBe(1);
  });
});

describe('ranking', () => {
  it('finds nothing for an empty or blank query', () => {
    for (const mode of ['keyword', 'semantic', 'both'] as const) {
      expect(search('', mode)).toEqual([]);
      expect(search('   ', mode)).toEqual([]);
    }
  });
  it('finds nothing for words no passage is about', () => {
    for (const mode of ['keyword', 'semantic', 'both'] as const) expect(search('xylophone', mode)).toEqual([]);
  });

  it('an English query reaches the Cantonese and Mandarin passages only through meaning', () => {
    const keyword = search('supplier delay', 'keyword');
    expect(keyword.map((h) => h.passage.lang)).toEqual(['en']);
    const langs = new Set(search('supplier delay', 'semantic').map((h) => h.passage.lang));
    expect(langs).toEqual(new Set(['en', 'yue', 'cmn']));
  });
  it('a Chinese query finds the English passage and the Cantonese slang for it', () => {
    expect(new Set(search('退款', 'keyword').map((h) => h.passage.lang))).toEqual(new Set(['cmn']));
    const sem = search('退款', 'semantic');
    expect(sem.some((h) => h.passage.lang === 'en' && /refund/i.test(h.passage.text))).toBe(true);
    expect(sem.some((h) => h.passage.lang === 'yue' && h.passage.text.includes('回水'))).toBe(true);
  });
  it('an exact code is keyword territory: meaning misses it, hybrid keeps it', () => {
    expect(ids('PO-8812', 'semantic')).toEqual([]);
    expect(ids('PO-8812', 'keyword')).toHaveLength(1);
    expect(ids('PO-8812', 'both')).toEqual(ids('PO-8812', 'keyword'));
  });
  it('searches in either Chinese script', () => {
    const trad = search('供應商', 'keyword').map((h) => h.passage.lang);
    expect(new Set(trad)).toEqual(new Set(['yue', 'cmn']));
    expect(ids('供應商', 'keyword')).toEqual(ids('供应商', 'keyword'));
  });
  it('never matches on the English gloss, or crossing languages would be a trick', () => {
    const glossOnly = PASSAGES.find((p) => p.gloss?.toLowerCase().includes('supplier') && p.lang !== 'en')!;
    expect(glossOnly).toBeTruthy();
    expect(ids('supplier', 'keyword')).not.toContain(glossOnly.id);
  });

  it('hybrid returns everything either list found', () => {
    for (const q of ['supplier delay', '退款', 'PO-8812', 'why is the opening late']) {
      const both = new Set(ids(q, 'both'));
      for (const id of [...ids(q, 'keyword'), ...ids(q, 'semantic')]) expect(both.has(id)).toBe(true);
    }
  });
  it('hybrid ranks a passage both lists agree on above one only a single list found', () => {
    const hits = search('supplier delay', 'both');
    expect(hits[0].keyword && hits[0].semantic).toBe(true);
    const firstSingle = hits.findIndex((h) => !(h.keyword && h.semantic));
    const lastDouble = hits.map((h) => h.keyword && h.semantic).lastIndexOf(true);
    if (firstSingle >= 0) expect(lastDouble).toBeLessThan(firstSingle);
  });
  it('a paraphrase with few shared words surfaces the real answer first under hybrid', () => {
    const top = search('why is the opening late', 'both')[0];
    expect(top.passage.text).toMatch(/opening/i);
    expect(top.semantic).toBe(true);
  });
  it('flags a hit that crossed languages', () => {
    const yue = PASSAGES.find((p) => p.lang === 'yue')!;
    const en = PASSAGES.find((p) => p.lang === 'en')!;
    expect(crossesLanguage('supplier delay', yue)).toBe(true);
    expect(crossesLanguage('supplier delay', en)).toBe(false);
    expect(crossesLanguage('退款', en)).toBe(true);
    expect(crossesLanguage('退款', yue)).toBe(false);
  });
  it('flags which list found each hit', () => {
    const hits = search('supplier delay', 'both');
    expect(hits.some((h) => h.keyword)).toBe(true);
    expect(hits.some((h) => h.semantic && !h.keyword)).toBe(true);
    expect(search('supplier delay', 'keyword').every((h) => h.keyword && !h.semantic)).toBe(true);
    expect(search('supplier delay', 'semantic').every((h) => h.semantic && !h.keyword)).toBe(true);
  });
  it('is deterministic, with ties in transcript order', () => {
    expect(ids('budget', 'both')).toEqual(ids('budget', 'both'));
    const q = search('training', 'semantic');
    const tied = q.filter((h) => h.score === q[0].score).map((h) => PASSAGES.indexOf(h.passage));
    expect(tied).toEqual([...tied].sort((a, b) => a - b));
  });
});

describe('suggested queries', () => {
  it('each returns results, and at least one crosses languages', () => {
    for (const s of SUGGESTIONS) expect(search(s.query, 'both').length).toBeGreaterThan(0);
    const crossing = SUGGESTIONS.filter((s) => {
      const langs = new Set(search(s.query, 'both').map((h) => h.passage.lang));
      return langs.size > 1;
    });
    expect(crossing.length).toBeGreaterThanOrEqual(1);
  });
});

describe('highlighting', () => {
  it('splits a passage into pieces that rebuild it exactly', () => {
    for (const h of search('supplier delay', 'both')) {
      expect(segments(h, 'supplier delay', 'both').map((s) => s.text).join('')).toBe(h.passage.text);
    }
  });
  it('marks the literal word as keyword and a related word as meaning', () => {
    const hit = search('supplier delay', 'both').find((h) => h.passage.text.includes('供應商'))!;
    const marks = segments(hit, 'supplier delay', 'both').filter((s) => s.kind);
    expect(marks.some((m) => m.kind === 'meaning' && m.text === '供應商')).toBe(true);
    const en = search('supplier delay', 'keyword')[0];
    const kw = segments(en, 'supplier delay', 'keyword').filter((s) => s.kind);
    expect(kw.map((k) => k.text.toLowerCase())).toContain('supplier');
    expect(kw.every((k) => k.kind === 'keyword')).toBe(true);
  });
  it('marks only what the current mode actually used', () => {
    const hit = search('supplier delay', 'keyword')[0];
    expect(segments(hit, 'supplier delay', 'semantic').filter((s) => s.kind === 'keyword')).toEqual([]);
  });
});

describe('no em dashes in anything visible', () => {
  it('holds for the transcripts, glosses and suggestions', () => {
    const all = [...PASSAGES.flatMap((p) => [p.text, p.gloss ?? '', p.speaker]), ...MEETINGS.map((m) => m.title), ...SUGGESTIONS.flatMap((s) => [s.query, s.hint])].join(' ');
    expect(all).not.toMatch(/—/);
  });
});
