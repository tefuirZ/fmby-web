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

test('后端 unauthorized 业务码判定为会话失效', () => {
  const expired = makeApiError({ code: 'unauthorized' });
  assert.equal(isSessionInvalidationError(expired), true);
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
