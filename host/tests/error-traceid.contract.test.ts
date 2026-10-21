// #1904 Slice 2：排查码（trace_id）展示位数据源契约。
// 运行：node --import ./tests/register-aliases.mjs --test tests/error-traceid.contract.test.ts
//
// 锁定 `getErrorTraceId`（shared/src/errors/error.ts）对三类抛出物的提取语义：
//   1. ApiError 归一化对象（client 桶 throw 的 plain object，traceId camelCase）；
//   2. 路由错误响应体（data 为后端 ErrorBody JSON，trace_id snake_case）；
//   3. 无排查码 ⇒ undefined（组件走 stack/JSON dump 兜底，不虚构）。

import test from 'node:test';
import assert from 'node:assert/strict';

const { getErrorTraceId } = await import('@fmby/v2-shared/errors/error');

test('ApiError 归一化对象：traceId（camelCase）⇒ 提取', () => {
  const thrown = {
    code: 'PERM_LICENSE_DENIED',
    backendCode: 'PERM_LICENSE_DENIED',
    message: '免费额度已用尽',
    retryable: false,
    traceId: '01JABC123',
    status: 403,
    statusText: 'Forbidden',
  };
  assert.equal(getErrorTraceId(thrown), '01JABC123');
});

test('路由错误响应体：data.trace_id（snake_case）⇒ 提取', () => {
  const thrown = {
    status: 403,
    statusText: 'Forbidden',
    data: { error_code: 'PERM_DENIED', message: '无权限', trace_id: '01JXYz789' },
  };
  assert.equal(getErrorTraceId(thrown), '01JXYz789');
});

test('data.traceId（camelCase 变体）⇒ 提取', () => {
  const thrown = { status: 500, data: { error_code: 'INTERNAL', message: 'x', traceId: '01JQ' } };
  assert.equal(getErrorTraceId(thrown), '01JQ');
});

test('无排查码 ⇒ undefined（不虚构、不读 stack）', () => {
  assert.equal(getErrorTraceId({ code: '500', message: '页面出现异常' }), undefined);
  assert.equal(getErrorTraceId(new Error('真 Error 无 traceId 字段')), undefined);
  assert.equal(getErrorTraceId('字符串错误'), undefined);
  assert.equal(getErrorTraceId(null), undefined);
});

test('空串 traceId 视为无（不展示空排查码）', () => {
  assert.equal(getErrorTraceId({ code: 'X', message: 'm', traceId: '' }), undefined);
  assert.equal(getErrorTraceId({ status: 400, data: { error_code: 'V', trace_id: '' } }), undefined);
});
