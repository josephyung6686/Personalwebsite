// "What Aikonic remembers". Facts that change over time, kept as linked versions, plus the race between two pipeline stages
// in the drawer. The facts, their dates and the run timings are all invented.
import { BUILT } from './aikonicBuilt';
import { drawerMarkup, fillOnOpen, pressGroup, seconds } from './aikonicDom';

export type Version = { id: string; value: string; from: string; to: string | null; by: string | null; source: string };
export type Fact = { id: string; kind: 'Topic' | 'Person'; name: string; subject: string; versions: Version[] };
export const FACTS: Fact[] = [
  {
    id: 'opening', kind: 'Topic', name: 'Kowloon opening date', subject: 'the opening',
    versions: [
      { id: 'v1', value: '18 August', from: '2026-03-16', to: '2026-05-14', by: 'v2', source: 'Kickoff, 12:40' },
      { id: 'v2', value: '1 September', from: '2026-05-14', to: '2026-07-22', by: 'v3', source: 'Menu review, 15:48' },
      { id: 'v3', value: '21 September', from: '2026-07-22', to: null, by: null, source: 'Q3 launch sync, 22:58' },
    ],
  },
  {
    id: 'sam', kind: 'Person', name: 'Sam', subject: 'Sam’s role',
    versions: [
      { id: 'v1', value: 'operations lead', from: '2026-03-02', to: '2026-06-15', by: 'v2', source: 'Kickoff, 03:10' },
      { id: 'v2', value: 'head of supply', from: '2026-06-15', to: null, by: null, source: 'Q3 launch sync, 07:41' },
    ],
  },
];

const DAY = 86_400_000;
const START = Date.UTC(2026, 2, 1);
export const LAST_DAY = Math.round((Date.UTC(2026, 8, 30) - START) / DAY);
export const dayOf = (iso: string): number => Math.round((Date.parse(`${iso}T00:00:00Z`) - START) / DAY);
const formatDay = (day: number) => new Date(START + day * DAY).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const formatIso = (iso: string) => formatDay(dayOf(iso));

/** The version that was true on a day, or null before anything had been recorded. Latest-wins alone could not answer this. */
export function factAt(fact: Fact, day: number): Version | null {
  return fact.versions.find((v) => dayOf(v.from) <= day && (v.to === null || day < dayOf(v.to))) ?? null;
}
export function statusAt(v: Version, day: number): 'true' | 'superseded' | 'future' {
  if (day < dayOf(v.from)) return 'future';
  return v.to !== null && day >= dayOf(v.to) ? 'superseded' : 'true';
}

export type FactSource = 'same' | 'prior';
export type RaceRun = { extractEnd: number; readAt: number; hasFacts: boolean };
// Simulated seconds for fact extraction to end, and for the summary to read its context. They run as separate stages.
const TIMINGS: [number, number][] = [[6.5, 3], [2.5, 3.5], [7, 4], [4, 3], [3, 5], [8, 3.5], [2, 4.5], [5.5, 4]];
export const RACE_RUNS = TIMINGS.length;

export function runPipeline(n: number, source: FactSource): RaceRun {
  const [extractEnd, readAt] = TIMINGS[n % TIMINGS.length];
  return { extractEnd, readAt, hasFacts: source === 'prior' || extractEnd <= readAt };
}

const STATUS_TEXT = { true: 'True on this date', superseded: 'Replaced, still kept', future: 'Not recorded yet' };
const SCALE = 10;
const RACE_RESULT = {
  missing: ['Missing context', 'Extraction had not finished when the summary read its context, so this meeting’s facts are left out.'],
  ready: ['Facts ready, this time', 'Extraction happened to finish first. Nothing guarantees it next run.'],
  prior: ['Guaranteed', 'The summary reads facts from the participant’s previous meetings, which already exist. It no longer waits on extraction.'],
};

