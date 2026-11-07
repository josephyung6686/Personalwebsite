/* The Tuck demo is the real prototype in an iframe. Under 700px it can't work, so a small rebuild takes its place (phone/).
   Each visitor downloads only the one they need, and only when the demo is near. */
import { VIEWS, type View } from './views';

export { VIEWS };

/* Render the page at its minimum size and scale it down to the stage, so it shrinks and never clips. */
export function fitFrame(stageW: number, stageH: number, minW: number, minH: number) {
  const k = Math.min(1, stageW / minW, stageH / minH);
  return { k, w: stageW / k, h: stageH / k };
}

export function initTuckDemos(): void {
  document.querySelectorAll<HTMLElement>('.tuck-demo').forEach(mount);
}

function mount(root: HTMLElement): void {
  if (root.dataset.ready) return;
  root.dataset.ready = '1';
  const stage = root.querySelector<HTMLElement>('[data-stage]')!, frame = root.querySelector<HTMLIFrameElement>('[data-frame]')!;
  const poster = root.querySelector<HTMLImageElement>('[data-poster]')!, full = root.querySelector<HTMLAnchorElement>('[data-full]')!, small = root.querySelector<HTMLElement>('[data-phone]')!;
  const wide = matchMedia('(min-width: 700px)');
  let view: View = 'app', near = false, loaded = false, pressed = false, phone = false;

  /* The quest listens for tuck:sorted on this page. The frame is same-origin, so the first press inside it counts.
     The phone version fires it itself, when a decision is accepted. */
  const pressedInside = () => {
    if (pressed) return;
    pressed = true;
    document.dispatchEvent(new CustomEvent('tuck:sorted'));
  };

  function fit() {
    const { k, w, h } = fitFrame(stage.clientWidth, stage.clientHeight, VIEWS[view].minW, VIEWS[view].minH);
    frame.style.width = `${w}px`;
    frame.style.height = `${h}px`;
    frame.style.transform = k < 1 ? `scale(${k})` : '';
  }
  function load() {
    if (!near) return;
    if (!wide.matches) {
      if (!phone) { phone = true; void import('./phone/tuckPhone').then((m) => m.mountPhone(small)); }
      return;
    }
    /* never compete with the page's own first load */
    if (document.readyState !== 'complete') { addEventListener('load', load, { once: true }); return; }
    frame.hidden = false;
    fit();
    if (frame.getAttribute('src') !== VIEWS[view].src) {
      loaded = false;
      poster.hidden = false;
      frame.src = VIEWS[view].src;
    }
  }
  function show(next: View) {
    view = next;
    poster.src = VIEWS[view].poster;
    poster.alt = VIEWS[view].alt;
    full.href = VIEWS[view].src;
    root.querySelectorAll<HTMLElement>('[data-view]').forEach((b) => {
      const on = b.dataset.view === view;
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('alt', !on);
    });
    load();
  }

  frame.addEventListener('load', () => {
    loaded = true;
    poster.hidden = true;
    const inner = frame.contentDocument;
    inner?.addEventListener('pointerdown', pressedInside);
    inner?.addEventListener('keydown', pressedInside);
  });
  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-view]');
    if (b) show(b.dataset.view as View);
  });
  new ResizeObserver(() => { if (loaded || !frame.hidden) fit(); }).observe(stage);
  wide.addEventListener('change', () => {
    if (wide.matches && loaded) poster.hidden = true;
    load();
  });
  const watch = new IntersectionObserver((seen) => {
    if (!seen.some((x) => x.isIntersecting)) return;
    watch.disconnect();
    near = true;
    load();
  }, { rootMargin: '100px' });
  watch.observe(root);
}
