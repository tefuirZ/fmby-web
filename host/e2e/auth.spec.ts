import { test, expect } from '@playwright/test';
import { resetBackend, E2E_ENABLED, E2E_SKIP_REASON } from './fixtures/helpers';

test.skip(!E2E_ENABLED, E2E_SKIP_REASON);

test.describe('Auth Flow E2E', () => {
  test.beforeEach(async () => {
    await resetBackend();
  });

  test('renders login form with accessible fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'FMBY' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '用户名' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '密码' })).toBeVisible();
    await expect(page.getByRole('button', { name: '登录', exact: true })).toBeVisible();
  });

  test('shows both required-field errors on empty submit', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await expect(page.getByText('请输入用户名', { exact: true })).toBeVisible();
    await expect(page.getByText('请输入密码', { exact: true })).toBeVisible();
  });

  test('renders server error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: '用户名' }).fill('wronguser');
    await page.getByRole('textbox', { name: '密码' }).fill('wrongpass');
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await expect(page.getByText('unauthorized', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('logs in, restores session after reload, and logs out', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: '用户名' }).fill('admin');
    await page.getByRole('textbox', { name: '密码' }).fill('admin');
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await page.waitForURL(/\/$/);
    await expect(page.getByRole('heading', { name: '最近入库' })).toBeVisible();

    const meAfterLogin = await page.evaluate(async () => {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      return res.status;
    });
    expect(meAfterLogin).toBe(200);

    await page.reload();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: '最近入库' })).toBeVisible();

    // P0-08④：getSession 不再硬编码“系统管理员”，TopBar 显示登录用户名（本用例为 admin）
    await page.getByRole('button', { name: /admin/ }).click();
    await page.getByRole('menuitem', { name: '退出登录' }).click();
    await page.waitForURL(/\/login/);
    const meAfterLogout = await page.evaluate(async () => {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      return res.status;
    });
    expect(meAfterLogout).toBe(401);
  });
});
