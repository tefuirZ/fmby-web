// WEB-IDENTITY-LOGIN-UI：三方登录契约 mapper / API 层对拍。
//
// 覆盖：provider 列表映射与登录就绪过滤、start/complete/status/callback 映射、
// ★`mfa_required` **不得**被当成登录成功（本卡核心诚实纪律）、后端 503 失败
// 原样上抛（不假成功）。经真实 httpClient 链路（stub 全局 fetch）验证。
import test from 'node:test';
import assert from 'node:assert/strict';

// node 环境无 window/sessionStorage：client.ts 与 contracts/auth/api.ts 依赖它们。
const sessionStorageStore = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  location: { origin: 'http://test.local' },
};
(globalThis as unknown as { sessionStorage: unknown }).sessionStorage = {
  getItem: (key: string) => sessionStorageStore.get(key) ?? null,
  setItem: (key: string, value: string) => void sessionStorageStore.set(key, value),
  removeItem: (key: string) => void sessionStorageStore.delete(key),
};

type RouteHandler = (url: string, init?: RequestInit) => Response | undefined;
let routeHandler: RouteHandler = () => undefined;
let lastBody: unknown = undefined;

const originalFetch = globalThis.fetch;
(globalThis as unknown as { fetch: unknown }).fetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (typeof init?.body === 'string') {
    try {
      lastBody = JSON.parse(init.body);
    } catch {
      lastBody = init.body;
    }
  }
  const response = routeHandler(url, init);
  if (response) return response;
  return new Response(JSON.stringify({ message: 'no route' }), { status: 404 });
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const { identityLoginApi } = await import('../src/contracts/auth/identity/api.ts');
const {
  loginReadyProviders,
  mapIdentityComplete,
  mapProviderAvailability,
  mapProviderList,
} = await import('../src/contracts/auth/identity/mappers.ts');

test.after(() => {
  (globalThis as unknown as { fetch: unknown }).fetch = originalFetch;
});

test('mapProviderAvailability：snake_case wire → camelCase domain（含 login_enabled 缺省兜底 enabled）', () => {
  const item = mapProviderAvailability({
    provider: 'google',
    display_name: 'Google',
    enabled: true,
    login_enabled: true,
    binding_enabled: false,
    password_reset_enabled: false,
    configured: true,
  });
  assert.deepEqual(item, {
    provider: 'google',
    displayName: 'Google',
    enabled: true,
    loginEnabled: true,
    bindingEnabled: false,
    passwordResetEnabled: false,
    configured: true,
  });
});

test('mapProviderAvailability：未知 provider 值 → null（绝不猜测为有效 provider）', () => {
  assert.equal(mapProviderAvailability({ provider: 'wechat', enabled: true }), null);
  assert.equal(mapProviderAvailability({ enabled: true }), null);
});

test('mapProviderList：缺失段宽容 → 空数组，不崩溃', () => {
  assert.deepEqual(mapProviderList({}), []);
  assert.deepEqual(mapProviderList({ items: 'not-an-array' }), []);
  assert.equal(mapProviderList({ items: [{ provider: 'telegram', enabled: true }] }).length, 1);
});

test('loginReadyProviders：仅 enabled && configured && loginEnabled（V1 过滤语义）', () => {
  const ready = loginReadyProviders([
    { provider: 'google', displayName: 'Google', enabled: true, loginEnabled: true, bindingEnabled: true, passwordResetEnabled: false, configured: true },
    { provider: 'telegram', displayName: 'Telegram', enabled: true, loginEnabled: true, bindingEnabled: true, passwordResetEnabled: false, configured: false },
    { provider: 'email', displayName: '邮箱', enabled: true, loginEnabled: false, bindingEnabled: true, passwordResetEnabled: true, configured: true },
  ]);
  assert.deepEqual(ready.map((p) => p.provider), ['google']);
});

test('★mapIdentityComplete：mfa_required 归入 MFA 分支（绝不当作登录成功）', () => {
  const outcome = mapIdentityComplete({
    status: 'mfa_required',
    challenge_id: 'chl-1',
    expires_at: 1_700_000_000_000,
  });
  assert.deepEqual(outcome, {
    status: 'mfa_required',
    challengeId: 'chl-1',
    expiresAtMs: 1_700_000_000_000,
  });
});

test('mapIdentityComplete：成功分支带 user_id；缺 status 亦按成功（后端成功态才有 cookie）', () => {
  assert.deepEqual(mapIdentityComplete({ user_id: 7, status: 'ok' }), {
    status: 'authenticated',
    userId: 7,
  });
  assert.deepEqual(mapIdentityComplete({ user_id: 9 }), { status: 'authenticated', userId: 9 });
});

