// The "Make a podcast" panel. A timeline of simulated seconds, computed by a pure function, so the screen is only ever drawing
// stateAt(t). Nothing here makes sound, and the durations are invented to show the report's "approximately 3x".
import { BUILT } from './aikonicBuilt';
import { drawerMarkup, fillOnOpen, pressGroup, reducedMotion, seconds } from './aikonicDom';

export const SEGMENTS = [
  { title: 'Intro', sim: 5 },
  { title: 'What changed', sim: 3 },
  { title: 'Why it changed', sim: 4 },
  { title: 'What it means', sim: 7 },
  { title: 'Next steps', sim: 6.5 },
  { title: 'Close', sim: 4.5 },
];
export const STAGES = [
  { name: 'Context analysis', sim: 2 },
  { name: 'Script generation', sim: 2 },
  { name: 'Director notes', sim: 1 },
  { name: 'Text-to-speech generation', sim: 0 },
  { name: 'Duration policy', sim: 1 },
];
const WORKERS = 3;
const GENERATED_LENGTH = 500;
const SPEED = 8; // simulated seconds drawn per real second

export type Slot = { start: number; end: number };
/** Hands each segment, in script order, to whichever worker frees up first. */
export function schedule(durations: number[], workers: number): Slot[] {
  const free = new Array(workers).fill(0);
  return durations.map((d) => {
    const w = free.indexOf(Math.min(...free));
    const slot = { start: free[w], end: free[w] + d };
    free[w] = slot.end;
    return slot;
  });
}

const SLOTS = schedule(SEGMENTS.map((s) => s.sim), WORKERS);
export const SEQUENTIAL = SEGMENTS.reduce((a, s) => a + s.sim, 0);
export const CONCURRENT = Math.max(...SLOTS.map((s) => s.end));
export const speedup = SEQUENTIAL / CONCURRENT;
export const TTS_START = STAGES.slice(0, 3).reduce((a, s) => a + s.sim, 0);
export const PLAY_READY = TTS_START + SLOTS[0].end;
const STAGES_END = TTS_START + CONCURRENT + STAGES[4].sim;
export const END = Math.max(STAGES_END, TTS_START + SEQUENTIAL);

export type Phase = 'waiting' | 'running' | 'done';
export function stateAt(t: number): { stages: Phase[]; segments: Phase[]; finishOrder: number[]; seqProgress: number; playReady: boolean; running: boolean } {
  const ends = [2, 4, 5, TTS_START + CONCURRENT, STAGES_END];
  const stages = ends.map((end, i): Phase => {
    const start = i ? ends[i - 1] : 0;
    return t >= end ? 'done' : t >= start ? 'running' : 'waiting';
  });
  const tts = t - TTS_START;
  const segments = SLOTS.map((s): Phase => (tts >= s.end ? 'done' : tts >= s.start ? 'running' : 'waiting'));
  const finishOrder = SLOTS.map((s, i) => ({ i, end: s.end })).filter((s) => tts >= s.end).sort((a, b) => a.end - b.end).map((s) => s.i);
  return {
    stages, segments, finishOrder,
    seqProgress: Math.min(1, Math.max(0, tts / SEQUENTIAL)),
    playReady: t >= PLAY_READY,
    running: t < END,
  };
}

