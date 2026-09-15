import { test, expect } from '@playwright/test';
import { login, resetBackend, E2E_ENABLED, E2E_SKIP_REASON } from './fixtures/helpers';

// WEB-E2E-FULL 阶段 1：用户面 7 页真实遍历（每页 ≥1 真交互：进入 → 关键操作 → 断言）。
// 真实栈：真实 server + 真实 SQLite（seed：电影库 / 星际穿越 101 / 剧集 201）。
test.skip(!E2E_ENABLED, E2E_SKIP_REASON);

test.describe('User Pages Coverage', () => {
  test.beforeEach(async ({ page }) => {
    await resetBackend();
    await login(page);
  });

  test('首页（放映厅）真数据渲染 + 视口滚动', async ({ page }) => {
    const bootstrap = page.waitForResponse(
      (r) => r.url().includes('/api/browse/home/bootstrap') && r.status() === 200,
    );
    await page.goto('/');
    await bootstrap;
    await expect(page.getByRole('heading', { name: '最近入库' })).toBeVisible({ timeout: 15_000 });
    // 真交互：滚到媒体库入口（视口触发门控查询）
    await page.getByRole('heading', { name: '媒体库入口' }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('link', { name: /电影库/ }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('观看历史页', async ({ page }) => {
    const history = page.waitForResponse(
      (r) => r.url().includes('/api/browse/history') && r.status() === 200,
    );
    await page.goto('/history');
    await expect(page.getByRole('heading', { name: '历史' }).first()).toBeVisible({ timeout: 15_000 });
    await history;
  });

  test('媒体库列表页（含搜索真交互）', async ({ page }) => {
    const libs = page.waitForResponse(
      (r) => r.url().includes('/api/browse/libraries') && r.status() === 200,
    );
    await page.goto('/libraries');
    await expect(page.getByRole('heading', { name: '媒体库大厅' })).toBeVisible({ timeout: 15_000 });
    await libs;
    // 真交互：关键词过滤
    const search = page.getByPlaceholder('搜索媒体库名称、简介，支持拼音首字母');
    await search.fill('电影');
    await expect(page.getByRole('link', { name: /电影库/ }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('媒体库详情页（L3 皮肤真数据渲染）', async ({ page }) => {
    await page.goto('/libraries/1');
    // 投影修复后：库详情真实渲染 星际穿越
    await expect(page.getByText('星际穿越', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('条目详情页', async ({ page }) => {
    const detail = page.waitForResponse(
      (r) => r.url().includes('/api/items/101') && r.status() === 200,
    );
    await page.goto('/item/101');
    await detail;
    await expect(page.getByRole('heading', { name: '星际穿越' }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('播放页（真实会话 + 取流）', async ({ page }) => {
    const session = page.waitForResponse(
      (r) => r.url().includes('/api/playback/sessions') && r.status() === 200,
    );
    await page.goto('/play/101');
    const resp = await session;
    const body = await resp.json();
    expect(body.session_id).toBeTruthy();
    // 真交互：请求真实取流 URL（路径票据形态），断言 200
    const stream = await page.evaluate(async (url) => {
      const res = await fetch(url, { credentials: 'include' });
      return { status: res.status, bytes: (await res.arrayBuffer()).byteLength };
    }, body.stream_url);
    expect(stream.status).toBe(200);
    expect(stream.bytes).toBeGreaterThan(0);
  });

  test('个人设置三页（资料 / 播放偏好 / 外观）', async ({ page }) => {
    // 资料
    await page.goto('/settings/profile');
    await expect(page.getByRole('heading', { name: '个人资料' }).first()).toBeVisible({ timeout: 15_000 });
    // 播放偏好
    await page.goto('/settings/playback');
    await expect(page.getByRole('heading', { name: '播放偏好' }).first()).toBeVisible({ timeout: 15_000 });
    // 外观
    await page.goto('/settings/appearance');
    await expect(page.getByRole('heading', { name: '外观' }).first()).toBeVisible({ timeout: 15_000 });
  });
});
