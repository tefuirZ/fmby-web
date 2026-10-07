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
