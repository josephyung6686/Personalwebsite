import { describe, it, expect } from 'vitest';
import {
  DECISIONS, START, reduce, doneCount, filesWaiting, included, isFinished, yesLabel, accepted,
  actionForKey, statusFor, renderList, renderDetail,
} from '../../src/components/tuck/phone/tuckPhone';

const yes = { type: 'answer', kind: 'yes' } as const;
const no = { type: 'answer', kind: 'no' } as const;
const skip = { type: 'skip' } as const;

describe('the sample decisions', () => {
  it('are the six from the prototype, in order, with their real titles and labels', () => {
    expect(DECISIONS.map((d) => d.type)).toEqual(['New folder', 'Where it goes', 'Old versions', 'Duplicate folders', 'Private file', 'Folder fit']);
    expect(DECISIONS.map((d) => d.title)).toEqual([
      'Make a Labs folder in PHYS 1401', 'File IMG_2210.HEIC in PHYS 1401', 'Move 7 older resumes into Old Resumes',
      'Combine the two Website Proposal folders', 'Keep Barnard club budget.xlsx private', 'Keep Robotics club in Projects',
    ]);
    expect(DECISIONS.map((d) => d.files.length)).toEqual([12, 1, 7, 14, 1, 10]);
  });
  it('start at 0 of 6 done with 45 files waiting', () => {
    expect(START.i).toBe(0);
    expect(doneCount(START)).toBe(0);
    expect(filesWaiting(START)).toBe(45);
    expect(isFinished(START)).toBe(false);
  });
});

describe('answering', () => {
  it('Yes records the answer, advances, and drops the files waiting', () => {
    const s = reduce(START, yes);
    expect(s.answers.labs).toEqual({ kind: 'yes', n: 12, to: ['Studying', 'PHYS 1401', 'Labs'] });
    expect(s.i).toBe(1);
    expect(doneCount(s)).toBe(1);
    expect(filesWaiting(s)).toBe(33);
  });
  it('No also advances and counts as done, but does not accept', () => {
    const s = reduce(START, no);
    expect(s.answers.labs.kind).toBe('no');
    expect(s.i).toBe(1);
    expect(doneCount(s)).toBe(1);
    expect(accepted(START, s)).toBe(false);
  });
  it('only a Yes or Accept all counts as accepting', () => {
    expect(accepted(START, reduce(START, yes))).toBe(true);
    expect(accepted(START, reduce(START, { type: 'acceptAll' }))).toBe(true);
    expect(accepted(START, reduce(START, skip))).toBe(false);
    expect(accepted(START, reduce(START, { type: 'open', i: 3 }))).toBe(false);
  });
  it('an answered decision ignores a second answer', () => {
    const s = reduce(reduce(START, yes), { type: 'open', i: 0 });
    expect(reduce(s, no)).toBe(s);
    expect(reduce(s, skip)).toBe(s);
    expect(reduce(s, { type: 'toggle', file: 'Lab 7.pdf' })).toBe(s);
  });
  it('the sixth answer finishes: no decision is open and nothing waits', () => {
    let s = START;
    for (let k = 0; k < 5; k++) s = reduce(s, yes);
    expect(isFinished(s)).toBe(false);
    expect(s.i).toBe(5);
    s = reduce(s, no);
    expect(isFinished(s)).toBe(true);
    expect(s.i).toBeNull();
    expect(doneCount(s)).toBe(6);
    expect(filesWaiting(s)).toBe(0);
  });
});

describe('skip', () => {
  it('advances without counting as done, and keeps its files waiting', () => {
    const s = reduce(START, skip);
    expect(s.i).toBe(1);
    expect(s.skipped).toEqual(['labs']);
    expect(doneCount(s)).toBe(0);
    expect(filesWaiting(s)).toBe(45);
  });
  it('a skipped decision comes back after the others', () => {
    let s = reduce(START, skip);
    for (let k = 0; k < 5; k++) s = reduce(s, yes);
    expect(s.i).toBe(0);
    expect(isFinished(s)).toBe(false);
    s = reduce(s, yes);
    expect(s.skipped).toEqual([]);
    expect(isFinished(s)).toBe(true);
  });
  it('skipping the only one left stays on it', () => {
    let s = START;
    for (let k = 0; k < 5; k++) s = reduce(s, yes);
    expect(reduce(s, skip).i).toBe(5);
  });
});

