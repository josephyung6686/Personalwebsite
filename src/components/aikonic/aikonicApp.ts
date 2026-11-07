// The app window: open recording, search, Ask and the sidebar, plus lazy loading for everything heavier.
// Ranking lives in aikonicSearch.ts. Everything is written with textContent, so whatever a visitor types stays plain text.
import { BUILT } from './aikonicBuilt';
import type { ToolCall } from './featureTools';
import { el, fillOnOpen, pressGroup, reducedMotion, tabForKey } from './aikonicDom';
import { NOTES, getStore, loadTodos, saveTodos, type TodoState } from './aikonicNotes';
import {
  FOLDERS, JA_MEETING, LANG_NAME, LANG_TAG, PASSAGES, SUGGESTIONS,
  answerFor, chunkLines, citeTerm, countBySpaces, crossesLanguage, estimateLength, folderOf, formatTime, meetingById, resolveCitation, search, segments,
  type Hit, type Meeting, type Mode, type Passage,
} from './aikonicSearch';

const WHY: Record<Mode, string> = {
  keyword: 'Exact words only. It misses anything said another way or in another language.',
  semantic: 'Matches meaning across languages, but an exact code means nothing to it.',
  both: 'Keyword and semantic search run in parallel, then Reciprocal Rank Fusion merges the two rankings.',
};
const WHY_DOWN = 'Embedding service down. Keyword retrieval keeps answering instead of the whole search failing.';
const MODE_NAME: Record<Mode, string> = { keyword: 'Keyword', semantic: 'Semantic', both: 'Both' };
const SUBS = ['transcript', 'summary', 'todos'] as const;
type Sub = (typeof SUBS)[number];

const timeKey = (cls: string, p: Passage) => {
  const m = meetingById(p.meetingId);
  const b = el('button', cls, formatTime(p.start));
  b.type = 'button';
  b.dataset.jump = p.id;
  b.setAttribute('aria-label', `${formatTime(p.start)}, jump to this moment in ${m.name}`);
  return b;
};

export type App = ReturnType<typeof mountApp>;

