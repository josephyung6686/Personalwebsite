import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const spade = (page: Page) => page.locator('[data-demo="spade"]');
const aik = (page: Page) => page.locator('[data-demo="aikonic"]');
const openSpade = async (page: Page) => {
  await page.goto('/work/nutrigene');
  await spade(page).scrollIntoViewIfNeeded();
  await expect(spade(page)).toHaveAttribute('data-ready', 'true');
};
const openAikonic = async (page: Page) => {
  await page.goto('/work/aikonic');
  await aik(page).scrollIntoViewIfNeeded();
  await expect(aik(page)).toHaveAttribute('data-ready', 'true');
};
const noSidewaysScroll = async (page: Page) => {
  const [scroll, client] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(scroll).toBeLessThanOrEqual(client);
};

test.describe('SPADE demo', () => {
  test('wears the label that says it is not the real product', async ({ page }) => {
    await openSpade(page);
    await expect(spade(page)).toContainText("My reimagining of the idea, with sample data. Not NutriGene's product.");
  });

  test('holds off, then recommends a range as the rounds add data', async ({ page }) => {
    await openSpade(page);
    const d = spade(page);
    const run = d.getByRole('button', { name: 'Run next round' });
    await run.click();
    await expect(d.getByRole('status')).toContainText('Not confident yet: holding off.');
    await expect(d.locator('.spd-count')).toHaveText('Round 1 of 6 · 8 experiments');
    await run.click();
    await run.click();
    await expect(d.getByRole('status')).toContainText(/Recommend: Glucose feed [\d.]+ to [\d.]+ g\/L/);
    await expect(d.getByRole('img')).toHaveAccessibleName(/Round 3 of 6\. 24 experiments so far/);
  });

  test('raising the target past anything reachable sends it back to holding off', async ({ page }) => {
    await openSpade(page);
    const d = spade(page);
    const run = d.getByRole('button', { name: 'Run next round' });
    for (let i = 0; i < 3; i++) await run.click();
    await d.getByLabel('Target yield').fill('95');
    await expect(d.getByRole('status')).toContainText('holding off');
    await expect(d.locator('.spd-tval')).toHaveText('95%');
  });

  test('stops at the budget, and Reset replays from the start', async ({ page }) => {
    await openSpade(page);
    const d = spade(page);
    const run = d.getByRole('button', { name: 'Run next round' });
    for (let i = 0; i < 6; i++) await run.click();
    await expect(d.locator('.spd-count')).toHaveText('Round 6 of 6 · 48 experiments');
    await expect(run).toHaveAttribute('aria-disabled', 'true');
    // Playwright waits forever on an aria-disabled button, so force the press a real visitor can still make.
    await run.click({ force: true });
    await expect(d.locator('.spd-count')).toHaveText('Round 6 of 6 · 48 experiments');
    await d.getByRole('button', { name: 'Reset' }).click();
    await expect(d.locator('.spd-count')).toHaveText('Round 0 of 6 · 0 experiments');
    await expect(run).toHaveAttribute('aria-disabled', 'false');
    await expect(d.getByRole('status')).toContainText('No experiments yet.');
  });

  test('the map is painted once it is near the viewport', async ({ page }) => {
    await openSpade(page);
    await spade(page).getByRole('button', { name: 'Run next round' }).click();
    // The fit eases in over a few frames, so wait for it rather than reading the first one.
    await expect.poll(() => spade(page).locator('canvas').evaluate((c: HTMLCanvasElement) => {
      const px = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      const colors = new Set<number>();
      for (let i = 0; i < px.length; i += 400) colors.add((px[i] << 16) | (px[i + 1] << 8) | px[i + 2]);
      return colors.size;
    })).toBeGreaterThan(10);
  });
});

test.describe('SPADE demo on a touch screen', () => {
  test.use({ hasTouch: true, viewport: { width: 360, height: 800 } });
  test('a tap reads out a cell, and the reading stays after the finger lifts', async ({ page }) => {
    await openSpade(page);
    const d = spade(page);
    await d.getByRole('button', { name: 'Run next round' }).tap();
    const box = (await d.locator('canvas').boundingBox())!;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect(d.locator('.spd-readout')).toContainText(/predicted \d+%/);
  });
});

