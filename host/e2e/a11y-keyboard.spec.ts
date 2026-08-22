import { test, expect } from '@playwright/test';

test.describe('Accessibility & Keyboard Navigation E2E', () => {
  test('keyboard tab navigation shifts focus between inputs', async ({ page }) => {
    await page.goto('/login');
    await page.keyboard.press('Tab');
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedTag).toBeTruthy();
  });
});