export function mount(host: HTMLElement) {
  const pct = (d: number) => `${(d / LAST_DAY) * 100}%`;
  host.innerHTML = `
    <p class="aik-view-h">What Aikonic remembers: <span class="aik-mem-name"></span></p>
    <div class="aik-answer" role="status"><p class="aik-answer-a"></p></div>
    <div class="aik-band" aria-hidden="true"><i class="aik-band-at"></i></div>
    <label class="aik-slider"><span>Look back to <b class="aik-date"></b></span>
      <input type="range" min="0" max="${LAST_DAY}" step="1" value="${LAST_DAY}" /></label>
    <ol class="aik-versions"></ol>
    ${drawerMarkup()}`;

  const $ = <T extends Element>(s: string) => host.querySelector<T>(s)!;
  const slider = $<HTMLInputElement>('.aik-slider input');
  let fact = FACTS[0];

  function renderFact(): void {
    const day = Number(slider.value);
    const now = factAt(fact, day);
    $('.aik-date').textContent = formatDay(day);
    slider.setAttribute('aria-valuetext', formatDay(day));
    $('.aik-answer-a').textContent = now ? `On ${formatDay(day)}, ${fact.subject} was understood to be ${now.value}.` : `On ${formatDay(day)}, nothing had been recorded yet.`;
    $<HTMLElement>('.aik-band-at').style.left = pct(day);
    host.querySelectorAll<HTMLElement>('.aik-band b').forEach((b) => b.classList.toggle('on', b.dataset.v === now?.id));
    host.querySelectorAll<HTMLElement>('.aik-versions li').forEach((li) => {
      const s = statusAt(fact.versions.find((x) => x.id === li.dataset.v)!, day);
      li.dataset.status = s;
      li.querySelector('.aik-pill')!.textContent = STATUS_TEXT[s];
    });
  }

  function show(factId: string, iso?: string): void {
    fact = FACTS.find((f) => f.id === factId) ?? FACTS[0];
    $('.aik-mem-name').textContent = fact.name;
    const band = $<HTMLElement>('.aik-band');
    band.querySelectorAll('b').forEach((b) => b.remove());
    band.insertAdjacentHTML('afterbegin', fact.versions.map((v) => {
      const a = dayOf(v.from), z = v.to ? dayOf(v.to) : LAST_DAY;
      return `<b style="left:${pct(a)};width:${pct(z - a)}" data-v="${v.id}">${v.id}</b>`;
    }).join(''));
    $('.aik-versions').innerHTML = fact.versions.map((v) => `
      <li data-v="${v.id}">
        <p class="aik-v-top"><b>${v.id}</b> <span class="aik-v-val">${v.value}</span> <span class="aik-pill"></span></p>
        <p class="aik-v-meta">Valid from ${formatIso(v.from)}${v.to ? `, replaced ${formatIso(v.to)}` : ', still current'}. Source: ${v.source}.</p>
        ${v.by ? `<button type="button" class="aik-key sm" data-goto="${v.by}">Replaced by ${v.by}</button>` : ''}
      </li>`).join('');
    slider.value = String(iso ? dayOf(iso) : LAST_DAY);
    renderFact();
  }

  slider.addEventListener('input', renderFact);
  $('.aik-versions').addEventListener('click', (e) => {
    const key = (e.target as HTMLElement).closest<HTMLElement>('[data-goto]');
    if (!key) return;
    slider.value = String(dayOf(fact.versions.find((v) => v.id === key.dataset.goto)!.from));
    renderFact();
  });

  fillOnOpen($<HTMLDetailsElement>('.aik-drawer'), (body) => {
    body.innerHTML = `
      <p class="aik-built"><b>What I built</b> ${BUILT.memory}</p>
      <p class="aik-note">When a fact changes, the previous version is retained and marked as superseded, with when it became valid, when it was retired, and which fact replaced it. A store that only overwrites would answer with the latest value for every date.</p>
      <p class="aik-h">The race in the summary <span class="aik-sim">Simulated</span></p>
      <p class="aik-note">Summarization and fact extraction run as separate stages, and extraction cannot be guaranteed to finish first.</p>
      <div class="aik-seg" role="group" aria-label="Which facts the summary uses">
        <button type="button" class="aik-key sm" data-value="same" aria-pressed="true">Before: same-meeting facts</button>
        <button type="button" class="aik-key sm" data-value="prior" aria-pressed="false">After: prior-meeting facts</button>
      </div>
      <button type="button" class="aik-key pri sm aik-race-run">Run the pipeline</button>
      <div class="aik-race" aria-hidden="true">
        <p class="aik-race-l">Fact extraction</p><div class="aik-track"><b class="aik-bar ex"></b></div>
        <p class="aik-race-l">Summary reads context</p><div class="aik-track"><i class="aik-tickmark rd"></i></div>
      </div>
      <div class="aik-race-out" role="status"><p class="aik-card-head"></p><p class="aik-card-why"></p><p class="aik-note aik-tally"></p></div>`;
    const q = <T extends Element>(s: string) => body.querySelector<T>(s)!;
    let source: FactSource = 'same';
    const runs: Record<FactSource, number> = { same: 0, prior: 0 };
    const missed: Record<FactSource, number> = { same: 0, prior: 0 };
    const bar = q<HTMLElement>('.aik-bar.ex'), tick = q<HTMLElement>('.aik-tickmark.rd'), out = q<HTMLElement>('.aik-race-out');

    function renderRace(run: RaceRun | null): void {
      if (!run) {
        out.dataset.result = 'idle';
        out.querySelector('.aik-card-head')!.textContent = runs[source] ? 'Ready for another run' : 'Not run yet';
        out.querySelector('.aik-card-why')!.textContent = 'Press Run the pipeline, more than once. Each run has different timings.';
        bar.style.width = '0'; tick.style.left = '0';
      } else {
        const key = source === 'prior' ? 'prior' : run.hasFacts ? 'ready' : 'missing';
        out.dataset.result = key;
        [out.querySelector('.aik-card-head')!.textContent, out.querySelector('.aik-card-why')!.textContent] = RACE_RESULT[key];
        bar.style.width = `${(run.extractEnd / SCALE) * 100}%`;
        tick.style.left = `${((source === 'prior' ? 0 : run.readAt) / SCALE) * 100}%`;
      }
      const timing = run ? `Extraction ${seconds(run.extractEnd)}, summary read at ${seconds(source === 'prior' ? 0 : run.readAt)}. ` : '';
      q('.aik-tally').textContent = runs[source] ? `${timing}Runs missing context: ${missed[source]} of ${runs[source]}.` : '';
    }
    pressGroup(q('.aik-seg'), (v) => { source = v as FactSource; renderRace(null); });
    q('.aik-race-run').addEventListener('click', () => {
      const run = runPipeline(runs[source], source);
      runs[source]++;
      if (!run.hasFacts) missed[source]++;
      renderRace(run);
    });
    renderRace(null);
  });

  return { show };
}