describe('file checkboxes', () => {
  it('unticking updates the count in the primary button and the files waiting', () => {
    expect(yesLabel(START, 0)).toBe('Make Labs and move 12 files');
    const s = reduce(START, { type: 'toggle', file: 'Lab 7.pdf' });
    expect(included(s, 0)).toBe(11);
    expect(yesLabel(s, 0)).toBe('Make Labs and move 11 files');
    expect(filesWaiting(s)).toBe(44);
    expect(reduce(s, { type: 'toggle', file: 'Lab 7.pdf' }).out.labs).toEqual([]);
  });
  it('says 1 file, not 1 files', () => {
    let s = START;
    for (const f of DECISIONS[0].files.slice(1)) s = reduce(s, { type: 'toggle', file: f[0] });
    expect(yesLabel(s, 0)).toBe('Make Labs and move 1 file');
  });
  it('with nothing ticked Yes does nothing, but No still works', () => {
    const s = reduce(START, { type: 'tickAll' });
    expect(included(s, 0)).toBe(0);
    expect(reduce(s, yes)).toBe(s);
    expect(doneCount(reduce(s, no))).toBe(1);
    expect(included(reduce(s, { type: 'tickAll' }), 0)).toBe(12);
  });
  it('a Yes records only the ticked files', () => {
    const s = reduce(reduce(START, { type: 'toggle', file: 'Lab 1.pdf' }), yes);
    expect(s.answers.labs.n).toBe(11);
  });
  it('each decision keeps its own ticks while you move between rows', () => {
    const s = reduce(reduce(START, { type: 'toggle', file: 'Lab 1.pdf' }), { type: 'open', i: 3 });
    expect(included(s, 0)).toBe(11);
    expect(included(s, 3)).toBe(14);
  });
});

describe('choosing a folder', () => {
  it('changes where the files go and the primary button; Yes commits there', () => {
    const s = reduce(START, { type: 'dest', path: ['Studying', 'PHYS 1401', 'Lab Reports'] });
    expect(s.i).toBe(0);
    expect(doneCount(s)).toBe(0);
    expect(yesLabel(s, 0)).toBe('Move 12 files to Lab Reports');
    expect(reduce(s, yes).answers.labs.to).toEqual(['Studying', 'PHYS 1401', 'Lab Reports']);
  });
  it("can go back to Tuck's pick", () => {
    const s = reduce(reduce(START, { type: 'dest', path: ['Studying'] }), { type: 'dest', path: null });
    expect(yesLabel(s, 0)).toBe('Make Labs and move 12 files');
  });
});

describe('rows, Accept all, undo, start over', () => {
  it('a row opens its decision', () => {
    expect(reduce(START, { type: 'open', i: 4 }).i).toBe(4);
  });
  it('Accept all finishes everything, keeping any unticked files out', () => {
    const s = reduce(reduce(START, { type: 'toggle', file: 'Lab 1.pdf' }), { type: 'acceptAll' });
    expect(isFinished(s)).toBe(true);
    expect(s.i).toBeNull();
    expect(doneCount(s)).toBe(6);
    expect(filesWaiting(s)).toBe(0);
    expect(s.answers.labs.n).toBe(11);
    expect(Object.values(s.answers).every((a) => a.kind === 'yes')).toBe(true);
  });
  it('Accept all keeps answers already given as No', () => {
    expect(reduce(reduce(START, no), { type: 'acceptAll' }).answers.labs.kind).toBe('no');
  });
  it('Accept all with every file unticked still accepts that decision whole', () => {
    expect(reduce(reduce(START, { type: 'tickAll' }), { type: 'acceptAll' }).answers.labs.n).toBe(12);
  });
  it('undo puts an answered decision back in the queue', () => {
    const s = reduce(reduce(reduce(START, yes), { type: 'open', i: 0 }), { type: 'undo' });
    expect(s.answers.labs).toBeUndefined();
    expect(s.i).toBe(0);
    expect(filesWaiting(s)).toBe(45);
  });
  it('undo after finishing leaves the done state', () => {
    let s = reduce(START, { type: 'acceptAll' });
    s = reduce(reduce(s, { type: 'open', i: 2 }), { type: 'undo' });
    expect(isFinished(s)).toBe(false);
    expect(doneCount(s)).toBe(5);
  });
  it('start over is exactly the first state', () => {
    expect(reduce(reduce(START, { type: 'acceptAll' }), { type: 'restart' })).toEqual(START);
  });
  it('actions on the done state do nothing', () => {
    const s = reduce(START, { type: 'acceptAll' });
    expect(reduce(s, yes)).toBe(s);
    expect(reduce(s, skip)).toBe(s);
    expect(reduce(s, { type: 'acceptAll' })).toBe(s);
  });
});

