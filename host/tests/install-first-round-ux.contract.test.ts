/**
 * INSTALL-FIRST-ROUND-UX（P0）：安装模式首次打开的 3 个逻辑 bug —— 契约测试。
 *
 * 证据（playwright 真浏览器）：安装模式开 / ⇒ 「网络波动，正在重试恢复会话」+「Not Found」
 * +「立即重试」+ console 3x404（/api/auth/me ×N + /themes/darkroom/theme.manifest.json）。
 *
 * 三修：
 *  A 路由：安装模式（state=needs_database 等）开 / ⇒ 重定向 /install（InstallModeGuard）。
 *  B 会话：SessionProvider 把 install 模式 /auth/me 404 误报成网络波动 + 自动重试风暴
 *    ⇒ 404 且 install/status=needs_database ⇒ clearSession + 静默停（不设 restoreError、不排重试）。
 *  C 主题：/themes/darkroom/theme.manifest.json 404 ⇒ 静默回落默认形象，不 console.error。
 *
 * 本仓无 jsdom ⇒ 用纯函数 + 源码级契约检查（照 installStatus.ts / secrets-metadata 范式）。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNotFound } from '@fmby/v2-shared/errors';
import { isInstallModeInProgress } from '@/pages/install/installStatus';

// ───────────────────────────────────────────────────────────────────────────
// 纯函数：isNotFound（B 的 404 判定）
// ───────────────────────────────────────────────────────────────────────────

test('① isNotFound — 按 code（not_found/NOT_FOUND/HTTP_404）或 status===404 判定', () => {
  assert.equal(isNotFound({ code: 'not_found', message: 'x', retryable: false }), true);
  assert.equal(isNotFound({ code: 'NOT_FOUND', message: 'x', retryable: false }), true);
  assert.equal(isNotFound({ code: 'HTTP_404', message: 'x', retryable: false }), true);
  assert.equal(
    isNotFound({ code: 'whatever', message: 'x', retryable: false, status: 404 }),
    true,
  );
});

test('①b isNotFound — 非 404（401/403/500/网络错/非 ApiError）一律 false', () => {
  assert.equal(isNotFound({ code: 'HTTP_401', message: 'x', retryable: false, status: 401 }), false);
  assert.equal(isNotFound({ code: 'HTTP_500', message: 'x', retryable: true, status: 500 }), false);
  assert.equal(isNotFound({ code: 'forbidden', message: 'x', retryable: false, status: 403 }), false);
  assert.equal(isNotFound(new Error('fetch failed')), false); // 网络错非 ApiError
  assert.equal(isNotFound(null), false);
});

// ───────────────────────────────────────────────────────────────────────────
// 纯函数：isInstallModeInProgress（A/B 的安装模式判定）
// ───────────────────────────────────────────────────────────────────────────

test('② isInstallModeInProgress — 安装中状态（needs_database/needs_admin）⇒ true', () => {
  assert.equal(isInstallModeInProgress({ state: 'needs_database' }), true);
  assert.equal(isInstallModeInProgress({ state: 'needs_admin' }), true);
});

test('②b isInstallModeInProgress — completed / 无 state / 未知态 ⇒ false（已安装⇒进主应用）', () => {
  assert.equal(isInstallModeInProgress({ state: 'completed' }), false);
  assert.equal(isInstallModeInProgress({ state: 'configured' }), false);
  assert.equal(isInstallModeInProgress({}), false);
  assert.equal(isInstallModeInProgress(undefined), false);
  assert.equal(isInstallModeInProgress({ state: 'some_future_state' }), false);
});

// ───────────────────────────────────────────────────────────────────────────
// 源码级契约（照 secrets-metadata / yun139-transfer 范式）
// ───────────────────────────────────────────────────────────────────────────

async function readSrc(rel: string): Promise<string> {
  const { readFile } = await import('node:fs/promises');
  return readFile(new URL(`../src/${rel}`, import.meta.url), 'utf8');
}

test('③ Bug A：InstallModeGuard 存在，安装中 ⇒ Navigate /install，已安装 ⇒ 放行主应用', async () => {
  const src = await readSrc('app/guards/InstallModeGuard.tsx');
  assert.match(src, /isInstallModeInProgress/, '守卫必须用 isInstallModeInProgress 判定');
  assert.match(src, /Navigate[\s\S]{0,40}\/install|to=\{?['"]\/install/, '安装中必须 <Navigate to="/install">');
  assert.match(src, /getInstallStatus/, '守卫必须拉 /api/install/status');
});

test('③b Bug A：router 用 InstallModeGuard 包裹主应用（AuthGuard）路由', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../src/app/router/index.tsx', import.meta.url), 'utf8');
  assert.match(src, /InstallModeGuard/, 'router 必须引入 InstallModeGuard');
  // InstallModeGuard 包在 AuthGuard 外层（安装模式先于鉴权拦截）
  assert.match(src, /InstallModeGuard[\s\S]{0,120}AuthGuard/, 'InstallModeGuard 应包裹 AuthGuard');
});

test('④ Bug B：SessionProvider 遇 404 且安装模式 ⇒ 静默 clearSession（不设 restoreError、不排重试）', async () => {
  const src = await readSrc('session/SessionProvider.tsx');
  assert.match(src, /isNotFound/, '必须用 isNotFound 判定 /auth/me 404');
  assert.match(src, /isInstallModeInProgress/, '必须拉 install/status 判定安装模式');
  // 静默路径：命中安装模式 404 ⇒ clearSession 后 return（不进 recovering/retry 分支）
  assert.match(
    src,
    /clearSession\(\)[\s\S]{0,40}return/,
    '安装模式 404 必须 clearSession 后静默 return（不 setRestoreError/不 scheduleRestoreRetry）',
  );
  // recovering 横幅只由非安装-404 的路径触达
  assert.match(src, /scheduleRestoreRetry/, '重试逻辑仍在（仅非安装-404 的真网络错才走）');
});

test('⑤ Bug C：ThemeProvider 初始主题激活失败不 console.error（静默回落默认形象）', async () => {
  const src = await readSrc('theme/ThemeProvider.tsx');
  // 初始激活 catch 不得 logger.error（manifest 404 在安装模式是预期降级，行为已默认）
  assert.equal(
    /\.catch\([\s\S]{0,200}logger\.error/.test(src),
    false,
    '初始主题激活失败不得 logger.error（改为去噪，行为已回落默认形象）',
  );
  // 仍保持默认形象（status error 路径在，不崩）
  assert.match(src, /setStatus\('error'\)/, '激活失败仍落到 error 态（保持 host 默认形象）');
});
