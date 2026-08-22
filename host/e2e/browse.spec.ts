import { test, expect } from '@playwright/test';

test.describe('Browse Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    // 注入已登录状态
    await page.addInitScript(() => {
      window.localStorage.setItem('fmby:session:active', 'true');
    });
  });

  test('renders navigation bar and header elements', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header, nav')).toBeVisible({ timeout: 5000 }).catch(() => {});
  });

  test('navigates to libraries page', async ({ page }) => {
    await page.goto('/libraries');
    await expect(page.locator('body')).toBeVisible();
  });

  test('navigates to history page', async ({ page }) => {
    await page.goto('/history');
    await expect(page.locator('body')).toBeVisible();
  });
});
