// The crayon box and draw mode. Nothing here touches the page until the visitor turns drawing on, so links and scrolling
// are never in question: the drawing surface exists only while draw mode is on, and the wax engine only loads then too.
const PRESSABLE = 'a[href], button, input, select, textarea, summary, label, [role="button"], [role="tab"], .tuck-demo, [data-demo]';

export type TraceDetail = { pts: number[][]; crayon: string; onStep?: (x: number, y: number) => void; onDone?: () => void };

function wireBox() {
  const box = document.getElementById('crayon-box')!;
  const tab = box.querySelector<HTMLButtonElement>('.cb-tab')!;
  const folded = matchMedia('(max-width: 1279px)');
  const setOpen = (on: boolean) => { box.classList.toggle('open', on); tab.setAttribute('aria-expanded', String(on)); };
  tab.addEventListener('click', () => setOpen(!box.classList.contains('open')));
  box.querySelectorAll('.cr').forEach((c) => c.addEventListener('click', () => setOpen(false)));
  document.addEventListener('click', (e) => { if (box.classList.contains('open') && !box.contains(e.target as Node)) setOpen(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && box.classList.contains('open')) { setOpen(false); tab.focus(); } });

  // Like the lion ducking: when something tappable is under the tab, the tab gets out of its way.
  let queued = false;
  const check = () => {
    queued = false;
    if (!folded.matches || box.classList.contains('open') || document.body.classList.contains('drawing')) { box.classList.remove('tucked'); return; }
    box.classList.remove('tucked');
    const r = tab.getBoundingClientRect();
    let under = false;
    for (let y = r.top + 2; y < r.bottom && !under; y += 10) {
      for (const x of [r.left + 2, r.right - 2]) {
        const hit = document.elementsFromPoint(x, y).find((t) => !box.contains(t) && !t.closest('#lion'));
        if (hit?.closest(PRESSABLE)) { under = true; break; }
      }
    }
    box.classList.toggle('tucked', under);
  };
  const later = () => { if (!queued) { queued = true; requestAnimationFrame(check); } };
  addEventListener('scroll', later, { passive: true, capture: true });
  addEventListener('resize', later);
  window.setInterval(later, 400);
  check();
  return setOpen;
}

