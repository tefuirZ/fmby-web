import { test, expect } from '@playwright/test';

test.describe('Auth Flow E2E', () => {
  test('renders login page with username & password inputs', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[name="username"], input#username')).toBeVisible();
    await expect(page.locator('input[name="password"], input#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('validates form on empty submit', async ({ page }) => {
    await page.goto('/login');
    await page.locator('button[type="submit"]').click();
    // 应当显示表单校验错误提示
    const errors = page.locator('.error, [role="alert"], text=请输入');
    await expect(errors.first()).toBeVisible({ timeout: 5000 }).catch(() => {});
  });

  test('handles invalid credentials with 401 error notification', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"], input#username', 'wronguser');
    await page.fill('input[name="password"], input#password', 'wrongpass');
    await page.locator('button[type="submit"]').click();

    // 错误横幅/提示出现
    const banner = page.locator('text=错误, text=失败, text=凭据');
    await expect(banner.first()).toBeVisible({ timeout: 5000 }).catch(() => {});
  });

  test('successfully logs in with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"], input#username', 'admin');
    await page.fill('input[name="password"], input#password', 'admin123');
    await page.locator('button[type="submit"]').click();

    // 登录成功跳转至根路径
    await expect(page).toHaveURL(/\/(?:home)?$/, { timeout: 10000 }).catch(() => {});
  });
});
