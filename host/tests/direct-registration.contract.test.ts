// FE-GAP-NEXT-1：直连注册窗口管理端契约对拍（RED → GREEN）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 后端 wire 取证（REGISTRATION-WINDOW-ADMIN-API，origin/main ref）：
//   GET/PUT /api/manage/users/direct-registration/settings（manage_registration_window.rs:30/47）
//   DTO DirectRegistrationSettingsDto（contracts/dto_registration.rs）：
//     { enabled, start_at?, end_at?, max_users?, default_role_template? }（serde(default)+deny_unknown_fields）
//   门 = MANAGE_ACCESS；PUT 全量替换，返回落库后真值；未持久化 ⇒ 诚实缺省（关闭）；
//   校验复用注册侧 validate_direct_registration_settings（非法 ⇒ Validation，不吞）。
// 前端全仓零调用（origin/main ref：shared/src + host/src 对 direct-registration/directRegistration 0 命中）。

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
  return new Response(JSON.stringify(json), {
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

const { manageApi } = await import('@fmby/v2-shared/contracts/manage');

const RAW_DTO = {
  enabled: true,
  start_at: 1_790_000_000_000,
  end_at: 1_790_100_000_000,
  max_users: 100,
  default_role_template: 'Member',
};

test('① GET：路径 + 方法（管理面，session+MANAGE_ACCESS）', async () => {
  reset({ status: 200, json: RAW_DTO });
  await manageApi.getDirectRegistrationSettings();
  assert.equal(lastCall().method, 'GET');
  assert.equal(pathOf(lastCall().url), '/api/manage/users/direct-registration/settings');
});

test('② GET：snake→camel 映射（未配置字段 null 不回落假值）', async () => {
  reset({ status: 200, json: RAW_DTO });
  const dto = await manageApi.getDirectRegistrationSettings();
  assert.equal(dto.enabled, true);
  assert.equal(dto.startAt, 1_790_000_000_000);
  assert.equal(dto.endAt, 1_790_100_000_000);
  assert.equal(dto.maxUsers, 100);
  assert.equal(dto.defaultRoleTemplate, 'Member');
});

test('③ 未配置（全空）→ 诚实缺省：enabled=false，时间/名额 null', async () => {
  reset({
    status: 200,
    json: { enabled: false, start_at: null, end_at: null, max_users: null, default_role_template: null },
  });
  const dto = await manageApi.getDirectRegistrationSettings();
  assert.equal(dto.enabled, false);
  assert.equal(dto.startAt, null);
  assert.equal(dto.maxUsers, null);
});

test('④ PUT：全量替换体（snake wire 字段）+ 返回落库后真值', async () => {
  reset({ status: 200, json: RAW_DTO });
  const saved = await manageApi.putDirectRegistrationSettings({
    enabled: true,
    startAt: 1_790_000_000_000,
    endAt: 1_790_100_000_000,
    maxUsers: 100,
    defaultRoleTemplate: 'Member',
  });
  assert.equal(lastCall().method, 'PUT');
  assert.equal(pathOf(lastCall().url), '/api/manage/users/direct-registration/settings');
  const body = lastCall().body as Record<string, unknown>;
  assert.equal(body.enabled, true);
  assert.equal(body.start_at, 1_790_000_000_000);
  assert.equal(body.max_users, 100);
  assert.equal(body.default_role_template, 'Member');
  assert.equal(saved.enabled, true);
});

test('⑤ PUT：显式清空 = enabled:false + 全 null（「未配置 ≡ 关闭」语义）', async () => {
  reset({
    status: 200,
    json: { enabled: false, start_at: null, end_at: null, max_users: null, default_role_template: null },
  });
  const saved = await manageApi.putDirectRegistrationSettings({
    enabled: false,
    startAt: null,
    endAt: null,
    maxUsers: null,
    defaultRoleTemplate: null,
  });
  const body = lastCall().body as Record<string, unknown>;
  assert.equal(body.enabled, false);
  assert.equal(body.start_at, null);
  assert.equal(saved.enabled, false);
});

test('⑥ 校验失败 Validation 400 透传（不吞后端拒绝原因）', async () => {
  reset({ status: 400, json: { error_code: 'validation', message: 'end_at 必须晚于 start_at' } });
  await assert.rejects(() =>
    manageApi.putDirectRegistrationSettings({
      enabled: true,
      startAt: 1_790_100_000_000,
      endAt: 1_790_000_000_000,
      maxUsers: 100,
      defaultRoleTemplate: 'Member',
    }),
  );
});