test.describe('Aikonic demo', () => {
  test('wears the label that says it is not the real product', async ({ page }) => {
    await openAikonic(page);
    await expect(aik(page)).toContainText("My reimagining of the idea, with sample data. Not Aikonic's product.");
  });

  test('starts with a teaching empty state', async ({ page }) => {
    await openAikonic(page);
    await expect(aik(page).locator('.aik-empty')).toContainText('Press a suggestion or type a question.');
    await expect(aik(page).locator('.aik-result')).toHaveCount(0);
  });

  test('a suggestion crosses languages, and the modes show why hybrid wins', async ({ page }) => {
    await openAikonic(page);
    const d = aik(page);
    await d.getByRole('button', { name: /supplier delay/ }).click();
    await expect(d.locator('.aik-result').filter({ hasText: '供應商' })).toBeVisible();
    await expect(d.locator('.aik-result').filter({ hasText: '供應商' })).toContainText('Crossed languages');

    await d.getByRole('button', { name: /^Keyword/ }).click();
    await expect(d.locator('.aik-result')).toHaveCount(1);
    await expect(d.locator('.aik-result').filter({ hasText: '供應商' })).toHaveCount(0);

    await d.getByRole('button', { name: /^Semantic/ }).click();
    await expect(d.locator('.aik-result').filter({ hasText: '供應商' })).toBeVisible();
  });

  test('an exact code is found by keyword and missed by meaning, and the no-results state says so', async ({ page }) => {
    await openAikonic(page);
    const d = aik(page);
    await d.getByRole('button', { name: /PO-8812/ }).click();
    await expect(d.locator('.aik-result')).toHaveCount(1);
    await d.getByRole('button', { name: /^Semantic/ }).click();
    await expect(d.locator('.aik-result')).toHaveCount(0);
    await expect(d.getByRole('status')).toContainText('Semantic found nothing for "PO-8812", but Both found 1.');
  });

  test('a query nothing matches gets a no-results state, and a typed query stays plain text', async ({ page }) => {
    await openAikonic(page);
    const d = aik(page);
    await d.getByLabel(/Search 4 sample meetings/).fill('<img src=x onerror=alert(1)>');
    await expect(d.getByRole('status')).toContainText('Nothing in these meetings matches');
    await expect(d.locator('.aik-summary img')).toHaveCount(0);
  });

  test('pressing a timestamp jumps the transcript to that passage and highlights it', async ({ page }) => {
    await openAikonic(page);
    const d = aik(page);
    await d.getByRole('button', { name: /supplier delay/ }).click();
    const row = d.locator('.aik-result').filter({ hasText: '供應商' });
    await row.getByRole('button', { name: /09:22/ }).click();
    await expect(d.locator('.aik-vtitle')).toContainText('Menu review');
    await expect(d.locator('.aik-vtime')).toContainText('09:22');
    const line = d.locator('.aik-line[aria-current="true"]');
    await expect(line).toContainText('供應商出唔到貨');
    await expect(line).toBeInViewport();
    await expect(line).toBeFocused();
  });
});

test.describe('Both demos', () => {
  for (const width of [360, 768, 1440]) {
    test(`no sideways scroll at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await openSpade(page);
      const run = spade(page).getByRole('button', { name: 'Run next round' });
      for (let i = 0; i < 3; i++) await run.click();
      await noSidewaysScroll(page);
      await openAikonic(page);
      await aik(page).getByRole('button', { name: /supplier delay/ }).click();
      await noSidewaysScroll(page);
    });
  }

  test('have no axe violations while in use', async ({ page }) => {
    await openSpade(page);
    await spade(page).getByRole('button', { name: 'Run next round' }).click();
    const s = await new AxeBuilder({ page }).include('[data-demo="spade"]').analyze();
    expect(s.violations).toEqual([]);
    await openAikonic(page);
    await aik(page).getByRole('button', { name: /supplier delay/ }).click();
    const a = await new AxeBuilder({ page }).include('[data-demo="aikonic"]').analyze();
    expect(a.violations).toEqual([]);
  });

  test('previews on the homepage hold no tab stops', async ({ page }) => {
    await page.goto('/');
    for (const s of ['.v-sp', '.v-ak']) {
      await expect(page.locator(s)).toHaveAttribute('aria-hidden', 'true');
      await expect(page.locator(`${s} :is(a, button, input, [tabindex])`)).toHaveCount(0);
    }
  });
});
