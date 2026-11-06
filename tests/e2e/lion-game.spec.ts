import { test, expect, type Locator, type Page } from '@playwright/test';

const lion = (page: Page) => page.locator('#lion');
const dressUp = (page: Page) => page.getByRole('button', { name: 'Dress up the lion' });
const wardrobe = (page: Page) => page.getByRole('dialog', { name: 'Dress up the lion' });

async function throwLion(page: Page) {
  const b = (await lion(page).boundingBox())!;
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(x + i * 40, y - i * 60, { steps: 1 });
  await page.mouse.up();
}

test('the lion roams on every page and has an accessible name', async ({ page }) => {
  for (const path of ['/', '/work/tuck']) {
    await page.goto(path);
    await expect(lion(page)).toBeVisible();
    await expect(lion(page)).toHaveAccessibleName(/lion/);
  }
});

test('the lion and every pose are hard-pixel art', async ({ page }) => {
  await page.goto('/');
  const svgs = page.locator('#lion svg.lion-svg, .lion-pose svg.lion-svg');
  expect(await svgs.count()).toBeGreaterThanOrEqual(4);
  for (const svg of await svgs.all()) await expect(svg).toHaveAttribute('shape-rendering', 'crispEdges');
  for (const pose of ['laptop', 'phone', 'scarf', 'bed']) await expect(page.locator(`.lion-pose[data-pose="${pose}"]`)).toHaveAttribute('aria-hidden', 'true');
});

test('throwing the lion sends it flying and it lands back on the floor, dizzy', async ({ page }) => {
  await page.goto('/');
  const before = (await lion(page).boundingBox())!;
  await throwLion(page);
  await expect.poll(async () => (await lion(page).boundingBox())!.y).toBeLessThan(before.y - 50);
  await expect(lion(page)).toHaveAttribute('data-mode', 'dizzy', { timeout: 6000 });
  const vh = page.viewportSize()!.height;
  const b = (await lion(page).boundingBox())!;
  expect(Math.round(b.y + b.height)).toBeGreaterThanOrEqual(vh - 4);
});

test('a plain click is not a throw', async ({ page }) => {
  await page.goto('/');
  await lion(page).click();
  await expect(lion(page)).not.toHaveAttribute('data-mode', 'dizzy');
});

test('double-click or Enter opens the wardrobe; Esc closes it', async ({ page }) => {
  await page.goto('/');
  await lion(page).dblclick();
  await expect(wardrobe(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(wardrobe(page)).toBeHidden();
  await lion(page).focus();
  await page.keyboard.press('Enter');
  await expect(wardrobe(page)).toBeVisible();
});

test('an outfit shows on the roaming lion and the hero lion, and survives a reload', async ({ page }) => {
  await page.goto('/');
  await dressUp(page).click();
  await wardrobe(page).getByRole('button', { name: 'Columbia cap' }).click();
  await wardrobe(page).getByRole('tab', { name: 'Accessories' }).click();
  await wardrobe(page).getByRole('button', { name: 'Round glasses' }).click();
  for (const where of ['#lion', '#hero .lion-pose']) {
    await expect(page.locator(`${where} [data-item="columbia"]`)).toHaveCount(1);
    await expect(page.locator(`${where} [data-item="glasses"]`)).toHaveCount(1);
  }
  await page.reload();
  await expect(page.locator('#lion [data-item="columbia"]')).toHaveCount(1);
  await expect(page.locator('#hero .lion-pose [data-item="glasses"]')).toHaveCount(1);
});

test('locked items unlock by exploring: a case study, the Tuck demo and a Devpost link', async ({ page }) => {
  await page.goto('/');
  await dressUp(page).click();
  await expect(wardrobe(page).getByRole('button', { name: /Grad cap/ })).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.goto('/work/tuck');
  await page.goto('/');
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('tuck:sorted')));
  await expect(page.locator('#game-toast')).toContainText('Lab coat');
  await page.evaluate(() => {
    const a = document.querySelector<HTMLAnchorElement>('a[href*="devpost.com"]')!;
    a.addEventListener('click', (e) => e.preventDefault());
    a.click();
  });
  await dressUp(page).click();
  await expect(wardrobe(page).getByRole('button', { name: /Grad cap/ })).toBeEnabled();
  await wardrobe(page).getByRole('tab', { name: 'Tops' }).click();
  await expect(wardrobe(page).getByRole('button', { name: /Lab coat/ })).toBeEnabled();
  await expect(wardrobe(page).getByRole('button', { name: /Columbia hoodie/ })).toBeEnabled();
  await wardrobe(page).getByRole('button', { name: 'Quests' }).click();
  await expect(wardrobe(page).locator('.quest.done')).toHaveCount(3);
});

