import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Configuration for FMBY-V2 Host
 * docs/plans/tasks/gemini-frontend-002.md
 *
 * WEB-GOV ③：真实 E2E 依赖 Rust 服务端二进制；无产物时**跳过而非失败**
 * （`skip: !hasBinary`）。二进制解析与 start.mjs 同源口径：
 *   1. 环境变量 `FMBY_E2E_SERVER_BIN`（显式覆盖）；
 *   2. `<repo>/target/<FMBY_E2E_PROFILE|debug>/fmby-v2-server${exeSuffix}`。
 */

const repoRoot = join(import.meta.dirname, '..', '..');
const EXE_SUFFIX = process.platform === 'win32' ? '.exe' : '';
const profile = process.env.FMBY_E2E_PROFILE ?? 'debug';

/** 服务端二进制是否存在（与 e2e/start.mjs 的 resolveBinary 保持一致）。 */
function hasServerBinary() {
  const candidates = [
    process.env.FMBY_E2E_SERVER_BIN,
    join(repoRoot, 'target', profile, `fmby-v2-server${EXE_SUFFIX}`),
    join(repoRoot, 'target', profile, 'fmby-v2-server'),
  ].filter((value) => typeof value === 'string' && value.length > 0);
  return candidates.some((candidate) => existsSync(candidate));
}

const hasBinary = hasServerBinary();

if (!hasBinary) {
  console.warn(
    `[playwright] SKIP e2e: fmby-v2-server binary not found (FMBY_E2E_SERVER_BIN / target/${profile}/fmby-v2-server${EXE_SUFFIX}). ` +
      `Build with 'cargo build -p fmby-v2-server' to enable real E2E.`,
  );
}

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5180',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // 无服务端二进制时不拉起 webServer；各 spec 顶部 `test.skip(!E2E_ENABLED)`
  // 使测试被报告为 skipped（而非失败）。
  webServer: hasBinary
    ? {
        command: 'node e2e/start.mjs',
        url: 'http://127.0.0.1:5180',
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : undefined,
});
