// `license_capability_not_ready`（501）的前端登记契约 —— #1626 DECLARE-NOT-READY。
//
// 背景：后端把「门挂在本端未声明的授权键上」从 `403 license_feature_denied`（文案「当前授权
// 不包含能力 X（请购买/升级授权）」）改成 `501 license_capability_not_ready`（「该能力尚未就绪，
// 非授权缺失，无需购买」）。后端这条改动的意义在**付费用户不被引去重复购买**——前端必须跟上，
// 否则 501 会落到通用兜底，用户看到「未知错误」，等于白改。
//
// 三条判据（都钉行为，不钉实现）：
//   ① 码值逐字锁定 = 后端 slug（写错一个字母，前端判据全失效）；
//   ② 该码**不得**被判成「需要授权/请购买」（`isForbiddenError` 类判据必须为 false）；
//   ③ 走真映射口 `mapResponseToApiError`：501 响应体 ⇒ code 原样保留、message 不改写
//      （后端文案已如实）、retryable=false（不是瞬时故障，不该自动重试）。
//
// 跑法：node --import ./tests/register-aliases.mjs --test tests/license-capability-not-ready.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LICENSE_CAPABILITY_NOT_READY,
  isForbiddenError,
  isLicenseCapabilityNotReady,
} from '@fmby/v2-shared/errors/error';
import { mapResponseToApiError } from '@fmby/v2-shared/api/client/errorMapping';

const BACKEND_BODY = {
  error_code: 'license_capability_not_ready',
  message:
    '能力 feature.users.registration_window 尚未就绪：本端未声明该授权键（非授权缺失，无需购买；待执法面落地后开放）',
};

test('① 码值与后端 slug 逐字一致', () => {
  assert.equal(LICENSE_CAPABILITY_NOT_READY, 'license_capability_not_ready');
});

test('② 不得把「未就绪」误判成「无权限/请购买」', () => {
  const err = { code: LICENSE_CAPABILITY_NOT_READY, message: BACKEND_BODY.message, retryable: false };
  assert.equal(isLicenseCapabilityNotReady(err), true, '本码必须被识别为未就绪');
  assert.equal(
    isForbiddenError(err),
    false,
    '未就绪不是 403：若判成 forbidden，gated 模块会弹「需要授权/请购买」= 回到本次要修的撒谎',
  );
  // 反向：真正的授权拒绝不能被当成「未就绪」（否则付费引导被吞掉）
  for (const code of ['license_feature_denied', 'forbidden', 'license_required']) {
    assert.equal(
      isLicenseCapabilityNotReady({ code, message: '当前授权不包含能力 X', retryable: false }),
      false,
      `${code} 是授权语义，不得归为未就绪`,
    );
  }
});

test('③ 501 响应走真映射口：码保留、文案不被改写、不自动重试', async () => {
  const response = new Response(JSON.stringify(BACKEND_BODY), {
    status: 501,
    headers: { 'content-type': 'application/json' },
  });
  const mapped = await mapResponseToApiError(response);
  assert.equal(mapped.code, LICENSE_CAPABILITY_NOT_READY);
  assert.equal(mapped.message, BACKEND_BODY.message, '后端文案已如实，前端不得再改写（尤其不得加「请购买」）');
  assert.equal(mapped.retryable, false, '501 未就绪不是瞬时故障');
});
