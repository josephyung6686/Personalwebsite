import {
  CATEGORIES, ITEMS, QUESTS, DEFAULT_OUTFIT, findItem, isUnlocked, questName, equip, complete, recordThrow,
  progress, randomOutfit, loadState, saveState, lionSvg, type Category, type GameState, type Item,
} from '../../lib/wardrobe';
import { step, release, isThrow, type Body, type Sample } from '../../lib/lionPhysics';
import { SIZE, art } from '../../assets/lion/sprites';

const I = (n: string, cls = 'gi') => `<svg class="${cls}" aria-hidden="true" focusable="false"><use href="#i-${n}"/></svg>`;
const storage = (() => { try { return window.localStorage; } catch { return { getItem: () => null, setItem: () => {} }; } })();

let state: GameState;
let cat: Category = 'hat';
let mode: 'wardrobe' | 'quests' = 'wardrobe';

function set(next: GameState, announce = true) {
  const before = new Set(state.done);
  state = next;
  saveState(state, storage);
  if (announce) for (const q of state.done) if (!before.has(q)) toast(`Quest done! ${QUESTS.find((x) => x.id === q)!.reward} unlocked.`);
  render();
}

function toast(msg: string) {
  const el = document.getElementById('game-toast')!;
  el.textContent = msg;
  el.classList.add('show');
  window.clearTimeout((el as any)._t);
  (el as any)._t = window.setTimeout(() => el.classList.remove('show'), 2600);
}

/** Fills the hat and face slots on the lions placed around the page, which already have their own bodies and props. */
function dressPoses() {
  document.querySelectorAll<SVGGElement>('.wear').forEach((g) => {
    const c = g.dataset.cat as Category;
    const id = state.outfit[c];
    g.innerHTML = `<g data-item="${id}">${findItem(c, id)?.svg ?? ''}</g>`;
  });
}

/** An item on its own, cropped to its drawing and scaled to fit the tile. */
function itemIcon(it: Item) {
  const { x, y, w, h } = it.box!;
  const k = Math.min(3, 72 / Math.max(w, h));
  return `<svg viewBox="${x} ${y} ${w} ${h}" width="${Math.round(w * k)}" height="${Math.round(h * k)}" aria-hidden="true" focusable="false">${it.icon ?? it.svg}</svg>`;
}

