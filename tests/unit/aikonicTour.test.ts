import { describe, it, expect } from 'vitest';
import { BUILT } from '../../src/components/aikonic/aikonicBuilt';
import { tabForKey } from '../../src/components/aikonic/aikonicDom';
import { FOLDERS, MEETINGS, meetingById, folderOf } from '../../src/components/aikonic/aikonicSearch';
import { NOTES, flatten, loadTodos, saveTodos, TODO_KEY } from '../../src/components/aikonic/aikonicNotes';
import { STEPS } from '../../src/components/aikonic/aikonicGuide';
import { GROUPS, RUNS, TOOL_COUNT, COMMANDS, interpret, replyFor, type ToolCall } from '../../src/components/aikonic/featureTools';
import { outlineFor } from '../../src/components/aikonic/featureSlides';
import { ASK_PROMPTS } from '../../src/components/aikonic/aikonicSearch';
import { FACTS, RACE_RUNS, dayOf, factAt, runPipeline, statusAt } from '../../src/components/aikonic/featureMemory';
import { END, PLAY_READY, SEGMENTS, SEQUENTIAL, CONCURRENT, STAGES, TTS_START, durationPolicy, schedule, speedup, stateAt } from '../../src/components/aikonic/featurePodcast';
import { available, linkReduce, sessionPlan, LINKS } from '../../src/components/aikonic/featureDesktop';
import { LOCALES, STRINGS, noteFor } from '../../src/components/aikonic/featurePhone';

// His report's own wording. A line may split one of his sentences across two features, but it may not change a verb.
const REPORT = [
  'Implemented hybrid retrieval, citation safeguards, and multilingual chunking improvements.',
  'Implemented 21 folder-scoped agent tools.',
  'Applied temporal fact versioning and redesigned asynchronous context dependencies to reduce race conditions.',
  'Converted a single-model workflow into a multi-stage agentic pipeline and reduced text-to-speech generation time by approximately 3x.',
  'Improved dual Bluetooth connectivity, session initialization, reconnection behavior, translation, recording reliability and added most app features.',
  'Resolved silent failures, improved structured content rendering, persistent task states, localization, and user feedback.',
];

