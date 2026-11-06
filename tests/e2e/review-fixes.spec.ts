import { test, expect } from '@playwright/test';

test('night sky sits behind the clouds and buildings', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 19, 23, 0));
  await page.goto('/');
  const z = (sel: string) => page.locator(sel).evaluate((el) => Number(getComputedStyle(el).zIndex));
  expect(await z('.night-layer')).toBeLessThan(await z('.clouds-layer'));
  expect(await z('.night-layer')).toBeLessThan(await z('.px-scene'));
  expect(await z('.night-layer')).toBeGreaterThan(await z('.sky-layer'));
});

test('demo sidebar is reachable with arrow keys', async ({ page }) => {
  await page.goto('/');
  const demo = page.locator('.tuck-demo').first();
  await demo.getByRole('tab', { name: 'All Folders' }).focus();
  await page.keyboard.press('ArrowUp');
  await expect(demo.getByRole('tab', { name: 'New' })).toBeFocused();
  await expect(demo.getByRole('tab', { name: 'New' })).toHaveAttribute('aria-selected', 'true');
  await expect(demo.getByRole('tabpanel', { name: 'New' })).toBeVisible();
  await page.keyboard.press('End');
  await expect(demo.getByRole('tab', { name: 'All Folders' })).toBeFocused();
});

test('homepage copy credits the cofounder and Plasmole', async ({ page }) => {
  await page.goto('/');
  const featured = page.locator('section[aria-labelledby="featured-h"]');
  await expect(featured).toContainText('with my cofounder');
  await expect(featured).toContainText('Five rounds of redesign');
  await expect(featured).not.toContainText('without moving anything on your Mac');
  await expect(page.locator('#more-h')).toHaveText('More work');
  await expect(page.locator('#work .card2 .card-title').first()).toHaveText("Plasmole's MCP");
});

test('tuck case study gives the measured result and what is next', async ({ page }) => {
  await page.goto('/work/tuck');
  await expect(page.locator('main')).toContainText('15.7% to 10.2%');
  await expect(page.locator('main')).toContainText('formal usability testing with real users', { ignoreCase: true });
});

test('plasmole page shows the MCP page she designed', async ({ page }) => {
  await page.goto('/work/plasmole');
  await expect(page.locator('img[src="/work/plasmole/mcp-page.webp"]')).toHaveCount(1);
});

test('projects with a design of their own wear it, including Compass in NIC\'s look', async ({ page }) => {
  await page.goto('/work/compass');
  expect(await page.locator('h1').evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Playfair Display');
  await expect(page.locator('a.cs-btn', { hasText: 'Visit the platform' })).toHaveAttribute('href', 'https://ai.compassprobono.org/NIC');
  await expect(page.locator('img[src="/work/compass/nic-home.webp"]')).toHaveCount(1);
  for (const slug of ['tuck', 'pet-food', 'kwungfund', 'plasmole', 'compass']) {
    await page.goto(`/work/${slug}`);
    await expect(page.locator('.cs')).toHaveAttribute('data-look', slug);
  }
});

test('case study pages wear their own product\'s look', async ({ page }) => {
  const look = async (slug: string) => {
    await page.goto(`/work/${slug}`);
    return page.locator('h1').evaluate((el) => getComputedStyle(el).fontFamily);
  };
  expect(await look('tuck')).toContain('Bricolage Grotesque');
  expect(await look('pet-food')).toContain('Manrope');
  expect(await look('kwungfund')).toContain('Poppins');
  expect(await look('plasmole')).toContain('IBM Plex Sans');
  // The site's own nav stays the same on every case study.
  await expect(page.locator('.site-bar .back')).toHaveAttribute('href', '/#work');
});

test('phone nav links are big enough to tap', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  for (const a of await page.locator('.hero-nav a').all()) expect((await a.boundingBox())!.height).toBeGreaterThanOrEqual(24);
});

test('view work prompt stops blinking and is solid on focus', async ({ page }) => {
  await page.goto('/');
  const prompt = page.locator('.prompt');
  expect(await prompt.evaluate((el) => getComputedStyle(el).animationIterationCount)).toBe('5');
  await prompt.focus();
  await expect.poll(() => prompt.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
});

test('unfinished Devpost links are never linked', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#wins a[href*="TODO"]')).toHaveCount(0);
});
