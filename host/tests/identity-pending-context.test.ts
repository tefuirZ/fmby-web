// WEB-IDENTITY-LOGIN-UI：三方登录回流上下文（sessionStorage）单测。
//
// 验证：记住发起上下文后，Google 回站仅凭 `state`(=challenge_id) 即可反查
// provider；防串流（凭据不匹配不误认）；sessionStorage 不可用时不抛且返回 undefined。
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

const { rememberPendingIdentity, resolvePendingProvider, clearPendingIdentity } = await import(
  '../src/pages/login/forms/identityPendingContext.ts'
);

test('记住发起上下文后可按 challenge_id 反查 provider', () => {
  store.clear();
  rememberPendingIdentity({ challengeId: 'chl-1', provider: 'google' });
  assert.equal(resolvePendingProvider('chl-1'), 'google');
});

test('challenge_id 不匹配 → undefined（防串流，不误认 provider）', () => {
  store.clear();
  rememberPendingIdentity({ challengeId: 'chl-1', provider: 'google' });
  assert.equal(resolvePendingProvider('chl-other'), undefined);
});

test('未记住 / 已清理 → undefined（不猜测 provider）', () => {
  store.clear();
  assert.equal(resolvePendingProvider('chl-1'), undefined);
  rememberPendingIdentity({ challengeId: 'chl-1', provider: 'telegram' });
  clearPendingIdentity();
  assert.equal(resolvePendingProvider('chl-1'), undefined);
});

test('sessionStorage 不可用（隐私模式/禁用）→ 不抛异常且返回 undefined', () => {
  store.clear();
  storageThrows = true;
  try {
    rememberPendingIdentity({ challengeId: 'chl-1', provider: 'google' });
    assert.equal(resolvePendingProvider('chl-1'), undefined);
    clearPendingIdentity();
  } finally {
    storageThrows = false;
  }
});

test('损坏的存储值 → undefined（宽容解析，不崩）', () => {
  store.clear();
  store.set('fmby:identity:pending-login', '{not-json');
  assert.equal(resolvePendingProvider('chl-1'), undefined);
});