function render() {
  const lion = document.getElementById('lion')!;
  lion.querySelector('.lion-inner')!.innerHTML = lionSvg(state.outfit);
  lion.hidden = state.hidden;
  dressPoses();

  const wd = document.getElementById('wardrobe')!;
  wd.querySelector('.wd-preview')!.innerHTML = lionSvg(state.outfit);
  wd.querySelector('.wd-slots')!.innerHTML = CATEGORIES.map((c) =>
    `<span class="slot">${I(c.icon)}${state.outfit[c.id] !== 'none' ? `<span class="tick">${I('check')}</span>` : ''}</span>`).join('');
  const p = progress(state);
  const bar = wd.querySelector<HTMLElement>('.wd-bar')!;
  bar.setAttribute('aria-valuemax', String(p.total));
  bar.setAttribute('aria-valuenow', String(p.count));
  wd.querySelector<HTMLElement>('.wd-fill')!.style.transform = `scaleX(${p.count / p.total})`;
  wd.querySelector('.wd-lvl')!.textContent = `Level ${p.level} · ${p.count}/${p.total} quests`;
  wd.querySelector('[data-act="bed"]')!.innerHTML = state.hidden ? `${I('sun')}Wake the lion up` : `${I('moon')}Put the lion to bed`;

  wd.querySelector('.wd-tabs')!.innerHTML = CATEGORIES.map((c) =>
    `<button type="button" role="tab" class="tab" data-cat="${c.id}" aria-label="${c.label}" aria-selected="${c.id === cat}" tabindex="${c.id === cat ? 0 : -1}">${I(c.icon)}</button>`).join('');
  wd.querySelector('.wd-grid')!.innerHTML = ITEMS[cat].map((it) => {
    const locked = !isUnlocked(it, state.done);
    const on = state.outfit[cat] === it.id;
    const label = locked ? `${it.name}, locked. Unlock: ${questName(it.lock!)}` : it.name;
    const art = it.id === 'none' ? I('none', 'gi none-ic') : itemIcon(it);
    return `<button type="button" class="item${on ? ' on' : ''}${locked ? ' locked' : ''}" data-id="${it.id}" aria-label="${label}" aria-pressed="${on}"${locked ? ' disabled' : ''}>${art}${locked ? I('lock', 'gi lock-ic') : ''}<span class="item-name" aria-hidden="true">${locked ? questName(it.lock!) : it.name}</span></button>`;
  }).join('');
  wd.querySelector('.wd-quests')!.innerHTML = QUESTS.map((q) =>
    `<li class="quest${state.done.includes(q.id) ? ' done' : ''}"><span class="chk">${state.done.includes(q.id) ? I('check') : ''}</span><span>${q.name}<small>${q.reward}</small></span></li>`).join('');
  (wd.querySelector('.wd-grid') as HTMLElement).hidden = mode !== 'wardrobe';
  (wd.querySelector('.wd-tabs') as HTMLElement).hidden = mode !== 'wardrobe';
  (wd.querySelector('.wd-quests') as HTMLElement).hidden = mode !== 'quests';
  wd.querySelectorAll<HTMLElement>('.rail-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
}

/** A keepsake picture: the lion, as dressed right now, drawn onto a little crayon night sky. */
async function savePicture() {
  const { Sheet, draw, dense, hatch } = await import('../../lib/wax.js');
  const N = 600, K = 10;
  const big = Object.assign(document.createElement('canvas'), { width: N, height: N });
  const sky = new Sheet(big, N, N, 1);
  const rect = (x0: number, y0: number, x1: number, y1: number) => dense([[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]], 8);
  hatch(sky, rect(-20, -20, N + 20, N + 20), { color: '#16224f', r: 15, gap: 9, angle: -17, press: 1.14, over: 0, seed: 900, sample: 5, crumbs: false, wob: 1.8, join: 5 });
  hatch(sky, rect(-20, N - 90, N + 20, N + 20), { color: '#2f9e4f', r: 10, gap: 10, angle: -3, press: 1.08, over: 2, seed: 90, sample: 4, crumbs: false, join: 5 });
  for (const [x, y] of [[60, 50], [170, 110], [290, 40], [440, 80], [530, 160], [100, 220], [500, 280]]) {
    draw(sky, dense([[x - 7, y], [x + 7, y]], 2), { color: '#fffdf6', r: 1.8, press: 1.12, seed: x, crumbs: false });
    draw(sky, dense([[x, y - 7], [x, y + 7]], 2), { color: '#fffdf6', r: 1.8, press: 1.12, seed: y, crumbs: false });
  }
  sky.flush();
  // Every visible layer of the lion, in the order the page stacks them. Hidden frames are the alternates.
  const holder = document.createElement('div');
  holder.innerHTML = lionSvg(state.outfit);
  const layers = [...holder.querySelectorAll('image')].filter((i) => !i.closest('[visibility="hidden"]'));
  const pics = await Promise.all(layers.map((l) => new Promise<HTMLImageElement>((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img); img.onerror = () => fail(new Error('image'));
    img.src = l.getAttribute('href')!;
  })));
  const c = big.getContext('2d')!;
  pics.forEach((img, i) => {
    const l = layers[i], at = (n: string) => Number(l.getAttribute(n));
    c.drawImage(img, (at('x') + (60 - SIZE) / 2) * K, (at('y') + 60 - SIZE - 3) * K, at('width') * K, at('height') * K);
  });
  const blob: Blob = await new Promise((ok) => big.toBlob((x) => ok(x!), 'image/png'));
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'crayon-lion.png' });
  document.body.append(a); a.click(); a.remove();
}

function wireWardrobe() {
  const wd = document.getElementById('wardrobe') as HTMLDialogElement;
  const open = () => { if (!wd.open) { render(); wd.showModal(); } };
  document.getElementById('dress-btn')!.addEventListener('click', open);
  wd.querySelector('.wd-close')!.addEventListener('click', () => wd.close());
  wd.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === wd) return wd.close();
    const tab = t.closest<HTMLElement>('[data-cat]');
    if (tab) { cat = tab.dataset.cat as Category; render(); wd.querySelector<HTMLElement>(`[data-cat="${cat}"]`)?.focus(); return; }
    const item = t.closest<HTMLButtonElement>('.item');
    if (item && !item.disabled) { set(equip(state, cat, item.dataset.id!)); wd.querySelector<HTMLElement>(`.item[data-id="${item.dataset.id}"]`)?.focus(); return; }
    const rail = t.closest<HTMLElement>('.rail-btn');
    if (rail) { mode = rail.dataset.mode as typeof mode; render(); return; }
    const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'random') set({ ...state, outfit: randomOutfit(Math.random, state.done), tries: state.tries + 1 });
    if (act === 'reset') set({ ...state, outfit: { ...DEFAULT_OUTFIT } });
    if (act === 'bed') { set({ ...state, hidden: !state.hidden }, false); wd.querySelector<HTMLElement>('[data-act="bed"]')?.focus(); }
    if (act === 'save') savePicture().catch(() => toast('Sorry, that picture could not be saved.'));
  });
  wd.querySelector('.wd-tabs')!.addEventListener('keydown', (e) => {
    const k = (e as KeyboardEvent).key;
    const i = CATEGORIES.findIndex((c) => c.id === cat);
    const n = k === 'ArrowRight' ? i + 1 : k === 'ArrowLeft' ? i - 1 : k === 'Home' ? 0 : k === 'End' ? CATEGORIES.length - 1 : null;
    if (n === null) return;
    e.preventDefault();
    cat = CATEGORIES[(n + CATEGORIES.length) % CATEGORIES.length].id;
    render();
    wd.querySelector<HTMLElement>(`[data-cat="${cat}"]`)?.focus();
  });
  return open;
}

