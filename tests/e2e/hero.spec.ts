import { test, expect } from '@playwright/test';

for (const [hour, state] of [[12, 'day'], [18, 'sunset'], [23, 'night']] as const) {
  test(`hero shows ${state} at ${hour}:00`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 9, 19, hour, 0));
    await page.goto('/');
    await expect(page.locator('#hero')).toHaveAttribute('data-time', state);
    await expect.poll(() => page.locator(`.scene-${state}`).evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  });
}

test('js disabled still shows the day scene', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.locator('#hero[data-time="day"]')).toBeVisible();
  await expect(page.locator('.scene-day')).toBeVisible();
  await ctx.close();
});

test('name fits and clears the koala at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const h1 = (await page.locator('#hero h1').boundingBox())!;
  const koala = (await page.locator('#hero .koala').boundingBox())!;
  const overlap = h1.x < koala.x + koala.width && koala.x < h1.x + h1.width && h1.y < koala.y + koala.height && koala.y < h1.y + h1.height;
  expect(overlap).toBe(false);
});

test('no parallax on touch devices', async ({ browser }) => {
  const ctx = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.locator('#hero').dispatchEvent('mousemove', { clientX: 10, clientY: 10 });
  expect(await page.locator('#hero .px-scene').evaluate((el) => (el as HTMLElement).style.transform)).toBe('');
  await ctx.close();
});

test('parallax moves the scene with a mouse', async ({ page }) => {
  await page.goto('/');
  const box = (await page.locator('#hero').boundingBox())!;
  await page.mouse.move(box.x + 5, box.y + 5);
  await expect.poll(() => page.locator('#hero .px-scene').evaluate((el) => (el as HTMLElement).style.transform)).not.toBe('');
});

test('reduced motion stops animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  expect(await page.locator('.steam path').first().evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
});

test('prompt scrolls to work', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: '▶ VIEW WORK' }).click();
  await expect(page).toHaveURL(/#work$/);
});

for (const width of [320, 375]) {
  test(`hero text stays inside the hero on a ${width}px phone`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width, height: 700 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.fonts.check('10px "Press Start 2P"'))).toBe(true);
    const hero = (await page.locator('#hero').boundingBox())!;
    for (const sel of ['#hero h1', '#hero .sub', '#hero .prompt', '#hero .hero-nav']) {
      const r = await page.locator(sel).evaluate((el) => {
        const range = document.createRange(); range.selectNodeContents(el);
        const b = range.getBoundingClientRect(); return { left: b.left, right: b.right };
      });
      expect(r.right, sel).toBeLessThanOrEqual(hero.x + hero.width - 8);
    }
    await ctx.close();
  });
}
