import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Configuration for FMBY-V2 Host
 * docs/plans/tasks/gemini-frontend-002.md
 *
 * WEB-GOV ③：真实 E2E 依赖 Rust 服务端二进制；无产物时**跳过而非失败**
 * （`skip: !hasBinary`）。WEB-E2E-FULL：前端仓无 `target/`，二进制解析增加
 * **主仓 FMBY-V2 回退**（`FMBY_E2E_MAIN_REPO` 默认 `/home/tefuir/rustproject/FMBY-V2`），
 * 与 `e2e/start.mjs` 同源口径：
 *   1. 环境变量 `FMBY_E2E_SERVER_BIN`（显式覆盖）；
 *   2. `<前端仓>/target/<profile>/...`；
 *   3. `<主仓>/target/{release,debug}/...`。
 */

// host/ → 前端仓根
const webRepoRoot = join(import.meta.dirname, '..');
const mainRepoRoot = process.env.FMBY_E2E_MAIN_REPO ?? '/home/tefuir/rustproject/FMBY-V2';
const EXE_SUFFIX = process.platform === 'win32' ? '.exe' : '';
// 前端服务端口（默认 5180；多 worktree 并行时用 FMBY_E2E_WEB_PORT 避让，
// 与 e2e/start.mjs 同源口径）。
const webOrigin = `http://127.0.0.1:${Number(process.env.FMBY_E2E_WEB_PORT ?? 5180)}`;

/** 服务端二进制是否存在（与 e2e/start.mjs 的 resolveBinary 保持一致）。 */
function hasServerBinary() {
  const candidates = [process.env.FMBY_E2E_SERVER_BIN].filter(
    (v) => typeof v === 'string' && v.length > 0,
  );
  for (const root of [webRepoRoot, mainRepoRoot]) {
    for (const profile of ['release', 'debug']) {
      candidates.push(join(root, 'target', profile, `fmby-v2-server${EXE_SUFFIX}`));
      candidates.push(join(root, 'target', profile, 'fmby-v2-server'));
    }
  }
  return candidates.some((candidate) => existsSync(candidate));
}

const hasBinary = hasServerBinary();

if (!hasBinary) {
  console.warn(
    `[playwright] SKIP e2e: fmby-v2-server binary not found (FMBY_E2E_SERVER_BIN / ${webRepoRoot}/target/{release,debug} / ${mainRepoRoot}/target/{release,debug}). ` +
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
    baseURL: webOrigin,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // FE-OPT-02（本轮新增）：真移动设备 profile（hasTouch + isMobile）。
    //
    // 背景（关键）：仓内所有触屏样式（--touch-min 44px）都收在
    // `@media (hover: none) and (pointer: coarse)` 内，而 Desktop Chrome 的
    // pointer 是 fine → 该媒体查询**永不匹配**。也就是说，仅跑 desktop project
    // 时触屏 44px 规则根本没生效，却会被记为「0 违规」（视觉盒在触屏样式未
    // 应用下也常达标），结论偏弱。
    //
    // 故新增本 project 让触屏样式真正参与渲染；原 `chromium` project 保持不变
    // （桌面零回归对照）。用法：`npx playwright test --project=mobile-chrome`。
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  // 无服务端二进制时不拉起 webServer；各 spec 顶部 `test.skip(!E2E_ENABLED)`
  // 使测试被报告为 skipped（而非失败）。
  webServer: hasBinary
    ? {
        // FE-OPT-03：**先 build 再 preview**。e2e 默认服务 host/dist 的已构建产物
        // （start.mjs 仅在 dist **缺失**时才 build）→ 源码改动后若不手动 build，
        // 跑的仍是旧产物，会把「改动未生效」误判为「修复无效」（实测踩到两次）。
        // 前置 build 保证被验证的对象恒为当前源码（代价：每次 e2e 多约 7s）。
        command: 'pnpm build && node e2e/start.mjs',
        url: webOrigin,
        reuseExistingServer: false,
        timeout: 180_000,
      }
    : undefined,
});
