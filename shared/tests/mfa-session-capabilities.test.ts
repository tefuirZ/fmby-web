// #289：MFA 登录收口后 capabilities 必须来自后端 /auth/me（不得置空）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 缺陷（基线 6816ecf）：MfaVerifyPanel 在 verify 成功后自行拼 User 且
// `capabilities: []`，且 SessionProvider 只跟 restoreVersion 不会补拉
// ⇒ MFA 后前端权限视图恒空且不自愈（功能误禁；若同时有角色误判则误放）。
//
// 契约（后端 routes/auth.rs::MeResponse）：`{user_id, capabilities}`，
// capability 字面量为 PascalCase（`ManageAccess`，见 bridges/access.rs
// capability_to_str），前端查询面是 colon 风格（`manage:access`）——大小写
// 归一由 api.ts::mapMeResponse/getSession 既有纪律承担，本测试只断言
// 「capabilities 来自后端而非置空/伪造」。

import test from 'node:test';
import assert from 'node:assert/strict';

(globalThis as { window?: unknown }).window = { location: { origin: 'http://localhost:5173' } };

const sessionStorageStore = new Map<string, string>();
(globalThis as { sessionStorage?: unknown }).sessionStorage = {
  getItem: (key: string) => sessionStorageStore.get(key) ?? null,
  setItem: (key: string, value: string) => void sessionStorageStore.set(key, value),
  removeItem: (key: string) => void sessionStorageStore.delete(key),
};

type RouteHandler = (url: string) => Response | undefined;
let routeHandler: RouteHandler = () => undefined;
const calls: string[] = [];

