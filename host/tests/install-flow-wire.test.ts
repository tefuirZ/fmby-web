/**
 * fe01（裁决 E）：安装向导 **V2 安装流** wire 对拍。
 *
 * 真源：`crates/fmby-v2-server/src/install_flow.rs`
 *   - `router()` :582-590 —— 注册 status / probe/database / probe/redis / apply / complete
 *   - `apply_install` :472-538 —— 一次收全三组：探测 → 只写非默认项 → bootstrap
 *     → 建首管理员 → 自动登录
 *   - `complete` :546-579 —— confirm_action 精确串校验 → users>0 → 落锁 → restart_required
 *   - `INSTALL_COMPLETE_CONFIRM_ACTION` :36 = `"complete-install"`
 *
 * ★与 V1 的形态差异（本卡刻意不照抄 V1）：
 *   V1 是 4 步（database/initialize → config → setup → complete）；
 *   V2 收敛为 **apply 一次收全** + **complete 落锁**。故前端不得再发
 *   `/api/install/database/initialize`、`/api/install/config`、`/api/install/setup`
 *   —— 那些是 **V1 端点，V2 后端根本没有**（发了必然 404）。用例 ⑤ 钉死这一点。
 *
 * ★路由只挂在安装模式进程形态（main.rs:124-149 install_mode_main）；已安装实例
 *   下除 status 外一律 404 下线。前端必须按 status.state 决定是否展示向导。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  authApi,
  INSTALL_COMPLETE_CONFIRM_ACTION,
} from '@fmby/v2-shared/contracts/auth';

const captured: { method?: string; url?: string; body?: unknown } = {};
let nextResponse = { status: 200, json: {} as unknown };

(globalThis as unknown as { window: unknown }).window = {
  location: { origin: 'http://localhost:5173' },
};
(globalThis as unknown as { fetch: unknown }).fetch = async (
  url: string,
  init?: { method?: string; body?: string },
) => {
  captured.method = init?.method ?? 'GET';
  captured.url = url.replace('http://localhost:5173', '');
  captured.body = init?.body ? JSON.parse(init.body) : undefined;
  const body = nextResponse.status === 204 ? null : JSON.stringify(nextResponse.json);
  return new Response(body, {
    status: nextResponse.status,
    headers: { 'content-type': 'application/json' },
  });
};

function setResponse(json: unknown, status = 200) {
  nextResponse = { status, json };
}

test('① POST /api/install/probe/database —— 路径 + 方法 + body 原样', async () => {
  setResponse({ ok: true });
  await authApi.probeDatabase({ kind: 'sqlite', path: '/tmp/x.db' });
  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, '/api/install/probe/database');
  assert.deepEqual(captured.body, { kind: 'sqlite', path: '/tmp/x.db' });
});

test('② POST /api/install/probe/redis —— 路径 + body（url 必填）', async () => {
  setResponse({ ok: true });
  await authApi.probeRedis({ url: 'redis://127.0.0.1:6379', password: 'p', db: 2 });
  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, '/api/install/probe/redis');
  assert.deepEqual(captured.body, { url: 'redis://127.0.0.1:6379', password: 'p', db: 2 });
});

test('③ POST /api/install/apply —— 一次收全三组（database/cache/admin）', async () => {
  setResponse({ applied: true, auto_login: true, kind: 'sqlite', username: 'root' });
  const res = await authApi.applyInstall({
    database: { kind: 'sqlite' },
    cache: { kind: 'builtin' },
    admin: { username: 'root', password: 'Passw0rd!23' },
  });
  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, '/api/install/apply');
  assert.deepEqual(captured.body, {
    database: { kind: 'sqlite' },
    cache: { kind: 'builtin' },
    admin: { username: 'root', password: 'Passw0rd!23' },
  });
  assert.equal(res.auto_login, true);
  assert.equal(res.username, 'root');
});

test('④ POST /api/install/complete —— confirm_action 必须是精确串', async () => {
  setResponse({ completed: true, restart_required: true });
  const res = await authApi.completeInstall({
    confirm_action: INSTALL_COMPLETE_CONFIRM_ACTION,
  });
  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, '/api/install/complete');
  assert.deepEqual(captured.body, { confirm_action: 'complete-install' });
  assert.equal(res.restart_required, true);
});

test('⑤ 不得再发 V1 的四步端点（V2 后端没有，发必 404）', () => {
  const src = readFileSync(
    new URL('../../shared/src/contracts/auth/api.ts', import.meta.url),
    'utf8',
  );
  for (const legacy of [
    '/api/install/database/initialize',
    '/api/install/config',
    '/api/install/setup',
    '/api/install/site-settings',
    '/api/install/dependencies/install',
  ]) {
    assert.equal(
      src.includes(legacy),
      false,
      `契约层不得再出现 V1 端点 ${legacy}（V2 已收敛为 apply + complete）`,
    );
  }
});

test('⑥ 失败态：后端 4xx/5xx 一律 reject（不吞成成功 / 不静默）', async () => {
  setResponse({ error: 'validation', message: '系统已有用户，初始化通道已关闭' }, 400);
  await assert.rejects(() =>
    authApi.applyInstall({
      database: { kind: 'sqlite' },
      admin: { username: 'root', password: 'x' },
    }),
  );
  setResponse({ error: 'validation', message: '确认动作必须为 `complete-install`' }, 400);
  await assert.rejects(() => authApi.completeInstall({ confirm_action: 'yes' }));
});

test('⑦ status 只发 GET /api/install/status（不缓存污染其它端点）', async () => {
  setResponse({ state: 'needs_database', can_probe: true, database_configured: false });
  const res = await authApi.getInstallStatus();
  assert.equal(captured.method, 'GET');
  assert.equal(captured.url, '/api/install/status');
  assert.equal(res.state, 'needs_database');
});
