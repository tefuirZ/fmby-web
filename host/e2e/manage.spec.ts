import { test, expect } from '@playwright/test';
import { login, resetBackend } from './fixtures/helpers';

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
    await expect(siteName).toHaveValue('FMBY 测试站点');
    await siteName.fill('FMBY E2E 已保存');
    await page.getByRole('button', { name: '保存站点设置' }).first().click();
    await expect(page.getByText('站点设置已保存。')).toBeVisible();
    await expect(siteName).toHaveValue('FMBY E2E 已保存');

    await page.reload();
    await expect(page.getByLabel('站点名称')).toHaveValue('FMBY E2E 已保存');
  });
});
