// FE-MFA-TOTP-UI：MFA/TOTP 契约对拍（RED → GREEN）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 后端取证（crates/fmby-v2-http/src/routes/auth_mfa.rs + router_core.rs）：
//   GET    /api/auth/mfa/totp                  → {enabled,pending_confirmation,recovery_codes_remaining}
//   POST   /api/auth/mfa/totp                  → {secret,otpauth_url,qr_image_data_url?}（enroll）
//   POST   /api/auth/mfa/totp/confirm          → {enabled,pending_confirmation,recovery_codes_remaining,recovery_codes[]}
//                                            （★恢复码一次性明文回显，仅此响应；不落 localStorage/URL）
//   POST   /api/auth/mfa/totp/recovery-codes   → 同上（再生成）
//   DELETE /api/auth/mfa/totp                  → {ok}
//   POST   /api/auth/mfa/totp/verify           → {user_id,verified}（匿名 challenge）
//   登录 POST /api/auth/login：mfa_required ⇒ {status:"mfa_required",challenge_id,expires_at}（不建会话）
// 前端此前零消费，且 login 把 mfa_required 误当成功（user 兜底伪造）——本卡一并修。

import test from 'node:test';
import assert from 'node:assert/strict';

(globalThis as { window?: unknown }).window = { location: { origin: 'http://localhost:5173' } };

const captured: Array<{ method: string; url: string; body: unknown }> = [];
let nextResponse: { status: number; json: unknown } = { status: 200, json: {} };

(globalThis as { fetch?: unknown }).fetch = async (input: unknown, init: Record<string, unknown> = {}) => {
  const url = typeof input === 'string' ? input : String((input as { url?: string })?.url ?? input);
  const method = String(init.method ?? 'GET').toUpperCase();
  let body: unknown;
  if (typeof init.body === 'string') {
    try { body = JSON.parse(init.body); } catch { body = init.body; }
  }
  captured.push({ method, url, body });
  const { status, json } = nextResponse;
  return new Response(status === 204 ? null : JSON.stringify(json), {
    status,
    headers: status === 204 ? undefined : { 'content-type': 'application/json' },
  });
};

function reset(next: { status: number; json: unknown }): void {
  captured.length = 0;
  nextResponse = next;
}
const lastCall = (): { method: string; url: string; body: unknown } => captured[captured.length - 1]!;
const pathOf = (u: string): string => new URL(u).pathname;

const { mfaApi } = await import('@fmby/v2-shared/contracts/auth/mfa');

test('① 状态：GET /api/auth/mfa/totp → camel 映射', async () => {
  reset({ status: 200, json: { enabled: true, pending_confirmation: false, recovery_codes_remaining: 8 } });
  const s = await mfaApi.status();
  assert.equal(pathOf(lastCall().url), '/api/auth/mfa/totp');
  assert.deepEqual(s, { enabled: true, pendingConfirmation: false, recoveryCodesRemaining: 8 });
});

test('② 绑定：POST /api/auth/mfa/totp（空体）→ secret/otpauth_url/qr', async () => {
  reset({ status: 200, json: { secret: 'ABC', otpauth_url: 'otpauth://x', qr_image_data_url: 'data:image/png;base64,zz' } });
  const e = await mfaApi.enroll();
  assert.equal(lastCall().method, 'POST');
  assert.equal(e.secret, 'ABC');
  assert.equal(e.otpauthUrl, 'otpauth://x');
  assert.equal(e.qrImageDataUrl, 'data:image/png;base64,zz');
});

test('③ 确认：POST /confirm 带 code → 恢复码数组一次性回显', async () => {
  reset({ status: 200, json: { enabled: true, pending_confirmation: false, recovery_codes_remaining: 8, recovery_codes: ['rc-1', 'rc-2'] } });
  const r = await mfaApi.confirm({ code: '123456' });
  assert.equal(pathOf(lastCall().url), '/api/auth/mfa/totp/confirm');
  assert.deepEqual((lastCall().body as { code: string }).code, '123456');
  assert.deepEqual(r.recoveryCodes, ['rc-1', 'rc-2']);
});

test('④ 恢复码再生成：POST /recovery-codes', async () => {
  reset({ status: 200, json: { enabled: true, pending_confirmation: false, recovery_codes_remaining: 8, recovery_codes: ['n-1'] } });
  const r = await mfaApi.regenerateRecoveryCodes();
  assert.equal(pathOf(lastCall().url), '/api/auth/mfa/totp/recovery-codes');
  assert.deepEqual(r.recoveryCodes, ['n-1']);
});

test('⑤ 停用：DELETE /api/auth/mfa/totp 带 current_password', async () => {
  reset({ status: 200, json: { ok: true } });
  const r = await mfaApi.disable({ currentPassword: 'pw' });
  assert.equal(lastCall().method, 'DELETE');
  assert.deepEqual((lastCall().body as { current_password: string }).current_password, 'pw');
  assert.equal(r.ok, true);
});

test('⑥ 登录验证：POST /verify 带 challenge_id+code → {userId,verified}', async () => {
  reset({ status: 200, json: { user_id: 7, verified: true } });
  const r = await mfaApi.verify({ challengeId: 'ch-1', code: '123456' });
  assert.equal(pathOf(lastCall().url), '/api/auth/mfa/totp/verify');
  assert.deepEqual((lastCall().body as Record<string, string>), { challenge_id: 'ch-1', code: '123456' });
  assert.deepEqual(r, { userId: 7, verified: true });
});

test('⑦ login mfa_required 不再伪造用户（返回 status=+challenge_id，不发 /auth/me）', async () => {
  const { authApi } = await import('@fmby/v2-shared/contracts/auth');
  captured.length = 0;
  reset({ status: 200, json: { status: 'mfa_required', challenge_id: 'ch-9', expires_at: 123 } });
  const res = await authApi.login({ username: 'u', password: 'p' });
  assert.equal(res.status, 'mfa_required');
  assert.equal(res.challengeId, 'ch-9');
  assert.equal(res.user, undefined, 'mfa_required 时绝不可伪造 user');
  assert.ok(!captured.some((c) => c.url.includes('/auth/me')), '未建会话不得拉 capabilities');
});
