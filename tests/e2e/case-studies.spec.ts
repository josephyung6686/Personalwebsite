import { test, expect } from '@playwright/test';
import stats from '../../src/data/petfood-stats.json' with { type: 'json' };

for (const slug of ['tuck', 'plasmole', 'pet-food', 'kwungfund', 'compass']) {
  test(`/work/${slug} renders with a role line`, async ({ page }) => {
    const res = await page.goto(`/work/${slug}`);
    expect(res?.status()).toBe(200);
    await expect(page.locator('.role')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
}

test('tuck case study credits the cofounder and has the demo', async ({ page }) => {
  await page.goto('/work/tuck');
  await expect(page.locator('main')).toContainText('with my cofounder');
  await expect(page.locator('#demo .tuck-demo')).toBeVisible();
});

test('tuck case study answers the portfolio questions and links the prototype', async ({ page }) => {
  await page.goto('/work/tuck');
  for (const h of ['Links', 'What Tuck is', 'Why we built it', 'Onboarding: what someone needs to know first',
    'How Tuck gets to know you: onboarding, profile and memory',
    'A mascot that lives on your desktop', 'Visual identity', 'Typography', 'Color', 'Layout', 'Accessibility',
    'Process: five rounds, built in code', 'How we checked it', 'What I learned']) {
    await expect(page.getByRole('heading', { name: h, exact: true })).toBeVisible();
  }
  await page.getByRole('link', { name: 'Try the onboarding prototype' }).click();
  await expect(page).toHaveURL(/\/work\/tuck\/onboarding\/$/);
  await expect(page.getByRole('link', { name: '← Tuck case study' })).toBeVisible();
});

test('tuck case study shows the onboarding redesign', async ({ page }) => {
  await page.goto('/work/tuck');
  await expect(page.getByRole('heading', { name: 'Onboarding: what someone needs to know first' })).toBeVisible();
  for (const img of ['onboarding-welcome', 'onboarding-roles', 'onboarding-folders']) {
    await expect(page.locator(`img[src="/work/tuck/${img}.webp"]`)).toHaveCount(1);
  }
});

test('plasmole page only claims her MCP work', async ({ page }) => {
  await page.goto('/work/plasmole');
  await expect(page.locator('.role')).toContainText('MCP');
  await expect(page.locator('main')).toContainText('15 to 23 tools');
  await expect(page.locator('main')).not.toContainText('I built Plasmole');
});

test('compass page states her role', async ({ page }) => {
  await page.goto('/work/compass');
  await expect(page.locator('.role')).toContainText('AI & Automation Intern');
});

test('pet food numbers come from the stats file', async ({ page }) => {
  await page.goto('/work/pet-food');
  await expect(page.locator('main')).toContainText((stats as Record<string, string>)['Salmonella share of events']);
});
