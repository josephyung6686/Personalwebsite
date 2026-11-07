import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const demo = (page: Page) => page.getByRole('region', { name: 'Interactive demo of Tuck' });
const frameEl = (page: Page) => demo(page).locator('[data-frame]');
const inner = (page: Page) => page.frameLocator('.tuck-demo [data-frame]');
const nearDemo = (page: Page) => demo(page).evaluate((e) => e.scrollIntoView({ block: 'start', behavior: 'instant' }));

test('the homepage holds nothing of the prototype until the demo is near', async ({ page }) => {
  const asked: string[] = [];
  page.on('request', (r) => { if (/\/work\/tuck\/(app|onboarding)\//.test(r.url())) asked.push(r.url()); });
  await page.setViewportSize({ width: 1440, height: 500 });
  await page.goto('/');
  await page.waitForTimeout(700);
  expect(asked).toEqual([]);
  await expect(frameEl(page)).not.toHaveAttribute('src');
  await nearDemo(page);
  await expect(frameEl(page)).toHaveAttribute('src', '/work/tuck/app/brain.html');
  expect(asked.length).toBeGreaterThan(0);
});

test('The app opens on the Brain map, with no review controls and no loading state', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await nearDemo(page);
  const app = inner(page);
  await expect(app.locator('#cv')).toBeVisible();
  await expect(app.locator('#loading')).toBeHidden();
  for (const q of ['#theme', '#resetdemo', '#pstate', '#plook']) await expect(app.locator(q)).toBeHidden();
  await expect(demo(page)).toContainText('Prototype with sample files');
  await app.getByRole('link', { name: /Needs You/ }).first().click();
  await expect(app.getByRole('heading', { name: 'Needs You' })).toBeVisible();
});

test('Onboarding switches the stage and walks the steps; full screen follows', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await nearDemo(page);
  const full = demo(page).getByRole('link', { name: 'Open full screen' });
  await expect(full).toHaveAttribute('href', '/work/tuck/app/brain.html');
  await expect(full).toHaveAttribute('target', '_blank');
  await demo(page).getByRole('button', { name: 'Onboarding' }).click();
  await expect(demo(page).getByRole('button', { name: 'Onboarding' })).toHaveAttribute('aria-pressed', 'true');
  await expect(demo(page).getByRole('button', { name: 'The app' })).toHaveAttribute('aria-pressed', 'false');
  await expect(frameEl(page)).toHaveAttribute('src', '/work/tuck/onboarding/index.html');
  await expect(full).toHaveAttribute('href', '/work/tuck/onboarding/index.html');
  const ob = inner(page);
  await expect(ob.getByText("Hi, I'm Tuck.")).toBeVisible();
  await expect(ob.getByRole('link', { name: /Tuck case study/ })).toHaveCount(0);
});

test('the first press inside the frame fires tuck:sorted once and completes the quest', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    (window as unknown as { sorted: number }).sorted = 0;
    document.addEventListener('tuck:sorted', () => { (window as unknown as { sorted: number }).sorted++; });
  });
  await page.goto('/');
  await nearDemo(page);
  const count = () => page.evaluate(() => (window as unknown as { sorted: number }).sorted);
  await expect(inner(page).locator('#cv')).toBeVisible();
  expect(await count()).toBe(0);
  await inner(page).locator('#cv').click({ position: { x: 40, y: 40 } });
  await expect.poll(count).toBe(1);
  await inner(page).locator('#cv').click({ position: { x: 60, y: 60 } });
  expect(await count()).toBe(1);
});

for (const path of ['/', '/work/tuck']) {
  test(`the stage is big on ${path}: full width and about 80vh`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(path);
    const box = await demo(page).locator('[data-stage]').boundingBox();
    expect(box!.width).toBeGreaterThan(1200);
    expect(box!.height).toBeGreaterThanOrEqual(718);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
  });
}

test('at 1100px the prototype is scaled to fit, not clipped', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto('/');
  await nearDemo(page);
  await expect(inner(page).locator('#cv')).toBeVisible();
  const r = await demo(page).evaluate((root) => {
    const stage = root.querySelector('[data-stage]')!.getBoundingClientRect(), f = root.querySelector('[data-frame]')!.getBoundingClientRect();
    return [Math.round(stage.width - f.width), Math.round(stage.height - f.height)];
  });
  expect(Math.abs(r[0])).toBeLessThanOrEqual(1);
  expect(Math.abs(r[1])).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1100);
});

test('desktop never downloads the phone version', async ({ page }) => {
  const asked: string[] = [];
  page.on('request', (r) => { if (/tuck\/phone|tuckPhone|tuckBrain/.test(r.url())) asked.push(r.url()); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await nearDemo(page);
  await expect(inner(page).locator('#cv')).toBeVisible();
  expect(asked).toEqual([]);
  await expect(demo(page).locator('[data-phone]')).toBeHidden();
});

for (const width of [360, 600]) {
  test(`at ${width}px the phone version shows, and nothing of the prototype downloads`, async ({ page }) => {
    const asked: string[] = [];
    page.on('request', (r) => { if (/\/work\/tuck\/(app|onboarding)\/|poster-/.test(r.url())) asked.push(r.url()); });
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    await page.waitForTimeout(500);
    await nearDemo(page);
    await expect(demo(page).locator('[data-phone] .tb-n[data-id="you"]')).toHaveCount(1);
    await expect(demo(page)).toContainText('The full app and onboarding are best on a bigger screen');
    await expect(demo(page).locator('[data-phone]')).toContainText('Prototype with sample files');
    await expect(demo(page).locator('[data-stage]')).toBeHidden();
    await expect(frameEl(page)).not.toHaveAttribute('src');
    await page.waitForTimeout(400);
    expect(asked).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

test('crossing 700px swaps versions without reloading', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('/');
  await nearDemo(page);
  await expect(inner(page).locator('#cv')).toBeVisible();
  await page.setViewportSize({ width: 500, height: 800 });
  await nearDemo(page);
  await expect(demo(page).locator('[data-phone] .tb-n[data-id="you"]')).toHaveCount(1);
  await expect(demo(page).locator('[data-stage]')).toBeHidden();
  await page.setViewportSize({ width: 1200, height: 800 });
  await expect(demo(page).locator('[data-stage]')).toBeVisible();
  await expect(demo(page).locator('[data-phone]')).toBeHidden();
});

test('using the app talks to nothing but this site and its fonts', async ({ page }) => {
  const hosts = new Set<string>();
  page.on('request', (r) => { hosts.add(new URL(r.url()).hostname); });
  for (const path of ['/work/tuck/app/brain.html', '/work/tuck/app/tuck.html#chats', '/work/tuck/app/finder.html', '/work/tuck/onboarding/index.html']) {
    await page.goto(path);
    await page.waitForTimeout(600);
  }
  for (const h of hosts) expect(['127.0.0.1', 'localhost', 'fonts.googleapis.com', 'fonts.gstatic.com']).toContain(h);
});

for (const path of ['/', '/work/tuck']) {
  test(`no serious accessibility issues around the stage on ${path}`, async ({ page }) => {
    await page.goto(path);
    const r = await new AxeBuilder({ page }).include('.tuck-demo').exclude('[data-frame]').analyze();
    expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
  });
}
