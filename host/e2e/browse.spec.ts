import { test, expect } from '@playwright/test';
import { login, resetBackend, E2E_ENABLED, E2E_SKIP_REASON } from './fixtures/helpers';

test.skip(!E2E_ENABLED, E2E_SKIP_REASON);

test.describe('Browse Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    await resetBackend();
    await login(page);
  });

  test('renders home content from the real bootstrap contract', async ({ page }) => {
    const bootstrap = page.waitForResponse(
      (response) => response.url().includes('/api/browse/home/bootstrap') && response.status() === 200,
    );
    await page.reload();
    await bootstrap;
    await expect(page.getByRole('heading', { name: '最近入库' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '媒体库入口' })).toBeVisible();
  });

  test('filters libraries, opens the seeded library, and opens item 101', async ({ page }) => {
    await page.goto('/libraries');
    await expect(page.getByRole('heading', { name: '媒体库大厅' })).toBeVisible();
    await expect(page.getByRole('link', { name: /电影库/ }).first()).toBeVisible();

    const search = page.getByPlaceholder('搜索媒体库名称、简介，支持拼音首字母');
    await search.fill('剧集');
    await expect(page.getByRole('link', { name: /电影库/ })).toHaveCount(0);

    await search.fill('电影');
    await expect(page.getByRole('link', { name: /电影库/ }).first()).toBeVisible();

    await page.getByRole('link', { name: /电影库/ }).first().click();
    await page.waitForURL(/\/libraries\/1$/);
    await expect(page.getByText('星际穿越', { exact: true }).first()).toBeVisible();

    await page.getByRole('link', { name: /星际穿越/ }).first().click();
    await page.waitForURL(/\/item\/101$/);
    await expect(page.getByRole('heading', { name: '星际穿越' }).first()).toBeVisible();
  });

  test('keeps library detail DOM bounded on the real seeded library', async ({ page }) => {
    await page.goto('/libraries/1');
    await expect(page.getByText('星际穿越', { exact: true }).first()).toBeVisible();
    const rows = await page.evaluate(() =>
      document.querySelectorAll('[data-library-virtualized-row] article').length,
    );
    expect(rows).toBeLessThanOrEqual(60);
  });
});
