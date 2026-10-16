import { test, expect } from '@playwright/test';
import { E2E_ENABLED, E2E_SKIP_REASON } from './fixtures/helpers';

test.skip(!E2E_ENABLED, E2E_SKIP_REASON);

/**
 * FE-ASSET-FALLBACK-TAPTARGETS ②：移动视口点击目标触达区（回归守卫）。
 *
 * 站点 logo（FMBY 链接）原约 64×22（VIS-AUDIT 实测 <44），触屏点击目标不足。
 * 修法：触屏（hover:none + pointer:coarse）下 .brand 撑到 --touch-min（44 高），视觉零变化。
 *
 * ★项目分工（照 playwright.config 纪律）：触屏样式只在 mobile-chrome（pointer:coarse）生效；
 *   chromium（Desktop, pointer:fine）是**桌面零回归对照**（视觉尺寸不变）。故：
 *   - mobile-chrome ⇒ logo 高度 ≥44（触达区已补）；
 *   - chromium ⇒ logo 仍保持原小尺寸（证明桌面视觉零变化）。
 */

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: '用户名' }).fill('admin');
  await page.getByRole('textbox', { name: '密码' }).fill('admin');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.waitForURL(/\/$/);
}

test.describe('移动端点击目标', () => {
  test('站点 logo（FMBY）：触屏项目 ≥44 触达区，桌面项目保持原尺寸（视觉零变化）', async ({
    page,
  }, testInfo) => {
    await login(page);
    const brand = page.locator('a[href="/"]').filter({ hasText: 'FMBY' }).first();
    await brand.waitFor();
    const box = await brand.boundingBox();
    expect(box, 'logo 应可见').not.toBeNull();

    if (testInfo.project.name === 'mobile-chrome') {
      expect(
        box!.height,
        `触屏 logo 高度应 ≥44（--touch-min），实测 ${box!.height}`,
      ).toBeGreaterThanOrEqual(44);
      expect(box!.width, `触屏 logo 宽度应 ≥24，实测 ${box!.width}`).toBeGreaterThanOrEqual(24);
    } else {
      // 桌面零回归对照：视觉尺寸未被触屏规则撑大（pointer:fine 不匹配该媒体查询）。
      expect(
        box!.height,
        `桌面 logo 应保持原尺寸（<44，视觉零变化），实测 ${box!.height}`,
      ).toBeLessThan(44);
    }
  });
});
