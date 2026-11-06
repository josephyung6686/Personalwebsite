import { test, expect } from '@playwright/test';

test('home renders name and title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Alana Kwan · Builds products, end to end');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('ALANA');
});
