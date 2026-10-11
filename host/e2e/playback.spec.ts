import { test, expect } from '@playwright/test';
import { login, resetBackend, E2E_ENABLED, E2E_SKIP_REASON } from './fixtures/helpers';

test.skip(!E2E_ENABLED, E2E_SKIP_REASON);

test.describe('Playback Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    await resetBackend();
    await login(page);
  });

  test('creates a real playback session and serves the stream', async ({ page }) => {
    const sessionResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/playback/sessions') && response.status() === 200,
    );
    await page.goto('/play/101');

    const sessionResponse = await sessionResponsePromise;
    const session = await sessionResponse.json();
    expect(session.session_id).toBeTruthy();
    expect(session.item_id).toBe('101');
    expect(session.stream_url).toContain('/api/playback/stream/');

    const stream = await page.evaluate(async (url) => {
      const res = await fetch(url, { credentials: 'include' });
      const bytes = await res.arrayBuffer();
      return { status: res.status, bytes: bytes.byteLength };
    }, session.stream_url);
    expect(stream.status).toBe(200);
    expect(stream.bytes).toBeGreaterThan(0);
  });

  test('reports progress on pause and stops the session on navigation', async ({ page }) => {
    const sessionResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/playback/sessions') && response.status() === 200,
    );
    await page.goto('/play/101');
    await sessionResponsePromise;
    await expect(page.locator('video')).toBeAttached();

    const progressPromise = page.waitForResponse(
      (response) => response.url().includes('/progress') && response.status() === 204,
      { timeout: 10_000 },
    );
    await page.locator('video').evaluate((element) => {
      const media = element as HTMLMediaElement;
      Object.defineProperty(media, 'currentTime', { configurable: true, value: 12 });
      Object.defineProperty(media, 'duration', { configurable: true, value: 100 });
      media.dispatchEvent(new Event('pause'));
    });
    await progressPromise;

    const stopPromise = page.waitForResponse(
      (response) => response.url().includes('/stop') && response.status() === 204,
      { timeout: 10_000 },
    );
    // fe01：播放页在窄屏（≤767px）下顶部「详情」链接 `display:none`，
    // 移动端入口是「查看完整详情」（实测 375 视口：前者 0×0，后者 80×35）。
    // 这是响应式设计而非缺陷；原 spec 在 mobile-chrome 下恒超时。
    // 按 profile 选真实可见的导航入口（不放宽断言：仍要求真的导航到 /item/101）。
    const isNarrow = (page.viewportSize()?.width ?? 1280) < 768;
    const detailLink = isNarrow
      ? page.getByRole('link', { name: '查看完整详情' })
      : page.getByRole('link', { name: '详情', exact: true });
    await expect(detailLink).toBeVisible({ timeout: 10_000 });
    await detailLink.click();
    await page.waitForURL(/\/item\/101$/);
    await stopPromise;
  });
});
