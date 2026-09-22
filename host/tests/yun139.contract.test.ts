/**
 * FE-PARITY-YUN139 wire 对拍（扫码绑定 + 凭据档案）。
 *
 * 真源：`crates/fmby-v2-http/src/routes/yun139_accounts.rs:35/36/37/41/45/49`
 *      `crates/fmby-v2-http/src/state/yun139_accounts.rs`
 * 能力门：全部 MANAGE_MOUNT；`require_confirmed` 与 `DANGEROUS_ACTION` **均 0 次**
 *   → 所有 URL **不带** confirmed=true。
 *
 * ★与 pan115 的关键差异（易写反）：
 *   139 的 qr-status query 是 **snake_case `session_id`**（后端只 q.get("session_id")），
 *   pan115 是 camelCase `sessionId`。本测试钉死 139 这一侧。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { yun139Api } from '@fmby/v2-shared/contracts/manage/yun139';

const captured: { method?: string; url?: string; body?: unknown } = {};
let nextResponse = { status: 200, json: {} as unknown };

(globalThis as unknown as { window: unknown }).window = {
  location: { origin: 'http://localhost:5173' },
};
(globalThis as unknown as { fetch: unknown }).fetch = async (
  url: string,
  init?: { method?: string; body?: string },
) => {
  captured.method = init?.method ?? 'GET';
  captured.url = url.replace('http://localhost:5173', '');
  captured.body = init?.body ? JSON.parse(init.body) : undefined;
  const body = nextResponse.status === 204 ? null : JSON.stringify(nextResponse.json);
  return new Response(body, {
    status: nextResponse.status,
    headers: { 'content-type': 'application/json' },
  });
};

function setResponse(json: unknown, status = 200) {
  nextResponse = { status, json };
}

const RAW_PROFILE = {
  id: 'p-1',
  display_name: '主账号 139',
  account_identity_mask: '138****8000',
  status: 'active',
  can_refresh: true,
  authorization_expires_at: 1800000000000,
  last_success_at: 1700000000000,
  last_error_at: null,
  last_error_kind: null,
  last_error_message: null,
  created_at: 1600000000000,
  updated_at: 1700000000001,
};

test('① POST qr-login — 响应 snake→camel 映射', async () => {
  setResponse({
    session_id: 'sess-1',
    device_id: 'dev-1',
    qr_url: 'https://qr.example/139',
    qr_image: 'data:image/svg+xml;base64,AAAA',
  });
  const r = await yun139Api.qrLogin();
  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, '/api/manage/yun139/qr-login');
  assert.equal(r.sessionId, 'sess-1');
  assert.equal(r.deviceId, 'dev-1');
  assert.equal(r.qrUrl, 'https://qr.example/139');
  assert.equal(r.qrImage, 'data:image/svg+xml;base64,AAAA');
});

test('①b qr_image 取图失败为 null → 如实透传，不伪造占位图', async () => {
  setResponse({ session_id: 's', device_id: 'd', qr_url: 'u', qr_image: null });
  const r = await yun139Api.qrLogin();
  assert.equal(r.qrImage, null);
});

test('② GET qr-status — query 必须是 snake_case session_id（139 与 pan115 相反）', async () => {
  setResponse({ status: 'pending' });
  const r = await yun139Api.qrStatus('sess-1');
  assert.equal(captured.method, 'GET');
  assert.equal(captured.url, '/api/manage/yun139/qr-status?session_id=sess-1');
  assert.equal(captured.url.includes('sessionId'), false);
  assert.equal(r.status, 'pending');
});

test('②b 状态词原样透传（confirmed / expired / scanned 不本地改词）', async () => {
  for (const s of ['scanned', 'confirmed', 'expired']) {
    setResponse({ status: s });
    assert.equal((await yun139Api.qrStatus('x')).status, s);
  }
});

test('③ GET credential-profiles — 12 字段全映射，无 undefined', async () => {
  setResponse({ items: [RAW_PROFILE] });
  const items = await yun139Api.listCredentialProfiles();
  assert.equal(captured.url, '/api/manage/yun139/credential-profiles');
  const p = items[0];
  assert.equal(p.id, 'p-1');
  assert.equal(p.displayName, '主账号 139');
  assert.equal(p.accountIdentityMask, '138****8000');
  assert.equal(p.canRefresh, true);
  assert.equal(p.authorizationExpiresAt, 1800000000000);
  assert.equal(p.lastErrorKind, null);
  for (const [k, v] of Object.entries(p)) {
    assert.notEqual(v, undefined, `profile.${k} 不得为 undefined`);
  }
});

test('④ POST credential-profiles — 三种来源入参均 snake_case', async () => {
  setResponse({ profile: RAW_PROFILE });
  const p = await yun139Api.createCredentialProfile({
    displayName: '主账号 139',
    qrSessionId: 'sess-1',
    cookie: 'UID=1; CID=2',
  });
  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, '/api/manage/yun139/credential-profiles');
  // ★ undefined 键被 JSON.stringify 丢弃 → 实际 body 只含填了的字段
  assert.deepEqual(captured.body, {
    display_name: '主账号 139',
    qr_session_id: 'sess-1',
    cookie: 'UID=1; CID=2',
  });
  assert.equal(p.id, 'p-1');
});

test('⑤ POST reauthorize — URL 与 body 正确，不带 confirmed', async () => {
  setResponse({ profile: { ...RAW_PROFILE, authorization_expires_at: 1900000000000 } });
  const p = await yun139Api.reauthorizeCredentialProfile('p-1', { qrSessionId: 'sess-2' });
  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, '/api/manage/yun139/credential-profiles/p-1/reauthorize');
  assert.equal(captured.url.includes('confirmed'), false);
  assert.deepEqual(captured.body, { qr_session_id: 'sess-2' });
  assert.equal(p.authorizationExpiresAt, 1900000000000);
});

test('⑥ DELETE credential-profiles/{id} — 不带 confirmed（后端已去闸）', async () => {
  setResponse({ ok: true });
  const r = await yun139Api.deleteCredentialProfile('p-1');
  assert.equal(captured.method, 'DELETE');
  assert.equal(captured.url, '/api/manage/yun139/credential-profiles/p-1');
  assert.equal(captured.url.includes('confirmed'), false);
  assert.deepEqual(r, { ok: true });
});

test('⑦ fail-closed：403 缺 MANAGE_MOUNT 必须抛出，不吞成空列表', async () => {
  setResponse({ code: 'forbidden', message: 'missing capability manage:mount' }, 403);
  await assert.rejects(() => yun139Api.listCredentialProfiles());
  await assert.rejects(() => yun139Api.deleteCredentialProfile('p-1'));
});

test('⑧ fail-closed：500 端口未装配必须抛出（不假装凭据正常）', async () => {
  setResponse({ code: 'internal', message: 'yun139 port not assembled' }, 500);
  await assert.rejects(() => yun139Api.qrLogin());
  await assert.rejects(() => yun139Api.listCredentialProfiles());
});

test('⑨ qr-status 空 session_id → 后端校验失败，前端不得自行补默认会话', async () => {
  setResponse({ code: 'invalid_argument', message: 'session_id 不能为空' }, 400);
  await assert.rejects(() => yun139Api.qrStatus(''));
});
