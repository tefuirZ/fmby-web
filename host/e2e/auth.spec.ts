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
    // fe01：后端早已把错误码换成中文文案（实测 401
    // `{"error_code":"AUTH_INVALID_CREDENTIALS","message":"用户名或密码错误，请重新输入。"}`），
    // 前端经 getErrorMessage 原样渲染 message。原断言钉的是**旧英文字面量**
    // `unauthorized`，与现状不符 ⇒ 恒红。改为断言真契约：
    //   ① 服务端错误经 role=alert 可见（不吞错）；② 未置登录态（仍停在 /login）。
    const loginResponse = page.waitForResponse(
      (r) => r.url().includes('/api/auth/login') && r.status() === 401,
    );
    await page.goto('/login');
    await page.getByRole('textbox', { name: '用户名' }).fill('wronguser');
    await page.getByRole('textbox', { name: '密码' }).fill('wrongpass');
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await loginResponse;
    // ① 错误横幅可见且非空（文案由后端给，不本地钉死字面量）
    const banner = page.getByRole('alert').first();
    await expect(banner).toBeVisible();
    await expect(banner).not.toHaveText('');
    // ② 未置登录态：仍在登录页，且 /auth/me 仍是 401
    await expect(page).toHaveURL(/\/login/);
    const meStatus = await page.evaluate(async () => {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      return res.status;
    });
    expect(meStatus, '错误凭据后不得建立会话').toBe(401);
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