function wireQuests() {
  if (location.pathname.startsWith('/work/')) set(complete(state, 'read'));
  document.addEventListener('tuck:sorted', () => set(complete(state, 'sort')));
  document.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a[href*="devpost.com"]')) set(complete(state, 'devpost'));
  });
}

const DEMOS = '.tuck-demo, [data-demo]';
const PRESSABLE = 'a[href], button, input, select, textarea, summary, label, [role="button"], [role="tab"], [tabindex]:not([tabindex="-1"])';
const AHEAD = 8; // px of look-ahead, so a walking lion ducks before it arrives

/** Whether any demo overlaps the lion's box, or is just ahead of it. */
function demoUnder(lion: HTMLElement): boolean {
  const r = lion.getBoundingClientRect();
  return [...document.querySelectorAll(DEMOS)].some((demo) => {
    const d = demo.getBoundingClientRect();
    return d.left < r.right + AHEAD && d.right > r.left - AHEAD && d.top < r.bottom - 1 && d.bottom > r.top + 1;
  });
}

/** Whether anything pressable is under the lion's box. Only the topmost element at a point can take a tap. */
function pressableUnder(lion: HTMLElement): boolean {
  const r = lion.getBoundingClientRect();
  for (let y = r.top + 2; y < Math.min(r.bottom, innerHeight); y += 12) {
    for (let x = Math.max(0, r.left - AHEAD); x <= Math.min(innerWidth - 1, r.right + AHEAD); x += 12) {
      const top = document.elementsFromPoint(x, y).find((t) => !lion.contains(t));
      if (top?.closest(PRESSABLE)) return true;
    }
  }
  return false;
}

