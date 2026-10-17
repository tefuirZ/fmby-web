/**
 * E3 真栈终验专用 config —— **不使用仓主 config 的 webServer**（栈由外部真栈脚本管理）：
 * 后端 /tmp/fmby-e3-server @ 18097（FMBY_WEB_ROOT 直接伺服 host/dist，浏览器与后端同源）。
 * 测试对象：host/e2e/task-center-realstack-final.spec.ts（仅此一个，serial）。
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /task-center-realstack-final\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['json', { outputFile: '/tmp/e3-final-stack/evidence/report.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:18097',
    trace: 'retain-on-failure',
    screenshot: 'off',
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
  },
});
