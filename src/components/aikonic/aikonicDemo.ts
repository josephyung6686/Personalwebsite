// Wires the Aikonic demo to the page. Ranking lives in aikonicSearch.ts; this file only renders and listens.
// Everything is written with textContent, so whatever a visitor types stays plain text.
import {
  LANG_NAME, LANG_TAG, MEETINGS, PASSAGES,
  crossesLanguage, formatTime, search, segments,
  type Hit, type Meeting, type Mode, type Passage,
} from './aikonicSearch';

const WHY: Record<Mode, string> = {
  keyword: 'Exact words only. It misses anything said another way or in another language.',
  semantic: 'Matches meaning across languages, but an exact code means nothing to it.',
  both: 'Merges both ranked lists, so a passage either one finds can surface.',
};
const MODE_NAME: Record<Mode, string> = { keyword: 'Keyword', semantic: 'Semantic', both: 'Both' };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}
const timeKey = (cls: string, p: Passage, meeting: Meeting) => {
  const b = el('button', cls, formatTime(p.start));
  b.type = 'button';
  b.dataset.jump = p.id;
  b.setAttribute('aria-label', `${formatTime(p.start)}, jump to this moment in ${meeting.title}`);
  return b;
};

function mount(root: HTMLElement): void {
  const $ = <T extends Element>(s: string) => root.querySelector<T>(s)!;
  const input = $<HTMLInputElement>('input[type="search"]');
  const results = $<HTMLOListElement>('.aik-results');
  const lines = $<HTMLOListElement>('.aik-lines');
  const rail = $<HTMLElement>('.aik-rail');
  const head = $<HTMLElement>('.aik-head');
  const modeKeys = [...root.querySelectorAll<HTMLButtonElement>('.aik-mode')];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  let mode: Mode = 'both';
  let meeting: Meeting = MEETINGS[0];
  let current: Passage | null = null;
  let hits: Hit[] = [];

  function renderViewer(): void {
    const v = $<HTMLElement>('.aik-vtitle');
    v.textContent = `${meeting.title} · ${LANG_NAME[meeting.lang]}`;
    lines.replaceChildren(...meeting.passages.map((p) => {
      const li = el('li', 'aik-line');
      li.dataset.id = p.id;
      li.tabIndex = -1;
      const meta = el('div', 'aik-lmeta');
      meta.append(timeKey('aik-time alt', p, meeting), el('span', 'aik-who', p.speaker));
      const text = el('p', 'aik-ltext', p.text);
      text.lang = LANG_TAG[p.lang];
      li.append(meta, text);
      if (p.gloss) li.append(el('p', 'aik-gloss', p.gloss));
      return li;
    }));
    rail.querySelectorAll('.aik-tick').forEach((t) => t.remove());
    for (const p of meeting.passages) {
      const tick = el('b', 'aik-tick');
      tick.dataset.id = p.id;
      tick.style.left = `${(p.start / meeting.duration) * 100}%`;
      rail.append(tick);
    }
  }

  /** Marks what the current search found in the meeting on screen, and where the playhead sits. */
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
    const at = current?.meetingId === meeting.id ? current.start : 0;
    head.style.left = `${(at / meeting.duration) * 100}%`;
    $<HTMLElement>('.aik-vtime').textContent = `${formatTime(at)} / ${formatTime(meeting.duration)}`;
    results.querySelectorAll<HTMLElement>('.aik-result').forEach((r) => r.classList.toggle('on', r.dataset.id === current?.id));
  }

  function jump(id: string): void {
    const p = PASSAGES.find((x) => x.id === id);
    if (!p) return;
    current = p;
    if (p.meetingId !== meeting.id) {
      meeting = MEETINGS.find((m) => m.id === p.meetingId)!;
      renderViewer();
    }
    decorate();
    const line = lines.querySelector<HTMLElement>(`[data-id="${p.id}"]`);
    if (!line) return;
    const behavior: ScrollBehavior = reduceMotion.matches ? 'auto' : 'smooth';
    lines.scrollTo({ top: line.offsetTop - lines.offsetTop - 8, behavior });
    line.classList.remove('flash');
    void line.offsetWidth;
    line.classList.add('flash');
    // On a phone the transcript sits below the results, so bring it on screen too. Only the page scrolls here, never sideways.
    $<HTMLElement>('.aik-viewer').scrollIntoView({ block: 'nearest', behavior });
    line.focus({ preventScroll: true });
  }

  function renderResults(query: string): void {
    const summary = $<HTMLElement>('.aik-summary');
    const empty = $<HTMLElement>('.aik-empty');
    const counts = { keyword: search(query, 'keyword').length, semantic: search(query, 'semantic').length, both: search(query, 'both').length };
    modeKeys.forEach((k) => {
      const m = k.dataset.mode as Mode;
      const on = m === mode;
      k.setAttribute('aria-pressed', String(on));
      const n = k.querySelector<HTMLElement>('.n')!;
      n.hidden = !query.trim();
      n.textContent = String(counts[m]);
    });
    $<HTMLElement>('.aik-why').textContent = WHY[mode];

    results.replaceChildren();
    const blank = !query.trim();
    empty.hidden = !blank;
    results.hidden = blank || hits.length === 0;
    if (blank) { summary.textContent = ''; return; }

    if (hits.length === 0) {
      summary.textContent = counts.both > 0
        ? `${MODE_NAME[mode]} found nothing for "${query.trim()}", but Both found ${counts.both}. Try another mode above.`
        : `Nothing in these meetings matches "${query.trim()}". The demo only knows ${MEETINGS.length} meetings, so try supplier, budget or 退款.`;
      summary.classList.add('none');
      return;
    }
    summary.classList.remove('none');
    summary.textContent = `${hits.length} ${hits.length === 1 ? 'passage' : 'passages'} for "${query.trim()}". Press a timestamp to jump there.`;

    results.append(...hits.map((h) => {
      const p = h.passage;
      const m = MEETINGS.find((x) => x.id === p.meetingId)!;
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
      meta.append(timeKey('aik-time', p, m), el('span', 'aik-src', `${m.title} · ${p.speaker} · ${LANG_NAME[p.lang]}`));
      const tags = el('div', 'aik-tags');
      if (h.keyword) tags.append(el('span', 'aik-tag kw', 'Exact word'));
      if (h.semantic) tags.append(el('span', 'aik-tag sem', 'Same meaning'));
      if (crossesLanguage(query, p)) tags.append(el('span', 'aik-tag cross', 'Crossed languages'));
      li.append(meta, tags);
      return li;
    }));
  }

  function refresh(): void {
    const query = input.value;
    hits = search(query, mode);
    renderResults(query);
    decorate();
  }

  // Typing Chinese goes through an input method: wait until a character is committed before searching.
  let composing = false;
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; refresh(); });
  input.addEventListener('input', () => { if (!composing) refresh(); });
  $<HTMLFormElement>('.aik-form').addEventListener('submit', (e) => e.preventDefault());

  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const key = t.closest<HTMLElement>('[data-jump], [data-q], [data-mode]');
    if (!key) return;
    if (key.dataset.jump) jump(key.dataset.jump);
    else if (key.dataset.q) { input.value = key.dataset.q; refresh(); }
    else if (key.dataset.mode) { mode = key.dataset.mode as Mode; refresh(); }
  });

  renderViewer();
  refresh();
  root.dataset.ready = 'true';
}

/** Nothing renders until the demo is near the viewport, so the page stays fast. */
export function initAikonicDemos(): void {
  document.querySelectorAll<HTMLElement>('[data-demo="aikonic"]').forEach((root) => {
    if (!('IntersectionObserver' in window)) { mount(root); return; }
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      mount(root);
    }, { rootMargin: '300px' });
    io.observe(root);
  });
}
