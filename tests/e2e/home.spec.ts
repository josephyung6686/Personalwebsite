import { test, expect } from '@playwright/test';

test('work grid lists the four other projects', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#work')).toBeVisible();
  const titles = page.locator('#work .card2 .card-title');
  await expect(titles).toHaveText(["Plasmole's MCP", 'Pet food recalls', 'KwungFund', 'Compass Pro Bono']);
});

test('wins show placements and her role, with no broken links', async ({ page }) => {
  await page.goto('/');
  const rows = page.locator('#wins .win-row');
  await expect(rows).toHaveCount(4);
  await expect(rows.first()).toContainText('1st / 240');
  await expect(rows.first()).toContainText('FingerGuns');
  for (const row of await rows.all()) await expect(row).toContainText('Frontend and computer vision');
  await expect(page.locator('#wins a[href=""], #wins a[href="#"]')).toHaveCount(0);
});

test('compass card links to its case study', async ({ page }) => {
  await page.goto('/');
  const compass = page.locator('#work .card2', { hasText: 'Compass Pro Bono' });
  await expect(compass.locator('a')).toHaveAttribute('href', '/work/compass');
  await expect(compass).not.toContainText('Coming soon');
});

test('wins link to their Devpost pages', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#wins a[href^="https://devpost.com/software/"]')).toHaveCount(3);
  await expect(page.locator('#wins')).toContainText('Columbia DevFest 2026');
});

test('about links go to real places', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#about a', { hasText: 'Email me' })).toHaveAttribute('href', 'mailto:ak5333@columbia.edu');
  await expect(page.locator('#about a', { hasText: 'LinkedIn' })).toHaveAttribute('href', 'https://linkedin.com/in/alanakwan128');
});

test('no résumé anywhere on the site', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /résumé/i })).toHaveCount(0);
  await expect(page.locator('a[href$=".pdf"]')).toHaveCount(0);
  const res = await page.request.get('/Alana-Kwan-Resume.pdf');
  expect(res.status()).toBe(404);
});

test('featured Tuck section and about section render', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tuck: the agentic AI brain that sorts your files' })).toBeVisible();
  await expect(page.locator('#about')).toContainText("Hi, I'm Alana.");
  await expect(page.locator('footer')).toContainText('Thanks for stopping by.');
});

test('one column and no sideways scroll at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  const xs = await page.locator('#work .card2').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().x)));
  expect(new Set(xs).size).toBe(1);
});

test('no placeholders left at release', async ({ page }) => {
  test.skip(process.env.RELEASE !== '1', 'release gate only');
  await page.goto('/');
  expect(await page.locator('body').innerText()).not.toContain('[TODO');
  expect(await page.locator('a[href*="[TODO"]').count()).toBe(0);
});

test('section koalas stay small', async ({ page }) => {
  await page.goto('/');
  for (const sel of ['.wins-koala', '.about-koala', '.foot-koala']) {
    const box = (await page.locator(sel).boundingBox())!;
    expect(box.width, sel).toBeLessThanOrEqual(170);
  }
});

test('about shows Alana\'s own bio, as an intro and a short list', async ({ page }) => {
  await page.goto('/');
  const about = page.locator('#about');
  await expect(about).toContainText('Data & Computational Science');
  await expect(about).toContainText('My Chemical Engineering background may be unconventional');
  await expect(about.locator('.bio li')).toHaveCount(4);
  await expect(about).toContainText('feel free to reach out!');
  expect(await about.locator('.bio p').count()).toBeGreaterThanOrEqual(4);
});

test('each project card shows a product vignette and its results', async ({ page }) => {
  await page.goto('/');
  const cards = page.locator('#work .card2');
  await expect(cards).toHaveCount(4);
  for (const card of await cards.all()) {
    await expect(card.locator('.vig')).toBeVisible();
    expect(await card.locator('.metric').count()).toBeGreaterThanOrEqual(1);
  }
  await expect(page.locator('#work .glass')).toHaveCount(0);
});

test('pet food card shows the live dashboard', async ({ page }) => {
  await page.goto('/');
  const pf = page.locator('#work .card2', { hasText: 'Pet food recalls' });
  await expect(pf.locator('.vig img[src="/work/pet-food/card.webp"]')).toBeVisible();
  await expect(pf.locator('.vig')).toContainText('akwnn.github.io/pet-food-safety');
});

test('whole card is one link to the case study', async ({ page }) => {
  await page.goto('/');
  await page.locator('#work .card2', { hasText: 'KwungFund' }).click();
  await expect(page).toHaveURL(/\/work\/kwungfund$/);
});

test('site buttons keep their own style (demo styles do not leak)', async ({ page }) => {
  await page.goto('/');
  const email = page.locator('#about a', { hasText: 'Email me' });
  const s = await email.evaluate((el) => { const c = getComputedStyle(el); return [c.backgroundColor, c.color]; });
  expect(s).toEqual(['rgb(35, 100, 240)', 'rgb(255, 255, 255)']);
  // The featured Tuck card wears Tuck's own brand blue, not the site's.
  const cta = page.locator('a', { hasText: 'Read the case study' });
  expect(await cta.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(10, 75, 255)');
});
