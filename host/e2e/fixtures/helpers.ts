import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';

/**
 * 真实 E2E 是否启用（WEB-GOV ③）：依赖 Rust 服务端二进制；无产物时整组测试
 * **跳过而非失败**。解析口径与 `playwright.config.ts` / `e2e/start.mjs` 同源：
 *   1. 环境变量 `FMBY_E2E_SERVER_BIN`；
 *   2. `<repoRoot>/target/<FMBY_E2E_PROFILE|debug>/fmby-v2-server${exeSuffix}`。
 */
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');
const EXE_SUFFIX = process.platform === 'win32' ? '.exe' : '';
const PROFILE = process.env.FMBY_E2E_PROFILE ?? 'debug';

export const E2E_ENABLED: boolean = [
  process.env.FMBY_E2E_SERVER_BIN,
  join(REPO_ROOT, 'target', PROFILE, `fmby-v2-server${EXE_SUFFIX}`),
  join(REPO_ROOT, 'target', PROFILE, 'fmby-v2-server'),
].some((candidate) => typeof candidate === 'string' && candidate.length > 0 && existsSync(candidate));

/** 跳过原因（供 test.skip 文案）。 */
export const E2E_SKIP_REASON =
  '真实 E2E 需要 fmby-v2-server 二进制（cargo build -p fmby-v2-server 或设置 FMBY_E2E_SERVER_BIN）';

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