test('★completeIdentityLogin：后端 mfa_required → 返回 MFA 分支，不组装 User（不假成功）', async () => {
  routeHandler = (url) => {
    if (url.includes('/login/complete')) {
      return jsonResponse(
        { status: 'mfa_required', challenge_id: 'chl-mfa', expires_at: 123456 },
        200,
      );
    }
    return undefined;
  };
  const result = await identityLoginApi.complete('google', { challengeId: 'chl-mfa', code: 'x' });
  assert.equal(result.status, 'mfa_required');
  if (result.status === 'mfa_required') {
    assert.equal(result.challengeId, 'chl-mfa');
    assert.equal(result.expiresAtMs, 123456);
  }
});

test('completeIdentityLogin：成功 → 经 /auth/me 组装用户（用户名不可得不伪造）', async () => {
  routeHandler = (url) => {
    if (url.includes('/login/complete')) {
      return jsonResponse({ status: 'ok', user_id: 42, expires_in_secs: 3600 }, 200);
    }
    if (url.includes('/api/auth/me')) {
      return jsonResponse({ user_id: 42, capabilities: ['ViewCatalog'] }, 200);
    }
    return undefined;
  };
  const result = await identityLoginApi.complete('google', { challengeId: 'c1', code: 'ok' });
  assert.equal(result.status, 'authenticated');
  if (result.status === 'authenticated') {
    assert.equal(result.user.id, '42');
    assert.deepEqual(result.user.capabilities, ['ViewCatalog']);
    // 后端不提供用户名 → 留空（绝不回退 'admin' 之类默认身份）
    assert.equal(result.user.name, '');
    assert.deepEqual(result.user.roles, []);
  }
});

test('identityLoginApi.start：透传 email/redirect_uri，映射 authorizeUrl', async () => {
  lastBody = undefined;
  routeHandler = (url) => {
    if (url.includes('/login/start')) {
      return jsonResponse(
        {
          provider: 'google',
          challenge_id: 'chl-9',
          action: 'external_callback',
          authorize_url: 'https://accounts.google.com/o/oauth2/v2/auth?state=chl-9',
          expires_at: '2026-01-01T00:00:00+00:00',
        },
        200,
      );
    }
    return undefined;
  };
  const result = await identityLoginApi.start('google', { redirectUri: 'http://site/login' });
  assert.equal(result.challengeId, 'chl-9');
  assert.equal(result.action, 'external_callback');
  assert.match(String(result.authorizeUrl), /accounts\.google\.com/);
  assert.deepEqual(lastBody, { redirect_uri: 'http://site/login' });
});

test('★identityLoginApi.start：后端 503（发信面未装配）原样上抛，不返回假结果', async () => {
  routeHandler = (url) => {
    if (url.includes('/login/start')) {
      return jsonResponse({ error_code: 'source_unreachable', message: '邮箱登录发信面未接线' }, 503);
    }
    return undefined;
  };
  await assert.rejects(
    () => identityLoginApi.start('email', { email: 'a@b.c' }),
    (error: unknown) => {
      assert.match(String((error as { message?: string }).message), /发信面/);
      return true;
    },
  );
});

test('identityLoginApi.telegramStatus：verified 映射（不建会话的纯状态查询）', async () => {
  routeHandler = (url) => {
    if (url.includes('/login/status')) {
      return jsonResponse({ verified: true, expires_at: '2026-01-01T00:00:00+00:00' }, 200);
    }
    return undefined;
  };
  const status = await identityLoginApi.telegramStatus({
    challengeId: 'c1',
    completionToken: 'tkt',
  });
  assert.equal(status.verified, true);
  assert.equal(status.expiresAt, '2026-01-01T00:00:00+00:00');
});

test('identityLoginApi.captureCallback：state 作 challenge 定位（GET，不消费）', async () => {
  routeHandler = (url) => {
    if (url.includes('/callback') && url.includes('state=chl_9')) {
      return jsonResponse(
        { provider: 'google', challenge_id: 'chl_9', received_code: true, message: '已接收' },
        200,
      );
    }
    return undefined;
  };
  const captured = await identityLoginApi.captureCallback('google', { state: 'chl_9', code: 'c' });
  assert.equal(captured.challengeId, 'chl_9');
  assert.equal(captured.receivedCode, true);
});

test('mappers：provider 列表 item 缺 display_name 回落 provider 名（不产空标签）', () => {
  const item = mapProviderAvailability({ provider: 'telegram', enabled: true, configured: true });
  assert.equal(item?.displayName, 'telegram');
  // 显式 login_enabled=false 优先于 enabled 兜底（不把「明确关闭」误读成开启）
  const off = mapProviderAvailability({
    provider: 'google',
    enabled: true,
    login_enabled: false,
    configured: true,
  });
  assert.equal(off?.loginEnabled, false);
});
