// fmby-web#658 / #671：CAS 写面（触发对账 / 重试复制）的**失败语义真断言**。
// 运行：node --import ./tests/register-aliases.mjs --test tests/cas-write-actions.test.ts
//
// ★为什么不走「mock fetch 真发请求」：httpClient 依赖浏览器环境（`window` / CSRF cookie），
//   node:test 无 DOM ⇒ 打桩 fetch 会在 client 层抛 `window is not defined`，测不到语义。
//   故把**失败语义分类**抽成纯函数 `classifyCasWriteError`（契约层），直接对其断言 ——
//   这与本仓既有纪律一致（纯逻辑 + 行为断言，而非「渲染不炸即过」）。
//
// 后端语义（#671，照后端、不猜）：未装配/不可用 ⇒ **503**（不是 500）；
//   能力不足 ⇒ 403；缺 confirmed ⇒ 400。
// ★并且：错误码与后端原文必须**原样可见**，不得被吞成「操作失败」。

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  classifyCasWriteError,
  isCasAdminUnwired,
} from '@fmby/v2-shared/contracts/manage/casAdmin';
import { getErrorMessage, isApiError } from '@fmby/v2-shared/errors';

/** 后端 ErrorBody 归一化后的 ApiError 形态（与 client 层一致）。 */
const apiError = (code: string, message: string) => ({
  code,
  message,
  retryable: false,
});

test('① 503 未装配/不可用 ⇒ unwired（**不是** 500 语义）', () => {
  const err = apiError('dependency_unavailable', 'CAS 写端口未装配');
  assert.equal(classifyCasWriteError(err), 'unwired');
  assert.equal(isCasAdminUnwired(err), true);
  // 500 类也归入未装配（后端 fail-closed 口径）。
  assert.equal(classifyCasWriteError(apiError('HTTP_503', 'x')), 'unwired');
});

test('② 403 能力不足 ⇒ forbidden，且**不**被误判为未装配', () => {
  const err = apiError('forbidden', '缺少 MANAGE_MOUNT 能力');
  assert.equal(classifyCasWriteError(err), 'forbidden');
  assert.equal(isCasAdminUnwired(err), false, '403 与 503 不得混为一谈');
  assert.ok(getErrorMessage(err).includes('缺少 MANAGE_MOUNT 能力'));
});

test('③ 400 缺 confirmed ⇒ bad_request，且**不**判为未装配', () => {
  const err = apiError('validation', '缺少 confirmed=true');
  assert.equal(classifyCasWriteError(err), 'bad_request');
  assert.equal(isCasAdminUnwired(err), false);
  assert.ok(getErrorMessage(err).includes('缺少 confirmed=true'));
});

test('④ 未知错误码 ⇒ other，且**错误码与后端原文都可见**（不得吞成通用文案）', () => {
  const err = apiError('cas_retry_unsupported', '该盘不支持重试：provider=local');
  assert.equal(classifyCasWriteError(err), 'other', '未知码不得归入既有类别');
  assert.ok(isApiError(err));
  // ★错误码原样保留（运维要能照着查）。
  assert.equal(err.code, 'cas_retry_unsupported');
  // ★原文可见：getErrorMessage 直接返回后端 message。
  const text = getErrorMessage(err);
  assert.ok(text.includes('该盘不支持重试'), `须含后端原文，实际：${text}`);
  assert.notEqual(text.trim(), '操作失败', '绝不能只剩「操作失败」这类通用文案');
});

test('⑤ 非 ApiError（普通 Error）⇒ other，message 仍可见', () => {
  const err = new Error('网络中断');
  assert.equal(classifyCasWriteError(err), 'other');
  assert.equal(getErrorMessage(err), '网络中断');
  // 未知输入（null/undefined）也不炸，且归 other。
  assert.equal(classifyCasWriteError(null), 'other');
  assert.equal(classifyCasWriteError(undefined), 'other');
});

test('⑥ 端点路径与 confirmed 闸：契约源码须含两个写端点且都带 confirmed', () => {
  // 路径前缀以**契约常量**为单一真源（/api/admin/cas/*），与后端 #671 口径一致。
  const src = readFileSync(
    new URL('../../shared/src/contracts/manage/casAdmin/api.ts', import.meta.url),
    'utf-8',
  );
  assert.ok(
    src.includes('${RECONCILE_PATH}/trigger'),
    '须有 POST .../reconcile/trigger 端点',
  );
  assert.ok(
    src.includes('${FANOUT_PATH}/${contentId}/drives/${driveId}/retry'),
    '须有 POST .../fanout/{contentId}/drives/{driveId}/retry 端点',
  );
  // ★两个写端点都必须带 confirmed=true 闸（缺了后端会 400）。
  const confirmCount = src.split('params: { confirmed: true }').length - 1;
  assert.ok(confirmCount >= 2, `两个写端点都须带 confirmed=true，实际 ${confirmCount} 处`);
});
