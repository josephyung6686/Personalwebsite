// Wires the SPADE demo to the page. All the math lives in spadeMath.ts; this file only draws and listens.
import {
  DEFAULT_TARGET, GRID, MAX_ROUNDS,
  certify, describeCell, describeStatus, heatColor, newCampaign, recommend, runRound, summarize,
  type Campaign, type Posterior,
} from './spadeMath';

const GOLD = '#f5c04a';
const INK = '#eaf6f4';
const SHADE = '#06201b';
const MORPH_MS = 260;

function mount(root: HTMLElement): void {
  const $ = <T extends Element>(s: string) => root.querySelector<T>(s)!;
  const canvas = $<HTMLCanvasElement>('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const run = $<HTMLButtonElement>('.spd-run');
  const slider = $<HTMLInputElement>('input[type="range"]');
  const readout = $<HTMLElement>('.spd-readout');
  const readoutIdle = readout.textContent ?? '';
  const pips = [...root.querySelectorAll<HTMLElement>('.spd-pips i')];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  let campaign: Campaign = newCampaign();
  let target = DEFAULT_TARGET;
  let hover = -1;
  let shown: Posterior = campaign.post;
  let frame = 0;

  function paint(): void {
    if (!ctx) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.round(canvas.clientWidth * dpr);
    if (!w) return;
    if (canvas.width !== w) { canvas.width = w; canvas.height = w; }
    // Whole-pixel cell edges, so the map stays crisp at any size. Row 0 of the grid is the bottom of the picture.
    const ex = (i: number) => Math.round((i * w) / GRID);
    const ey = (j: number) => Math.round(((GRID - j) * w) / GRID);

    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const k = j * GRID + i;
        const [r, g, b] = heatColor(shown.mean[k], shown.sd[k]);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(ex(i), ey(j + 1), ex(i + 1) - ex(i), ey(j) - ey(j + 1));
      }
    }

    const mask = certify(campaign.post, target);
    const on = (i: number, j: number) => i >= 0 && j >= 0 && i < GRID && j < GRID && mask[j * GRID + i] === 1;
    ctx.beginPath();
    ctx.fillStyle = 'rgba(255,255,255,.13)';
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        if (!on(i, j)) continue;
        ctx.fillRect(ex(i), ey(j + 1), ex(i + 1) - ex(i), ey(j) - ey(j + 1));
        if (!on(i - 1, j)) { ctx.moveTo(ex(i), ey(j + 1)); ctx.lineTo(ex(i), ey(j)); }
        if (!on(i + 1, j)) { ctx.moveTo(ex(i + 1), ey(j + 1)); ctx.lineTo(ex(i + 1), ey(j)); }
        if (!on(i, j - 1)) { ctx.moveTo(ex(i), ey(j)); ctx.lineTo(ex(i + 1), ey(j)); }
        if (!on(i, j + 1)) { ctx.moveTo(ex(i), ey(j + 1)); ctx.lineTo(ex(i + 1), ey(j + 1)); }
      }
    }
    ctx.lineCap = 'square';
    ctx.strokeStyle = SHADE; ctx.lineWidth = 3 * dpr; ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.25 * dpr; ctx.stroke();

    const rect = recommend(campaign.post, target);
    if (rect) {
      const x = ex(rect.x0), y = ey(rect.y1 + 1), rw = ex(rect.x1 + 1) - x, rh = ey(rect.y0) - y;
      ctx.lineCap = 'butt';
      ctx.strokeStyle = SHADE; ctx.lineWidth = 6 * dpr; ctx.strokeRect(x, y, rw, rh);
      ctx.strokeStyle = GOLD; ctx.lineWidth = 3 * dpr; ctx.strokeRect(x, y, rw, rh);
    }

    const dot = (px: number, py: number, radius: number) => {
      ctx.beginPath();
      ctx.arc(px * w, (1 - py) * w, radius + 1.5 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = SHADE; ctx.fill();
      ctx.beginPath();
      ctx.arc(px * w, (1 - py) * w, radius, 0, Math.PI * 2);
      ctx.fillStyle = INK; ctx.fill();
    };
    const older = campaign.obs.length - campaign.latest.length;
    campaign.obs.slice(0, older).forEach((o) => dot(o.x, o.y, 2.5 * dpr));
    campaign.latest.forEach((o) => dot(o.x, o.y, 4 * dpr));

    if (hover >= 0) {
      const i = hover % GRID, j = Math.floor(hover / GRID);
      ctx.lineWidth = 1.5 * dpr;
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(ex(i), ey(j + 1), ex(i + 1) - ex(i), ey(j) - ey(j + 1));
    }
  }

  /** Eases the heatmap from what is on screen to the new fit. The overlays land immediately, because they are the answer. */
  function morphTo(next: Posterior): void {
    cancelAnimationFrame(frame);
    if (reduceMotion.matches) { shown = next; paint(); return; }
    const from = shown;
    const mean = new Float64Array(next.mean.length), sd = new Float64Array(next.sd.length);
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / MORPH_MS);
      const e = 1 - (1 - t) ** 4;
      for (let k = 0; k < mean.length; k++) {
        mean[k] = from.mean[k] + (next.mean[k] - from.mean[k]) * e;
        sd[k] = from.sd[k] + (next.sd[k] - from.sd[k]) * e;
      }
      shown = t < 1 ? { mean, sd } : next;
      paint();
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  }

  function setText(): void {
    const status = describeStatus(campaign, target);
    $<HTMLElement>('.spd-status').dataset.kind = status.kind;
    $<HTMLElement>('.spd-head').textContent = status.headline;
    $<HTMLElement>('.spd-detail').textContent = status.detail;
    $<HTMLElement>('.spd-sum').textContent = summarize(campaign, target);
    $<HTMLElement>('.spd-count').textContent = `Round ${campaign.round} of ${MAX_ROUNDS} · ${campaign.obs.length} experiments`;
    $<HTMLElement>('.spd-tval').textContent = `${target}%`;
    slider.setAttribute('aria-valuetext', `${target} percent`);
    $<HTMLElement>('.spd-empty').hidden = campaign.round > 0;
    pips.forEach((p, i) => p.classList.toggle('on', i < campaign.round));
    run.setAttribute('aria-disabled', String(campaign.round >= MAX_ROUNDS));
    if (hover >= 0) readout.textContent = describeCell(campaign, hover, target);
  }

  run.addEventListener('click', () => {
    const next = runRound(campaign, target);
    if (next === campaign) return;
    campaign = next;
    setText();
    morphTo(campaign.post);
  });
  $<HTMLButtonElement>('.spd-reset').addEventListener('click', () => {
    campaign = newCampaign();
    setText();
    morphTo(campaign.post);
  });
  slider.addEventListener('input', () => {
    target = Number(slider.value);
    setText();
    paint();
  });

  const cellAt = (e: PointerEvent): number => {
    const box = canvas.getBoundingClientRect();
    const i = Math.floor(((e.clientX - box.left) / box.width) * GRID);
    const j = GRID - 1 - Math.floor(((e.clientY - box.top) / box.height) * GRID);
    return i < 0 || j < 0 || i >= GRID || j >= GRID ? -1 : j * GRID + i;
  };
  const point = (e: PointerEvent) => {
    const cell = cellAt(e);
    if (cell === hover) return;
    hover = cell;
    readout.textContent = cell >= 0 ? describeCell(campaign, cell, target) : readoutIdle;
    paint();
  };
  canvas.addEventListener('pointermove', point);
  canvas.addEventListener('pointerdown', point);
  // A finger lifting also counts as leaving, and a tap's reading should stay until the next tap.
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse') return;
    hover = -1;
    readout.textContent = readoutIdle;
    paint();
  });

  if ('ResizeObserver' in window) new ResizeObserver(paint).observe(canvas);
  setText();
  paint();
  root.dataset.ready = 'true';
}

/** Nothing is drawn or computed until the demo is near the viewport, so the page stays fast. */
export function initSpadeDemos(): void {
  document.querySelectorAll<HTMLElement>('[data-demo="spade"]').forEach((root) => {
    if (!('IntersectionObserver' in window)) { mount(root); return; }
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      mount(root);
    }, { rootMargin: '300px' });
    io.observe(root);
  });
}