describe('the product', () => {
  it('every recording in the sidebar is a real meeting with a transcript, in exactly one folder', () => {
    const inFolders = FOLDERS.flatMap((f) => f.meetings).sort();
    expect(inFolders).toEqual(MEETINGS.map((m) => m.id).sort());
    expect(new Set(inFolders).size).toBe(inFolders.length);
    for (const id of inFolders) {
      expect(meetingById(id).passages.length).toBeGreaterThan(0);
      expect(folderOf(id).meetings).toContain(id);
    }
  });
  it('every recording has a summary and to-dos', () => {
    for (const m of MEETINGS) {
      expect(NOTES[m.id].blocks.length).toBeGreaterThan(0);
      expect(NOTES[m.id].todos.length).toBeGreaterThan(0);
    }
  });
  it('to-do ids never collide across recordings, because they share one saved set', () => {
    const ids = Object.values(NOTES).flatMap((n) => n.todos.map((t) => t.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('the sub-tabs follow the WAI-ARIA keys, wrapping at the ends', () => {
    const ids = ['transcript', 'summary', 'todos'];
    expect(tabForKey(ids, 'transcript', 'ArrowRight')).toBe('summary');
    expect(tabForKey(ids, 'transcript', 'ArrowLeft')).toBe('todos');
    expect(tabForKey(ids, 'todos', 'ArrowRight')).toBe('transcript');
    expect(tabForKey(ids, 'summary', 'Home')).toBe('transcript');
    expect(tabForKey(ids, 'summary', 'End')).toBe('todos');
    expect(tabForKey(ids, 'summary', 'a')).toBeNull();
  });
});

describe('the guide', () => {
  it('has about six steps, each with a target, plain words and an invitation', () => {
    expect(STEPS).toHaveLength(6);
    for (const s of STEPS) {
      expect(s.spot.length).toBeGreaterThan(0);
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.does.length).toBeGreaterThan(20);
      expect(s.tryIt).toMatch(/^Try it: /);
    }
  });
  it('says what he built in his report’s words, covering all six', () => {
    expect(STEPS.map((s) => s.built)).toEqual(REPORT);
    expect(Object.values(BUILT)).toEqual(REPORT);
  });
  it('says no founder wording, and nothing stronger than the report', () => {
    const copy = STEPS.map((s) => `${s.title} ${s.does} ${s.tryIt}`).join(' ').toLowerCase();
    for (const word of ['founder', 'built', 'led ', 'architected', 'spearheaded', 'owned']) expect(copy).not.toContain(word);
  });
});

describe('agent tools', () => {
  it('names 21 and his six capability groups, and invents no tool names', () => {
    expect(TOOL_COUNT).toBe(21);
    expect(GROUPS.map((g) => g.name)).toEqual([
      'Generate a podcast episode from an individual recording or folder',
      'Produce or regenerate a meeting summary',
      'Edit transcript and summary files',
      'Move and reorganize recordings between folders',
      'Trigger correction and memory operations',
      'Manage recordings through conversational commands',
    ]);
    for (const c of COMMANDS) {
      const r = interpret(c, 'stores', 'Q3 launch sync');
      expect(JSON.stringify(r)).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });
  it('every suggested command reaches a group, and together they cover all six', () => {
    const seen = new Set(COMMANDS.map((c) => {
      const r = interpret(c, 'stores', 'Q3 launch sync');
      return 'group' in r ? r.group : null;
    }));
    for (const g of GROUPS) expect(seen.has(g.id)).toBe(true);
  });
  it('runs a call inside the folder, scoped to that folder', () => {
    const r = interpret('Generate a podcast from Q3 launch sync', 'stores');
    expect(r.kind).toBe('call');
    if (r.kind === 'call') {
      expect(r.group).toBe('podcast');
      expect(r.scope).toBe('Store openings');
      expect(r.target).toBe('Q3 launch sync');
    }
  });
  it('refuses a recording outside the current folder, and allows it from its own folder', () => {
    const r = interpret('Summarize Board prep', 'stores');
    expect(r.kind).toBe('refused');
    if (r.kind === 'refused') {
      expect(r.target).toBe('Board prep');
      expect(r.owner).toBe('Finance');
    }
    expect(interpret('Summarize Board prep', 'finance').kind).toBe('call');
  });
  it('refuses a move whose destination is another folder', () => {
    expect(interpret('Move Menu review to Drafts', 'stores').kind).toBe('call');
    expect(interpret('Move Menu review to Finance', 'stores').kind).toBe('refused');
  });
  it('accepts a whole folder as a podcast source, as long as it is this one', () => {
    expect(interpret('Generate a podcast from this folder', 'stores').kind).toBe('call');
    expect(interpret('Generate a podcast from Finance', 'stores').kind).toBe('refused');
  });
  it('asks which recording when none is named, listing only what this folder can reach', () => {
    const r = interpret('Regenerate the summary', 'support');
    expect(r.kind).toBe('need-target');
    if (r.kind === 'need-target') expect(r.options).toEqual(['Customer support retro']);
  });
  it('has no general-purpose action to fall back on', () => {
    expect(interpret('Order me a pizza', 'stores').kind).toBe('no-tool');
    expect(interpret('   ', 'stores').kind).toBe('empty');
  });
  it('ignores case', () => {
    expect(interpret('summarize BOARD PREP', 'stores').kind).toBe('refused');
  });
  it('"this" means the open recording, and a move names where it went', () => {
    const r = interpret('Move this to the Q3 folder', 'stores', 'Menu review');
    expect(r.kind).toBe('call');
    if (r.kind === 'call') {
      expect(r.group).toBe('move');
      expect(r.target).toBe('Menu review');
      expect(r.dest).toBe('Q3');
    }
  });
  it('moving this into another folder is refused, naming that folder', () => {
    const r = interpret('Move this to Finance', 'stores', 'Menu review');
    expect(r.kind).toBe('refused');
    if (r.kind === 'refused') expect(r.owner).toBe('Finance');
  });
  it('replies in a plain sentence, with no technical words on the surface', () => {
    const say = (text: string, folder = 'stores') => replyFor(interpret(text, folder, 'Q3 launch sync') as ToolCall);
    expect(say('Move this to the Q3 folder')).toBe('Moved Q3 launch sync to the Q3 folder.');
    expect(say('Summarize Board prep')).toBe('I can only work in the folder you have open, so I left Board prep alone.');
    expect(say('Summarize Board prep', 'finance')).toContain('Summarized Board prep.');
    expect(say('Move Menu review')).toBe('Where should Menu review go? Name a folder.');
    expect(say('Move this folder to Drafts')).toBe('Which recording should I move?');
    expect(say('Regenerate the summary', 'support')).toContain('Customer support retro');
    for (const c of COMMANDS) expect(say(c)).not.toMatch(/tool|capability|scope|refused|simulated|Folder:/i);
  });
  it('every suggestion succeeds, or says up front that it reaches another folder', () => {
    for (const p of ASK_PROMPTS) {
      const kind = interpret(p.text, 'stores', 'Q3 launch sync').kind;
      if (p.hint) {
        expect(kind).toBe('refused');
        expect(p.hint).toMatch(/another folder/);
        expect(interpret(p.text, p.away!, 'Board prep').kind).toBe('call');
      } else {
        expect(['call', 'no-tool']).toContain(kind);
      }
    }
  });
  it('runs slides on the open recording, inside the folder rule, without adding a group or a claim', () => {
    const r = interpret('Turn this into slides', 'stores', 'Q3 launch sync');
    expect(r.kind).toBe('call');
    if (r.kind === 'call') { expect(r.group).toBe('slides'); expect(r.target).toBe('Q3 launch sync'); }
    expect(interpret('Turn Board prep into slides', 'stores').kind).toBe('refused');
    expect(interpret('Make this a podcast', 'stores', 'Q3 launch sync').kind).toBe('call');
    expect(GROUPS.map((g) => g.id)).not.toContain('slides');
    expect(JSON.stringify(BUILT)).not.toMatch(/slides/i);
    expect(RUNS.podcast.steps).toEqual(['Analyzing', 'Writing script', 'Generating audio']);
    expect(RUNS.slides.steps).toEqual(['Reading the transcript', 'Outlining', 'Building slides']);
  });
  it('builds the sample outline from the recording’s own summary and to-dos', () => {
    const slides = outlineFor('launch', 'Q3 launch sync');
    expect(slides.map((s) => s.title)).toEqual(['Q3 launch sync', 'Decisions', 'Risks', 'To-dos']);
    expect(slides[1].points).toEqual(['Move the Kowloon opening to 21 September.']);
    expect(slides[3].points).toEqual(NOTES.launch.todos.map((t) => t.text));
  });
  it('a question is not a command, even with a command word in it', () => {
    expect(interpret('Why did the Kowloon opening move?', 'stores', 'Menu review').kind).toBe('no-tool');
    expect(interpret('what should we move next', 'stores', 'Menu review').kind).toBe('no-tool');
  });
});

describe('memory', () => {
  const FACT = FACTS[0];
  it('remembers a topic and a person', () => {
    expect(FACTS.map((f) => f.kind)).toEqual(['Topic', 'Person']);
  });
  it('keeps every version, each linked to what replaced it', () => {
    expect(FACT.versions.length).toBeGreaterThanOrEqual(3);
    for (const f of FACTS) {
      const last = f.versions[f.versions.length - 1];
      expect(last.by).toBeNull();
      expect(last.to).toBeNull();
      for (const x of f.versions.slice(0, -1)) {
        const next = f.versions.find((y) => y.id === x.by)!;
        expect(next).toBeTruthy();
        expect(x.to).toBe(next.from);
      }
    }
  });
  it('reconstructs what was true on a date, not just the latest', () => {
    const first = FACT.versions[0], second = FACT.versions[1];
    expect(factAt(FACT, dayOf(first.from))?.id).toBe(first.id);
    expect(factAt(FACT, dayOf(second.from) - 1)?.id).toBe(first.id);
    expect(factAt(FACT, dayOf(second.from))?.id).toBe(second.id);
    expect(factAt(FACT, dayOf(first.from) - 1)).toBeNull();
  });
  it('marks each version as of the date', () => {
    const second = FACT.versions[1];
    const day = dayOf(second.from);
    expect(statusAt(FACT.versions[0], day)).toBe('superseded');
    expect(statusAt(second, day)).toBe('true');
    expect(statusAt(FACT.versions[2], day)).toBe('future');
  });
  it('same-meeting facts sometimes miss the summary, prior-meeting facts never do', () => {
    const same = Array.from({ length: RACE_RUNS }, (_, n) => runPipeline(n, 'same'));
    const prior = Array.from({ length: RACE_RUNS }, (_, n) => runPipeline(n, 'prior'));
    expect(same[0].hasFacts).toBe(false);
    expect(same.some((r) => r.hasFacts)).toBe(true);
    expect(prior.every((r) => r.hasFacts)).toBe(true);
  });
  it('the race is real: facts are there only if extraction finished before the summary read them', () => {
    for (let n = 0; n < RACE_RUNS; n++) {
      const r = runPipeline(n, 'same');
      expect(r.hasFacts).toBe(r.extractEnd <= r.readAt);
    }
  });
});

describe('podcast', () => {
  it('runs his five stages in order', () => {
    expect(STAGES.map((s) => s.name)).toEqual(['Context analysis', 'Script generation', 'Director notes', 'Text-to-speech generation', 'Duration policy']);
  });
  it('concurrent text-to-speech is about 3x faster than one sequential request', () => {
    expect(SEQUENTIAL).toBe(SEGMENTS.reduce((a, s) => a + s.sim, 0));
    expect(speedup).toBeGreaterThan(2.5);
    expect(speedup).toBeLessThan(3.5);
    expect(CONCURRENT).toBeLessThan(SEQUENTIAL);
  });
  it('schedules every segment without overlapping more workers than it has', () => {
    const slots = schedule(SEGMENTS.map((s) => s.sim), 3);
    for (const t of slots.flatMap((s) => [s.start + 0.01, s.end - 0.01])) {
      expect(slots.filter((s) => s.start <= t && t < s.end).length).toBeLessThanOrEqual(3);
    }
  });
  it('segments finish out of order', () => {
    const order = stateAt(END).finishOrder;
    expect(order).not.toEqual([...order].sort((a, b) => a - b));
    expect(order).toHaveLength(SEGMENTS.length);
  });
  it('Play opens once the first segment is ready, while later ones are still generating', () => {
    expect(stateAt(PLAY_READY - 0.01).playReady).toBe(false);
    const s = stateAt(PLAY_READY);
    expect(s.playReady).toBe(true);
    expect(s.segments[0]).toBe('done');
    expect(s.segments).toContain('running');
    expect(s.seqProgress).toBeLessThan(1);
  });
  it('the sequential request has nothing to play until the very end', () => {
    expect(stateAt(TTS_START + SEQUENTIAL - 0.01).seqProgress).toBeLessThan(1);
    expect(stateAt(TTS_START + SEQUENTIAL).seqProgress).toBe(1);
  });
  it('walks the stages forward', () => {
    expect(stateAt(0).stages[0]).toBe('running');
    expect(stateAt(TTS_START).stages[3]).toBe('running');
    expect(stateAt(END).stages.every((s) => s === 'done')).toBe(true);
  });
  it('the duration policy shortens or expands to the requested length', () => {
    expect(durationPolicy(500, 300)).toEqual({ action: 'Shortens', by: 200 });
    expect(durationPolicy(500, 720)).toEqual({ action: 'Expands', by: 220 });
    expect(durationPolicy(500, 500)).toEqual({ action: 'Keeps', by: 0 });
  });
});

describe('desktop', () => {
  const up = { classic: 'connected', ble: 'connected' } as const;
  it('carries what his report says each link carries', () => {
    expect(LINKS.classic.carries).toEqual(['Microsoft Teams audio', 'Zoom audio']);
    expect(LINKS.ble.carries).toEqual(expect.arrayContaining(['Recording controls', 'Transcription', 'Translation']));
  });
  it('dropping one link leaves the other alone, and everything it carries', () => {
    const s = linkReduce(up, { type: 'drop', id: 'classic' });
    expect(s.classic).toBe('reconnecting');
    expect(s.ble).toBe('connected');
    const on = available(s);
    expect(on).toContain('Recording controls');
    expect(on).not.toContain('Zoom audio');
  });
  it('and the other way round', () => {
    const s = linkReduce(up, { type: 'drop', id: 'ble' });
    expect(s.classic).toBe('connected');
    expect(available(s)).toContain('Zoom audio');
    expect(available(s)).not.toContain('Translation');
  });
  it('reconnects without being asked', () => {
    const s = linkReduce(linkReduce(up, { type: 'drop', id: 'ble' }), { type: 'reconnected', id: 'ble' });
    expect(s).toEqual(up);
  });
  it('a pre-warmed start moves setup outside the wait', () => {
    const cold = sessionPlan('cold'), warm = sessionPlan('warm');
    expect(cold.steps.every((s) => s.start >= 0)).toBe(true);
    expect(warm.steps.filter((s) => s.end <= 0).length).toBeGreaterThanOrEqual(2);
    expect(warm.wait).toBeLessThan(cold.wait / 3);
    expect(warm.steps.map((s) => s.name)).toEqual(cold.steps.map((s) => s.name));
  });
});

describe('web and mobile', () => {
  const memory = (seed: Record<string, string> = {}) => ({
    data: { ...seed } as Record<string, string>,
    getItem(k: string) { return k in this.data ? this.data[k] : null; },
    setItem(k: string, v: string) { this.data[k] = v; },
  });
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };

  it('flattens structured blocks into one run of text, from the same data', () => {
    const blocks = [{ type: 'heading', text: 'Risks' }, { type: 'bullet', text: 'Late tea.' }] as const;
    expect(flatten([...blocks])).toBe('Risks Late tea.');
  });
  it('remembers to-do completion through storage', () => {
    const s = memory();
    expect(saveTodos(s, ['supplier'])).toBe(true);
    expect([...loadTodos(s)]).toEqual(['supplier']);
  });
  it('survives storage that throws, and says the save failed', () => {
    expect([...loadTodos(broken)]).toEqual([]);
    expect(saveTodos(broken, ['supplier'])).toBe(false);
    expect([...loadTodos(null)]).toEqual([]);
    expect(saveTodos(null, ['supplier'])).toBe(false);
  });
  it('survives junk in storage', () => {
    expect([...loadTodos(memory({ [TODO_KEY]: 'not json' }))]).toEqual([]);
    expect([...loadTodos(memory({ [TODO_KEY]: '{"a":1}' }))]).toEqual([]);
  });
  it('the phone shows the same note as the window: same blocks, same to-dos', () => {
    expect(noteFor('launch', 'en').blocks).toEqual(NOTES.launch.blocks);
    expect(noteFor('launch', 'en').todos).toEqual(NOTES.launch.todos);
    expect(noteFor('menu', 'en').blocks).toEqual(NOTES.menu.blocks);
  });
  it('translates the sample note, and says so plainly for any other', () => {
    expect(noteFor('launch', 'ja').translated).toBe(true);
    expect(noteFor('launch', 'ja').todos.map((t) => t.id)).toEqual(NOTES.launch.todos.map((t) => t.id));
    expect(noteFor('menu', 'ja').translated).toBe(false);
    expect(noteFor('menu', 'ja').blocks).toEqual(NOTES.menu.blocks);
    expect(noteFor('menu', 'en').translated).toBe(true);
  });
  it('has every string in English, Japanese and Traditional Chinese', () => {
    expect(LOCALES.map((l) => l.id)).toEqual(['en', 'ja', 'zh-Hant']);
    const keys = Object.keys(STRINGS.en).sort();
    for (const l of LOCALES) {
      expect(Object.keys(STRINGS[l.id]).sort()).toEqual(keys);
      expect(STRINGS[l.id].todos.map((t) => t.id)).toEqual(STRINGS.en.todos.map((t) => t.id));
      expect(STRINGS[l.id].blocks.map((b) => b.type)).toEqual(STRINGS.en.blocks.map((b) => b.type));
    }
    expect(STRINGS.ja.share).not.toBe(STRINGS.en.share);
    expect(STRINGS['zh-Hant'].share).not.toBe(STRINGS.ja.share);
  });
});

describe('no em or en dashes in visible text', () => {
  it('holds for all tab data', () => {
    const text = JSON.stringify([BUILT, RUNS, STEPS.map(({ title, does, tryIt }) => ({ title, does, tryIt })), GROUPS, COMMANDS, FACTS, STAGES, SEGMENTS, LINKS, STRINGS, NOTES, [...Array(RACE_RUNS).keys()].map((n) => runPipeline(n, 'same'))]);
    expect(text).not.toMatch(/[–—]/);
  });
});
