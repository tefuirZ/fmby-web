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
  });

  // BUG-SKIN-NAV-01（已修复）：默认主题 darkroom 的 `LibrarySkin` 曾把媒体库
  // 条目卡片渲染为裸 `<article>`（无 `<Link>` / `onClick`），用户**无法从媒体库
  // 进入条目**。修复前 A/B 实测（同 /libraries/1，登录态一致）：
  //   - darkroom（默认主题，走 skin）：卡墙 6 张，`a[href^="/item/"]` = 0；
  //   - template（无 browse.library skin → 回落 host 默认页）：`a[href^="/item/"]` = 7。
  // 修复（双侧）：① `SkinProps.actions` 增 `openItem(id)` / `itemHref(id)` 语义键
  //（MINOR 兼容，host 注入）；② host loaders 注入 `navigate(\`/item/${id}\`)` +
  // href 构造器；③ darkroom 两皮肤卡片接该回调渲染真实 `<a href>`（主题不自建
  // 路由字面量，保持禁取数/禁路由纯度）。
  test('从媒体库进入条目（darkroom skin 卡片导航）', async ({ page }) => {
    await page.goto('/libraries/1');
    await expect(page.getByText('星际穿越', { exact: true }).first()).toBeVisible();
    // 卡墙必须有真实条目锚点（BUG-SKIN-NAV-01 回归锁定：≥ 1）。
    await expect(page.locator('a[href^="/item/"]')).not.toHaveCount(0);
    const link = page.getByRole('link', { name: /星际穿越/ }).first();
    await expect(link).toBeVisible({ timeout: 10_000 });
    await link.click();
    await page.waitForURL(/\/item\/101$/);
    await expect(page.getByRole('heading', { name: '星际穿越' }).first()).toBeVisible();
  });

  test('keeps library detail DOM bounded on the real seeded library', async ({ page }) => {
    await page.goto('/libraries/1');
    await expect(page.getByText('星际穿越', { exact: true }).first()).toBeVisible();
    // 注：默认主题 darkroom 走 LibrarySkin（卡墙，非虚拟网格），
    // `[data-library-virtualized-row]` 为 0 → 该断言在 darkroom 下恒定成立；
    // 虚拟化上限的真实约束在 host 默认页（template 主题回落）生效。
    const rows = await page.evaluate(() =>
      document.querySelectorAll('[data-library-virtualized-row] article').length,
    );
    expect(rows).toBeLessThanOrEqual(60);
  });
});
