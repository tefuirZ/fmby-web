import type { Page } from '@playwright/test';

// 真实 E2E：无 mock reset/state——server 每次用全新临时 DB，天然隔离。
// 真实种子由 fmby-v2-server FMBY_E2E_SEED=1 提供（admin/admin + 电影库 + 星际穿越）。

export async function resetBackend(): Promise<void> {
  // 真实后端：无需 reset（全新临时库）；保留空实现供测试夹具 API 兼容。
}

export async function readBackendState(): Promise<{
  session_active: boolean;
  requests: Array<{ method: string; path: string; body: Record<string, unknown> }>;
  settings: Record<string, unknown>;
}> {
  // 真实后端：不提供 mock state；返回空（断言方不应依赖 mock 内部状态）。
  return { session_active: false, requests: [], settings: {} };
}

export async function login(page: Page) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: '用户名' }).fill('admin');
  await page.getByRole('textbox', { name: '密码' }).fill('admin');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.waitForURL(/\/$/);
  await page.getByRole('heading', { name: /星际穿越|继续观看|最近入库/ }).first().waitFor();
}
