import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('404 page offers a way home', async ({ page }) => {
  const res = await page.goto('/does-not-exist');
  expect(res?.status()).toBe(404);
  await expect(page.getByText('Nothing here yet.')).toBeVisible();
  await expect(page.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/');
});

for (const path of ['/', '/work/tuck']) {
  for (const time of [12, 18, 23]) {
    test(`no serious accessibility issues on ${path} at ${time}:00`, async ({ page }) => {
      await page.clock.setFixedTime(new Date(2026, 9, 19, time, 0));
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(900);
      // The Tuck prototype in the frame is its own app, and which view it shows first shouldn't decide this page's result.
      const r = await new AxeBuilder({ page }).exclude('[data-frame]').analyze();
      const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(bad.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    });
  }
}

test('every image has alt text and the site has an icon and share image', async ({ page }) => {
  await page.goto('/');
  expect(await page.locator('img:not([alt])').count()).toBe(0);
  // The koala logo in every size search results, browsers and phones ask for.
  for (const href of ['/favicon.ico', '/favicon-96.png']) await expect(page.locator(`link[rel="icon"][href="${href}"]`)).toHaveCount(1);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/apple-touch-icon.png');
  for (const f of ['/favicon.ico', '/favicon-48.png', '/apple-touch-icon.png', '/icon-512.png', '/site.webmanifest', '/robots.txt', '/sitemap.xml']) {
    expect((await page.request.get(f)).status(), f).toBe(200);
  }
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /og\.png$/);
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', 'Alana Kwan');
  const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? '[]');
  expect(schema.map((x: { '@type': string }) => x['@type'])).toEqual(['WebSite', 'Person']);
});

test('the site describes her as someone who builds products, with no em dashes', async ({ page }) => {
  for (const path of ['/', '/work/tuck', '/work/pet-food']) {
    await page.goto(path);
    const head = [await page.title(), await page.locator('meta[name="description"]').getAttribute('content')].join(' ');
    expect(head).not.toMatch(/design/i);
    expect(await page.locator('body').innerText()).not.toContain('\u2014');
    expect(head).not.toContain('\u2014');
  }
});