(globalThis as { fetch?: unknown }).fetch = async (input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  calls.push(new URL(url).pathname);
  const response = routeHandler(url);
  if (response) return response;
  return new Response(JSON.stringify({ message: 'no route' }), { status: 404 });
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const { mfaApi } = await import('../src/contracts/auth/mfa.ts');

const PATH_VERIFY = '/api/auth/mfa/totp/verify';
const PATH_ME = '/api/auth/me';

/** verify 成功（建会话）+ /auth/me 返回给定 capabilities。 */
function seedVerifiedSession(meBody: unknown, meStatus = 200) {
  calls.length = 0;
  routeHandler = (url) => {
    if (url.includes(PATH_VERIFY)) {
      return jsonResponse({ user_id: 7, verified: true });
    }
    if (url.includes(PATH_ME)) {
      return jsonResponse(meBody, meStatus);
    }
    return undefined;
  };
}

test('MFA 成功后 capabilities 取自后端 /auth/me（不得置空）', async () => {
  seedVerifiedSession({ user_id: 7, capabilities: ['ManageAccess', 'Browse'] });

  const result = await mfaApi.verifyForSession({ challengeId: 'c-1', code: '123456' });

  assert.equal(result.verified, true);
  assert.ok(result.user, 'verify 成功必须回 User（否则前端无法进入认证态）');
  assert.deepEqual(
    result.user.capabilities,
    ['ManageAccess', 'Browse'],
    'capabilities 必须逐字来自后端 /auth/me（不得置空或从用户名推断）',
  );
  assert.equal(result.user.id, '7');
  assert.deepEqual(result.user.roles, [], '后端契约不返回 roles，恒空 fail-closed');
  assert.ok(calls.includes(PATH_ME), `必须补拉 ${PATH_ME}`);
});

test('MFA 成功后 userId 与 verify 响应的 user_id 一致（防串号）', async () => {
  seedVerifiedSession({ user_id: 7, capabilities: [] });

  const result = await mfaApi.verifyForSession({ challengeId: 'c-1', code: '123456' });

  assert.equal(result.verified, true);
  assert.equal(result.user?.id, '7');
});

test('MFA 码错（verified=false）：不回 User，绝不进入认证态', async () => {
  calls.length = 0;
  routeHandler = (url) =>
    url.includes(PATH_VERIFY) ? jsonResponse({ user_id: 7, verified: false }) : undefined;

  const result = await mfaApi.verifyForSession({ challengeId: 'c-1', code: '000000' });

  assert.equal(result.verified, false);
  assert.equal(result.user, null, '码错不得返回任何 User');
  assert.ok(!calls.includes(PATH_ME), `码错不应补拉 ${PATH_ME}（会话尚未建立）`);
});

test('/auth/me 失败：fail-closed 不返回伪造权限（user=null）', async () => {
  seedVerifiedSession({ message: 'boom' }, 500);

  const result = await mfaApi.verifyForSession({ challengeId: 'c-1', code: '123456' });

  assert.equal(result.verified, true, 'verify 确实成功了');
  assert.equal(result.user, null, '权限面拉不到时不得伪造 User 置登录态');
});

// ── #289 附带发现 ────────────────────────────────────────────────────────────
// `login()` 在 `status="mfa_required"` 分支**提前 return**，而 `persistSessionUsername`
// 在它之后 ⇒ MFA 用户名从未入缓存；而 `/auth/me` 不返回用户名（MeResponse 只有
// user_id + capabilities）⇒ MFA 后的会话用户名恒为空串（顶栏空白）。
// 本用例锁住「MFA 三段流结束后用户名仍在」。
test('MFA 三段流（login→verify→me）结束后用户名仍来自登录阶段缓存', async () => {
  calls.length = 0;
  routeHandler = (url) => {
    if (url.includes('/api/auth/login')) {
      return jsonResponse({ status: 'mfa_required', challenge_id: 'c-1', expires_at: null });
    }
    if (url.includes(PATH_VERIFY)) {
      return jsonResponse({ user_id: 7, verified: true });
    }
    if (url.includes(PATH_ME)) {
      return jsonResponse({ user_id: 7, capabilities: ['ManageAccess'] });
    }
    return undefined;
  };

  const { authApi } = await import('@fmby/v2-shared/contracts/auth/api');

  // ① 密码登录 → 拿到 challenge（未建会话）
  const loginResult = await authApi.login({ username: 'alice', password: 'pw' });
  assert.equal(loginResult.status, 'mfa_required');

  // ② MFA 验证 + 补拉 me
  const result = await mfaApi.verifyForSession({ challengeId: 'c-1', code: '123456' });

  assert.equal(result.verified, true);
  assert.ok(result.user, 'verify 成功必须回 User');
  assert.equal(
    result.user.name,
    'alice',
    'MFA 后用户名必须来自登录阶段缓存（/auth/me 不返回用户名）',
  );
  assert.deepEqual(result.user.capabilities, ['ManageAccess']);
});

test('★刷新后 restore 路径（getSession）capabilities 非空且用户名在 —— 卡面「不自愈」的落点', async () => {
  routeHandler = (url) => {
    if (url.includes('/api/auth/login')) {
      return jsonResponse({ status: 'mfa_required', challenge_id: 'c-1', expires_at: null });
    }
    if (url.includes(PATH_VERIFY)) {
      return jsonResponse({ user_id: 7, verified: true });
    }
    if (url.includes(PATH_ME)) {
      return jsonResponse({ user_id: 7, capabilities: ['ManageAccess', 'Browse'] });
    }
    return undefined;
  };

  const { authApi } = await import('@fmby/v2-shared/contracts/auth/api');

  await authApi.login({ username: 'alice', password: 'pw' });
  await mfaApi.verifyForSession({ challengeId: 'c-1', code: '123456' });

  // 页面刷新后 SessionProvider 的 restore 走的就是 getSession()。
  const restored = await authApi.getSession();

  assert.deepEqual(
    restored.capabilities,
    ['ManageAccess', 'Browse'],
    '刷新后 capabilities 必须非空（缺陷形态：恒空且不自愈）',
  );
  assert.equal(restored.name, 'alice');
});
