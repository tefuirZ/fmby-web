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
const { extractErrorInfo } = await import('@fmby/v2-shared/errors/routeErrorInfo');

// 路由错误响应的显式夹具谓词（生产侧传 react-router 真函数；
// 本测试用夹具谓词保证分支判定确定——只认显式构造的 {status,statusText} 形态）。
const ROUTE_MARKER = Symbol('route-error');
// 路由错误夹具助手：生产侧传 react-router 真函数（其判据自带 brand）；
// 测试侧用 symbol 标记保证「只认显式构造的路由错误」，ApiError 夹具不误入。
const routeErr = (status: number, data: unknown = 'gone'): unknown => ({
  status,
  statusText: 'x',
  data,
  [ROUTE_MARKER]: true,
});
const isRouteErrorResponse = (e: unknown) =>
  typeof e === 'object' && e !== null && ROUTE_MARKER in (e as Record<symbol, unknown>);

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

// ── rb02 复审：extractErrorInfo 回归钉（ApiError 分支——原 unknown 分支丢 message/真状态）──

test('extractErrorInfo：ApiError 对象 ⇒ message 取到 / code=真实状态 / traceId 透传', () => {
  const info = extractErrorInfo(
    { code: 'PERM_LICENSE_DENIED', message: '免费额度已用尽', traceId: '01JABC', status: 403, statusText: 'Forbidden' },
    isRouteErrorResponse,
  );
  assert.equal(info.description, '免费额度已用尽', '后端人话 message 必须展示');
  assert.equal(info.code, '403', '大码 = 真实 HTTP 状态（不再恒 500）');
  assert.equal(info.traceId, '01JABC', '排查码透传');
  assert.ok(info.trace && info.trace.includes('PERM_LICENSE_DENIED'), 'trace dump 兜底不丢信息量');
});

test('extractErrorInfo：status 缺失 ⇒ code 回落 rec.code（不虚构 500）', () => {
  const info = extractErrorInfo(
    { code: 'PERM_LICENSE_DENIED', message: '免费额度已用尽' },
    isRouteErrorResponse,
  );
  assert.equal(info.code, 'PERM_LICENSE_DENIED', '无 status 时回落后端码本身');
  assert.equal(info.title, '请求失败 (PERM_LICENSE_DENIED)');
  assert.equal(info.description, '免费额度已用尽');
});

test('extractErrorInfo：404 路由错误 ⇒ 既有行为回归（title/404/showHome）', () => {
  const info = extractErrorInfo(
    routeErr(404, 'gone'),
    isRouteErrorResponse,
  );
  assert.equal(info.code, '404');
  assert.equal(info.title, '页面不存在');
  assert.equal(info.showHome, true);
});

test('extractErrorInfo：401 响应体 data 带 trace_id ⇒ 排查码提取（snake_case）', () => {
  const info = extractErrorInfo(
    routeErr(401, { error_code: 'AUTH_EXPIRED', message: '会话失效', trace_id: '01JXY' }),
    isRouteErrorResponse,
  );
  assert.equal(info.traceId, '01JXY');
});