test('the Quests view replaces the item grid', async ({ page }) => {
  await page.goto('/');
  await dressUp(page).click();
  await wardrobe(page).getByRole('button', { name: 'Quests' }).click();
  await expect(wardrobe(page).locator('.wd-quests')).toBeVisible();
  await expect(wardrobe(page).locator('.wd-grid')).toBeHidden();
  await expect(wardrobe(page).locator('.wd-tabs')).toBeHidden();
});

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('one tap gives a hint, two quick taps open the wardrobe', async ({ page }) => {
    await page.goto('/no-such-page'); // nothing pressable along the bottom, so the lion stays up
    const tap = async () => { const b = (await lion(page).boundingBox())!; await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
    // Straight after load on purpose: the first tap of a visit must not count as the second half of a double-tap.
    await tap();
    await expect(lion(page)).toHaveClass(/show-hint/);
    await expect(wardrobe(page)).toBeHidden();
    await page.waitForTimeout(500);
    await tap();
    await tap();
    await expect(wardrobe(page)).toBeVisible();
  });
});

const DEMOS = '.tuck-demo, [data-demo]';
const TAP_TARGETS = [
  ['the Devpost button in Wins', '/', '#wins a.btn:has-text("Devpost")'],
  ['the Repo button in Wins', '/', '#wins a.btn:has-text("Repo")'],
  ['the SPADE Run button', '/work/nutrigene', '[data-demo="spade"] button:has-text("Run next round")'],
  ['an Aikonic query', '/work/aikonic', '[data-demo="aikonic"] button >> nth=0'],
  ['an Aikonic search mode', '/work/aikonic', '[data-demo="aikonic"] button:has-text("Semantic")'],
  ['a Tuck row', '/work/tuck', '.tuck-demo button:has-text("New folder")'],
] as const;

/** Picks the lion up on clear ground and drops it straight above a control, then scrolls that control into its lane. */
async function parkLionOver(page: Page, target: Locator) {
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await expect(lion(page)).not.toHaveClass(/duck/);
  const { x } = (await target.boundingBox())!;
  const { width } = (await target.boundingBox())!;
  const b = (await lion(page).boundingBox())!;
  const vh = page.viewportSize()!.height;
  const dropX = Math.max(b.width / 2, Math.min(page.viewportSize()!.width - b.width / 2, x + width / 2));
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(dropX, vh - 220, { steps: 8 });
  for (let i = 0; i < 7; i++) await page.mouse.move(dropX + (i % 2), vh - 220); // settle, so this is a drop and not a throw
  await page.mouse.up();
  await expect(lion(page)).not.toHaveAttribute('data-mode', /air|held/, { timeout: 6000 });
  await target.evaluate((t) => { const r = t.getBoundingClientRect(); window.scrollBy({ top: r.top + r.height / 2 - (window.innerHeight - 30), behavior: 'instant' }); });
}

/** A point inside both the lion's box and the control, once they overlap. */
async function overlapPoint(page: Page, target: Locator) {
  let point: { x: number; y: number } | null = null;
  await expect.poll(async () => {
    const a = (await lion(page).boundingBox())!, b = (await target.boundingBox())!;
    const left = Math.max(a.x, b.x), right = Math.min(a.x + a.width, b.x + b.width);
    const top = Math.max(a.y, b.y), bottom = Math.min(a.y + a.height, b.y + b.height);
    point = right - left > 3 && bottom - top > 3 ? { x: (left + right) / 2, y: (top + bottom) / 2 } : null;
    return point !== null;
  }, { timeout: 15_000 }).toBe(true);
  return point!;
}

