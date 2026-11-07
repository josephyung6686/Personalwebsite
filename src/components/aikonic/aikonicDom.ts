// Small helpers shared by the app. Anything a visitor types goes through textContent, never into markup.
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

export const reducedMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Presses one key of a toggle group, and reports its value to the callback. */
export function pressGroup(root: Element, onPress: (value: string) => void): void {
  const keys = [...root.querySelectorAll<HTMLButtonElement>('button[data-value]')];
  root.addEventListener('click', (e) => {
    const key = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-value]');
    if (!key) return;
    keys.forEach((k) => k.setAttribute('aria-pressed', String(k === key)));
    onPress(key.dataset.value!);
  });
}

export const seconds = (s: number): string => `${s.toFixed(1)} s`;

/** The tab that an arrow, Home or End key moves to, or null for any other key. The WAI-ARIA pattern, wrapping at the ends. */
export function tabForKey<T>(ids: readonly T[], current: T, key: string): T | null {
  const i = ids.indexOf(current);
  if (key === 'ArrowRight') return ids[(i + 1) % ids.length];
  if (key === 'ArrowLeft') return ids[(i + ids.length - 1) % ids.length];
  if (key === 'Home') return ids[0];
  if (key === 'End') return ids[ids.length - 1];
  return null;
}

/** Opens a "How I built this" drawer's contents the first time it is opened, so its code runs only if someone asks. */
export function fillOnOpen(drawer: HTMLDetailsElement, fill: (body: HTMLElement) => void | Promise<void>): void {
  const body = drawer.querySelector<HTMLElement>('.aik-drawer-body')!;
  let filled = false;
  drawer.addEventListener('toggle', () => {
    if (!drawer.open || filled) return;
    filled = true;
    void fill(body);
  });
}

export const drawerMarkup = (body = ''): string => `<details class="aik-drawer"><summary>How I built this</summary><div class="aik-drawer-body">${body}</div></details>`;
