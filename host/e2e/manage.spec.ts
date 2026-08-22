import { test, expect } from '@playwright/test';

test.describe('Manage Flow E2E', () => {
  test('navigates to manage overview page', async ({ page }) => {
    await page.goto('/manage/overview');
    await expect(page.locator('body')).toBeVisible();
  });

  test('navigates to site settings page', async ({ page }) => {
    await page.goto('/manage/site-settings');
    await expect(page.locator('body')).toBeVisible();
  });
});