describe('keys', () => {
  it('map Y, N and S to answers in either case, and leave everything else alone', () => {
    expect(actionForKey('y')).toEqual(yes);
    expect(actionForKey('Y')).toEqual(yes);
    expect(actionForKey('n')).toEqual(no);
    expect(actionForKey('s')).toEqual(skip);
    for (const k of ['c', ' ', 'ArrowDown', 'PageDown', 'Tab', 'Enter', 'x']) expect(actionForKey(k)).toBeNull();
  });
});

describe('what a screen reader hears', () => {
  it('names the answer and what is next', () => {
    expect(statusFor(START, reduce(START, yes), yes)).toBe('Done: 12 files in Labs. 1 of 6 done. Next: File IMG_2210.HEIC in PHYS 1401.');
    expect(statusFor(START, reduce(START, no), no)).toContain('Left as is');
    expect(statusFor(START, reduce(START, skip), skip)).toContain('Skipped: Make a Labs folder in PHYS 1401.');
  });
  it('says nothing moved when finished', () => {
    const a = { type: 'acceptAll' } as const;
    expect(statusFor(START, reduce(START, a), a)).toBe('All 6 answered. Nothing moved on disk.');
  });
  it('counts ticks', () => {
    const a = { type: 'toggle', file: 'Lab 7.pdf' } as const;
    expect(statusFor(START, reduce(START, a), a)).toBe('11 of 12 files included.');
  });
});

describe('rendering', () => {
  it('the list shows the header, progress and every row', () => {
    const h = renderList(START);
    expect(h).toContain('6 decisions waiting. Nothing changes until you answer.');
    expect(h).toContain('0 of 6 done');
    expect(h).toContain('45 files waiting');
    expect(h).toContain('Accept all 6');
    expect(h).toContain('role="progressbar"');
    expect(h).toContain('aria-valuenow="0"');
    expect(h).toContain('Nothing moves on disk. Every answer can be undone in History.');
    expect(h.match(/data-q="/g)).toHaveLength(6);
  });
  it('the list marks answered and skipped rows and keeps them clickable', () => {
    const h = renderList(reduce(reduce(START, yes), skip));
    expect(h).toContain('1 of 6 done');
    expect(h).toContain('33 files waiting');
    expect(h).toContain('Accept all 5');
    expect(h).toContain('>Done<');
    expect(h).toContain('>Skipped<');
    expect(h.match(/data-q="/g)).toHaveLength(6);
  });
  it('one decision left has no Accept all, and says decision not decisions', () => {
    let s = START;
    for (let k = 0; k < 5; k++) s = reduce(s, yes);
    const h = renderList(s);
    expect(h).toContain('1 decision waiting.');
    expect(h).not.toContain('Accept all');
  });
  it('the detail shows the chip, position, title, files and all four actions', () => {
    const h = renderDetail(START);
    for (const t of ['New folder', 'Decision 1 of 6', 'Make a Labs folder in PHYS 1401', 'Lab 7.pdf', '12 of 12 included',
      'Make Labs and move 12 files', 'Leave them in PHYS 1401', 'Choose folder', 'Skip', 'Goes to', 'new folder']) expect(h).toContain(t);
    expect(h.match(/type="checkbox"/g)).toHaveLength(12);
    expect(h).toContain('role="menu"');
  });
  it('the detail disables Yes when no file is ticked', () => {
    expect(renderDetail(reduce(START, { type: 'tickAll' }))).toMatch(/data-a="yes"[^>]*disabled/);
    expect(renderDetail(START)).not.toMatch(/data-a="yes"[^>]*disabled/);
  });
  it('the private decision says private, and the menu leaves out where it already goes', () => {
    const s = reduce(START, { type: 'open', i: 4 });
    expect(renderDetail(s)).toContain('Private: never sent to AI');
    expect(renderDetail(s).match(/role="menuitemradio"/g)).toHaveLength(2);
  });
  it('an answered decision offers Undo instead of the actions', () => {
    const h = renderDetail(reduce(reduce(START, yes), { type: 'open', i: 0 }));
    expect(h).toContain('Done: 12 files in Labs');
    expect(h).toContain('data-undo');
    expect(h).not.toContain('data-a="yes"');
  });
  it('the done state says nothing moved on disk and offers Start over', () => {
    const h = renderDetail(reduce(START, { type: 'acceptAll' }));
    expect(h).toContain('Nothing moved on disk');
    expect(h).toContain('Start over');
    expect(h).not.toContain('data-a="yes"');
  });
});
