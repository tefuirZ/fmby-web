import { test, expect } from '@playwright/test';
import { login, resetBackend } from './fixtures/helpers';

test.describe('Theme Hot-Switching E2E', () => {
  test.beforeEach(async ({ page }) => {
    await resetBackend();
    await login(page);
  });

  test('activates the registered darkroom theme and its tokens', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'darkroom');
    await expect.poll(() => page.locator('link[data-theme-style="darkroom"]').count()).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg-base').trim())).toBe('#000000');
  });

  test('hot-switches to template without reload', async ({ page }) => {
    await page.goto('/settings/appearance');
    await expect(page.getByRole('heading', { name: '外观' })).toBeVisible();
    await page.evaluate(() => {
      (window as Window & { __themeMarker?: string }).__themeMarker = 'alive';
    });

    await page.getByRole('combobox', { name: '界面皮肤' }).click();
    await page.getByRole('option', { name: '模板主题' }).click();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'template');
    await expect.poll(() => page.locator('link[data-theme-style="template"]').count()).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg-base').trim())).toBe('#14161c');
    await expect.poll(() => page.evaluate(() => (window as Window & { __themeMarker?: string }).__themeMarker)).toBe('alive');
    await expect(page).toHaveURL(/\/settings\/appearance$/);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('fmby:theme'))).toBe('template');
  });
});
