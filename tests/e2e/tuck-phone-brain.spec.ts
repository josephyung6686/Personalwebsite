import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ viewport: { width: 390, height: 800 } });

const demo = (page: Page) => page.getByRole('region', { name: 'Interactive demo of Tuck' });
const node = (page: Page, id: string) => demo(page).locator(`.tb-n[data-id="${id}"]`);
const panel = (page: Page) => demo(page).locator('.tb-insp');
const press = (page: Page, id: string) => node(page, id).dispatchEvent('click');

async function open(page: Page, path = '/') {
  await page.addInitScript(() => {
    (window as unknown as { sorted: number }).sorted = 0;
    document.addEventListener('tuck:sorted', () => { (window as unknown as { sorted: number }).sorted++; });
  });
  await page.goto(path);
  await demo(page).evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect(node(page, 'you')).toHaveCount(1);
}
const sorted = (page: Page) => page.evaluate(() => (window as unknown as { sorted: number }).sorted);

test('the Brain is the default screen, with the honest label', async ({ page }) => {
  await open(page);
  const d = demo(page);
  await expect(d.locator('[data-screen="brain"]')).toHaveAttribute('aria-current', 'page');
  await expect(d.locator('[data-screen-panel="needs"]')).toBeHidden();
  await expect(d.locator('[data-screen-panel="brain"]')).toContainText('315 files · 38 folders');
  await expect(d.locator('[data-screen-panel="brain"]')).toContainText('Prototype with sample files');
  expect(await d.locator('.tb-n').count()).toBeGreaterThan(45);
});

test('the map does no work until the demo is near the viewport', async ({ page }) => {
  const loaded: string[] = [];
  page.on('request', (r) => { if (r.url().includes('tuckBrain')) loaded.push(r.url()); });
  await page.setViewportSize({ width: 390, height: 500 });
  await page.goto('/');
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => document.querySelector('.tuck-demo')!.getBoundingClientRect().top)).toBeGreaterThan(600);
  expect(loaded).toEqual([]);
  await expect(node(page, 'you')).toHaveCount(0);
  await demo(page).evaluate((e) => e.scrollIntoView({ behavior: 'instant' }));
  await expect(node(page, 'you')).toHaveCount(1);
  expect(loaded.length).toBeGreaterThan(0);
});

test('Tuck reads first, then says what it found; replay works', async ({ page }) => {
  await open(page);
  const pill = demo(page).locator('.tb-read');
  await expect(pill).toContainText(/Tuck is reading \d+ of 315 files/);
  await expect(pill).toContainText('Read 315 files. Unsure about 6.', { timeout: 6000 });
  await expect(pill).toBeHidden({ timeout: 6000 });
  await demo(page).getByRole('button', { name: 'Watch Tuck read' }).click();
  await expect(pill).toContainText(/Tuck is reading/);
});

test('reduced motion: the map is simply there', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await expect(demo(page).locator('.tb-read')).toBeHidden();
  await expect(demo(page).locator('.tb-svg')).not.toHaveClass(/tb-(reading|wait)/);
});

test('pressing a node shows its detail, what it connects to and its files', async ({ page }) => {
  await open(page);
  await expect(panel(page)).toBeHidden();
  await press(page, 'phys');
  const p = panel(page);
  await expect(p.getByRole('heading')).toHaveText('PHYS 1401');
  for (const t of ['In Studying · 26 files', 'Sure', 'Your physics course', 'Connected to', 'Prof. Alvarez', 'Lecture 6 Gravity.pdf', 'and 9 more']) await expect(p).toContainText(t);
  await expect(demo(page).locator('.tb-crumbs')).toHaveText(/You.*Studying.*PHYS 1401/);
  await expect(node(page, 'health')).toHaveClass(/dim/);
  await expect(node(page, 'study')).not.toHaveClass(/dim/);
  await p.getByRole('button', { name: /Prof\. Alvarez/ }).click();
  await expect(p.getByRole('heading')).toHaveText('Prof. Alvarez');
  await demo(page).locator('.tb-crumbs').getByRole('button', { name: 'You' }).click();
  await expect(p.getByRole('heading')).toHaveText('You');
  await p.getByRole('button', { name: 'Close details' }).click();
  await expect(p).toBeHidden();
  await expect(node(page, 'health')).not.toHaveClass(/dim/);
});

test('a press before the first read keeps its selection', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 400 });
  await page.goto('/');
  // near enough to load, not yet enough on screen to start reading
  await demo(page).evaluate((e) => scrollTo({ top: scrollY + e.getBoundingClientRect().top - innerHeight + 40, behavior: 'instant' }));
  await expect(node(page, 'you')).toHaveCount(1);
  await press(page, 'study');
  await expect(panel(page)).toBeVisible();
  await demo(page).evaluate((e) => e.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.waitForTimeout(500);
  await expect(panel(page)).toBeVisible();
  await expect(demo(page).locator('.tb-read')).toBeHidden();
});