export function durationPolicy(generated: number, requested: number): { action: 'Shortens' | 'Expands' | 'Keeps'; by: number } {
  if (generated === requested) return { action: 'Keeps', by: 0 };
  return generated > requested ? { action: 'Shortens', by: generated - requested } : { action: 'Expands', by: requested - generated };
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const PHASE_TEXT: Record<Phase, string> = { waiting: 'Waiting', running: 'Running', done: 'Done' };

export function mount(host: HTMLElement, ctx: { title: () => string }) {
  const left = (x: number) => `${(x / SEQUENTIAL) * 100}%`;
  const COMPARE = `
    <div class="aik-compare">
      <p class="aik-h">Text-to-speech, same time scale <span class="aik-sim">Simulated</span></p>
      <div class="aik-lane">
        <p class="aik-lane-h">Before: one sequential request <b class="aik-seq-t"></b></p>
        <div class="aik-track"><b class="aik-bar seq"></b></div>
      </div>
      <div class="aik-lane">
        <p class="aik-lane-h">After: ${SEGMENTS.length} segments, concurrent <b class="aik-con-t"></b></p>
        ${SLOTS.map((s, i) => `<div class="aik-track thin" aria-hidden="true"><b class="aik-bar seg" data-i="${i}" style="left:${left(s.start)};width:${left(s.end - s.start)}"><i></i></b></div>`).join('')}
      </div>
      <p class="aik-note aik-order-note"></p>
    </div>`;
  host.innerHTML = `
    <p class="aik-view-h">Make a podcast: <span class="aik-pod-name"></span></p>
    <div class="aik-pod-top">
      <button type="button" class="aik-key pri aik-gen">Generate</button>
      <div class="aik-seg" role="group" aria-label="Requested episode length">
        ${[300, 480, 720].map((s, i) => `<button type="button" class="aik-key sm" data-value="${s}" aria-pressed="${i === 0}">${s / 60} min</button>`).join('')}
      </div>
    </div>
    <p class="aik-pod-status" role="status">Press Generate to make the episode.</p>
    <ol class="aik-stages">${STAGES.map((s, i) => `<li data-phase="waiting"><span class="aik-stage-n">${i + 1}</span><div><p class="aik-stage-name">${s.name}<span class="aik-sr"> </span><small class="aik-stage-state">Waiting</small></p><p class="aik-stage-out"></p></div></li>`).join('')}</ol>
    <div class="aik-order-wrap">
      <p class="aik-h">Episode parts</p>
      <ol class="aik-order">${SEGMENTS.map((s, i) => `<li data-i="${i}" data-phase="waiting"><b>${i + 1}</b></li>`).join('')}</ol>
      <div class="aik-play-row">
        <button type="button" class="aik-key aik-play" aria-disabled="true">Play</button>
        <p class="aik-play-text">Opens as soon as segment 1 is ready.</p>
      </div>
    </div>
    ${drawerMarkup(COMPARE)}`;

  const $ = <T extends Element>(s: string) => host.querySelector<T>(s)!;
  const status = $<HTMLElement>('.aik-pod-status');
  const stageRows = [...host.querySelectorAll<HTMLElement>('.aik-stages li')];
  const segBars = [...host.querySelectorAll<HTMLElement>('.aik-bar.seg')];
  const orderBoxes = [...host.querySelectorAll<HTMLElement>('.aik-order li')];
  const seqBar = $<HTMLElement>('.aik-bar.seq');
  const play = $<HTMLButtonElement>('.aik-play');
  const playText = $<HTMLElement>('.aik-play-text');

  let requested = 300;
  let t = -1;
  let frame = 0;
  let timer = 0;
  let announced = '';

  const stageOutput = (i: number): string => {
    if (i === 0) return `Focus: the main themes of ${ctx.title()}.`;
    if (i === 1) return `Structured script, ${SEGMENTS.length} segments.`;
    if (i === 2) return 'Instructions for pacing, emphasis, transitions and tone.';
    if (i === 3) return `Parts generate at the same time, about ${Math.round(speedup)}x faster.`;
    const p = durationPolicy(GENERATED_LENGTH, requested);
    return `${p.action} the ${mmss(GENERATED_LENGTH)} draft${p.by ? ` by ${mmss(p.by)}` : ''} to fit ${mmss(requested)}.`;
  };

  function draw(): void {
    const s = stateAt(Math.max(t, 0));
    const started = t >= 0;
    stageRows.forEach((li, i) => {
      const phase = started ? s.stages[i] : 'waiting';
      li.dataset.phase = phase;
      li.querySelector('.aik-stage-state')!.textContent = PHASE_TEXT[phase];
      li.querySelector('.aik-stage-out')!.textContent = phase === 'done' ? stageOutput(i) : '';
    });
    const tts = t - TTS_START;
    segBars.forEach((b, i) => {
      const slot = SLOTS[i];
      const f = started ? Math.min(1, Math.max(0, (tts - slot.start) / (slot.end - slot.start))) : 0;
      b.firstElementChild!.setAttribute('style', `transform:scaleX(${f})`);
    });
    orderBoxes.forEach((li, i) => {
      li.dataset.phase = started ? s.segments[i] : 'waiting';
    });
    seqBar.style.width = `${(started ? s.seqProgress : 0) * 100}%`;
    $('.aik-seq-t').textContent = started && s.seqProgress >= 1 ? seconds(SEQUENTIAL) : '';
    $('.aik-con-t').textContent = started && s.segments.every((p) => p === 'done') ? `${seconds(CONCURRENT)}, about ${Math.round(speedup)}x` : '';
    $('.aik-order-note').textContent = started && !s.running ? `Segments finished in the order ${s.finishOrder.map((i) => i + 1).join(', ')}, then played as 1 to ${SEGMENTS.length}.` : '';
    play.setAttribute('aria-disabled', String(!(started && s.playReady)));
    play.classList.toggle('pri', started && s.playReady);
    $('.aik-gen').classList.toggle('pri', !(started && s.playReady));

    let say = '';
    if (started) {
      const n = s.stages.findIndex((p) => p === 'running');
      say = n >= 0 ? `Stage ${n + 1} of ${STAGES.length}: ${STAGES[n].name}.` : 'Done. Your episode is ready.';
    }
    if (say && say !== announced) { announced = say; status.textContent = say; }
    if (started && s.playReady && !timer && playText.dataset.state !== 'played') playText.textContent = s.segments.every((p) => p === 'done') ? 'Ready to play.' : 'Ready to play while later segments keep generating.';
  }

  function stopPlay(): void {
    clearInterval(timer);
    timer = 0;
  }

  function generate(): void {
    cancelAnimationFrame(frame);
    stopPlay();
    delete playText.dataset.state;
    playText.textContent = 'Opens as soon as segment 1 is ready.';
    announced = '';
    if (reducedMotion()) { t = END; draw(); return; }
    t = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      t = Math.min(END, ((now - t0) / 1000) * SPEED);
      draw();
      if (t < END) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  }

  /** Walks the segments in script order. If the next one is not ready yet, it waits for it, which is what makes early play safe. */
  function startPlay(): void {
    stopPlay();
    let i = 0;
    const tick = () => {
      if (i >= SEGMENTS.length) { stopPlay(); playText.dataset.state = 'played'; playText.textContent = 'Played all segments in script order (simulated, no audio).'; orderBoxes.forEach((b) => b.classList.remove('now')); return; }
      const ready = stateAt(Math.max(t, 0)).segments[i] === 'done';
      orderBoxes.forEach((b, k) => b.classList.toggle('now', k === i));
      playText.textContent = ready ? `Playing segment ${i + 1} of ${SEGMENTS.length}: ${SEGMENTS[i].title} (simulated, no audio).` : `Waiting for segment ${i + 1}, still generating.`;
      if (ready) i++;
    };
    tick();
    timer = window.setInterval(tick, 800);
  }

  $('.aik-gen').addEventListener('click', generate);
  play.addEventListener('click', () => {
    if (play.getAttribute('aria-disabled') === 'true') return;
    startPlay();
  });
  pressGroup($('.aik-seg'), (v) => { requested = Number(v); draw(); });
  fillOnOpen($<HTMLDetailsElement>('.aik-drawer'), (body) => {
    body.insertAdjacentHTML('afterbegin', `
      <p class="aik-built"><b>What I built</b> ${BUILT.podcast}</p>
      <p class="aik-note">Before, one prompt asked one model to plan, structure, write and pace a whole episode. Separate stages are easier to evaluate, replace and debug, and a failure can be traced to the stage responsible.</p>
      <p class="aik-note">Previously the whole script went through a single sequential request. Dividing it into independent segments, processing them concurrently and reconstructing the audio in order is what the comparison below shows. The segments also allow progressive playback.</p>`);
  });

  return {
    show(): void { $('.aik-pod-name').textContent = ctx.title(); draw(); },
    generate,
  };
}
