/**
 * FE-PARITY-MICROSOFT wire 对拍。
 *
 * 后端真源：`crates/fmby-v2-http/src/routes/manage_microsoft.rs:47-112`（ENDPOINTS #1–#14）
 * DTO：`crates/fmby-v2-http/src/state/microsoft_accounts.rs`
 *
 * 两个必须钉死的 wire 事实：
 * ① **请求体 camelCase**（后端 `#[serde(rename="providerType", alias="provider_type")]`，
 *     canonical 是 camelCase）→ 若误发 snake_case 即 400。
 * ② **响应体 snake_case** → 必须映射成 camelCase 域模型。
 *
 * 确认闸：本路由文件 `require_confirmed` 出现 0 次 → 所有 URL 均**不带** confirmed=true。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { microsoftApi } from '@fmby/v2-shared/contracts/manage/microsoft';

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
  if (init?.body) {
    try {
      captured.body = JSON.parse(init.body);
    } catch {
      captured.body = init.body;
    }
  } else {
    captured.body = undefined;
  }
  const body = nextResponse.status === 204 ? null : JSON.stringify(nextResponse.json);
  return new Response(body, {
    status: nextResponse.status,
    headers: { 'content-type': 'application/json' },
  });
};

function setResponse(json: unknown, status = 200) {
  nextResponse = { status, json };
}

const RAW_ACCOUNT = {
  id: 'acc-1',
  auth_profile_id: 'prof-1',
  provider_type: 'global',
  tenant_id: 'tenant-1',
  drive_id: 'drive-1',
  service_kind: 'onedrive',
  oauth_client_kind: 'custom',
  note: '主账号',
  status: 'active',
  principal_id: 'p-1',
  user_principal_name: 'a@b.com',
  display_name: 'A B',
  last_used_at: '2026-01-01T00:00:00Z',
  last_success_at: '2026-01-01T00:00:00Z',
  last_error_at: null,
  last_error_message: null,
  throttled_until: null,
  consecutive_throttle_count: 0,
  created_at: '2025-12-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
};

test('① GET config-status — snake_case 响应映射为 camelCase', async () => {
  setResponse({
    items: [
      {
        provider_type: 'global',
        client_id_configured: true,
        client_secret_configured: false,
        redirect_uri: 'http://localhost/cb',
        client_id_source: 'secrets',
        token_key_status: 'ready',
      },
    ],
  });
  const items = await microsoftApi.getAppConfigStatus();
  assert.equal(captured.method, 'GET');
  assert.equal(captured.url, '/api/manage/microsoft/auth/config-status');
  assert.equal(items.length, 1);
  assert.deepEqual(items[0], {
    providerType: 'global',
    clientIdConfigured: true,
    clientSecretConfigured: false,
    redirectUri: 'http://localhost/cb',
    clientIdSource: 'secrets',
    tokenKeyStatus: 'ready',
  });
});

test('② GET profiles — 账号 20 字段全映射，无 undefined', async () => {
  setResponse({ items: [RAW_ACCOUNT] });
  const items = await microsoftApi.listAuthProfiles();
  assert.equal(captured.url, '/api/manage/microsoft/auth/profiles');
  const a = items[0];
  assert.equal(a.id, 'acc-1');
  assert.equal(a.authProfileId, 'prof-1');
  assert.equal(a.userPrincipalName, 'a@b.com');
  assert.equal(a.consecutiveThrottleCount, 0);
  assert.equal(a.lastErrorMessage, null);
  for (const [k, v] of Object.entries(a)) {
    assert.notEqual(v, undefined, `account.${k} 不得为 undefined`);
  }
});

test('③ POST start — 请求体必须 camelCase（serde canonical）', async () => {
  setResponse({
    authorization_id: 'auth-1',
    auth_profile_id: 'prof-1',
    provider_type: 'global',
    tenant_id: 'tenant-1',
    drive_id: 'drive-1',
    service_kind: 'onedrive',
    redirect_uri: 'http://localhost/cb',
    authorize_url: 'https://login.microsoftonline.com/x',
  });
  const r = await microsoftApi.startAuth({
    providerType: 'global',
    tenantId: 'tenant-1',
    driveId: 'drive-1',
    serviceKind: 'onedrive',
    oauthClient: { clientId: 'cid', clientSecret: 'sec', redirectUri: 'http://localhost/cb' },
    note: '备注',
  });
  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, '/api/manage/microsoft/auth/start');
  const body = captured.body as Record<string, unknown>;
  assert.equal(body.providerType, 'global');
  assert.equal(body.tenantId, 'tenant-1');
  assert.equal(body.driveId, 'drive-1');
  assert.equal(body.serviceKind, 'onedrive');
  assert.equal(body.note, '备注');
  // 嵌套 oauthClient 也必须 camelCase
  const oc = body.oauthClient as Record<string, unknown>;
  assert.equal(oc.clientId, 'cid');
  assert.equal(oc.clientSecret, 'sec');
  assert.equal(oc.redirectUri, 'http://localhost/cb');
  // 响应侧仍是 snake_case → 映射后为 camelCase
  assert.equal(r.authorizationId, 'auth-1');
  assert.equal(r.authorizeUrl, 'https://login.microsoftonline.com/x');
});

test('④ POST complete — callbackUrl 入参 camelCase，不带 confirmed', async () => {
  setResponse({
    authorization_id: 'auth-1',
    auth_profile_id: 'prof-1',
    provider_type: 'global',
    tenant_id: 'tenant-1',
    drive_id: 'drive-1',
    service_kind: 'onedrive',
    status: 'active',
    principal_id: 'p-1',
    user_principal_name: 'a@b.com',
    display_name: 'A B',
  });
  const r = await microsoftApi.completeAuth({
    authorizationId: 'auth-1',
    callbackUrl: 'http://localhost/cb?code=abc',
  });
  assert.equal(captured.url, '/api/manage/microsoft/auth/complete');
  assert.deepEqual(captured.body, {
    authorizationId: 'auth-1',
    callbackUrl: 'http://localhost/cb?code=abc',
  });
  assert.equal(r.status, 'active');
  assert.equal(r.displayName, 'A B');
});

test('⑤ POST token/start — camelCase 入参', async () => {
  setResponse({
    authorization_id: 'auth-2',
    provider_type: 'global',
    tenant_id: 'tenant-1',
    service_kind: 'sharepoint',
    redirect_uri: 'http://localhost/cb',
    authorize_url: 'https://login.microsoftonline.com/y',
    oauth_client_kind: 'builtin',
  });
  const r = await microsoftApi.startTokenAuth({
    providerType: 'global',
    serviceKind: 'sharepoint',
  });
  assert.equal(captured.url, '/api/manage/microsoft/auth/token/start');
  assert.deepEqual(captured.body, { providerType: 'global', serviceKind: 'sharepoint' });
  assert.equal(r.oauthClientKind, 'builtin');
});

test('⑥ POST token/complete — 令牌只进内存域模型（不落 localStorage/URL）', async () => {
  setResponse({
    authorization_id: 'auth-2',
    provider_type: 'global',
    tenant_id: 'tenant-1',
    service_kind: 'sharepoint',
    access_token: 'AT-SECRET',
    refresh_token: 'RT-SECRET',
    expires_at: '2026-01-02T00:00:00Z',
    principal_id: 'p-1',
    user_principal_name: 'a@b.com',
    display_name: 'A B',
    oauth_client_kind: 'builtin',
  });
  const r = await microsoftApi.completeTokenAuth({
    authorizationId: 'auth-2',
    callbackUrl: 'http://localhost/cb?code=xyz',
  });
  assert.equal(captured.url, '/api/manage/microsoft/auth/token/complete');
  assert.equal(r.accessToken, 'AT-SECRET');
  assert.equal(r.refreshToken, 'RT-SECRET');
  assert.equal(r.expiresAt, '2026-01-02T00:00:00Z');
  // ★安全断言：契约层不得把令牌写入任何持久化存储或 URL
  assert.equal(typeof localStorage, 'undefined');
  assert.equal(captured.url.includes('access_token'), false);
  assert.equal(captured.url.includes('AT-SECRET'), false);
});

test('⑦ POST token/drives — 可选令牌按 camelCase 发送，响应映射 quota', async () => {
  setResponse({
    items: [
      {
        id: 'd-1',
        name: '文档',
        drive_type: 'documentLibrary',
        web_url: 'http://x/d',
        quota: { total: 100, used: 40, remaining: 60 },
      },
      { id: 'd-2', name: null, drive_type: null, web_url: null, quota: null },
    ],
  });
  const items = await microsoftApi.listTokenDrives({
    providerType: 'global',
    accessToken: 'AT',
    siteId: 'site-1',
  });
  assert.equal(captured.url, '/api/manage/microsoft/auth/token/drives');
  const body = captured.body as Record<string, unknown>;
  assert.equal(body.providerType, 'global');
  assert.equal(body.accessToken, 'AT');
  assert.equal(body.siteId, 'site-1');
  assert.deepEqual(items[0].quota, { total: 100, used: 40, remaining: 60 });
  assert.equal(items[1].quota, null);
});

test('⑧ POST token/sites — q 必填且 camelCase', async () => {
  setResponse({ items: [{ id: 's-1', name: 'n', display_name: 'D', web_url: 'http://x' }] });
  const items = await microsoftApi.searchTokenSites({ providerType: 'global', q: 'team' });
  assert.equal(captured.url, '/api/manage/microsoft/auth/token/sites');
  assert.deepEqual(captured.body, { providerType: 'global', q: 'team' });
  assert.equal(items[0].displayName, 'D');
});

test('⑨ POST token/import — driveId 必填，返回账号 DTO', async () => {
  setResponse(RAW_ACCOUNT);
  const a = await microsoftApi.importTokenAccount({
    providerType: 'global',
    serviceKind: 'onedrive',
    driveId: 'drive-1',
    accessToken: 'AT',
  });
  assert.equal(captured.url, '/api/manage/microsoft/auth/token/import');
  const body = captured.body as Record<string, unknown>;
  assert.equal(body.driveId, 'drive-1');
  assert.equal(body.accessToken, 'AT');
  assert.equal(body.providerType, 'global');
  assert.equal(a.id, 'acc-1');
});

test('⑩ enable / disable / recover — URL 正确且不带 confirmed', async () => {
  setResponse(RAW_ACCOUNT);
  await microsoftApi.enableAccount('acc-1');
  assert.equal(captured.url, '/api/manage/microsoft/auth/accounts/acc-1/enable');
  await microsoftApi.disableAccount('acc-1');
  assert.equal(captured.url, '/api/manage/microsoft/auth/accounts/acc-1/disable');
  await microsoftApi.recoverAccount('acc-1');
  assert.equal(captured.url, '/api/manage/microsoft/auth/accounts/acc-1/recover');
  for (const u of [captured.url]) {
    assert.equal(u.includes('confirmed'), false);
  }
});

test('⑪ note — body 仅 note 字段', async () => {
  setResponse(RAW_ACCOUNT);
  await microsoftApi.updateAccountNote('acc-1', '新备注');
  assert.equal(captured.url, '/api/manage/microsoft/auth/accounts/acc-1/note');
  assert.deepEqual(captured.body, { note: '新备注' });
});

test('⑫ DELETE accounts/{id} — 不带 confirmed（后端已去闸），返回 ok/message', async () => {
  setResponse({ ok: true, message: 'deleted' });
  const r = await microsoftApi.deleteAccount('acc-1');
  assert.equal(captured.method, 'DELETE');
  assert.equal(captured.url, '/api/manage/microsoft/auth/accounts/acc-1');
  assert.equal(captured.url.includes('confirmed'), false);
  assert.deepEqual(r, { ok: true, message: 'deleted' });
});

test('⑬ fail-closed：403 缺 DANGEROUS_ACTION 必须抛出，不吞成 ok', async () => {
  setResponse({ code: 'forbidden', message: 'missing capability dangerous:action' }, 403);
  await assert.rejects(() => microsoftApi.deleteAccount('acc-1'));
});

test('⑭ fail-closed：500 端口未装配必须抛出（config-status 不伪造空列表）', async () => {
  setResponse({ code: 'internal', message: 'microsoft port not assembled' }, 500);
  await assert.rejects(() => microsoftApi.getAppConfigStatus());
});
