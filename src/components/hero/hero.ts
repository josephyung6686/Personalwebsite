import { sceneTime } from '../../lib/timeOfDay';
import { parallaxOffset, PARALLAX_DEPTH } from '../../lib/parallax';

const LAYERS: [selector: string, depth: number, prop: 'transform' | 'translate'][] = [
  ['.sky-layer', PARALLAX_DEPTH.sky, 'transform'],
  ['.sun-layer', PARALLAX_DEPTH.sun, 'transform'],
  ['.clouds-layer', PARALLAX_DEPTH.clouds, 'translate'],
  ['.px-scene', PARALLAX_DEPTH.scene, 'transform'],
  ['.hero-lion', PARALLAX_DEPTH.lion, 'transform'],
];

export function initHero(now: Date = new Date()): void {
  const hero = document.getElementById('hero');
  if (!hero) return;
  hero.dataset.time = sceneTime(now.getHours());

  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || reduce) return;

  const els = LAYERS.map(([sel, depth, prop]) => ({ el: hero.querySelector<HTMLElement>(sel), depth, prop }));
  hero.addEventListener('mousemove', (e) => {
    const r = hero.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    for (const { el, depth, prop } of els) {
      if (!el) continue;
      const { x, y } = parallaxOffset(nx, ny, depth);
      if (prop === 'translate') el.style.translate = `${x}px ${y}px`;
      else el.style.transform = `translate(${x}px, ${y}px)`;
    }
  });
  hero.addEventListener('mouseleave', () => {
    for (const { el } of els) if (el) { el.style.transform = ''; el.style.translate = ''; }
  });
}
