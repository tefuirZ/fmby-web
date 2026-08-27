import { test, expect } from '@playwright/test';
import { login, resetBackend } from './fixtures/helpers';

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
    await page.getByRole('link', { name: '详情', exact: true }).click();
    await page.waitForURL(/\/item\/101$/);
    await stopPromise;
  });
});
