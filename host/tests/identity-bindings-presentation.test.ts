// FE-IDENTITY-BINDINGS：绑定管理页纯逻辑单测。
//
// 覆盖：
// ① partition：已绑定项与可绑定项不混淆；已绑定 provider 不再出现在可绑定列表；
// ② complete 请求构造：enter_code（邮箱/Telegram 验证码）走 providerSubject、
//    external_callback（Google OAuth 回调）走 code，challengeId 恒来自对应 start；
// ③ 回流上下文：按 challengeId(=OAuth state) 反查 provider，防串流。
import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map<string, string>();
let storageThrows = false;
(globalThis as unknown as { sessionStorage: unknown }).sessionStorage = {
  getItem: (key: string) => {
    if (storageThrows) throw new Error('storage disabled');
    return store.get(key) ?? null;
  },
  setItem: (key: string, value: string) => {
    if (storageThrows) throw new Error('storage disabled');
    store.set(key, value);
  },
  removeItem: (key: string) => {
    if (storageThrows) throw new Error('storage disabled');
    store.delete(key);
  },
};

const {
  bindingCompleteRequest,
  clearPendingBinding,
  partitionBindingProviders,
  rememberPendingBinding,
  resolvePendingBinding,
} = await import('../src/pages/settings/identityBindingsPresentation');

const google = {
  provider: 'google' as const,
  displayName: 'Google',
  enabled: true,
  loginEnabled: true,
  bindingEnabled: true,
  passwordResetEnabled: false,
  configured: true,
};
const email = {
  provider: 'email' as const,
  displayName: '邮箱',
  enabled: true,
  loginEnabled: true,
  bindingEnabled: true,
  passwordResetEnabled: true,
  configured: true,
};
const googleBinding = {
  id: 'b-google',
  provider: 'google' as const,
  providerSubject: 'sub-1',
  providerEmail: 'a@b.c',
  providerUsername: null,
  providerDisplayName: 'Alice',
  verifiedAt: '2026-01-01T00:00:00+00:00',
  lastUsedAt: null,
};

test('① partition：已绑定 provider 不再出现在可绑定列表', () => {
  const { bound, bindable } = partitionBindingProviders([googleBinding], [google, email]);
  assert.deepEqual(
    bound.map((row) => row.provider),
    ['google'],
  );
  assert.equal(bound[0]?.displayName, 'Google');
  assert.equal(bound[0]?.binding.id, 'b-google');
  assert.deepEqual(
    bindable.map((p) => p.provider),
    ['email'],
  );
});

test('① partition：绑定记录 provider 不在可用性列表时仍如实展示（不丢绑定）', () => {
  const orphan = { ...googleBinding, id: 'b-oidc', provider: 'oidc' as const, providerDisplayName: null };
  const { bound } = partitionBindingProviders([orphan], []);
  assert.equal(bound[0]?.provider, 'oidc');
  // 无可用性元信息时回落 provider 名，不产空标签
  assert.equal(bound[0]?.displayName, 'oidc');
});

test('① partition：bindingEnabled=false / enabled=false 的 provider 一律不出现在可绑定列表（fail-closed）', () => {
  const oidc = { ...google, provider: 'oidc' as const, displayName: 'OIDC', bindingEnabled: false };
  const github = { ...google, provider: 'github' as const, displayName: 'GitHub', enabled: false };
  const { bindable } = partitionBindingProviders([], [oidc, github, email]);
  assert.deepEqual(
    bindable.map((p) => p.provider),
    ['email'],
  );
});

test('② bindingCompleteRequest：enter_code（邮箱验证码）→ providerSubject，challengeId 不串', () => {
  const start = {
    provider: 'email' as const,
    challengeId: 'chl-email-1',
    action: 'enter_code',
    expiresAt: '2026-01-01T00:00:00+00:00',
  };
  assert.deepEqual(bindingCompleteRequest(start, '  123456  '), {
    challengeId: 'chl-email-1',
    providerSubject: '123456',
  });
});

test('② bindingCompleteRequest：external_callback（OAuth 回调）→ code', () => {
  const start = {
    provider: 'google' as const,
    challengeId: 'chl-google-1',
    action: 'external_callback',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=chl-google-1',
    expiresAt: '2026-01-01T00:00:00+00:00',
  };
  assert.deepEqual(bindingCompleteRequest(start, 'auth-code-9'), {
    challengeId: 'chl-google-1',
    code: 'auth-code-9',
  });
});

test('② bindingCompleteRequest：空码不编造字段（缺码交由后端如实拒绝）', () => {
  const start = {
    provider: 'email' as const,
    challengeId: 'chl-email-2',
    action: 'enter_code',
    expiresAt: '2026-01-01T00:00:00+00:00',
  };
  assert.deepEqual(bindingCompleteRequest(start, '   '), { challengeId: 'chl-email-2' });
});

test('③ 回流上下文：state=challengeId 反查 provider；不匹配/不可用不误认', () => {
  store.clear();
  rememberPendingBinding({ challengeId: 'chl-google-1', provider: 'google' });
  assert.equal(resolvePendingBinding('chl-google-1')?.provider, 'google');
  assert.equal(resolvePendingBinding('other-state'), undefined);

  clearPendingBinding();
  assert.equal(resolvePendingBinding('chl-google-1'), undefined);
});

test('③ 回流上下文：sessionStorage 不可用 → 不抛，返回 undefined（不猜测）', () => {
  storageThrows = true;
  try {
    rememberPendingBinding({ challengeId: 'x', provider: 'google' });
    assert.equal(resolvePendingBinding('x'), undefined);
    clearPendingBinding();
  } finally {
    storageThrows = false;
  }
});
