import { describe, it, expect } from 'vitest';
import { BRAIN_START, reduceBrain, nodeOf, related, crumbs, search, unsure, lit, fileCount, renderInspector, renderMap } from '../../src/components/tuck/phone/tuckBrain';
import { START, reduce } from '../../src/components/tuck/phone/tuckPhone';

describe('the map data', () => {
  it('holds the prototype: 315 files under You, nine parts of life, six unsure', () => {
    expect(fileCount('you')).toBe(315);
    expect(fileCount('phys')).toBe(26);
    expect(unsure(START).size).toBe(6);
  });
  it('resolves files by topic and index, keeping the disk path', () => {
    const f = nodeOf('phys#0')!;
    expect(f.k).toBe('file');
    expect(f.p).toBe('phys');
    expect(f.path).toMatch(/^~\//);
  });
  it('has no long dashes and no founder wording in anything it can show', () => {
    expect(renderMap() + ['you', 'study', 'phys', 'lb', 'p-alv'].map((id) => renderInspector(id, START)).join('')).not.toMatch(/[–—]|founder/i);
  });
});

describe('the Brain reducer', () => {
  it('selects, clears, filters and searches, changing only that', () => {
    const s = reduceBrain(BRAIN_START, { type: 'select', id: 'phys' });
    expect(s).toEqual({ ...BRAIN_START, sel: 'phys' });
    expect(reduceBrain(s, { type: 'clear' }).sel).toBeNull();
    expect(reduceBrain(s, { type: 'filter', filter: 'unsure' })).toEqual({ ...s, filter: 'unsure' });
    expect(reduceBrain(s, { type: 'query', q: 'lab' }).q).toBe('lab');
  });
});

describe('what lights up', () => {
  it('a node relates to its ancestors, children, people and relations', () => {
    const r = related('phys');
    for (const id of ['phys', 'study', 'you', 'lb', 'p-alv', 'p-maya']) expect(r.has(id)).toBe(true);
    expect(r.has('health')).toBe(false);
  });
  it('nothing is dimmed at rest', () => {
    expect(lit(BRAIN_START, START)).toBeNull();
  });
  it('Unsure lights the six and the way back to You, and shrinks as decisions are answered', () => {
    const s = reduceBrain(BRAIN_START, { type: 'filter', filter: 'unsure' });
    const on = lit(s, START)!;
    for (const id of ['lb', 'phys', 'study', 'you']) expect(on.has(id)).toBe(true);
    expect(on.has('health')).toBe(false);
    const answered = reduce(START, { type: 'answer', kind: 'yes' });
    expect(unsure(answered).size).toBe(5);
    expect(lit(s, answered)!.has('lb')).toBe(false);
  });
  it('a selection wins over the filter', () => {
    const s = reduceBrain(reduceBrain(BRAIN_START, { type: 'filter', filter: 'unsure' }), { type: 'select', id: 'health' });
    expect(lit(s, START)!.has('health')).toBe(true);
  });
});

describe('find a topic or file', () => {
  it('finds folders first, then files, case-insensitively', () => {
    const r = search('PHYS');
    expect(r[0].id).toBe('phys');
    expect(search('lecture 6 grav')[0].label).toBe('Lecture 6 Gravity.pdf');
    expect(search('lecture 6 grav')[0].id).toContain('phys#');
  });
  it('needs two letters and caps its list', () => {
    expect(search('p')).toEqual([]);
    expect(search('la').length).toBeLessThanOrEqual(7);
    expect(search('zzzz')).toEqual([]);
  });
});

describe('the inspector', () => {
  it('walks back to You in the breadcrumbs', () => {
    expect(crumbs('lb').map((c) => c.label)).toEqual(['You', 'Studying', 'PHYS 1401', 'Labs']);
  });
  it('shows detail, connected nodes and files', () => {
    const h = renderInspector('phys', START);
    for (const t of ['PHYS 1401', 'In Studying', '26 files', 'Your physics course', 'Connected to', 'Prof. Alvarez', 'Lecture 6 Gravity.pdf']) expect(h).toContain(t);
    expect(h).toContain('data-go="study"');
  });
  it('asks the open question and links it to Needs You', () => {
    const h = renderInspector('lb', START);
    expect(h).toContain('Make a Labs folder in PHYS 1401?');
    expect(h).toContain('data-ans="yes"');
    expect(h).toContain('data-needs="0"');
  });
  it('after the answer it reports it instead of asking', () => {
    const h = renderInspector('lb', reduce(START, { type: 'answer', kind: 'yes' }));
    expect(h).toContain('Done: 12 files in Labs');
    expect(h).not.toContain('data-ans="yes"');
  });
  it('says private files are never sent to AI, and that nothing moved', () => {
    expect(renderInspector('tax', START)).toContain('Private: never sent to AI');
    expect(renderInspector('phys#0', START)).toContain('Nothing moved on disk');
  });
});

describe('the map markup', () => {
  it('draws one focusable node per hub, topic and person, one tab stop in all', () => {
    const h = renderMap();
    expect(h.match(/class="tb-n/g)!.length).toBeGreaterThan(45);
    expect(h.match(/tabindex="0"/g)).toHaveLength(1);
    expect(h).toContain('aria-label="PHYS 1401, 26 files"');
  });
});
