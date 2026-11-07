// The entry point, kept tiny. The window is already on the page as HTML. Its code loads when the window nears the viewport,
// and the guide's code loads only if someone starts the tour.
import type { App } from './aikonicApp';

type Guide = ReturnType<typeof import('./aikonicGuide').createGuide>;

function wireGuide(root: HTMLElement, app: App): void {
  const intro = root.querySelector<HTMLElement>('.aik-start')!;
  const card = root.querySelector<HTMLElement>('.aik-guide')!;
  const restart = root.querySelector<HTMLElement>('.aik-restart')!;
  let guide: Guide | null = null;

  async function act(action: string): Promise<void> {
    if (guide?.running()) { guide.handle(action); return; }
    if (action === 'skip') {
      intro.hidden = true;
      restart.hidden = false;
      restart.focus({ preventScroll: true });
      return;
    }
    if (action !== 'start') return;
    guide ??= (await import('./aikonicGuide')).createGuide(root, app);
    guide.start();
  }
  root.addEventListener('click', (e) => {
    const key = (e.target as HTMLElement).closest<HTMLElement>('[data-guide]');
    if (key?.getAttribute('aria-disabled') !== 'true' && key) void act(key.dataset.guide!);
  });
  card.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Escape' && !card.hidden) void act('skip'); });
}

export function initAikonicDemos(): void {
  document.querySelectorAll<HTMLElement>('[data-demo="aikonic"]').forEach((root) => {
    const start = async () => {
      const { mountApp } = await import('./aikonicApp');
      wireGuide(root, mountApp(root));
      root.dataset.ready = 'true';
    };
    if (!('IntersectionObserver' in window)) { void start(); return; }
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      void start();
    }, { rootMargin: '300px' });
    io.observe(root);
  });
}
