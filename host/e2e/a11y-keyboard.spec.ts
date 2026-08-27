import { test, expect } from '@playwright/test';
import { resetBackend } from './fixtures/helpers';

test.describe('Accessibility & Keyboard Navigation E2E', () => {
  test.beforeEach(async () => {
    await resetBackend();
  });

  test('moves focus through the login controls without a trap', async ({ page }) => {
    await page.goto('/login');
    const username = page.getByRole('textbox', { name: '用户名' });
    const password = page.getByRole('textbox', { name: '密码' });
    const toggle = page.getByRole('button', { name: '显示密码' });
    const submit = page.getByRole('button', { name: '登录', exact: true });

    await username.focus();
    await expect(username).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(password).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(toggle).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(submit).toBeFocused();
  });
});
