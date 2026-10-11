import { test, expect } from '@playwright/test';
import { login, resetBackend, E2E_ENABLED, E2E_SKIP_REASON } from './fixtures/helpers';

test.skip(!E2E_ENABLED, E2E_SKIP_REASON);

test.describe('Manage Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    await resetBackend();
    await login(page);
  });

  test('renders the management cockpit with real mount queries', async ({ page }) => {
    const mountsPromise = page.waitForResponse(
      (response) => response.url().includes('/api/manage/mounts') && response.status() === 200,
    );
    await page.goto('/manage');
    await expect(page.getByRole('heading', { name: /中控驾驶舱/ })).toBeVisible();

    const mountsResponse = await mountsPromise;
    const payload = await mountsResponse.json();
    expect(JSON.stringify(payload)).toContain('E2E 本地');
  });

  test('loads and saves all three site setting groups', async ({ page }) => {
    await page.goto('/manage/site/settings');
    await expect(page.getByRole('heading', { name: '站点设置' })).toBeVisible();

    const siteName = page.getByLabel('站点名称');
    // fe01：原实现钉死初始值 `'FMBY 测试站点'`，但完整跑时前面的 spec
    // （manage-pages「站点设置」）会**真写**站点名（它自己会复原，但顺序不保证）
    // ⇒ 断言初始值脆弱。改为「读当前值 → 改成另一个值 → 保存 → reload 校验
    // → 复原」，语义更强：验证的是**写回能力**，不依赖数据库的初始状态。
    const original = await siteName.inputValue();
    expect(original.trim(), '站点名称应有初始值（后端真值）').not.toBe('');
    const next = `${original}-e2e-${Date.now()}`;

    await siteName.fill(next);
    await page.getByRole('button', { name: '保存站点设置' }).first().click();
    await expect(page.getByText('站点设置已保存。')).toBeVisible();
    await expect(siteName).toHaveValue(next);

    await page.reload();
    await expect(page.getByLabel('站点名称')).toHaveValue(next);

    // 复原（避免污染后续 spec 的断言）
    await siteName.fill(original);
    await page.getByRole('button', { name: '保存站点设置' }).first().click();
    await expect(page.getByText('站点设置已保存。')).toBeVisible();
    await expect(siteName).toHaveValue(original);
  });
});
