// P1-04 F-1 前端回显：写方法必须读取 fmby_csrf cookie 并经 X-CSRF-Token 回显
//（与后端 middleware/csrf.rs 双匹配契约配套）；安全方法与无 cookie 场景不回显。
// 通过 stub document.cookie + 捕获全局 fetch 的 init.headers，走真实 httpClient 链路验证。
import test from 'node:test';
import assert from 'node:assert/strict';

// node 环境无 window/document：client.ts 依赖 window.location.origin 与
// document.cookie，先 stub 再动态加载模块（与 auth-session.test.ts 同惯例）。
(globalThis as unknown as { window: unknown }).window = {
  location: { origin: 'http://test.local' },
};

type CapturedRequest = { url: string; headers: Record<string, string> };
let captured: CapturedRequest[] = [];
let cookieValue: string | null = null;

const originalFetch = globalThis.fetch;
(globalThis as unknown as { fetch: unknown }).fetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const headers: Record<string, string> = {};
  // client.ts 传给 fetch 的是 Headers 实例（归一化后）；逐条展开捕获
  if (init?.headers instanceof Headers) {
    init.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });
  }
  captured.push({ url, headers });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

// document.cookie 只读属性：用 getter 返回受控值（readCookie 解析用）
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: {
    get cookie() {
      return cookieValue ?? '';
    },
  },
});

const { httpClient } = await import('../src/api/client.ts');

test.after(() => {
  (globalThis as unknown as { fetch: unknown }).fetch = originalFetch;
  delete (globalThis as unknown as { document?: unknown }).document;
});

test('写方法回显 fmby_csrf cookie 为 X-CSRF-Token header', async () => {
  cookieValue = 'fmby_session=abc; fmby_csrf=csrf-token-value-123';
  captured = [];
  await httpClient.post('/api/settings/server/general', { body: { k: 1 } });
  const req = captured.find((r) => r.url.includes('/api/settings/server/general'));
  assert.ok(req, '请求应被捕获');
  assert.equal(
    req.headers['x-csrf-token'],
    'csrf-token-value-123',
    '写方法必须回显 csrf cookie 值',
  );
});

test('GET 安全方法不回显 X-CSRF-Token', async () => {
  cookieValue = 'fmby_csrf=csrf-token-value-123';
  captured = [];
  await httpClient.get('/api/auth/me');
  const req = captured.find((r) => r.url.includes('/api/auth/me'));
  assert.ok(req, '请求应被捕获');
  assert.equal(req.headers['x-csrf-token'], undefined, '安全方法无需回显');
});

test('无 fmby_csrf cookie（未登录/已登出）时不发送头', async () => {
  cookieValue = 'other=1';
  captured = [];
  await httpClient.post('/api/auth/login', { body: { username: 'u', password: 'p' } });
  const req = captured.find((r) => r.url.includes('/api/auth/login'));
  assert.ok(req, '请求应被捕获');
  assert.equal(req.headers['x-csrf-token'], undefined, '无工件不得伪造头');
});

test('调用方显式指定的 X-CSRF-Token 不被覆盖', async () => {
  cookieValue = 'fmby_csrf=cookie-value';
  captured = [];
  await httpClient.post('/api/x', {
    body: {},
    headers: { 'X-CSRF-Token': 'explicit-value' },
  } as Parameters<typeof httpClient.post>[1]);
  const req = captured.find((r) => r.url.includes('/api/x'));
  assert.ok(req, '请求应被捕获');
  assert.equal(req.headers['x-csrf-token'], 'explicit-value', '显式头优先于 cookie 回显');
});

test('MFA/TOTP 写方法同样回显 fmby_csrf（与登录同口径，#554/#553 取证）', async () => {
  // w06 S6 审计发现后端 `post_totp_verify` 曾漏签 fmby_csrf 工件 ⇒ 启用 TOTP 的用户
  // 登录后所有写请求 403。后端已修（PR #554）。本条钉住**前端侧**不变量：
  // MFA 的写方法与普通 login **共用同一个 httpClient**，CSRF 回显在 client 的
  // `request()` 里按 method 统一施加（非 GET/HEAD/OPTIONS 即回显），
  // 故 MFA 路径**自动受益**，不存在「MFA 走另一条不回显 csrf 的写路径」。
  const { mfaApi } = await import('../src/contracts/auth/mfa.ts');
  const { authApi } = await import('../src/contracts/auth/api.ts');

  cookieValue = 'fmby_session=abc; fmby_csrf=csrf-token-value-123';

  for (const [name, call] of [
    ['mfaApi.verify（登录二因子）', () => mfaApi.verify({ challengeId: 'c1', code: '123456' })],
    ['mfaApi.confirm（绑定确认）', () => mfaApi.confirm({ code: '123456' })],
    ['mfaApi.enroll（发起绑定）', () => mfaApi.enroll()],
    ['mfaApi.disable（停用）', () => mfaApi.disable({ currentPassword: 'pw' })],
    ['authApi.login（普通登录，对照）', () =>
      authApi.login({ username: 'u', password: 'p' } as never)],
  ] as const) {
    captured = [];
    try {
      await call();
    } catch {
      // 响应体是 stub 的 {ok:true}，形状不符会抛；本条只关心**请求头**，忽略解析错。
    }
    const req = captured[0];
    assert.ok(req, `${name} 应发出请求`);
    assert.equal(
      req.headers['x-csrf-token'],
      'csrf-token-value-123',
      `${name} 必须与普通登录同口径回显 csrf（否则 MFA 用户的写请求会被 403 拦截）`,
    );
  }
});
