// The status bar: two links to one microphone, kept as two independent states, and a recording start whose setup work can
// move outside the wait. Everything here is simulated: no Bluetooth is involved and the timings are invented.
import { BUILT } from './aikonicBuilt';
import { pressGroup } from './aikonicDom';

export type LinkId = 'classic' | 'ble';
export type LinkState = 'connected' | 'reconnecting';
export type Links = Record<LinkId, LinkState>;
export const LINKS: Record<LinkId, { name: string; short: string; carries: string[] }> = {
  classic: { name: 'Call audio', short: 'Teams, Zoom audio', carries: ['Microsoft Teams audio', 'Zoom audio'] },
  ble: { name: 'Recording', short: 'Recording, transcription, translation', carries: ['Recording controls', 'Transcription', 'Translation', 'Device management'] },
};
const IDS: LinkId[] = ['classic', 'ble'];

export function linkReduce(s: Links, a: { type: 'drop' | 'reconnected'; id: LinkId }): Links {
  return { ...s, [a.id]: a.type === 'drop' ? 'reconnecting' : 'connected' };
}
/** What still works. Each link answers only for itself, which is the whole point of separating them. */
export function available(s: Links): string[] {
  return IDS.filter((id) => s[id] === 'connected').flatMap((id) => LINKS[id].carries);
}

export type SessionMode = 'cold' | 'warm';
export type SessionStep = { name: string; start: number; end: number };
const STEP_NAMES = ['Open connection', 'Session initialization', 'Blocking startup work'];
/** Times in simulated seconds, relative to the press at 0. The round trips still happen. A pre-warmed start moves them before the press. */
export function sessionPlan(mode: SessionMode): { steps: SessionStep[]; wait: number } {
  const times: [number, number][] = mode === 'cold' ? [[0, 0.9], [0.9, 1.6], [1.6, 2.2]] : [[-1.8, -0.9], [-1.3, -0.5], [0, 0.3]];
  const steps = times.map(([start, end], i) => ({ name: STEP_NAMES[i], start, end }));
  return { steps, wait: Math.max(...steps.map((s) => s.end)) };
}

const RECONNECT_MS = 2000;
const MIN = -2, MAX = 2.4;
const x = (t: number) => ((t - MIN) / (MAX - MIN)) * 100;
const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export function mount(bar: HTMLElement) {
  const $ = <T extends Element>(s: string) => bar.querySelector<T>(s)!;
  const say = (t: string) => { $('.aik-status-text').textContent = t; };
  const rec = $<HTMLButtonElement>('[data-rec]');
  let links: Links = { classic: 'connected', ble: 'connected' };
  let mode: SessionMode = 'warm';
  let recording: 'idle' | 'starting' | 'on' = 'idle';
  let elapsed = 0;
  let tick = 0;
  let startTimer = 0;
  const timers: Partial<Record<LinkId, number>> = {};

  function render(): void {
    for (const id of IDS) {
      const chip = $<HTMLElement>(`.aik-linkchip[data-id="${id}"]`);
      const up = links[id] === 'connected';
      chip.dataset.state = links[id];
      chip.querySelector('.aik-linkstate')!.textContent = up ? 'Connected' : 'Reconnecting';
      chip.querySelector('[data-drop]')!.setAttribute('aria-disabled', String(!up));
    }
    $('.aik-mic-state').textContent = IDS.every((id) => links[id] === 'connected') ? 'Microphone connected' : 'Microphone reconnecting';
    rec.textContent = recording === 'idle' ? 'Record' : recording === 'starting' ? 'Starting...' : `Stop ${clock(elapsed)}`;
    rec.classList.toggle('live', recording === 'on');
    rec.setAttribute('aria-disabled', String(links.ble !== 'connected' || recording === 'starting'));
  }

  function drop(id: LinkId): void {
    if (links[id] !== 'connected') return;
    const other = IDS.find((o) => o !== id)!;
    links = linkReduce(links, { type: 'drop', id });
    render();
    const keeps = links[other] === 'connected' ? `${LINKS[other].short} still working.` : `${LINKS[other].name} is reconnecting too.`;
    say(`${LINKS[id].name} disconnected. ${keeps}${recording === 'on' && id === 'classic' ? ' The recording carries on.' : ''}`);
    clearTimeout(timers[id]);
    timers[id] = window.setTimeout(() => {
      links = linkReduce(links, { type: 'reconnected', id });
      render();
      say(`${LINKS[id].name} reconnected on its own.`);
    }, RECONNECT_MS);
  }

  function toggleRecording(): void {
    if (rec.getAttribute('aria-disabled') === 'true') return;
    if (recording === 'on') {
      clearInterval(tick);
      recording = 'idle';
      render();
      say(`Stopped after ${clock(elapsed)} (simulated).`);
      return;
    }
    const { wait } = sessionPlan(mode);
    recording = 'starting';
    elapsed = 0;
    render();
    say('Starting...');
    clearTimeout(startTimer);
    startTimer = window.setTimeout(() => {
      recording = 'on';
      render();
      say(`Recording ready ${wait.toFixed(1)} s after the press (simulated). Try disconnecting one.`);
      clearInterval(tick);
      tick = window.setInterval(() => { elapsed++; render(); }, 1000);
    }, wait * 1000);
  }

  function fillDrawer(body: HTMLElement): void {
    const plan = (m: SessionMode, title: string) => {
      const p = sessionPlan(m);
      return `<div class="aik-plan" data-mode="${m}">
        <p class="aik-lane-h">${title} <b>${p.wait.toFixed(1)} s wait</b></p>
        ${p.steps.map((s) => `<div class="aik-plan-row"><span>${s.name}</span><div class="aik-track thin"><b class="aik-bar" style="left:${x(s.start)}%;width:${x(s.end) - x(s.start)}%"></b><i class="aik-press-line" style="left:${x(0)}%"></i></div></div>`).join('')}
      </div>`;
    };
    body.innerHTML = `
      <p class="aik-built"><b>What I built</b> ${BUILT.desktop}</p>
      <p class="aik-note">One microphone, two separate communication paths with different guarantees. Early issues came from treating them as one connection. Teams and Zoom use classic Bluetooth, and the app uses Bluetooth Low Energy.</p>
      <p class="aik-h">Recording start <span class="aik-sim">Simulated</span></p>
      <p class="aik-note">Network round trips cannot be eliminated, but setup can move outside the period when you are actively waiting. Pick one, then press Record and feel the wait.</p>
      <div class="aik-seg" role="group" aria-label="How the session starts">
        <button type="button" class="aik-key sm" data-value="cold" aria-pressed="false">Before: cold start</button>
        <button type="button" class="aik-key sm" data-value="warm" aria-pressed="true">After: pre-warmed</button>
      </div>
      <div class="aik-plans">${plan('cold', 'Cold')}${plan('warm', 'Pre-warmed')}</div>
      <p class="aik-note">The line in each row marks your press. Setup left of it happened before you asked.</p>`;
    pressGroup(body.querySelector('.aik-seg')!, (v) => {
      mode = v as SessionMode;
      body.querySelectorAll<HTMLElement>('.aik-plan').forEach((p) => p.classList.toggle('on', p.dataset.mode === mode));
    });
    body.querySelector(`.aik-plan[data-mode="${mode}"]`)!.classList.add('on');
  }

  render();
  return { drop, toggleRecording, fillDrawer };
}