function wireLion(open: () => void) {
  const el = document.getElementById('lion')!;
  const hint = el.querySelector<HTMLElement>('.lion-hint')!;
  el.addEventListener('dblclick', open);
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const size = () => el.offsetWidth || 88;
  const bounds = () => ({ width: innerWidth, height: innerHeight, size: size() });
  let body: Body = { x: 24, y: innerHeight - size(), vx: 0, vy: 0, rot: 0, vr: 0, mode: reduce ? 'sit' : 'walk', dir: 1, timer: reduce ? Infinity : 4 };
  let samples: Sample[] = [];
  let grab = { dx: 0, dy: 0 };

  // Walking a drawn line: he takes the visitor's crayon, hops to the nearer end, walks it, then cheers and hops off.
  type Trace = { pts: number[][]; cum: number[]; len: number; d: number; speed: number; hop: { t: number; x: number; y: number; dist: number; dur: number } | null; onStep?: (x: number, y: number) => void; onDone?: () => void };
  let trace: Trace | null = null;
  let tilt = 0;
  let cheerTimer = 0;
  let softLanding = false;
  const feet = () => ({ ox: size() / 2, oy: size() * 0.985 });
  const at = (t: Trace, d: number) => {
    let lo = 0, hi = t.cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (t.cum[m] <= d) lo = m; else hi = m; }
    const k = (d - t.cum[lo]) / ((t.cum[hi] - t.cum[lo]) || 1), a = t.pts[lo], b = t.pts[hi];
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  };
  const holdCrayon = (key: string) => { el.querySelector('.l-held')!.innerHTML = art(key) + art('grip'); };
  const standOn = (p: number[]) => { const { ox, oy } = feet(); return { x: p[0] - scrollX - ox, y: p[1] - scrollY - oy }; };
  /** Takes him back to the page floor and gives him his own held item back. */
  const goHome = () => {
    window.clearTimeout(cheerTimer);
    delete el.dataset.cheer;
    el.style.transformOrigin = '';
    trace = null; tilt = 0;
    render();
    if (reduce) { body = step({ ...body, mode: 'sit', timer: Infinity }, 0, bounds()); draw(); return; }
    softLanding = true;
    body = { ...body, mode: 'air', vx: body.dir * 90, vy: -420, rot: 0, vr: 0 };
  };
  document.addEventListener('lion:trace', (ev) => {
    const { pts: raw, crayon, onStep, onDone } = (ev as CustomEvent).detail as { pts: number[][]; crayon: string; onStep?: (x: number, y: number) => void; onDone?: () => void };
    if (raw.length < 2) { onDone?.(); return; }
    window.clearTimeout(cheerTimer);
    delete el.dataset.cheer;
    el.hidden = false;
    holdCrayon(crayon);
    const here = [body.x + feet().ox + scrollX, body.y + feet().oy + scrollY];
    const dist = (p: number[]) => Math.hypot(p[0] - here[0], p[1] - here[1]);
    const pts = dist(raw[raw.length - 1]) < dist(raw[0]) ? [...raw].reverse() : raw;
    if (reduce) {
      // No walking and no hopping with reduced motion: he is simply standing at the end of the line, crayon in hand.
      for (const p of pts) onStep?.(p[0], p[1]);
      body = { ...body, ...standOn(pts[pts.length - 1]), mode: 'held' };
      draw();
      onDone?.();
      return;
    }
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const len = cum[cum.length - 1], d0 = dist(pts[0]);
    trace = { pts, cum, len, d: 0, speed: Math.max(170, Math.min(460, len / 6)), hop: d0 > 12 ? { t: 0, x: body.x, y: body.y, dist: d0, dur: Math.min(0.6, 0.25 + d0 / 1400) } : null, onStep, onDone };
    el.style.transformOrigin = '50% 98%';
  });
  document.addEventListener('lion:draw-off', () => { if (trace || reduce || el.dataset.cheer !== undefined) goHome(); });
  const walkTrace = (t: Trace, dt: number) => {
    if (t.hop) {
      const h = t.hop, k = Math.min(1, (h.t += dt / h.dur)), to = standOn(t.pts[0]);
      body = { ...body, mode: 'air', x: h.x + (to.x - h.x) * k, y: h.y + (to.y - h.y) * k - Math.sin(k * Math.PI) * Math.min(150, 40 + h.dist * 0.25), rot: 0, vr: 0, vx: to.x - h.x, dir: to.x >= h.x ? 1 : -1 };
      if (k >= 1) t.hop = null;
      return;
    }
    t.d = Math.min(t.len, t.d + t.speed * dt);
    const p = at(t, t.d), ahead = at(t, Math.min(t.len, t.d + 22)), dx = ahead[0] - p[0], dy = ahead[1] - p[1];
    const dir = Math.abs(dx) > 1.2 ? (dx > 0 ? 1 : -1) : body.dir;
    const want = Math.max(-38, Math.min(38, Math.atan2(dy, Math.abs(dx) + 0.001) * 57.3 * dir));
    tilt += (want - tilt) * Math.min(1, dt * 9);
    body = { ...body, ...standOn(p), mode: 'walk', dir, timer: 3 };
    t.onStep?.(p[0], p[1]);
    if (t.d >= t.len) {
      const done = t.onDone;
      trace = null; tilt = 0;
      el.style.transformOrigin = '';
      el.dataset.cheer = '';
      body = { ...body, mode: 'held' };
      cheerTimer = window.setTimeout(goHome, 900);
      done?.();
    }
  };

  const draw = () => {
    const face = body.mode === 'air' ? (body.vx < 0 ? -1 : 1) : body.dir;
    const { x, y } = body;
    const rot = trace ? tilt : body.mode === 'air' ? body.rot : 0;
    el.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
    (el.querySelector('.lion-inner') as HTMLElement).style.scale = face < 0 ? '-1 1' : '1 1';
    el.dataset.mode = body.mode;
    // Keep the speech bubble on screen however close to an edge the lion wanders.
    if (el.matches(':hover, :focus-visible, .show-hint')) {
      const hw = hint.offsetWidth;
      hint.style.left = `${Math.min(innerWidth - 8 - hw, Math.max(8, x + size() / 2 - hw / 2)) - x}px`;
    }
  };

  // The lion must never take a tap meant for something else, at any screen size. So whenever something pressable is under
  // it, it ducks: only its eyes peek above the bottom edge, and taps go straight through. A demo gets more room still: the
  // lion drops fully out of sight and holds still until the demo has gone. Past anything else it keeps creeping along, and
  // it pops back up on clear ground, where it can be thrown as usual.
  let overDemo = false;
  const checkLane = () => {
    const onFloor = body.mode !== 'held' && body.mode !== 'air';
    const watching = onFloor && !trace && !el.hidden && !document.querySelector('dialog[open]');
    overDemo = watching && demoUnder(el);
    el.classList.toggle('away', overDemo);
    el.classList.toggle('duck', overDemo || (watching && pressableUnder(el)));
  };
  // The look under him only needs reading again once he or the page has moved. A slower pass still catches pages that change by themselves.
  let laneAt = '', laneTime = 0, laneQueued = false;
  const pollLane = () => {
    laneQueued = false;
    if (document.hidden) return;
    const now = performance.now(), here = `${Math.round(body.x / 4)},${Math.round(body.y / 4)},${body.mode},${scrollX},${scrollY}`;
    if (here === laneAt && now - laneTime < 480) return;
    laneAt = here; laneTime = now;
    checkLane();
  };
  window.setInterval(pollLane, 120);
  addEventListener('scroll', () => { if (!laneQueued) { laneQueued = true; requestAnimationFrame(pollLane); } }, { passive: true, capture: true });
  checkLane();

  if (reduce) { body = step(body, 0, bounds()); draw(); addEventListener('resize', () => { body = step(body, 0, bounds()); draw(); }); return; }

  let lastTap = -Infinity;
  let downAt = { x: 0, y: 0, t: 0 };
  el.addEventListener('pointerdown', (e) => {
    el.setPointerCapture(e.pointerId);
    body = { ...body, mode: 'held' };
    grab = { dx: e.clientX - body.x, dy: e.clientY - body.y };
    downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
    samples = [{ x: e.clientX, y: e.clientY, t: downAt.t }];
  });
  el.addEventListener('pointermove', (e) => {
    if (body.mode !== 'held') return;
    body = { ...body, x: e.clientX - grab.dx, y: e.clientY - grab.dy };
    samples = [...samples.slice(-5), { x: e.clientX, y: e.clientY, t: performance.now() }];
  });
  const letGo = (e: PointerEvent) => {
    if (body.mode !== 'held') return;
    const now = performance.now();
    const tapped = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6 && now - downAt.t < 300;
    if (tapped) {
      // A tap isn't a throw. Touch screens may not send dblclick, so two quick taps open the wardrobe here.
      body = { ...body, mode: 'sit', timer: 1.2 };
      if (e.pointerType !== 'mouse') {
        if (now - lastTap < 350) open();
        el.classList.add('show-hint');
        window.setTimeout(() => el.classList.remove('show-hint'), 2200);
      }
      lastTap = now;
      return;
    }
    body = release(body, samples.length > 1 ? samples : [...samples, ...samples]);
    if (isThrow(body)) set(recordThrow(state));
  };
  el.addEventListener('pointerup', letGo);
  el.addEventListener('pointercancel', letGo);

  let prev = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(0.033, (now - prev) / 1000);
    prev = now;
    if (trace) { walkTrace(trace, dt); draw(); requestAnimationFrame(tick); return; }
    if (!el.hidden) {
      const wasAir = body.mode === 'air';
      const vyBefore = body.vy;
      if (overDemo && (body.mode === 'walk' || body.mode === 'sit')) body = { ...body, mode: 'sit', timer: 1.2 };
      body = step(body, dt, bounds());
      if (softLanding && body.mode === 'dizzy') { softLanding = false; body = { ...body, mode: 'sit', timer: 1.6 }; }
      if (wasAir && body.mode === 'air' && vyBefore > 0 && body.vy < 0) el.querySelector('.lion-inner')!.animate([{ transform: 'scale(1.15, .8)' }, { transform: 'scale(1, 1)' }], { duration: 180, easing: 'ease-out' });
      draw();
    }
    requestAnimationFrame(tick);
  };
  draw();
  requestAnimationFrame(tick);
}

/** The lions placed around the page only animate while they can be seen; their frame-by-frame poses otherwise cost a layout every step. */
function pauseOffscreenPoses() {
  const seen = new IntersectionObserver((all) => { for (const e of all) e.target.classList.toggle('offscreen', !e.isIntersecting); }, { rootMargin: '100px' });
  document.querySelectorAll('.lion-pose').forEach((p) => seen.observe(p));
}

export function initGame(): void {
  state = loadState(storage);
  pauseOffscreenPoses();
  const open = wireWardrobe();
  render();
  wireQuests();
  wireLion(open);
}
