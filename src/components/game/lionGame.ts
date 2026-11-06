import {
  CATEGORIES, ITEMS, QUESTS, DEFAULT_OUTFIT, findItem, isUnlocked, questName, equip, complete, recordThrow,
  progress, randomOutfit, loadState, saveState, lionSvg, type Category, type GameState, type Item,
} from '../../lib/wardrobe';
import { step, release, isThrow, type Body, type Sample } from '../../lib/lionPhysics';
import { SIZE } from '../../assets/lion/sprites';

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

/** An item on its own, cropped to its art and drawn at a whole-number scale so the pixels stay even. */
function itemIcon(it: Item) {
  const { x, y, w, h } = it.box!;
  const k = Math.max(1, Math.min(3, Math.floor(72 / Math.max(w, h))));
  return `<svg viewBox="${x} ${y} ${w} ${h}" width="${w * k}" height="${h * k}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${it.icon ?? it.svg}</svg>`;
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

/** A keepsake picture: the lion on a little night sky, painted at sprite resolution and scaled up with hard pixels. */
async function savePicture() {
  const art = lionSvg(state.outfit).replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" `);
  const url = URL.createObjectURL(new Blob([art], { type: 'image/svg+xml' }));
  const img = new Image();
  await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = () => fail(new Error('image')); img.src = url; });
  const N = 60;
  const small = Object.assign(document.createElement('canvas'), { width: N, height: N });
  const s = small.getContext('2d')!;
  [['#0b1226', 0], ['#10203f', 14], ['#152c54', 28], ['#1b3a6b', 40]].forEach(([c, y]) => { s.fillStyle = c as string; s.fillRect(0, y as number, N, N); });
  s.fillStyle = '#ffe9b0';
  for (const [x, y] of [[6, 5], [17, 11], [29, 4], [44, 8], [53, 16], [10, 22], [50, 28]]) s.fillRect(x, y, 1, 1);
  s.fillStyle = '#1d4f91'; s.fillRect(0, N - 8, N, 8);
  s.fillStyle = '#6fb1e6'; s.fillRect(0, N - 8, N, 1);
  s.drawImage(img, (N - SIZE) / 2, N - SIZE - 3, SIZE, SIZE);
  URL.revokeObjectURL(url);
  const big = Object.assign(document.createElement('canvas'), { width: N * 10, height: N * 10 });
  const b = big.getContext('2d')!;
  b.imageSmoothingEnabled = false;
  b.drawImage(small, 0, 0, big.width, big.height);
  const blob: Blob = await new Promise((ok) => big.toBlob((x) => ok(x!), 'image/png'));
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'pixel-lion.png' });
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
const PRESSABLE = `a[href], button, input, select, textarea, summary, label, [role="button"], [role="tab"], [tabindex]:not([tabindex="-1"]), ${DEMOS}`;

/** The first pressable thing under the lion's box, or just ahead of it. Only the topmost element at a point can take a tap. */
function pressableUnder(lion: HTMLElement): Element | null {
  const r = lion.getBoundingClientRect();
  for (let y = r.top + 2; y < Math.min(r.bottom, innerHeight); y += 12) {
    for (let x = Math.max(0, r.left - 8); x <= Math.min(innerWidth - 1, r.right + 8); x += 12) {
      const top = document.elementsFromPoint(x, y).find((t) => !lion.contains(t));
      const hit = top?.closest(PRESSABLE);
      if (hit) return hit;
    }
  }
  return null;
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

  const draw = () => {
    const face = body.mode === 'air' ? (body.vx < 0 ? -1 : 1) : body.dir;
    // Moves land on the sprite's own pixel grid, and a spin turns in quarter turns, so the art never blurs mid-flight.
    const px = size() / SIZE;
    const x = Math.round(body.x / px) * px;
    const y = body.mode === 'air' || body.mode === 'held' ? Math.round(body.y / px) * px : body.y;
    const rot = body.mode === 'air' ? Math.round(body.rot / 90) * 90 : 0;
    el.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
    (el.querySelector('.lion-inner') as HTMLElement).style.scale = face < 0 ? '-1 1' : '1 1';
    el.dataset.mode = body.mode;
    // Keep the speech bubble on screen however close to an edge the lion wanders.
    if (el.matches(':hover, :focus-visible, .show-hint')) {
      const hw = hint.offsetWidth;
      hint.style.left = `${Math.min(innerWidth - 8 - hw, Math.max(8, x + size() / 2 - hw / 2)) - x}px`;
    }
  };

  // On phones the lion shares a narrow screen with everything you can press, and it must never take a tap meant for one
  // of those. So whenever something pressable is under it, it ducks: only its eyes peek above the bottom edge, and taps
  // go straight through. It stays down and still over a demo, keeps creeping along past anything else, and pops back up
  // on clear ground, where it can be thrown as usual.
  const phone = matchMedia('(max-width: 720px)');
  let overDemo = false;
  const checkLane = () => {
    const onFloor = body.mode !== 'held' && body.mode !== 'air';
    const under = phone.matches && onFloor && !el.hidden && !document.querySelector('dialog[open]') ? pressableUnder(el) : null;
    el.classList.toggle('duck', !!under);
    overDemo = !!under?.closest(DEMOS);
  };
  window.setInterval(checkLane, 120);
  addEventListener('scroll', checkLane, { passive: true, capture: true });
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
    if (!el.hidden) {
      const wasAir = body.mode === 'air';
      const vyBefore = body.vy;
      if (overDemo && (body.mode === 'walk' || body.mode === 'sit')) body = { ...body, mode: 'sit', timer: 1.2 };
      body = step(body, dt, bounds());
      if (wasAir && body.mode === 'air' && vyBefore > 0 && body.vy < 0) el.querySelector('.lion-inner')!.animate([{ transform: 'scale(1.15, .8)' }, { transform: 'scale(1, 1)' }], { duration: 180, easing: 'steps(2)' });
      draw();
    }
    requestAnimationFrame(tick);
  };
  draw();
  requestAnimationFrame(tick);
}

export function initGame(): void {
  state = loadState(storage);
  const open = wireWardrobe();
  render();
  wireQuests();
  wireLion(open);
}