function wireDraw(closeBox: () => void) {
  const toggle = document.getElementById('draw-toggle') as HTMLButtonElement;
  const surface = document.getElementById('draw-surface')!;
  const bar = document.getElementById('draw-bar')!;
  const doodles = document.getElementById('doodles')!;
  const done = bar.querySelector<HTMLElement>('[data-draw="done"]')!;
  const picks = [...bar.querySelectorAll<HTMLButtonElement>('.pick')];
  let pick = picks.find((p) => p.getAttribute('aria-pressed') === 'true')!;

  let wax: any = null;
  let live: any = null;
  let stroke: any = null;
  let pts: number[][] | null = null;
  let activeId: number | null = null;
  let on = false;
  const queue: TraceDetail[] = [];
  let walking = false;
  const scale = () => Math.min(devicePixelRatio || 1, 1.25);

  const sizeLive = () => { live = new wax.Sheet(surface.querySelector('canvas'), innerWidth, innerHeight, scale()); };

  const next = () => {
    const item = queue.shift();
    walking = !!item;
    if (!item) return;
    document.dispatchEvent(new CustomEvent<TraceDetail>('lion:trace', { detail: { ...item, onDone: () => { item.onDone?.(); next(); } } }));
  };

  /** Fixes the finished line in place on the page, in its own small canvas, and sends the lion along it. */
  function commit(line: number[][]) {
    const S = scale(), pad = 14;
    const xs = line.map((p) => p[0]), ys = line.map((p) => p[1]);
    const x0 = Math.max(0, Math.floor(Math.min(...xs) - pad)), y0 = Math.max(0, Math.floor(Math.min(...ys) - pad));
    const x1 = Math.min(innerWidth, Math.ceil(Math.max(...xs) + pad)), y1 = Math.min(innerHeight, Math.ceil(Math.max(...ys) + pad));
    const w = x1 - x0, h = y1 - y0;
    const c = document.createElement('canvas');
    const sheet = new wax.Sheet(c, w, h, S);
    const X0 = Math.floor(x0 * S), Y0 = Math.floor(y0 * S);
    for (let row = 0; row < sheet.H && row + Y0 < live.H; row++) {
      const from = (row + Y0) * live.W * 4, n = Math.min(sheet.W, live.W - X0) * 4;
      sheet.px.set(live.px.subarray(from + X0 * 4, from + X0 * 4 + n), row * sheet.W * 4);
    }
    sheet.dirty = [0, 0, sheet.W - 1, sheet.H - 1];
    sheet.flush();
    live.clear();
    const docX = x0 + scrollX, docY = y0 + scrollY;
    c.style.cssText = `left:${docX}px;top:${docY}px;width:${w}px;height:${h}px`;
    doodles.append(c);

    // As he walks, his crayon goes over the line again, so it gets richer behind him.
    const pass = new wax.Stroke(sheet, { color: pick.dataset.hex, r: 3.1, press: 1.12 });
    queue.push({
      pts: wax.spline(line.filter((_, i) => i % 2 === 0 || i === line.length - 1).map((p) => [p[0] + scrollX, p[1] + scrollY]), false, 3),
      crayon: pick.dataset.key!,
      onStep: (x, y) => { if (c.isConnected) { pass.to(x - docX, y - docY); sheet.flush(); } },
      onDone: () => {
        sheet.mask = sheet.sid = null;
        // The line fades away 5 seconds after he has walked it.
        window.setTimeout(() => { c.style.transition = 'opacity .6s'; c.style.opacity = '0'; window.setTimeout(() => c.remove(), 650); }, 5000);
      },
    });
    if (!walking) next();
  }

  const endStroke = () => {
    if (!pts) return;
    const line = pts;
    pts = null; stroke = null; activeId = null;
    const long = line.length > 3 && Math.hypot(line[line.length - 1][0] - line[0][0], line[line.length - 1][1] - line[0][1]) + line.length > 14;
    if (long) commit(line); else live.clear();
  };

  surface.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || activeId !== null) return;
    e.preventDefault();
    activeId = e.pointerId;
    surface.setPointerCapture(e.pointerId);
    pts = [[e.clientX, e.clientY]];
    stroke = new wax.Stroke(live, { color: pick.dataset.hex, r: innerWidth <= 720 ? 4.2 : 5.2, press: 1.04 });
    stroke.to(e.clientX, e.clientY);
  });
  surface.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activeId || !pts) return;
    for (const ev of e.getCoalescedEvents?.() ?? [e]) {
      const l = pts[pts.length - 1];
      if (Math.hypot(ev.clientX - l[0], ev.clientY - l[1]) < 3) continue;
      pts.push([ev.clientX, ev.clientY]);
      stroke.to(ev.clientX, ev.clientY);
    }
    live.flush();
  });
  surface.addEventListener('pointerup', (e) => { if (e.pointerId === activeId) endStroke(); });
  surface.addEventListener('pointercancel', (e) => { if (e.pointerId === activeId) { pts = null; stroke = null; activeId = null; live.clear(); } });
  addEventListener('scroll', () => { if (pts) endStroke(); }, { passive: true });
  addEventListener('resize', () => { if (on) sizeLive(); });

  const enter = async () => {
    wax ??= await import('../../lib/wax.js');
    on = true;
    closeBox();
    sizeLive();
    surface.hidden = false; bar.hidden = false;
    document.body.classList.add('drawing');
    toggle.setAttribute('aria-pressed', 'true');
    done.focus();
  };
  const leave = () => {
    on = false;
    if (pts) { pts = null; stroke = null; activeId = null; }
    surface.hidden = true; bar.hidden = true;
    document.body.classList.remove('drawing');
    toggle.setAttribute('aria-pressed', 'false');
    live = null;
    document.dispatchEvent(new Event('lion:draw-off'));
    // The Draw button lives in the folded drawer on smaller screens, so focus goes back to the tab that opens it.
    (matchMedia('(max-width: 1279px)').matches ? document.querySelector<HTMLElement>('.cb-tab')! : toggle).focus();
  };

  toggle.addEventListener('click', () => { if (on) leave(); else enter(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && on) { e.preventDefault(); leave(); } });
  bar.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const p = t.closest<HTMLButtonElement>('.pick');
    if (p) { pick = p; picks.forEach((b) => b.setAttribute('aria-pressed', String(b === p))); return; }
    const act = t.closest<HTMLElement>('[data-draw]')?.dataset.draw;
    if (act === 'done') leave();
    if (act === 'clear') { queue.length = 0; doodles.replaceChildren(); document.dispatchEvent(new Event('lion:draw-off')); }
  });
}

// From 1280px up the Dress up button stands in the box, under Draw and in the same wax. Below that it goes back to its place in the page.
function placeDressUp() {
  const dress = document.getElementById('dress-btn')!, slot = document.getElementById('dress-slot')!;
  const home = dress.parentElement!, next = dress.nextSibling, wide = matchMedia('(min-width: 1280px)');
  const place = () => {
    dress.className = wide.matches ? 'cb-draw' : 'btn dress-btn';
    if (wide.matches) slot.append(dress);
    else home.insertBefore(dress, next);
  };
  wide.addEventListener('change', place);
  place();
}

export function initCrayons(): void {
  placeDressUp();
  const setOpen = wireBox();
  wireDraw(() => setOpen(false));
}