for (const width of [360, 768, 1100]) {
  test.describe(`at ${width}px nothing floats over what you need to press`, () => {
    test.use({ hasTouch: true, viewport: { width, height: 740 } });

    for (const [name, path, selector] of TAP_TARGETS) {
      test(`a real tap presses ${name}, with the lion on top of it`, async ({ page }) => {
        await page.goto(path);
        const target = page.locator(selector).first();
        await target.evaluate((t) => t.addEventListener('click', (e) => { e.preventDefault(); (window as any).pressed = true; }));
        await parkLionOver(page, target);
        const { x, y } = await overlapPoint(page, target);
        await page.waitForTimeout(250);
        await page.touchscreen.tap(x, y);
        await expect.poll(() => page.evaluate(() => (window as any).pressed === true), { timeout: 2000 }).toBe(true);
      });
    }

    test('neither the lion nor the Dress up button ever sits on a demo', async ({ page }) => {
      for (const path of ['/', '/work/nutrigene', '/work/aikonic', '/work/tuck']) {
        await page.goto(path);
        const overlaps = await page.locator(DEMOS).first().evaluate(async (first) => {
          const hits: string[] = [];
          const demo = first.getBoundingClientRect();
          const start = scrollY + demo.top - innerHeight, end = scrollY + demo.bottom;
          const clash = (a: DOMRect, b: DOMRect) => Math.min(a.right, b.right, innerWidth) - Math.max(a.left, b.left, 0) > 0 && Math.min(a.bottom, b.bottom, innerHeight) - Math.max(a.top, b.top, 0) > 0;
          for (let y = Math.max(0, start); y <= end; y += 160) {
            scrollTo({ top: y, behavior: 'instant' });
            await new Promise((r) => setTimeout(r, 340)); // the duck takes .2s
            const d = first.getBoundingClientRect();
            if (clash(document.querySelector('#lion .lion-inner')!.getBoundingClientRect(), d)) hits.push(`lion @${y}`);
            if (clash(document.getElementById('dress-btn')!.getBoundingClientRect(), d)) hits.push(`button @${y}`);
          }
          return hits;
        });
        expect(overlaps, path).toEqual([]);
      }
    });
  });
}

test('with reduced motion the lion still gets off a demo button', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/work/nutrigene');
  const target = page.locator('[data-demo="spade"] button').first();
  await target.evaluate((t) => { const r = t.getBoundingClientRect(); window.scrollBy({ top: r.top + r.height / 2 - (window.innerHeight - 30), behavior: 'instant' }); });
  await expect(lion(page)).toHaveClass(/duck/);
  const { x, y } = await overlapPoint(page, target);
  const hit = await page.evaluate(([px, py]) => !document.getElementById('lion')!.contains(document.elementFromPoint(px, py)), [x, y]);
  expect(hit).toBe(true);
});

test('over a demo it holds still, then comes back when the demo has gone', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/work/nutrigene');
  const target = page.locator('[data-demo="spade"] button').first();
  await target.evaluate((t) => { const r = t.getBoundingClientRect(); window.scrollBy({ top: r.top + r.height / 2 - (window.innerHeight - 30), behavior: 'instant' }); });
  await expect(lion(page)).toHaveClass(/duck/);
  const a = (await lion(page).boundingBox())!;
  await page.waitForTimeout(800);
  expect((await lion(page).boundingBox())!.x).toBe(a.x);
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await expect(lion(page)).not.toHaveClass(/duck/);
});

test('Random, Reset and the keyboard tabs work', async ({ page }) => {
  await page.goto('/');
  await dressUp(page).click();
  await wardrobe(page).getByRole('button', { name: 'Random' }).click();
  await wardrobe(page).getByRole('button', { name: 'Reset' }).click();
  await expect(page.locator('#lion [data-item="scarf"]')).toHaveCount(1);
  await wardrobe(page).getByRole('tab', { name: 'Hats' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(wardrobe(page).getByRole('tab', { name: 'Tops' })).toBeFocused();
  await expect(wardrobe(page).getByRole('button', { name: 'Fund manager tie' })).toBeVisible();
});

test('Put the lion to bed hides it and the choice sticks', async ({ page }) => {
  await page.goto('/');
  await dressUp(page).click();
  await page.getByRole('button', { name: 'Put the lion to bed' }).click();
  await expect(lion(page)).toBeHidden();
  await page.reload();
  await expect(lion(page)).toBeHidden();
  await dressUp(page).click();
  await page.getByRole('button', { name: 'Wake the lion up' }).click();
  await expect(lion(page)).toBeVisible();
});

test('Save downloads a picture of your lion', async ({ page }) => {
  await page.goto('/');
  await dressUp(page).click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save picture' }).click()]);
  expect(dl.suggestedFilename()).toBe('pixel-lion.png');
});

test('with reduced motion the lion stays put', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const a = (await lion(page).boundingBox())!;
  await page.waitForTimeout(1200);
  const b = (await lion(page).boundingBox())!;
  expect(Math.abs(a.x - b.x)).toBeLessThan(1);
  await expect(lion(page)).toHaveAttribute('data-mode', 'sit');
});

test('on a phone: no sideways scroll, and the button sits in the page instead of over it', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 760 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await expect(dressUp(page)).toHaveCSS('position', 'static');
  await dressUp(page).click();
  const box = (await wardrobe(page).boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(375);
});

test('the quest toast is hidden until there is news', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game-toast')).toBeHidden();
});
