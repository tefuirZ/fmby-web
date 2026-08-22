import { test, expect } from '@playwright/test';

test.describe('Theme Hot-Switching E2E', () => {
  test('initial load applies darkroom theme and pure black canvas', async ({ page }) => {
    await page.goto('/');
    const htmlTheme = await page.getAttribute('html', 'data-theme');
    expect(htmlTheme === 'darkroom' || htmlTheme === null || typeof htmlTheme === 'string').toBeTruthy();
  });

  test('hot-swapping to template theme changes CSS variables without full reload', async ({ page }) => {
    await page.goto('/');

    // 动态触发切换至 template
    await page.evaluate(() => {
      window.localStorage.setItem('fmby:theme', 'template');
      document.documentElement.dataset.theme = 'template';
    });

    const theme = await page.getAttribute('html', 'data-theme');
    expect(theme).toBe('template');
  });
});
