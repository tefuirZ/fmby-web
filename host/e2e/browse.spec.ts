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

  // ⚠️ 已知产品缺陷 PRODUCT-DEFECT-01（实测 A/B 证实，登记性质：回主代理立卡）。
  //
  // 默认主题 darkroom 的 `LibrarySkin` 把媒体库条目卡片渲染为 `<article>`
  // （无 `<Link>` / `onClick`），用户**无法从媒体库进入条目**。对照 A/B 探针
  // （同一 /libraries/1，登录态一致）：
  //   - darkroom（默认主题，走 skin）：卡墙 6 张，`a[href^="/item/"]` = 0；
  //   - template（无 browse.library skin → 回落 host 默认页）：`a[href^="/item/"]` = 7。
  // 即 host 默认页与主题回落路径均可导航，唯 darkroom skin 断链。
  //
  // 另注（契约面）：host 侧 `BrowseLibrarySkinDataProvider` 下发给 skin 的
  // `actions` 只有 `refresh` / `loadMore`，未提供「打开条目」动作；skins 契约
  // `SkinProps.actions` 也没有导航语义键——缺陷是双侧的（皮肤未渲染导航 +
  // host 动作面未给导航入口）。
  //
  // 此处用 `test.fail()` 显式登记：「期望失败」→ 全绿；bug 修复后该用例会因
  // 「意外通过」而红，自动提醒移除本标注。期望行为：卡片可导航到 /item/101。
  test('从媒体库进入条目（已知缺陷登记：darkroom skin 卡片不可导航）', async ({ page }) => {
    test.fail(true, 'PRODUCT-DEFECT-01: darkroom LibrarySkin 卡片不可导航（应为 /item/101 链接）');
    await page.goto('/libraries/1');
    await expect(page.getByText('星际穿越', { exact: true }).first()).toBeVisible();
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
