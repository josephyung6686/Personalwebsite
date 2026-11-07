// The guided tour. It spotlights the real element in the window and presses real keys, in plain words. It never blocks the
// page: no overlay, no focus trap, so a visitor can use the app at any step or simply Tab away.
import type { App } from './aikonicApp';
import { BUILT } from './aikonicBuilt';
import { reducedMotion } from './aikonicDom';

type Press = (el: HTMLElement | null, action?: () => void) => Promise<void>;
export type Step = {
  title: string;
  does: string;
  tryIt: string;
  built: string;
  spot: string[];
  prepare: (app: App) => Promise<unknown> | void;
  act?: (app: App, press: Press, root: HTMLElement) => Promise<void>;
};

export const STEPS: Step[] = [
  {
    title: 'Find anything anyone said',
    does: 'Search everything you recorded, in any language. I searched "supplier delay".',
    tryIt: 'Try it: press a timestamp to jump to that moment.',
    built: BUILT.search,
    spot: ['.aik-search', '.aik-ask'],
    prepare: (app) => app.runSearch('supplier delay'),
  },
  {
    title: 'Ask it to do things',
    does: 'Tell it what to do, and it acts only in the folder you have open. I asked it to move this recording.',
    tryIt: 'Try it: press Summarize Board prep, then open its folder.',
    built: BUILT.tools,
    spot: ['.aik-ask', '.aik-side'],
    prepare: (app) => app.reveal('folders', true),
    act: async (app, press, root) => {
      const text = 'Move this to the Q3 folder';
      if (!app.asked(text)) await press(root.querySelector(`[data-prompt="${text}"]`));
    },
  },
  {
    title: 'It remembers what changed',
    does: 'Every version of a fact is kept, so you can see what was true on any date. I set the date to May.',
    tryIt: 'Try it: drag the date slider.',
    built: BUILT.memory,
    spot: ['.aik-main', '.aik-side-mem'],
    prepare: (app) => app.openMemory('opening', '2026-05-30'),
  },
  {
    title: 'Turn a meeting into a podcast',
    does: 'Turns a recording into an episode to listen to. I pressed Generate.',
    tryIt: 'Try it: press Play as soon as it’s ready.',
    built: BUILT.podcast,
    spot: ['.aik-main'],
    prepare: (app) => app.openPodcast(),
    act: async (_app, press, root) => { await press(root.querySelector('.aik-gen')); },
  },
  {
    title: 'One microphone, two connections',
    does: 'Two separate links to one microphone. I disconnected one, and the other kept working.',
    tryIt: 'Try it: press Record.',
    built: BUILT.desktop,
    spot: ['.aik-status'],
    prepare: (app) => app.reveal('mic', true),
    act: async (_app, press, root) => { await press(root.querySelector('[data-drop="classic"]')); },
  },
  {
    title: 'The same note on your phone',
    does: 'The same note at phone size, in your language. I switched it to Japanese.',
    tryIt: 'Try it: tick a to-do, then reload.',
    built: BUILT.web,
    spot: ['.aik-main'],
    prepare: (app) => app.openPhone('ja'),
  },
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createGuide(root: HTMLElement, app: App) {
  const $ = <T extends Element>(s: string) => root.querySelector<T>(s)!;
  const card = $<HTMLElement>('.aik-guide');
  const intro = $<HTMLElement>('.aik-start');
  const restart = $<HTMLElement>('.aik-restart');
  const back = $<HTMLElement>('[data-guide="back"]');
  const next = $<HTMLElement>('[data-guide="next"]');
  let index = -1;
  let runId = 0;

  function clearSpot(): void {
    root.querySelectorAll('.aik-spotlit').forEach((n) => n.classList.remove('aik-spotlit'));
  }

  /** Brings the spotlit element between the sticky label and the sticky card, without scrolling when it is already there. */
  function reveal(target: HTMLElement): void {
    const top = $<HTMLElement>('.aik-label').offsetHeight + 12;
    const bottom = card.offsetHeight + 24;
    const r = target.getBoundingClientRect();
    if (r.top >= top && r.bottom <= innerHeight - bottom) return;
    scrollBy({ top: r.top - top, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  const press: Press = async (el, action) => {
    if (!el) return;
    if (!reducedMotion()) {
      await wait(320);
      el.classList.add('aik-pressing');
      await wait(180);
      el.classList.remove('aik-pressing');
    }
    if (action) action();
    else el.click();
  };

  async function go(i: number): Promise<void> {
    const token = ++runId;
    index = i;
    const step = STEPS[i];
    const inCard = (s: string) => card.querySelector(s)!;
    inCard('.aik-guide-step').textContent = `Step ${i + 1} of ${STEPS.length}`;
    inCard('.aik-guide-title').textContent = step.title;
    inCard('.aik-guide-does').textContent = step.does;
    inCard('.aik-guide-try').textContent = step.tryIt;
    inCard('.aik-guide-built span').textContent = step.built;
    back.setAttribute('aria-disabled', String(i === 0));
    next.textContent = i === STEPS.length - 1 ? 'Finish' : 'Next';

    clearSpot();
    app.calm();
    await step.prepare(app);
    if (token !== runId) return;
    const targets = step.spot.map((s) => root.querySelector<HTMLElement>(s)).filter((n): n is HTMLElement => !!n);
    targets.forEach((n) => n.classList.add('aik-spotlit'));
    if (targets[0]) reveal(targets[0]);
    root.dataset.tourStep = String(i + 1);
    await step.act?.(app, press, root);
    if (token === runId) root.dataset.tourDone = String(i + 1);
  }

  function stop(): void {
    runId++;
    index = -1;
    clearSpot();
    app.calm();
    delete root.dataset.touring;
    delete root.dataset.tourStep;
    delete root.dataset.tourDone;
    card.hidden = true;
    restart.hidden = false;
    restart.focus({ preventScroll: true });
  }

  return {
    running: () => index >= 0,
    start(): void {
      intro.hidden = true;
      restart.hidden = true;
      card.hidden = false;
      root.dataset.touring = 'true';
      app.clearSearch();
      void go(0);
      next.focus({ preventScroll: true });
    },
    handle(action: string): void {
      if (action === 'skip') { stop(); return; }
      if (action === 'back') { if (index > 0) void go(index - 1); return; }
      if (action === 'next') {
        if (index < STEPS.length - 1) { void go(index + 1); return; }
        app.showRecording();
        stop();
      }
    },
  };
}
