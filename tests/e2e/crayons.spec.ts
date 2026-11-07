import { test, expect, type Page } from '@playwright/test';

const JUMPS = [['Featured', '#tuck'], ['Projects', '#projects'], ['Experience', '#experience'], ['Hackathons', '#wins'], ['About', '#about']] as const;
const crayon = (page: Page, name: string) => page.locator('#crayon-box .cr', { hasText: name });

async function line(page: Page) {
  await expect(page.locator('#draw-surface')).toBeVisible();
  await page.mouse.move(300, 300);
  await page.mouse.down();
  for (let x = 300; x <= 800; x += 20) await page.mouse.move(x, 300 + Math.sin(x / 60) * 60);
  await page.mouse.up();
}

test.describe('the crayon box', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('holds five crayons, and each jumps to its section', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#crayon-box .cr')).toHaveCount(JUMPS.length);
    for (const [name, hash] of JUMPS) {
      await crayon(page, name).click();
      await expect(page).toHaveURL(new RegExp(`${hash}$`));
      await expect.poll(() => page.evaluate((h) => Math.abs(document.querySelector(h)!.getBoundingClientRect().top), hash)).toBeLessThan(40);
    }
  });

  test('is drawn in wax, with no CSS gradients on the crayons', async ({ page }) => {
    await page.goto('/');
    const bg = await crayon(page, 'Featured').evaluate((e) => getComputedStyle(e).backgroundImage);
    expect(bg).toContain('/wax/crayon-blue.webp');
    expect(bg).not.toContain('gradient');
  });

  test('covers none of the page content at the right edge', async ({ page }) => {
    await page.goto('/');
    const clear = await page.evaluate(() => {
      const box = document.getElementById('crayon-box')!.getBoundingClientRect();
      return [...document.querySelectorAll('.tuck-brand, .bento, .rail, .td-stage')].every((e) => e.getBoundingClientRect().right <= box.left);
    });
    expect(clear).toBe(true);
  });
});

test.describe('draw mode', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('is off by default, so nothing stands between a visitor and the page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#draw-surface')).toBeHidden();
    await page.locator('.hero-nav a[href="#about"]').click();
    await expect(page).toHaveURL(/#about$/);
  });

  test('the lion takes the chosen crayon, walks the line, and a link still works afterwards', async ({ page }) => {
    await page.goto('/');
    await page.locator('#draw-toggle').click();
    await expect(page.locator('#draw-toggle')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('.pick[data-key="crayon-blue"]').click();
    await line(page);
    await expect(page.locator('#doodles canvas')).toHaveCount(1);
    await expect(page.locator('#lion .l-held image').first()).toHaveAttribute('href', '/lion/crayon-blue.webp');
    await expect(page.locator('#lion')).toHaveAttribute('data-mode', 'walk');
    await page.locator('[data-draw="done"]').click();
    await expect(page.locator('#draw-surface')).toBeHidden();
    await expect(page.locator('#doodles canvas')).toHaveCount(1);
    await page.locator('.hero-nav a[href="#about"]').click();
    await expect(page).toHaveURL(/#about$/);
  });

  test('Escape always gets you out, and focus goes back to the button', async ({ page }) => {
    await page.goto('/');
    await page.locator('#draw-toggle').click();
    await expect(page.locator('#draw-surface')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#draw-surface')).toBeHidden();
    await expect(page.locator('#draw-toggle')).toBeFocused();
  });

  test('Clear takes every line away', async ({ page }) => {
    await page.goto('/');
    await page.locator('#draw-toggle').click();
    await line(page);
    await expect(page.locator('#doodles canvas')).toHaveCount(1);
    await page.locator('[data-draw="clear"]').click();
    await expect(page.locator('#doodles canvas')).toHaveCount(0);
  });

  test('with reduced motion the lion simply stands at the end of the line', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.locator('#draw-toggle').click();
    await line(page);
    await expect(page.locator('#lion')).toHaveAttribute('data-mode', 'held');
    const y = (await page.locator('#lion').boundingBox())!.y;
    expect(y).toBeLessThan(500);
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 360, height: 780 }, hasTouch: true });

  test('the box folds to a slim tab inside the page gutter, and opens on a tap', async ({ page }) => {
    await page.goto('/');
    const tab = (await page.locator('.cb-tab').boundingBox())!;
    expect(tab.width).toBeLessThanOrEqual(16);
    await expect(page.locator('#draw-toggle')).toBeHidden();
    await page.locator('.cb-tab').tap();
    await expect(page.locator('#draw-toggle')).toBeVisible();
    await crayon(page, 'Hackathons').tap();
    await expect(page).toHaveURL(/#wins$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  });

  test('after Escape, focus lands on the tab', async ({ page }) => {
    await page.goto('/');
    await page.locator('.cb-tab').tap();
    await page.locator('#draw-toggle').tap();
    await expect(page.locator('#draw-surface')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#draw-surface')).toBeHidden();
    await expect(page.locator('.cb-tab')).toBeFocused();
  });
});
