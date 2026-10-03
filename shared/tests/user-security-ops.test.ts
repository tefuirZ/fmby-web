import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { httpClient } from '@fmby/v2-shared/api/client';
import { manageApi } from '@fmby/v2-shared/contracts/manage';

/**
 * FE-GAP-NEXT-2：取的面 = **用户安全 / 凭据投递**（`/api/manage/users/{id}` 下两条管理员危险操作）。
 *
 * ★为什么是这面（避撞车 + 严格判据）：
 *   - 已扫描他人在做：**migration wizard**（/api/manage/migration/*）⇒ 本卡不碰；
 *   - 本会话已做面（rewards / media-reprocess / yun139 pools / points-checkin /
 *     collections / direct-registration）⇒ 不重复。
 *   - 后端**真实实现非 501**：
 *     · POST /api/manage/users/{id}/mfa/totp/reset
 *       → auth_mfa::post_reset_user_totp（MANAGE_ACCESS + DANGEROUS_ACTION + ?confirmed=true）
 *       → MfaOkResponse{ ok }
 *     · POST /api/manage/users/{id}/telegram-password-reset
 *       → manage_users::manage_users_schedule_telegram_password_reset
 *         （require_dangerous_manage；未装配 ⇒ 503，非假成功）
 *       → TelegramPasswordResetReceiptDto{ operation_id, user_id, username, replayed,
 *          delivery_status, payload_expires_at }
 *   - 前端**零调用**（逐条核实：`mfa/totp/reset` 0 命中、`telegram-password-reset` 0 命中；
 *     同族的 reset-password / approve-registration / login-risk/reset 都已接，仅这两条漏）。
 *
 * ★安全要点（测试钉死）：回执**绝不含明文密码**（后端 `payload_expires_at` 只给有效期）；
 *   前端契约层不得声明/透出任何密码字段。
 * ★幂等：幂等键走请求头 `x-idempotency-key`（后端缺省按日派生）⇒ 不在 body 里臆造。
 */

test('重置他人 TOTP：路径 + ?confirmed=true（危险操作）+ 解 { ok }', async () => {
  const post = mock.method(httpClient, 'post', async () => ({ ok: true }));

  const ok = await manageApi.resetUserTotp('u1');
  const [path, cfg] = post.mock.calls[0].arguments as [
    string,
    { params?: Record<string, unknown>; body?: unknown },
  ];
  assert.equal(path, '/api/manage/users/u1/mfa/totp/reset');
  assert.deepEqual(cfg?.params, { confirmed: true }, '危险操作必须带 ?confirmed=true');
  assert.equal(ok, true);

  post.mockRestore?.();
});

test('Telegram 密码重置回执：6 字段对拍 + 幂等键走 x-idempotency-key 头（不放 body）', async () => {
  const post = mock.method(httpClient, 'post', async () => ({
    operation_id: 'op1',
    user_id: 'u1',
    username: 'alice',
    replayed: false,
    delivery_status: 'pending',
    payload_expires_at: 1_760_000_000_000,
  }));

  const receipt = await manageApi.scheduleTelegramPasswordReset('u1', 'idem-1');
  const [path, cfg] = post.mock.calls[0].arguments as [
    string,
    { headers?: Record<string, string>; params?: Record<string, unknown>; body?: unknown },
  ];

  assert.equal(path, '/api/manage/users/u1/telegram-password-reset');
  assert.deepEqual(cfg?.params, { confirmed: true }, 'require_dangerous_manage ⇒ 需 confirmed');
  assert.deepEqual(cfg?.headers, { 'x-idempotency-key': 'idem-1' }, '幂等键走请求头');
  assert.equal(cfg?.body, undefined, '幂等键不得塞进 body');

  assert.deepEqual(receipt, {
    operationId: 'op1',
    userId: 'u1',
    username: 'alice',
    replayed: false,
    deliveryStatus: 'pending',
    payloadExpiresAt: 1_760_000_000_000,
  });

  // 安全红线：回执不得出现任何明文字段
  for (const k of Object.keys(receipt)) {
    assert.ok(
      !/password|plaintext|secret|token/i.test(k),
      `回执不得含明文字段: ${k}`,
    );
  }

  // 不传幂等键 ⇒ 不带该头（交由后端按日派生）
  await manageApi.scheduleTelegramPasswordReset('u1');
  const [, c2] = post.mock.calls[1].arguments as [
    string,
    { headers?: Record<string, string> },
  ];
  assert.equal(c2?.headers, undefined, '未给幂等键 ⇒ 不发该头，由后端派生');

  post.mockRestore?.();
});