export function mountApp(root: HTMLElement) {
  const $ = <T extends Element>(s: string) => root.querySelector<T>(s)!;
  const input = $<HTMLInputElement>('.aik-search input');
  const askInput = $<HTMLInputElement>('.aik-cmd input');
  const results = $<HTMLOListElement>('.aik-results');
  const lines = $<HTMLOListElement>('.aik-lines');
  const rail = $<HTMLElement>('.aik-rail');
  const head = $<HTMLElement>('.aik-head');
  const log = $<HTMLElement>('.aik-log');
  const subTabs = [...root.querySelectorAll<HTMLButtonElement>('.aik-subtab')];
  const store = getStore();

  let open: Meeting = meetingById('launch');
  let sub: Sub = 'transcript';
  let current: Passage | null = null;
  let mode: Mode = 'both';
  let down = false;
  let hits: Hit[] = [];
  const moved: Record<string, string> = {};

  const todos: TodoState = {
    done: loadTodos(store),
    saved: 'none',
    toggle(id, on) {
      if (on) todos.done.add(id);
      else todos.done.delete(id);
      todos.saved = saveTodos(store, todos.done) ? 'saved' : 'failed';
      if (sub === 'todos') renderSub();
    },
    reload() {
      todos.done = loadTodos(store);
      todos.saved = 'none';
      if (sub === 'todos') renderSub();
    },
  };

  /* ---------- sidebar ---------- */
  function renderSide(): void {
    for (const f of FOLDERS) {
      const box = $<HTMLElement>(`.aik-folder[data-folder="${f.id}"]`);
      const rec = (id: string) => {
        const m = meetingById(id);
        const li = el('li');
        const b = el('button', 'aik-rec');
        b.type = 'button';
        b.dataset.open = id;
        b.append(el('b', '', m.name), el('small', '', `${formatTime(m.duration)} · ${LANG_NAME[m.lang]}`));
        li.append(b);
        return li;
      };
      const list = el('ul', 'aik-recs');
      list.append(...f.meetings.filter((id) => !moved[id]).map(rec));
      const subs = new Set<string>(f.id === 'stores' ? ['Q3'] : []);
      f.meetings.forEach((id) => { if (moved[id]) subs.add(moved[id]); });
      const nodes: HTMLElement[] = [el('p', 'aik-folder-h', f.name), list];
      for (const name of subs) {
        const inside = f.meetings.filter((id) => moved[id] === name);
        const h = el('p', 'aik-sub-h', name);
        if (!inside.length) h.append(el('small', '', ' empty'));
        const subList = el('ul', 'aik-recs');
        subList.append(...inside.map(rec));
        nodes.push(h, subList);
      }
      box.replaceChildren(...nodes);
    }
    markSide();
  }
  function markSide(memory?: string): void {
    root.querySelectorAll<HTMLElement>('.aik-rec[data-open]').forEach((b) => {
      if (!memory && b.dataset.open === open.id) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
    root.querySelectorAll<HTMLElement>('.aik-rec[data-memory]').forEach((b) => {
      if (b.dataset.memory === memory) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
  }

  /* ---------- the open recording ---------- */
  function renderHeader(): void {
    $('.aik-vtitle').textContent = open.title;
    const inFolder = folderOf(open.id).name + (moved[open.id] ? ` / ${moved[open.id]}` : '');
    $('.aik-rec-meta').textContent = `${inFolder} · ${formatTime(open.duration)} · ${LANG_NAME[open.lang]}`;
    root.querySelectorAll<HTMLElement>('.aik-backname').forEach((b) => { b.textContent = open.name; });
    root.dataset.folder = folderOf(open.id).name;
    root.querySelectorAll<HTMLElement>('[data-away] small').forEach((hint) => { hint.hidden = hint.parentElement!.dataset.away === folderOf(open.id).id; });
  }

  function renderTranscript(): void {
    lines.replaceChildren(...open.passages.map((p) => {
      const li = el('li', 'aik-line');
      li.dataset.id = p.id;
      li.tabIndex = -1;
      const meta = el('div', 'aik-lmeta');
      meta.append(timeKey('aik-time alt', p), el('span', 'aik-who', p.speaker));
      const text = el('p', 'aik-ltext', p.text);
      text.lang = LANG_TAG[p.lang];
      li.append(meta, text);
      if (p.gloss) li.append(el('p', 'aik-gloss', p.gloss));
      return li;
    }));
    rail.querySelectorAll('.aik-tick').forEach((t) => t.remove());
    for (const p of open.passages) {
      const tick = el('b', 'aik-tick');
      tick.dataset.id = p.id;
      tick.style.left = `${(p.start / open.duration) * 100}%`;
      rail.append(tick);
    }
  }

  /** Marks what the current search found in the open transcript, and where the playhead sits. */
  function decorate(): void {
    const found = new Set(hits.map((h) => h.passage.id));
    lines.querySelectorAll<HTMLElement>('.aik-line').forEach((li) => {
      li.classList.toggle('hit', found.has(li.dataset.id!));
      const on = li.dataset.id === current?.id;
      li.classList.toggle('on', on);
      if (on) li.setAttribute('aria-current', 'true');
      else li.removeAttribute('aria-current');
    });
    rail.querySelectorAll<HTMLElement>('.aik-tick').forEach((t) => t.classList.toggle('hit', found.has(t.dataset.id!)));
    $<HTMLElement>('.aik-playbar').hidden = current?.meetingId !== open.id;
    const at = current?.meetingId === open.id ? current.start : 0;
    head.style.left = `${(at / open.duration) * 100}%`;
    $('.aik-vtime').textContent = `${formatTime(at)} / ${formatTime(open.duration)}`;
    results.querySelectorAll<HTMLElement>('.aik-result').forEach((r) => r.classList.toggle('on', r.dataset.id === current?.id));
  }

  function renderSub(): void {
    subTabs.forEach((t) => {
      const on = t.dataset.sub === sub;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    root.querySelectorAll<HTMLElement>('.aik-sub').forEach((p) => { p.hidden = p.dataset.sub !== sub; });
    if (sub === 'summary') {
      const box = $<HTMLElement>('.aik-sub[data-sub="summary"]');
      let list: HTMLUListElement | null = null;
      box.replaceChildren();
      for (const b of NOTES[open.id].blocks) {
        if (b.type === 'heading') { box.append(el('p', 'aik-block-h', b.text)); list = null; continue; }
        if (!list) { list = el('ul', 'aik-block-l'); box.append(list); }
        list.append(el('li', '', b.text));
      }
    }
    if (sub === 'todos') {
      const box = $<HTMLElement>('.aik-sub[data-sub="todos"]');
      const list = el('ul', 'aik-todos');
      list.append(...NOTES[open.id].todos.map((d) => {
        const li = el('li');
        const label = el('label');
        const check = el('input');
        check.type = 'checkbox';
        check.checked = todos.done.has(d.id);
        check.dataset.todo = d.id;
        label.append(check, el('span', '', d.text));
        li.append(label);
        return li;
      }));
      const saved = el('p', 'aik-saved', todos.saved === 'saved' ? 'Saved on this device' : todos.saved === 'failed' ? 'Could not save here. Check marks will reset when you leave.' : '');
      saved.dataset.state = todos.saved;
      box.replaceChildren(list, saved);
    }
  }

  function showRecording(id?: string): void {
    if (id && id !== open.id) {
      open = meetingById(id);
      current = null;
      renderHeader();
      renderTranscript();
    }
    $<HTMLElement>('.aik-v-recording').hidden = false;
    $<HTMLElement>('.aik-v-feature').hidden = true;
    root.dataset.view = 'recording';
    renderSub();
    decorate();
    markSide();
  }

  function jump(id: string, opts: { focus?: boolean } = {}): void {
    const p = PASSAGES.find((x) => x.id === id);
    if (!p) return;
    sub = 'transcript';
    showRecording(p.meetingId);
    // After opening it: opening a different recording clears the playhead.
    current = p;
    decorate();
    const line = lines.querySelector<HTMLElement>(`[data-id="${p.id}"]`);
    if (!line) return;
    line.classList.remove('flash');
    void line.offsetWidth;
    line.classList.add('flash');
    line.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
    if (opts.focus !== false) line.focus({ preventScroll: true });
  }

  /* ---------- search, in the side panel so the transcript stays in view ---------- */
  function renderResults(query: string): void {
    const summary = $<HTMLElement>('.aik-summary');
    const blank = !query.trim();
    const opts = { embeddingsDown: down };
    const counts = { keyword: search(query, 'keyword').length, semantic: search(query, 'semantic', opts).length, both: search(query, 'both', opts).length };
    root.querySelectorAll<HTMLElement>('.aik-mode').forEach((k) => {
      const m = k.dataset.mode as Mode;
      k.setAttribute('aria-pressed', String(m === mode));
      const n = k.querySelector<HTMLElement>('.n')!;
      n.hidden = blank;
      n.textContent = down && m === 'semantic' ? 'off' : String(counts[m]);
    });
    root.querySelector('.aik-switch')?.setAttribute('aria-checked', String(down));
    const why = root.querySelector<HTMLElement>('.aik-why');
    if (why) {
      why.textContent = down ? WHY_DOWN : WHY[mode];
      why.classList.toggle('down', down);
    }
    root.toggleAttribute('data-search', !blank);
    $<HTMLElement>('.aik-results-wrap').hidden = blank;
    $<HTMLElement>('.aik-ask-wrap').hidden = !blank;
    results.replaceChildren();
    summary.classList.remove('none');
    if (blank) { summary.textContent = ''; results.hidden = true; return; }
    results.hidden = hits.length === 0;
    if (hits.length === 0) {
      summary.classList.add('none');
      summary.textContent = down && mode === 'semantic'
        ? `Semantic search needs the embedding service. Keyword and Both still answer: ${counts.both} found.`
        : counts.both > 0
        ? `${MODE_NAME[mode]} found nothing for "${query.trim()}", but Both found ${counts.both}. Try another mode.`
        : `Nothing you have recorded matches "${query.trim()}". Try supplier, budget or 退款.`;
      return;
    }
    summary.textContent = `${hits.length} ${hits.length === 1 ? 'result' : 'results'} for "${query.trim()}"${down ? ', from keyword retrieval alone' : ''}. Press a timestamp to jump there.`;
    results.append(...hits.map((h) => {
      const p = h.passage;
      const li = el('li', 'aik-result');
      li.dataset.id = p.id;
      const text = el('p', 'aik-rtext');
      text.lang = LANG_TAG[p.lang];
      for (const s of segments(h, query, mode)) {
        if (s.kind) text.append(el('mark', s.kind === 'keyword' ? 'kw' : 'sem', s.text));
        else text.append(s.text);
      }
      li.append(text);
      if (p.gloss) li.append(el('p', 'aik-gloss', p.gloss));
      const meta = el('div', 'aik-rmeta');
      meta.append(timeKey('aik-time', p), el('span', 'aik-src', `${meetingById(p.meetingId).name} · ${p.speaker} · ${LANG_NAME[p.lang]}`));
      li.append(meta);
      const tags = el('div', 'aik-tags');
      if (crossesLanguage(query, p)) tags.append(el('span', 'aik-tag cross', `Found in ${LANG_NAME[p.lang]}`));
      if (h.keyword) tags.append(el('span', 'aik-tag kw lab', `Keyword #${h.ranks.keyword}`));
      if (h.semantic) tags.append(el('span', 'aik-tag sem lab', `Semantic #${h.ranks.semantic}`));
      if (mode === 'both' && !down) tags.append(el('span', 'aik-tag lab', `RRF ${h.score.toFixed(4)}`));
      li.append(tags);
      return li;
    }));
  }

  function refresh(): void {
    const query = input.value;
    hits = search(query, mode, { embeddingsDown: down });
    renderResults(query);
    decorate();
  }
  function runSearch(q: string): void {
    input.value = q;
    closeSuggest();
    refresh();
  }

  // Typing Chinese goes through an input method: wait until a character is committed before searching.
  let composing = false;
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; refresh(); });
  input.addEventListener('input', () => { if (!composing) { closeSuggest(); refresh(); } });
  $('.aik-search').addEventListener('submit', (e) => e.preventDefault());

  /* Suggestions appear only when the box has focus, so the window stays clean. */
  const searchBox = $<HTMLElement>('.aik-search');
  function closeSuggest(): void { searchBox.querySelector('.aik-suggest')?.remove(); }
  input.addEventListener('focus', () => {
    if (input.value.trim() || searchBox.querySelector('.aik-suggest')) return;
    const box = el('div', 'aik-suggest');
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Suggested searches');
    // Keep focus in the box while pressing. Safari does not focus a pressed button, so the list would close before the click landed.
    box.addEventListener('pointerdown', (e) => e.preventDefault());
    box.append(...SUGGESTIONS.map((s) => {
      const b = el('button', 'aik-chip');
      b.type = 'button';
      b.dataset.q = s.query;
      b.append(el('b', '', s.query), el('small', '', s.hint));
      return b;
    }));
    searchBox.append(box);
  });
  searchBox.addEventListener('focusout', (e) => {
    if (!searchBox.contains((e as FocusEvent).relatedTarget as Node | null)) closeSuggest();
  });
  searchBox.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Escape') closeSuggest(); });

  const searchDrawer = $<HTMLDetailsElement>('.aik-results-wrap .aik-drawer');
  searchDrawer.addEventListener('toggle', () => {
    $('.aik-results-wrap').classList.toggle('lab', searchDrawer.open);
    // Its controls live in the drawer, so closing it returns the search to normal rather than leaving a hidden setting on.
    if (!searchDrawer.open && (mode !== 'both' || down)) { mode = 'both'; down = false; refresh(); }
  });
  fillOnOpen(searchDrawer, (body) => {
    body.innerHTML = `
      <p class="aik-built"><b>What I built</b> ${BUILT.search}</p>
      <div class="aik-modes" role="group" aria-label="How to search">
        <button type="button" class="aik-mode" data-mode="keyword" aria-pressed="false">Keyword<span class="n" hidden></span></button>
        <button type="button" class="aik-mode" data-mode="semantic" aria-pressed="false">Semantic<span class="n" hidden></span></button>
        <button type="button" class="aik-mode" data-mode="both" aria-pressed="true">Both<span class="n" hidden></span></button>
      </div>
      <p class="aik-why"></p>
      <button type="button" class="aik-switch" role="switch" aria-checked="${down}"><i aria-hidden="true"></i>Embedding service down</button>
      <p class="aik-note">Each result now shows its rank in both lists and its Reciprocal Rank Fusion score: each list adds 1 / (60 + rank).</p>
      <p class="aik-h">Multilingual chunking</p>
      <p class="aik-note">Estimating length by splitting on spaces fails for Japanese, where words are not separated by spaces.</p>
      <div class="aik-seg" role="group" aria-label="Chunking logic">
        <button type="button" class="aik-key sm" data-value="before" aria-pressed="false">Before: split on spaces</button>
        <button type="button" class="aik-key sm" data-value="after" aria-pressed="true">After: fixed</button>
      </div>
      <dl class="aik-stats"></dl>
      <ol class="aik-chunks" lang="ja"></ol>
      <p class="aik-note">This search really runs in your browser, over ${PASSAGES.length} invented passages. Keyword mode is BM25. Semantic mode is a stand-in, not a real embedding model: a small hand-built map of ideas and their English, Cantonese, Mandarin and Japanese words, compared with cosine similarity. The English under other languages is there for you to read and is never searched.</p>`;
    const TERM = '予算';
    const stats = body.querySelector('.aik-stats')!, chunksOut = body.querySelector('.aik-chunks')!;
    const sw = body.querySelector<HTMLButtonElement>('.aik-switch')!;
    sw.addEventListener('click', () => {
      down = !down;
      refresh();
    });
    const renderChunks = (which: string) => {
      const before = which === 'before';
      const estimate = before ? countBySpaces : estimateLength;
      const chunks = chunkLines(JA_MEETING, estimate);
      const cited = citeTerm(chunks, TERM)!;
      const total = JA_MEETING.reduce((a, l) => a + estimate(l.text), 0);
      const facts: [string, string][] = [
        ['Estimated length', before ? `${total} words, for a whole meeting` : `${total} units`],
        ['Chunks', String(chunks.length)],
        [`Citation for ${TERM} (budget)`, `${formatTime(cited)}${before ? ', the start of the meeting' : ', where it was said'}`],
      ];
      stats.replaceChildren(...facts.map(([k, v]) => {
        const d = el('div', 'aik-stat');
        d.append(el('dt', '', k), el('dd', '', v));
        return d;
      }));
      chunksOut.replaceChildren(...chunks.map((c) => {
        const li = el('li', before ? 'aik-chunk big' : 'aik-chunk');
        li.append(el('b', 'aik-chunk-t', formatTime(c.start)), el('p', 'aik-chunk-text', c.lines.map((l) => l.text).join('')));
        if (c.lines.some((l) => l.text.includes(TERM))) li.classList.add('hit');
        return li;
      }));
    };
    pressGroup(body.querySelector('.aik-seg')!, renderChunks);
    renderChunks('after');
    refresh();
  });

  /* ---------- Ask ---------- */
  const tools = once(() => import('./featureTools'));
  let lastCall: ToolCall | null = null;
  function say(node: HTMLElement): void {
    log.append(node);
    log.scrollTop = log.scrollHeight;
  }
  function citeLine(part: { text: string; ref: string }): HTMLElement {
    const li = el('li');
    li.append(el('span', 'aik-answer-text', part.text));
    const source = resolveCitation(part.ref);
    if (source) {
      const cite = el('span', 'aik-cite');
      cite.append(timeKey('aik-time', source), el('span', 'aik-src', meetingById(source.meetingId).name));
      li.append(cite);
    } else {
      li.append(el('span', 'aik-cite-none', 'Source not found'));
    }
    return li;
  }
  /** A small key in a reply. Once pressed it becomes a line of text, and focus lands on that line instead of being dropped. */
  function replyKey(label: string, after: string, then?: () => void): HTMLButtonElement {
    const key = el('button', 'aik-key sm aik-reply-key', label);
    key.type = 'button';
    key.addEventListener('click', () => {
      then?.();
      const line = el('p', 'aik-reply-after', after);
      line.tabIndex = -1;
      key.replaceWith(line);
      line.focus({ preventScroll: true });
    });
    return key;
  }
  /** Does what was asked, then says so in a sentence. */
  function carryOut(r: ToolCall, reply: HTMLElement, sentence: string): void {
    const folder = folderOf(open.id);
    if (r.kind === 'refused') {
      reveal('folders', true);
      const away = FOLDERS.find((f) => f.name === r.owner)!;
      const key = replyKey(`Open ${r.owner}`, `${r.owner} is open. Ask again and I can do it.`);
      key.dataset.open = away.meetings.find((id) => meetingById(id).name === r.target) ?? away.meetings[0];
      reply.append(el('p', '', sentence), key);
      return;
    }
    const m = r.kind === 'call' ? folder.meetings.map(meetingById).find((x) => x.name === r.target) : undefined;
    if (r.kind === 'call' && (r.group === 'podcast' || r.group === 'slides')) {
      const kind = r.group;
      void tools().then((t) => {
        reply.append(t.runCard(kind, r.target.replace('Folder: ', ''), {
          instant: reducedMotion(),
          onChange: () => { log.scrollTop = log.scrollHeight; },
          onOpen: () => {
            if (m) showRecording(m.id);
            if (kind === 'podcast') void openPodcast().then((p) => p?.finish());
            else void feature('slides').then((s) => s?.show());
          },
        }));
      });
      return;
    }
    if (r.kind === 'call' && r.group === 'summary' && m) {
      sub = 'summary';
      showRecording(m.id);
    }
    if (r.kind === 'call' && r.group === 'move' && r.dest && m) {
      const before = moved[m.id];
      const now = before ?? folder.name;
      if (now.toLowerCase() === r.dest.toLowerCase()) {
        reply.append(el('p', '', `${m.name} is already in ${now}.`));
        return;
      }
      moved[m.id] = r.dest;
      reveal('folders', true);
      renderSide();
      renderHeader();
      reply.append(el('p', '', sentence), replyKey('Undo', `Moved ${m.name} back.`, () => {
        if (before) moved[m.id] = before;
        else delete moved[m.id];
        renderSide();
        renderHeader();
      }));
      return;
    }
    reply.append(el('p', '', sentence));
  }
  async function ask(text: string): Promise<void> {
    const t = text.trim();
    if (!t) return;
    closeResults();
    say(el('p', 'aik-msg me', t));
    const { interpret, renderCall, replyFor } = await tools();
    const r = interpret(t, folderOf(open.id).id, open.name);
    if (r.kind === 'empty') return;
    const reply = el('div', 'aik-msg');
    if (r.kind === 'no-tool') {
      const parts = answerFor(t);
      if (parts.length) {
        const list = el('ul', 'aik-answer-lines');
        list.append(...parts.map(citeLine));
        reply.append(list);
      } else {
        reply.append(el('p', '', 'I couldn’t find that in your recordings, and it isn’t something I can do here.'));
      }
    } else {
      carryOut(r, reply, replyFor(r));
      if (r.group !== 'slides') {
        lastCall = r;
        const record = root.querySelector<HTMLElement>('.aik-last');
        if (record) renderCall(record, r);
      }
    }
    say(reply);
  }
  function closeResults(): void {
    if (!input.value) return;
    input.value = '';
    refresh();
  }
  $('.aik-cmd').addEventListener('submit', (e) => {
    e.preventDefault();
    void ask(askInput.value);
    askInput.value = '';
  });
  $('.aik-ask-wrap .aik-drawer').addEventListener('toggle', () => { log.scrollTop = log.scrollHeight; });
  fillOnOpen($<HTMLDetailsElement>('.aik-ask-wrap .aik-drawer'), async (body) => {
    const t = await tools();
    t.fillDrawer(body);
    t.renderCall(body.querySelector<HTMLElement>('.aik-last')!, lastCall);
  });

  /* ---------- features that load only when opened ---------- */
  const ctx = { title: () => open.name, meetingId: () => open.id, todos };
  type Features = {
    memory: { show: (factId: string, iso?: string) => void };
    podcast: { show: () => void; generate: () => void; finish: () => void };
    slides: { show: () => void };
    phone: { show: () => void; setLocale: (l: 'en' | 'ja' | 'zh-Hant') => void };
  };
  const LOADERS: { [K in keyof Features]: () => Promise<{ mount: (host: HTMLElement, ctx: never) => Features[K] }> } = {
    memory: () => import('./featureMemory') as never,
    podcast: () => import('./featurePodcast') as never,
    phone: () => import('./featurePhone') as never,
    slides: () => import('./featureSlides') as never,
  };
  const mounted: Partial<Features> = {};

  async function feature<K extends keyof Features>(name: K): Promise<Features[K] | null> {
    $<HTMLElement>('.aik-v-recording').hidden = true;
    $<HTMLElement>('.aik-v-feature').hidden = false;
    root.dataset.view = 'feature';
    root.querySelectorAll<HTMLElement>('.aik-host').forEach((h) => { h.hidden = h.dataset.host !== name; });
    const host = $<HTMLElement>(`.aik-host[data-host="${name}"]`);
    if (!mounted[name]) {
      try {
        const mod = await LOADERS[name]();
        mounted[name] = mod.mount(host, ctx as never) as Features[K];
      } catch {
        host.textContent = 'This part of the app failed to load. Press its button to try again.';
        return null;
      }
    }
    return mounted[name] as Features[K];
  }
  async function openMemory(factId: string, iso?: string): Promise<void> {
    reveal('memory', true);
    const m = await feature('memory');
    m?.show(factId, iso);
    markSide(factId);
  }
  async function openPodcast() {
    const p = await feature('podcast');
    p?.show();
    return p;
  }
  async function openPhone(locale?: 'en' | 'ja' | 'zh-Hant') {
    const p = await feature('phone');
    if (p && locale) p.setLocale(locale);
    else p?.show();
    return p;
  }

  /* The status bar's code loads on its first press or drawer. */
  const statusBar = $<HTMLElement>('.aik-status');
  const desktop = once(async () => (await import('./featureDesktop')).mount(statusBar));
  statusBar.addEventListener('click', async (e) => {
    const key = (e.target as HTMLElement).closest<HTMLElement>('[data-drop], [data-rec]');
    if (!key) return;
    const d = await desktop();
    if (key.dataset.drop) d.drop(key.dataset.drop as 'classic' | 'ble');
    else d.toggleRecording();
  });
  fillOnOpen($<HTMLDetailsElement>('.aik-status .aik-drawer'), async (body) => { (await desktop()).fillDrawer(body); });

  /* ---------- what is on screen: a short list, one transcript and one Ask box, until something asks for more ---------- */
  type Panel = 'folders' | 'memory' | 'mic';
  function reveal(panel: Panel, on: boolean): void {
    root.toggleAttribute(`data-show-${panel}`, on);
    root.querySelectorAll(`[data-show="${panel}"]`).forEach((k) => k.setAttribute('aria-expanded', String(on)));
  }
  /** Back to the calm window. The guide calls this as each step ends, so it brings one thing in at a time. */
  function calm(): void {
    for (const id of Object.keys(moved)) delete moved[id];
    log.replaceChildren();
    lastCall = null;
    const record = root.querySelector<HTMLElement>('.aik-last');
    if (record) void tools().then((t) => t.renderCall(record, null));
    root.querySelectorAll<HTMLDetailsElement>('details.aik-drawer[open]').forEach((d) => { d.open = false; });
    (['folders', 'memory', 'mic'] as const).forEach((p) => reveal(p, false));
    $('.aik-status-text').textContent = '';
    mounted.phone?.setLocale('en');
    input.value = '';
    mode = 'both';
    down = false;
    current = null;
    sub = 'transcript';
    showRecording('launch');
    renderSide();
    renderHeader();
    refresh();
  }

  /* ---------- one listener for every key in the window ---------- */
  root.addEventListener('click', (e) => {
    const key = (e.target as HTMLElement).closest<HTMLElement>('[data-jump], [data-q], .aik-mode, [data-open], [data-memory], [data-sub], [data-prompt], [data-action], [data-show]');
    if (!key) return;
    const d = key.dataset;
    if (d.jump) jump(d.jump);
    else if (d.q) runSearch(d.q);
    else if (d.mode) { mode = d.mode as Mode; refresh(); }
    else if (d.open) { current = null; showRecording(d.open); }
    else if (d.memory) void openMemory(d.memory);
    else if (d.sub) { sub = d.sub as Sub; renderSub(); }
    else if (d.prompt) void ask(d.prompt);
    else if (d.action === 'podcast') void openPodcast();
    else if (d.action === 'phone') void openPhone();
    else if (d.action === 'back') showRecording();
    else if (d.action === 'close-results') { input.value = ''; refresh(); }
    else if (d.show) {
      const on = !root.hasAttribute(`data-show-${d.show}`);
      reveal(d.show as Panel, on);
      if (d.show === 'memory') { if (on) void openMemory('opening'); else showRecording(); }
    }
  });
  $('.aik-subtabs').addEventListener('keydown', (e) => {
    const next = tabForKey(SUBS, sub, (e as KeyboardEvent).key);
    if (!next) return;
    e.preventDefault();
    sub = next;
    renderSub();
    subTabs.find((t) => t.dataset.sub === next)!.focus();
  });
  $('.aik-v-recording').addEventListener('change', (e) => {
    const box = e.target as HTMLInputElement;
    if (!box.dataset.todo) return;
    todos.toggle(box.dataset.todo, box.checked);
    root.querySelector<HTMLInputElement>(`.aik-sub [data-todo="${box.dataset.todo}"]`)?.focus();
  });

  renderHeader();
  renderTranscript();
  renderSide();
  renderSub();
  refresh();

  return {
    runSearch, jump, showRecording, ask, openMemory, openPodcast, openPhone, calm, reveal,
    desktop,
    asked: (text: string) => [...log.querySelectorAll('.aik-msg.me')].some((m) => m.textContent === text),
    clearSearch: () => { input.value = ''; refresh(); },
  };
}

function once<T>(load: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | null = null;
  return () => (p ??= load().catch((err) => { p = null; throw err; }));
}