test('the map works from the keyboard as one tab stop', async ({ page }) => {
  await open(page);
  await expect(demo(page).locator('.tb-n[tabindex="0"]')).toHaveCount(1);
  await node(page, 'you').focus();
  await page.keyboard.press('ArrowUp');
  const focused = () => page.evaluate(() => (document.activeElement as HTMLElement).dataset.id);
  expect(await focused()).not.toBe('you');
  await expect(demo(page).locator('.tb-n[tabindex="0"]')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(panel(page)).toBeVisible();
  const was = await focused();
  await page.keyboard.press('Escape');
  await expect(panel(page)).toBeHidden();
  expect(await focused()).toBe(was);
});

test('Everything and Unsure filter the map', async ({ page }) => {
  await open(page);
  const unsure = demo(page).getByRole('button', { name: /Unsure/ });
  await unsure.click();
  await expect(unsure).toHaveAttribute('aria-pressed', 'true');
  await expect(node(page, 'health')).toHaveClass(/dim/);
  for (const id of ['lb', 'phys', 'you']) await expect(node(page, id)).not.toHaveClass(/dim/);
  await demo(page).getByRole('button', { name: 'Everything' }).click();
  await expect(node(page, 'health')).not.toHaveClass(/dim/);
});

test('find a topic or file, without the letters answering anything', async ({ page }) => {
  await open(page);
  const box = demo(page).getByRole('searchbox', { name: 'Find a topic or file' });
  await box.fill('lecture 6');
  await expect(demo(page).locator('.tb-res')).toContainText('Lecture 6 Gravity.pdf');
  await box.press('Enter');
  await expect(panel(page).getByRole('heading')).toHaveText('Lecture 6 Gravity.pdf');
  await expect(panel(page)).toContainText('Nothing moved on disk');
  await box.pressSequentially('yns');
  await expect(box).toHaveValue('yns');
  expect(await sorted(page)).toBe(0);
});

test('zoom and fit', async ({ page }) => {
  await open(page);
  const zoom = demo(page).locator('.tb-zv');
  await expect(zoom).toHaveText('100%');
  await demo(page).getByRole('button', { name: 'Zoom in' }).click();
  await expect(zoom).toHaveText('125%');
  await demo(page).getByRole('button', { name: 'Zoom out' }).click();
  await expect(zoom).toHaveText('100%');
  await demo(page).getByRole('button', { name: 'Zoom in' }).click();
  await demo(page).getByRole('button', { name: 'Fit to View' }).click();
  await expect(zoom).toHaveText('100%');
});

test('answering in the Brain is the same answer as Needs You, and fires tuck:sorted once for Yes', async ({ page }) => {
  await open(page);
  const d = demo(page);
  await press(page, 'lb');
  await expect(panel(page)).toContainText('Make a Labs folder in PHYS 1401?');
  await expect(panel(page)).toContainText('Not sure yet');
  await panel(page).getByRole('button', { name: 'No', exact: true }).click();
  expect(await sorted(page)).toBe(0);
  await expect(panel(page)).toContainText('Left as is');
  await expect(d.locator('.tb-un')).toHaveText('5');
  await press(page, 'wp');
  await panel(page).getByRole('button', { name: 'Yes', exact: true }).click();
  expect(await sorted(page)).toBe(1);
  await expect(panel(page)).toContainText('Done: 14 files in Website Proposal');
  await expect(d.locator('.tb-un')).toHaveText('4');
  await expect(d.locator('[data-count]')).toContainText('4');
  await panel(page).getByRole('button', { name: 'See it in Needs You' }).click();
  await expect(d.locator('[data-screen-panel="needs"]')).toBeVisible();
  await expect(d.locator('[data-detail]')).toContainText('Decision 4 of 6');
  await expect(d).toContainText('2 of 6 done');
  await d.locator('[data-screen="brain"]').click();
  await expect(d.locator('[data-screen-panel="brain"]')).toBeVisible();
});

test('an answer in Needs You updates the Brain, and Y answers from the map', async ({ page }) => {
  await open(page);
  const d = demo(page);
  await d.locator('[data-screen="needs"]').click();
  await d.getByRole('button', { name: /Make Labs and move 12 files/ }).click();
  await d.locator('[data-screen="brain"]').click();
  await expect(d.locator('.tb-un')).toHaveText('5');
  await expect(node(page, 'lb')).not.toHaveClass(/unsure/);
  await press(page, 'robo');
  await panel(page).getByRole('button', { name: 'Close details' }).focus();
  await page.keyboard.press('y');
  await expect(d.locator('.tb-un')).toHaveText('4');
  expect(await sorted(page)).toBe(2);
});

for (const width of [360, 600]) {
  test(`fits at ${width}px on both pages, and a node opens`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/work/tuck']) {
      await open(page, path);
      await press(page, 'study');
      await expect(panel(page)).toBeInViewport({ ratio: 0.1 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const spill = await demo(page).evaluate((root) => {
        const edge = root.getBoundingClientRect();
        return [...root.querySelectorAll<HTMLElement>('.tb-bar button,.tb-find,.tb-insp,.tb-crumbs,.tb-note')]
          .filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > edge.right + 1 || r.left < edge.left - 1); }).map((e) => e.className || e.tagName);
      });
      expect(spill).toEqual([]);
    }
  });
}

test('at 360px both screens are reachable and the details sit under the map', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await open(page);
  await press(page, 'photo');
  const map = await demo(page).locator('.tb-svg').boundingBox();
  const details = await panel(page).boundingBox();
  expect(details!.y).toBeGreaterThanOrEqual(map!.y + map!.height - 1);
  await demo(page).locator('[data-screen="needs"]').click();
  await expect(demo(page).getByRole('button', { name: /Make Labs/ })).toBeVisible();
});

test('no long dashes or founder wording on either screen', async ({ page }) => {
  await open(page);
  await press(page, 'grc');
  const text = await demo(page).evaluate((e) => e.textContent);
  expect(text).not.toMatch(/[–—]|founder/i);
});

for (const path of ['/', '/work/tuck']) {
  test(`no serious accessibility issues in the Brain on ${path}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, path);
    const check = async () => {
      const r = await new AxeBuilder({ page }).include('.tuck-demo').analyze();
      expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes[0].target}`)).toEqual([]);
    };
    await check();
    await press(page, 'lb');
    await check();
  });
}
