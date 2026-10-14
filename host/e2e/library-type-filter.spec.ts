import { test, expect } from '@playwright/test';
import { login, resetBackend, E2E_ENABLED, E2E_SKIP_REASON } from './fixtures/helpers';

test.skip(!E2E_ENABLED, E2E_SKIP_REASON);

/**
 * LIBRARY-FILTER-E2E：库详情「类型筛选」E2E（配对 w01 后端 mediaType 被端口
 * 静默丢弃的修复）。考古源 V1 `library-detail-filters.smoke.spec.ts`（web-gallery）
 * 只断言「请求 query 含 mediaType」；本 spec 多一条**结果真的变化**断言 ——
 * 直接断言后端响应的 items 只含所选类型（防「前端空壳」：前端把 mediaType 塞进
 * query，但结果变化是本地 filter 补的，或后端丢弃 mediaType 不过滤）。
 *
 * 时序（与 w01 后端卡对齐）：
 *   · 后端未修（mediaType 被端口丢弃）⇒ 断言③ 红（响应仍含全部 kind）；
 *   · 后端修后 ⇒ 断言③ 绿（响应只含 movie）。
 */
test.describe('Library detail type filter E2E (LIBRARY-FILTER-E2E)', () => {
  test.beforeEach(async ({ page }) => {
    await resetBackend();
    await login(page);
  });

  test('切换媒体类型 ⇒ 请求 query 含 mediaType 且后端响应真的只返回该类型（防前端空壳）', async ({ page }) => {
    // 库详情筛选 select 在 host 默认页（LibraryDetailPage）；darkroom 主题走
    // LibrarySkin（卡墙，不渲染筛选 toolbar）⇒ 切 template 主题（无 browse.library
    // skin）回落 host 默认页，才有「媒体类型筛选」select。
    await page.addInitScript(() => {
      window.localStorage.setItem('fmby:theme', 'template');
    });

    // 收集 GET /api/browse/libraries/1 请求 URL（读 query）+ 响应 items kind。
    const requests: string[] = [];
    const respKinds: string[][] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (req.method() === 'GET' && /\/api\/browse\/libraries\/1(\?|$)/.test(url)) {
        requests.push(url);
      }
    });
    page.on('response', async (resp) => {
      if (resp.url().includes('/api/browse/libraries/1') && resp.request().method() === 'GET') {
        try {
          const body = await resp.json();
          respKinds.push((body.items || []).map((i: { kind?: string }) => i.kind));
        } catch {
          /* 非 JSON 响应忽略 */
        }
      }
    });

    await page.goto('/libraries/1', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('星际穿越', { exact: true }).first()).toBeVisible();
    await expect.poll(() => requests.length).toBeGreaterThanOrEqual(1);

    // ① baseline：默认（mediaType=all ⇒ undefined）请求 query 不含 mediaType
    expect(new URL(requests[0]).searchParams.get('mediaType')).toBeNull();
    // baseline 响应含混合 kind（库 1：movie + series + season + episode）
    expect(respKinds[0]).toContain('series');

    // 切换媒体类型 = movie
    const before = requests.length;
    await page.getByLabel('媒体类型筛选').selectOption('movie');
    await expect.poll(() => requests.length).toBeGreaterThan(before);

    // ② 请求 query 含 mediaType=movie（前端真发，非空壳）
    expect(new URL(requests[requests.length - 1]).searchParams.get('mediaType')).toBe('movie');

    // ③ 结果真的变化：后端响应只返回 movie（不含 series/season/episode）。
    // 后端未修（mediaType 被端口丢弃）⇒ 响应仍含全部 kind ⇒ 红。
    await expect
      .poll(() => {
        const latest = respKinds[respKinds.length - 1];
        return latest.length > 0 && latest.every((k) => k === 'movie');
      })
      .toBe(true);
  });
});
