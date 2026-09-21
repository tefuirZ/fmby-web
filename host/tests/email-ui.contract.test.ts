// EMAIL-WEB-UI 契约对拍测试（① ② ③ ③a ④ ⑤）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 覆盖：
// - 邮件通道 GET/PUT 的 wire 路径/方法/body（password 只写、留空省略、空串归一 null）
// - 测试邮件 ② 失败 fail-closed（rejects，绝不伪造 sent:true）
// - 密码重置 start/complete 的 A 形态/B 形态 wire
// - ③ 防枚举：交付文案恒定 + 后续 UI 只由 delivery 决定
// - ④ 重置页固定路由 hash 解析
// - ⑤ 品牌 PUT 原样回传主题/时区（后端必填字段坑）+ 品牌字段语义 + 校验

import test from 'node:test';
import assert from 'node:assert/strict';

// httpClient.buildUrl 需要 window.location.origin；document 由 httpClient 自身守卫。
(globalThis as { window?: unknown }).window = { location: { origin: 'http://localhost:5173' } };

interface Captured {
  method: string;
  url: string;
  body: unknown;
}

const captured: Captured[] = [];
let nextResponse: { status: number; json: unknown } = { status: 200, json: {} };

(globalThis as { fetch?: unknown }).fetch = async (input: unknown, init: Record<string, unknown> = {}) => {
  const url = typeof input === 'string' ? input : String((input as { url?: string })?.url ?? input);
  const method = String(init.method ?? 'GET').toUpperCase();
  let body: unknown;
  if (typeof init.body === 'string') {
    try {
      body = JSON.parse(init.body);
    } catch {
      body = init.body;
    }
  }
  captured.push({ method, url, body });
  const { status, json } = nextResponse;
  const resBody = status === 204 ? null : JSON.stringify(json);
  return new Response(resBody, {
    status,
    headers: status === 204 ? undefined : { 'content-type': 'application/json' },
  });
};

function reset(next: { status: number; json: unknown }): void {
  captured.length = 0;
  nextResponse = next;
}

const pathOf = (url: string): string => new URL(url).pathname;
const lastCall = (): Captured => captured[captured.length - 1]!;

const RAW_EMAIL = {
  configured: true,
  secret_fields_configured: ['password'],
  host: 'smtp.example.com',
  port: 587,
  security: 'starttls',
  username: null,
  from_address: 'no-reply@example.com',
  reset_delivery: 'code',
  code_len: 6,
  code_ttl_minutes: 10,
  link_ttl_minutes: 15,
  html_template: null,
};

import {
  emailChannelApi,
  buildEmailChannelPutBody,
  mapEmailChannelToDraft,
  siteSettingsApi,
} from '@fmby/v2-shared/contracts/settings';
import {
  authApi,
  passwordResetStartSchema,
  passwordResetCodeSchema,
  PASSWORD_RESET_START_CONFIRM_MESSAGE,
} from '@fmby/v2-shared/contracts/auth';
import { parsePasswordResetHash, PASSWORD_RESET_HASH } from '../src/pages/login/resetHash.ts';
import { resetAfterSubmitView } from '../src/pages/login/passwordResetFlow.ts';
import {
  validateBrandDraft,
  isSameOriginPathOrHttpUrl,
  BRAND_SITE_NAME_MAX,
  BRAND_LOGO_URL_MAX,
} from '../src/pages/manage/site-settings/brandValidation.ts';

/* ---------------- ① 邮件通道配置 ---------------- */

test('① GET /api/settings/server/email：路径/方法正确，回显映射为 camelCase', async () => {
  reset({ status: 200, json: RAW_EMAIL });
  const res = await emailChannelApi.getEmailChannel();
  assert.equal(lastCall().method, 'GET');
  assert.equal(pathOf(lastCall().url), '/api/settings/server/email');
  assert.equal(res.port, 587);
  assert.equal(res.security, 'starttls');
  assert.equal(res.fromAddress, 'no-reply@example.com');
  assert.deepEqual(res.secretFieldsConfigured, ['password']);
});

test('① PUT body：password 留空则省略字段；username/html_template 空串归一 null', () => {
  const body = buildEmailChannelPutBody({
    host: 'h',
    port: 587,
    security: 'starttls',
    username: '',
    password: '',
    fromAddress: 'a@b.c',
    resetDelivery: 'code',
    codeLen: 6,
    codeTtlMinutes: 10,
    linkTtlMinutes: 15,
    htmlTemplate: '',
  });
  assert.equal('password' in body, false, '留空密码必须省略，避免覆盖已存凭据');
  assert.equal(body.username, null);
  assert.equal(body.html_template, null);
  assert.equal(body.from_address, 'a@b.c');
});

test('① PUT body：password 提供时写入字段', () => {
  const body = buildEmailChannelPutBody({
    host: 'h',
    port: 465,
    security: 'tls',
    username: 'user',
    password: 's3cret',
    fromAddress: 'a@b.c',
    resetDelivery: 'link',
    codeLen: 6,
    codeTtlMinutes: 10,
    linkTtlMinutes: 15,
    htmlTemplate: '<b>{{code}}</b>',
  });
  assert.equal(body.password, 's3cret');
  assert.equal(body.username, 'user');
  assert.equal(body.html_template, '<b>{{code}}</b>');
});

