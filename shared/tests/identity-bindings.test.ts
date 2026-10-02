// FE-IDENTITY-BINDINGS：账号三方身份绑定消费面契约对拍。
//
// 覆盖（卡 RED 三项）：
// ① 未配置/未启用/未开放绑定 provider **不可发起**（binding_enabled 缺失即 fail-closed）；
// ② start/complete 成功往返：challengeId/provider 逐字映射、完成后可刷新列表；
// ③ 后端 4xx/5xx（challenge 过期、越权、端口未装配）**原样上抛**，绝不假成功。
// 经真实 httpClient 链路（stub 全局 fetch）验证 wire 形状。
import test from 'node:test';
import assert from 'node:assert/strict';

// node 环境无 window/sessionStorage：client.ts 依赖它们。
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
let lastMethod: string | undefined;

const originalFetch = globalThis.fetch;
(globalThis as unknown as { fetch: unknown }).fetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  lastMethod = init?.method ?? 'GET';
  if (typeof init?.body === 'string') {
    try {
      lastBody = JSON.parse(init.body);
    } catch {
      lastBody = init.body;
    }
  } else {
    lastBody = undefined;
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

const { identityBindingsApi } = await import('../src/contracts/auth/identity/api.ts');
const {
  bindingReadyProviders,
  mapAccountIdentityBinding,
  mapAccountIdentityBindings,
  mapProviderAvailability,
} = await import('../src/contracts/auth/identity/mappers.ts');

test.after(() => {
  (globalThis as unknown as { fetch: unknown }).fetch = originalFetch;
});

// ─── RED ①：provider 可用性 fail-closed ─────────────────────────────────────

test('★mapProviderAvailability：binding_enabled 缺失 → bindingEnabled=false（fail-closed，不回落 enabled）', () => {
  const item = mapProviderAvailability({
    provider: 'google',
    enabled: true,
    configured: true,
  });
  assert.equal(item?.bindingEnabled, false);
});

test('mapProviderAvailability：显式 binding_enabled=true 才为 true', () => {
  const item = mapProviderAvailability({
    provider: 'google',
    enabled: true,
    configured: true,
    binding_enabled: true,
  });
  assert.equal(item?.bindingEnabled, true);
});

test('★bindingReadyProviders：仅 enabled && bindingEnabled（缺失/未启用一律排除）', () => {
  const ready = bindingReadyProviders([
    { provider: 'google', displayName: 'Google', enabled: true, loginEnabled: true, bindingEnabled: true, passwordResetEnabled: false, configured: true },
    { provider: 'telegram', displayName: 'Telegram', enabled: true, loginEnabled: true, bindingEnabled: false, passwordResetEnabled: false, configured: true },
    { provider: 'email', displayName: '邮箱', enabled: false, loginEnabled: false, bindingEnabled: true, passwordResetEnabled: true, configured: false },
    { provider: 'oidc', displayName: 'OIDC', enabled: true, loginEnabled: true, bindingEnabled: true, passwordResetEnabled: false, configured: false },
  ]);
  // email 已 enabled=false → 排除；oidc 虽未 configured，但后端声明 bindingEnabled=true，
  // 不擅自隐藏（configured 与否由后端 start 裁决）。
  assert.deepEqual(
    ready.map((p) => p.provider),
    ['google', 'oidc'],
  );
});

// ─── 绑定项 mapper ─────────────────────────────────────────────────────────

test('mapAccountIdentityBinding：snake_case wire → camelCase domain（V2 无源字段如实 null）', () => {
  const item = mapAccountIdentityBinding({
    id: 'bind_1',
    provider: 'google',
    provider_subject: 'sub-1',
    provider_email: 'a@b.c',
    provider_username: null,
    provider_display_name: 'Alice',
    verified_at: '2026-01-01T00:00:00+00:00',
    last_used_at: null,
  });
  assert.deepEqual(item, {
    id: 'bind_1',
    provider: 'google',
    providerSubject: 'sub-1',
    providerEmail: 'a@b.c',
    providerUsername: null,
    providerDisplayName: 'Alice',
    verifiedAt: '2026-01-01T00:00:00+00:00',
    lastUsedAt: null,
  });
});

test('mapAccountIdentityBinding：未知 provider 或缺 id → null（不猜测、不造假项）', () => {
  assert.equal(mapAccountIdentityBinding({ id: 'x', provider: 'wechat' }), null);
  assert.equal(mapAccountIdentityBinding({ provider: 'google' }), null);
  assert.equal(mapAccountIdentityBinding({ id: 'x', provider: 'google', providerSubject: 's' })?.id, 'x');
});

test('mapAccountIdentityBindings：缺失/畸形段宽容 → 空数组；坏项丢弃不崩', () => {
  assert.deepEqual(mapAccountIdentityBindings({}), []);
  assert.deepEqual(mapAccountIdentityBindings([]), []);
  const list = mapAccountIdentityBindings({
    items: [
      { id: 'b1', provider: 'google', provider_subject: 's1' },
      { id: 'b2', provider: 'wechat', provider_subject: 's2' },
    ],
  });
  assert.deepEqual(list.map((b) => b.id), ['b1']);
});

// ─── RED ②：list / start / complete 往返 ───────────────────────────────────

test('identityBindingsApi.list：GET /api/account/identity-bindings', async () => {
  routeHandler = (url) => {
    if (url.includes('/api/account/identity-bindings') && lastMethod === 'GET') {
      return jsonResponse({ items: [{ id: 'b1', provider: 'google', provider_subject: 's1' }] });
    }
    return undefined;
  };
  const items = await identityBindingsApi.list();
  assert.equal(items.length, 1);
  assert.equal(items[0]?.provider, 'google');
});

test('★identityBindingsApi.start：provider 进 path，challengeId 原样返回（不与 list 混淆）', async () => {
  lastBody = undefined;
  routeHandler = (url) => {
    if (url.includes('/api/account/identity-bindings/email/start')) {
      return jsonResponse({
        provider: 'email',
        challenge_id: 'chl-bind-1',
        action: 'enter_code',
        delivery_status: 'sent',
        message: '邮箱绑定验证码已发送，请查收邮件。',
        expires_at: '2026-01-01T00:00:00+00:00',
      });
    }
    return undefined;
  };
  const started = await identityBindingsApi.start('email', { email: 'a@b.c' });
  assert.equal(started.provider, 'email');
  assert.equal(started.challengeId, 'chl-bind-1');
  assert.equal(started.action, 'enter_code');
  assert.deepEqual(lastBody, { email: 'a@b.c' });
});

test('★identityBindingsApi.complete：provider 进 path、challengeId/码逐字入体，返回新绑定', async () => {
  lastBody = undefined;
  routeHandler = (url) => {
    if (url.includes('/api/account/identity-bindings/email/complete')) {
      return jsonResponse({
        binding: {
          id: 'bind_9',
          provider: 'email',
          provider_subject: 'a@b.c',
          provider_email: 'a@b.c',
          provider_username: null,
          provider_display_name: null,
          verified_at: '2026-01-01T00:00:00+00:00',
          last_used_at: null,
        },
      });
    }
    return undefined;
  };
  const binding = await identityBindingsApi.complete('email', {
    challengeId: 'chl-bind-1',
    providerSubject: '123456',
  });
  assert.equal(binding.id, 'bind_9');
  assert.equal(binding.provider, 'email');
  assert.deepEqual(lastBody, {
    challenge_id: 'chl-bind-1',
    provider_subject: '123456',
  });
});

test('identityBindingsApi.unbind：POST /api/auth/identity/unbind?confirmed=true + provider 体（解绑确认闸）', async () => {
  lastBody = undefined;
  routeHandler = (url, init) => {
    if (url.includes('/api/auth/identity/unbind') && url.includes('confirmed=true')) {
      return jsonResponse({ ok: true });
    }
    void init;
    return undefined;
  };
  await identityBindingsApi.unbind('google');
  assert.deepEqual(lastBody, { provider: 'google' });
});

// ─── RED ③：错误不假成功 ───────────────────────────────────────────────────

test('★complete 失败（challenge 过期 400）原样上抛，不返回假绑定', async () => {
  routeHandler = (url) => {
    if (url.includes('/complete')) {
      return jsonResponse(
        { error_code: 'validation', message: '身份绑定 challenge 不存在或已过期' },
        400,
      );
    }
    return undefined;
  };
  await assert.rejects(
    () => identityBindingsApi.complete('email', { challengeId: 'gone', providerSubject: '1' }),
    (error: unknown) => {
      assert.match(String((error as { message?: string }).message), /过期/);
      return true;
    },
  );
});

test('★complete 越权（challenge 归属他人 403）原样上抛', async () => {
  routeHandler = (url) => {
    if (url.includes('/complete')) {
      return jsonResponse(
        { error_code: 'forbidden', message: '当前 challenge 不属于该账号' },
        403,
      );
    }
    return undefined;
  };
  await assert.rejects(
    () => identityBindingsApi.complete('google', { challengeId: 'other', code: 'c' }),
    (error: unknown) => {
      assert.match(String((error as { message?: string }).message), /不属于该账号/);
      return true;
    },
  );
});

test('★start 失败（provider 未开放绑定 403 / 端口未装配 503）原样上抛', async () => {
  routeHandler = (url) => {
    if (url.includes('/start')) {
      return jsonResponse({ error_code: 'forbidden', message: 'Google 身份绑定未启用' }, 403);
    }
    return undefined;
  };
  await assert.rejects(
    () => identityBindingsApi.start('google', {}),
    (error: unknown) => {
      assert.match(String((error as { message?: string }).message), /未启用/);
      return true;
    },
  );
});

test('★unbind 被「最后一个可登录凭据」守卫拒绝（409）原样上抛', async () => {
  routeHandler = (url) => {
    if (url.includes('/unbind')) {
      return jsonResponse(
        { error_code: 'conflict', message: 'cannot remove the last login credential' },
        409,
      );
    }
    return undefined;
  };
  await assert.rejects(
    () => identityBindingsApi.unbind('google'),
    (error: unknown) => {
      assert.match(String((error as { message?: string }).message), /last login credential/);
      return true;
    },
  );
});
