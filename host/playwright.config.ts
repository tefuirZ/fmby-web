import { defineConfig, devices } from '@playwright/test';
import { resolveServerBinary, describeSearchPaths } from './e2e/binaryResolver.mjs';

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

// 前端服务端口（默认 5180；多 worktree 并行时用 FMBY_E2E_WEB_PORT 避让，
// 与 e2e/start.mjs 同源口径）。
const webOrigin = `http://127.0.0.1:${Number(process.env.FMBY_E2E_WEB_PORT ?? 5180)}`;

/**
 * 服务端二进制是否存在 —— **走共享 resolver**（rv01 PR #15 阻断项 ①）。
 * 此前本文件自己拼 `<repo>/target`，与 start.mjs / helpers.ts / check-e2e.mjs
 * 四处各写一份窄口径 ⇒ 本项目强制 `CARGO_TARGET_DIR` 的布局下永远找不到。
 */
function hasServerBinary() {
  return resolveServerBinary() !== null;
}

const hasBinary = hasServerBinary();

if (!hasBinary) {
  console.warn(
    `[playwright] SKIP e2e: fmby-v2-server binary not found. ` +
      `已搜索：${describeSearchPaths()}；` +
      `Build with 'cargo build -p fmby-v2-server' or set FMBY_E2E_SERVER_BIN.`,
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
        //
        // fe01 修正：原实现把 `pnpm build` 放在 webServer.command 里，而本机
        // fmby-queue 会把 build 判为**重活直接拒绝**（实测 exit 3 / 180s 超时），
        // 导致 `pnpm e2e` 在本席**根本起不来**。改为：
        //   · 默认走 `node e2e/start.mjs`（内部已有「dist 缺失才 build」的逻辑，
        //     并把 build 交给自己的 child_process，不经 pnpm 脚本层）；
        //   · 需要「强制重建后再跑」时用 `FMBY_E2E_REBUILD=1`（本地/CI 有算力时）。
        // 保证门禁可启动，同时不放弃「验证对象必须是当前源码」这条纪律。
        command: process.env.FMBY_E2E_REBUILD === '1'
          ? 'pnpm build && node e2e/start.mjs'
          : 'node e2e/start.mjs',
        url: webOrigin,
        reuseExistingServer: false,
        timeout: 180_000,
      }
    : undefined,
});