test('① GET 回显 → 草稿：password 只写重置为空、缺省补默认值', () => {
  const draft = mapEmailChannelToDraft({
    configured: false,
    secretFieldsConfigured: [],
    host: '',
    port: 587,
    security: 'starttls',
    username: null,
    fromAddress: '',
    resetDelivery: 'code',
    codeLen: 6,
    codeTtlMinutes: 10,
    linkTtlMinutes: 15,
    htmlTemplate: null,
  });
  assert.equal(draft.password, '');
  assert.equal(draft.username, '');
  assert.equal(draft.htmlTemplate, '');
});

test('① PUT /api/settings/server/email：路径/方法正确', async () => {
  reset({ status: 200, json: RAW_EMAIL });
  await emailChannelApi.putEmailChannel(mapEmailChannelToDraft({
    configured: true,
    secretFieldsConfigured: ['password'],
    host: 'smtp.example.com',
    port: 587,
    security: 'starttls',
    username: null,
    fromAddress: 'no-reply@example.com',
    resetDelivery: 'code',
    codeLen: 6,
    codeTtlMinutes: 10,
    linkTtlMinutes: 15,
    htmlTemplate: null,
  }));
  assert.equal(lastCall().method, 'PUT');
  assert.equal(pathOf(lastCall().url), '/api/settings/server/email');
});

/* ---------------- ② 发送测试邮件 ---------------- */

test('② testEmail：缺省自寄（body 无 to）；成功回传后端 to', async () => {
  reset({ status: 200, json: { sent: true, to: 'no-reply@example.com' } });
  const res = await emailChannelApi.testEmail();
  assert.equal(lastCall().method, 'POST');
  assert.equal(pathOf(lastCall().url), '/api/settings/server/email/test');
  assert.deepEqual(lastCall().body, {});
  assert.deepEqual(res, { sent: true, to: 'no-reply@example.com' });
});

test('② testEmail：显式收件人 trim 后作为 to 发送', async () => {
  reset({ status: 200, json: { sent: true, to: 'me@x.y' } });
  await emailChannelApi.testEmail('  me@x.y  ');
  assert.deepEqual(lastCall().body, { to: 'me@x.y' });
});

test('② testEmail 失败（500）必须 reject，绝不伪造「已发送」', async () => {
  reset({ status: 500, json: { error_code: 'internal', message: '邮件通道未装配', retryable: true } });
  await assert.rejects(() => emailChannelApi.testEmail());
});

/* ---------------- ③ / ③a 密码重置 ---------------- */

test('③ startPasswordReset：POST 路径 + body(email, session_id)', async () => {
  reset({ status: 200, json: { accepted: true, delivery: 'code', challenge: 'sess-1', expires_at_ms: 123 } });
  const res = await authApi.startPasswordReset({ email: 'a@b.c', session_id: 'sess-1' });
  assert.equal(lastCall().method, 'POST');
  assert.equal(pathOf(lastCall().url), '/api/auth/password-reset/start');
  assert.deepEqual(lastCall().body, { email: 'a@b.c', session_id: 'sess-1' });
  assert.equal(res.accepted, true);
  assert.equal(res.delivery, 'code');
});

test('③ startPasswordReset：无 session_id 时不带该字段', async () => {
  reset({ status: 200, json: { accepted: true, delivery: 'link' } });
  await authApi.startPasswordReset({ email: 'a@b.c' });
  assert.deepEqual(lastCall().body, { email: 'a@b.c' });
});

test('③a completePasswordReset（A 形态）：body(session_id,email,code,new_password)，204 成功', async () => {
  reset({ status: 204, json: null });
  await authApi.completePasswordReset({
    session_id: 'sess-1',
    email: 'a@b.c',
    code: '123456',
    new_password: 'longenough1',
  });
  assert.equal(pathOf(lastCall().url), '/api/auth/password-reset/complete');
  assert.deepEqual(lastCall().body, {
    session_id: 'sess-1',
    email: 'a@b.c',
    code: '123456',
    new_password: 'longenough1',
  });
});

test('④ completePasswordReset（B 形态）：body(ticket,new_password)', async () => {
  reset({ status: 204, json: null });
  await authApi.completePasswordReset({ ticket: 'tk-1', new_password: 'longenough1' });
  assert.deepEqual(lastCall().body, { ticket: 'tk-1', new_password: 'longenough1' });
});

test('③ 防枚举：确认文案为固定常量；后续 UI 仅由 delivery 决定', () => {
  assert.equal(typeof PASSWORD_RESET_START_CONFIRM_MESSAGE, 'string');
  assert.ok(PASSWORD_RESET_START_CONFIRM_MESSAGE.length > 0);
  // 该函数签名只接收 delivery——不存在按邮箱存在性分支的输入。
  assert.equal(resetAfterSubmitView('code'), 'code-form');
  assert.equal(resetAfterSubmitView('link'), 'link-notice');
  assert.equal(resetAfterSubmitView('password'), 'password-notice');
});

