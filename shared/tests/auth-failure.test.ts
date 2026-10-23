// P0-08 ③：isSessionInvalidationError 最小修复的单元测试。
// 语义：仅 HTTP_401 且请求路径非 /api/auth/login 才判定为会话失效。
import test from 'node:test';
import assert from 'node:assert/strict';
import { isSessionInvalidationError, subscribeAuthFailure } from '../src/errors/authFailure.ts';
import type { ApiError } from '../src/errors/error.ts';

function makeApiError(overrides: Partial<ApiError> & { requestPath?: string }): ApiError & { requestPath?: string } {
  return {
    code: 'HTTP_401',
    message: 'unauthorized',
    retryable: false,
    ...overrides,
  };
}

test('登录接口的 HTTP_401 不判定为会话失效（输错密码场景）', () => {
  const error = makeApiError({ requestPath: '/api/auth/login' });
  assert.equal(isSessionInvalidationError(error), false);
});

test('登录接口带 query 的 HTTP_401 同样豁免', () => {
  const error = makeApiError({ requestPath: '/api/auth/login?redirect=%2F' });
  assert.equal(isSessionInvalidationError(error), false);
});

test('非登录接口的 HTTP_401 判定为会话失效（既有会话过期）', () => {
  const meError = makeApiError({ requestPath: '/api/auth/me' });
  assert.equal(isSessionInvalidationError(meError), true);

  const libraryError = makeApiError({ requestPath: '/api/libraries' });
  assert.equal(isSessionInvalidationError(libraryError), true);
});

test('无 requestPath 元数据时保持旧行为（HTTP_401 视为会话失效）', () => {
  const error = makeApiError({});
  assert.equal(isSessionInvalidationError(error), true);
});

test('路径前缀相似但不等于登录接口时不被误豁免', () => {
  const error = makeApiError({ requestPath: '/api/auth/login-history' });
  assert.equal(isSessionInvalidationError(error), true);
});

test('业务非会话错误码（凭据无效等）不判定为会话失效', () => {
  const error = makeApiError({ code: 'credential_invalid' });
  assert.equal(isSessionInvalidationError(error), false);
});

test('非折叠后端码（unauthorized）保留原码，不判定为会话失效（M2）', () => {
  // V1 断言「unauthorized → true」基于「401 全折叠」旧语义。★M2 收窄
  // （errorMapping.ts FOLD_INTO_HTTP_401 = {AUTH_REQUIRED, AUTH_EXPIRED}）：
  //   折叠发生在 errorMapping 层（401 + 折叠集码 ⇒ code='HTTP_401'，由
  //   auth-session.test.ts 真实链路用例覆盖）；'unauthorized' 非折叠集成员
  //   ⇒ 保留后端码 ⇒ 不触发全局登出。若将来 wire 出现该生产者，按
  //   authFailure.ts 头注连同守卫一起加回。
  assert.equal(isSessionInvalidationError(makeApiError({ code: 'unauthorized' })), false);
});

test('非 ApiError 输入返回 false', () => {
  assert.equal(isSessionInvalidationError(new Error('boom')), false);
  assert.equal(isSessionInvalidationError(null), false);
  assert.equal(isSessionInvalidationError(undefined), false);
});

test('subscribeAuthFailure 返回退订函数', () => {
  let notified = 0;
  const unsubscribe = subscribeAuthFailure(() => {
    notified += 1;
  });
  unsubscribe();
  unsubscribe();
  assert.equal(notified, 0);
});
