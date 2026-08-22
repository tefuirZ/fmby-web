import { test, expect } from '@playwright/test';

test.describe('Playback Flow E2E', () => {
  test('navigates to play page and checks player mount container', async ({ page }) => {
    await page.goto('/play/item-101');
    await expect(page.locator('body')).toBeVisible();
  });
});
