import { test, expect } from '@playwright/test';
import { E2E_ENABLED, E2E_SKIP_REASON } from './fixtures/helpers';

test.skip(!E2E_ENABLED, E2E_SKIP_REASON);

/**
 * FE-ASSET-FALLBACK-TAPTARGETS ①：资产 404 优雅降级（回归守卫）。
 *
 * e2e seed 不种 artwork ⇒ 所有 `/api/assets/items/{id}/images/*` 404。
 * 前端须经 usePosterUrl/useBackdropUrl 降级链把破图换成明确占位，
 * **不出现 naturalWidth===0 的破图 img**。本 spec 用可编程判据锁住该行为
 * （本席模型看图受限 ⇒ 用 DOM/网络级断言代替肉眼）。
 */

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: '用户名' }).fill('admin');
  await page.getByRole('textbox', { name: '密码' }).fill('admin');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.waitForURL(/\/$/);
}

/** 页面中**可见且破图**（naturalWidth===0）的 img 集合。 */
async function brokenVisibleImgs(page: import('@playwright/test').Page) {
  return page.$$eval('img', (imgs) =>
    imgs
      .filter((i) => {
        const r = i.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })
      .filter((i) => i.complete && i.naturalWidth === 0)
      .map((i) => (i as HTMLImageElement).currentSrc || (i as HTMLImageElement).src),
  );
}

test.describe('资产 404 优雅降级', () => {
  test('海报墙：资产全 404 时无破图 img，且有占位元素', async ({ page }) => {
    await login(page);
    await page.goto('/');
    // 等降级链（usePosterUrl onError → 占位）稳定
    await page.waitForTimeout(3500);
    const broken = await brokenVisibleImgs(page);
    expect(broken, `不得有可见破图 img（naturalWidth===0）：${JSON.stringify(broken)}`).toEqual([]);
    // 占位元素存在（PosterMediaCard 的 posterArtworkFallback）
    const placeholders = await page.locator('[class*="Fallback"],[class*="fallback"],[class*="placeholder"]').count();
    expect(placeholders, 'asset 全 404 时应渲染占位元素，不留空白').toBeGreaterThan(0);
  });

  test('红侧自检：注入了未接降级的裸 <img src=404> ⇒ 探测器能抓到 naturalWidth===0（证明断言非vacuous）', async ({
    page,
  }) => {
    await login(page);
    await page.goto('/');
    await page.waitForTimeout(500);
    // 人为注入一个不走降级链的破图 img（模拟“退化缺失”）
    await page.evaluate(() => {
      const img = document.createElement('img');
      img.src = '/api/assets/items/999999/images/poster';
      img.alt = 'red-side-probe';
      img.style.width = '200px';
      img.style.height = '300px';
      document.body.appendChild(img);
    });
    await page.waitForTimeout(1500);
    const broken = await brokenVisibleImgs(page);
    expect(broken.length, '裸 404 img 应被探测器判为破图（naturalWidth===0）——否则上一条断言是vacuous').toBeGreaterThan(0);
  });
});