test('③a schema：验证码数字、新密码 ≥8', () => {
  assert.equal(passwordResetCodeSchema.safeParse({ code: '123456', newPassword: '12345678' }).success, true);
  assert.equal(passwordResetCodeSchema.safeParse({ code: '12', newPassword: '12345678' }).success, false);
  assert.equal(passwordResetCodeSchema.safeParse({ code: 'abcdef', newPassword: '12345678' }).success, false);
  assert.equal(passwordResetCodeSchema.safeParse({ code: '123456', newPassword: 'short' }).success, false);
});

test('③ start schema：邮箱非空且合法', () => {
  assert.equal(passwordResetStartSchema.safeParse({ email: '' }).success, false);
  assert.equal(passwordResetStartSchema.safeParse({ email: 'not-an-email' }).success, false);
  assert.equal(passwordResetStartSchema.safeParse({ email: 'user@example.com' }).success, true);
});

/* ---------------- ④ 链接重置固定路由 ---------------- */

test('④ 重置路由固定 #password-reset，仅解析其中的 ticket', () => {
  assert.equal(PASSWORD_RESET_HASH, '#password-reset');
  assert.equal(parsePasswordResetHash('#password-reset?ticket=abc'), 'abc');
  assert.equal(parsePasswordResetHash('#password-reset'), null);
  assert.equal(parsePasswordResetHash('#password-reset?foo=1'), null);
  assert.equal(parsePasswordResetHash('#other?ticket=abc'), null);
  assert.equal(parsePasswordResetHash(''), null);
});

/* ---------------- ⑤ 品牌 ---------------- */

test('⑤ GET /api/admin/site-settings：品牌缺失回退 null', async () => {
  reset({ status: 200, json: { theme_mode: 'dark', timezone_display: 'Asia/Shanghai' } });
  const res = await siteSettingsApi.getBrand();
  assert.equal(lastCall().method, 'GET');
  assert.equal(pathOf(lastCall().url), '/api/admin/site-settings');
  assert.equal(res.themeMode, 'dark');
  assert.equal(res.timezoneDisplay, 'Asia/Shanghai');
  assert.equal(res.siteName, null);
  assert.equal(res.brandLogoUrl, null);
});

test('⑤ PUT /api/admin/site-settings：必填 theme_mode/timezone_display 原样回传 + 品牌两字段', async () => {
  reset({
    status: 200,
    json: { theme_mode: 'dark', timezone_display: 'Asia/Shanghai', site_name: 'X', brand_logo_url: '/logo.svg' },
  });
  await siteSettingsApi.putBrand({
    themeMode: 'dark',
    timezoneDisplay: 'Asia/Shanghai',
    siteName: 'X',
    brandLogoUrl: '/logo.svg',
  });
  assert.equal(lastCall().method, 'PUT');
  assert.equal(pathOf(lastCall().url), '/api/admin/site-settings');
  assert.deepEqual(lastCall().body, {
    theme_mode: 'dark',
    timezone_display: 'Asia/Shanghai',
    site_name: 'X',
    brand_logo_url: '/logo.svg',
  });
});

test('⑤ 品牌校验：超长、非法 scheme、协议相对外链', () => {
  assert.equal(validateBrandDraft({ siteName: 'a'.repeat(BRAND_SITE_NAME_MAX), brandLogoUrl: '' }), null);
  assert.ok(validateBrandDraft({ siteName: 'a'.repeat(BRAND_SITE_NAME_MAX + 1), brandLogoUrl: '' }));
  assert.ok(validateBrandDraft({ siteName: '', brandLogoUrl: 'javascript:alert(1)' }));
  assert.ok(validateBrandDraft({ siteName: '', brandLogoUrl: 'data:image/png;base64,AAAA' }));
  assert.ok(validateBrandDraft({ siteName: '', brandLogoUrl: '//evil.example.com/x.png' }));
  assert.ok(validateBrandDraft({ siteName: '', brandLogoUrl: 'x'.repeat(BRAND_LOGO_URL_MAX + 1) }));
});

test('⑤ 品牌校验：空串=清除合法；同源路径/http(s) 合法', () => {
  assert.equal(isSameOriginPathOrHttpUrl(''), true);
  assert.equal(isSameOriginPathOrHttpUrl('/logo.svg'), true);
  assert.equal(isSameOriginPathOrHttpUrl('https://cdn.example.com/logo.svg'), true);
  assert.equal(isSameOriginPathOrHttpUrl('http://cdn.example.com/logo.svg'), true);
  assert.equal(isSameOriginPathOrHttpUrl('//evil.example.com/logo.svg'), false);
  assert.equal(isSameOriginPathOrHttpUrl('javascript:alert(1)'), false);
  assert.equal(validateBrandDraft({ siteName: '', brandLogoUrl: '' }), null);
});
