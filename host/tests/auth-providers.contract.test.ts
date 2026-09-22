/**
 * FE-PARITY-AUTH-PROVIDERS wire 对拍。
 *
 * 真源：`crates/fmby-v2-http/src/routes/manage_auth_providers.rs:98/109/124`
 *      `crates/fmby-v2-application/src/auth/auth_provider_config.rs`（+ diagnostics.rs）
 * 能力门：三条均 MANAGE_SETTINGS；文件内 `require_confirmed` **0 次** → URL 不带 confirmed。
 *
 * ★wire 三套 casing（最易写反，逐条钉死）：
 * - 写入 body：camelCase canonical（allowLogin / publicConfig / secretConfig …）
 * - 读取响应：snake_case（allow_login / secret_fields_configured …）
 * - 枚举：snake_case（validate_config / send_test_email …）
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authProvidersApi } from '@fmby/v2-shared/contracts/manage/authProviders';

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

const RAW_VIEW = {
  items: [
    {
      provider: 'google',
      display_name: 'Google',
      enabled: true,
      configured: true,
      allow_login: true,
      allow_binding: false,
      allow_password_reset: true,
      public_config: { client_id: 'cid' },
      secret_fields_configured: ['client_secret'],
      updated_at: '2026-01-01T00:00:00Z',
    },
  ],
};

test('① GET /api/manage/auth-providers — snake_case 响应映射为 camelCase', async () => {
  setResponse(RAW_VIEW);
  const view = await authProvidersApi.listConfigs();
  assert.equal(captured.method, 'GET');
  assert.equal(captured.url, '/api/manage/auth-providers');
  const item = view.items[0];
  assert.equal(item.provider, 'google');
  assert.equal(item.displayName, 'Google');
  assert.equal(item.allowLogin, true);
  assert.equal(item.allowBinding, false);
  assert.equal(item.allowPasswordReset, true);
  assert.deepEqual(item.publicConfig, { client_id: 'cid' });
  assert.deepEqual(item.secretFieldsConfigured, ['client_secret']);
  assert.equal(item.updatedAt, '2026-01-01T00:00:00Z');
  // ★密钥只报字段名单，不得出现任何值字段
  assert.equal('secretConfig' in item, false);
  assert.equal('clientSecret' in item, false);
});

test('② PUT — 写入必须是 camelCase canonical（不是 snake_case）', async () => {
  setResponse(RAW_VIEW);
  await authProvidersApi.replaceConfigs([
    {
      provider: 'google',
      enabled: true,
      allowLogin: true,
      allowBinding: false,
      allowPasswordReset: true,
      publicConfig: { client_id: 'cid' },
      secretConfig: { client_secret: 'SECRET' },
    },
  ]);
  assert.equal(captured.method, 'PUT');
  assert.equal(captured.url, '/api/manage/auth-providers');
  const body = captured.body as { items: Array<Record<string, unknown>> };
  const row = body.items[0];
  assert.equal(row.provider, 'google');
  assert.equal(row.allowLogin, true);
  assert.equal(row.allowBinding, false);
  assert.equal(row.allowPasswordReset, true);
  assert.equal(row.publicConfig !== undefined, true);
  assert.equal(row.secretConfig !== undefined, true);
  // 反例：不得出现 snake_case 写法
  assert.equal('allow_login' in row, false);
  assert.equal('allow_password_reset' in row, false);
});

test('③ PUT — clearSecretConfig 透传（清空密钥语义）', async () => {
  setResponse(RAW_VIEW);
  await authProvidersApi.replaceConfigs([
    {
      provider: 'google',
      enabled: false,
      allowLogin: false,
      allowBinding: false,
      allowPasswordReset: false,
      clearSecretConfig: true,
    },
  ]);
  const body = captured.body as { items: Array<Record<string, unknown>> };
  assert.equal(body.items[0].clearSecretConfig, true);
  // 未填的 publicConfig/secretConfig 被 JSON.stringify 丢弃，不出现 undefined 键
  assert.equal('publicConfig' in body.items[0], false);
});

test('④ POST diagnostics — URL 含 provider，场景枚举 snake_case', async () => {
  setResponse({
    run_id: 'run-1',
    provider: 'google',
    scenario: 'validate_config',
    status: 'success',
    summary: { title: '配置有效', message: 'ok' },
    steps: [
      {
        code: 's1',
        title: '检查 client_id',
        status: 'success',
        message: 'ok',
        retryable: false,
        started_at: 'a',
        finished_at: 'b',
      },
    ],
    artifacts: { authorize_url: 'https://accounts.google.com/x' },
    warnings: [],
    request_id: null,
    tested_at: 'c',
  });
  const r = await authProvidersApi.runDiagnostics('google', { scenario: 'validate_config' });
  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, '/api/manage/auth-providers/google/diagnostics');
  const body = captured.body as Record<string, unknown>;
  assert.equal(body.scenario, 'validate_config');
  // 反例：不得用 camelCase 枚举
  assert.equal(body.scenario === 'validateConfig', false);
  assert.equal(r.runId, 'run-1');
  assert.equal(r.status, 'success');
  assert.equal(r.steps[0].status, 'success');
  assert.equal(r.steps[0].startedAt, 'a');
  assert.equal(r.artifacts.authorizeUrl, 'https://accounts.google.com/x');
  assert.equal(r.requestId, null);
});

test('⑤ diagnostics — draftConfig 嵌套也走 camelCase（草稿自检不改线上配置）', async () => {
  setResponse({
    run_id: 'r', provider: 'smtp', scenario: 'send_test_email', status: 'failed',
    summary: { title: '发送失败', message: 'SMTP 未配置' }, steps: [], artifacts: {},
    warnings: [], request_id: null, tested_at: 't',
  });
  await authProvidersApi.runDiagnostics('smtp', {
    scenario: 'send_test_email',
    testEmail: 'a@b.com',
    draftConfig: {
      provider: 'smtp',
      enabled: true,
      allowLogin: false,
      allowBinding: false,
      allowPasswordReset: true,
    },
  });
  const body = captured.body as Record<string, unknown>;
  assert.equal(body.scenario, 'send_test_email');
  assert.equal(body.testEmail, 'a@b.com');
  const draft = body.draftConfig as Record<string, unknown>;
  assert.equal(draft.allowLogin, false);
  assert.equal(draft.allowPasswordReset, true);
  assert.equal('allow_login' in draft, false);
});

test('⑥ URL 均不带 confirmed（后端本文件 require_confirmed=0）', async () => {
  setResponse(RAW_VIEW);
  await authProvidersApi.listConfigs();
  assert.equal(captured.url.includes('confirmed'), false);
  await authProvidersApi.replaceConfigs([]);
  assert.equal(captured.url.includes('confirmed'), false);
});

test('⑦ fail-closed：403 缺 MANAGE_SETTINGS 必须抛出，不吞成空配置', async () => {
  setResponse({ code: 'forbidden', message: 'missing capability manage:settings' }, 403);
  await assert.rejects(() => authProvidersApi.listConfigs());
  await assert.rejects(() => authProvidersApi.replaceConfigs([]));
});

test('⑧ fail-closed：500 端口未装配必须抛出（不假装配置正常）', async () => {
  setResponse({ code: 'internal', message: 'auth provider port not assembled' }, 500);
  await assert.rejects(() => authProvidersApi.listConfigs());
});

test('⑨ 诊断失败（failed 态）也如实返回，不被吞成 success', async () => {
  setResponse({
    run_id: 'r2', provider: 'smtp', scenario: 'smtp_connect', status: 'failed',
    summary: { title: '连接失败', message: 'connection refused' },
    steps: [{ code: 's', title: 'connect', status: 'failed', message: 'refused', retryable: true, started_at: 'a', finished_at: 'b' }],
    artifacts: {}, warnings: ['凭据可能过期'], request_id: 'req-1', tested_at: 't',
  });
  const r = await authProvidersApi.runDiagnostics('smtp', { scenario: 'smtp_connect' });
  assert.equal(r.status, 'failed');
  assert.equal(r.summary.message, 'connection refused');
  assert.equal(r.steps[0].retryable, true);
  assert.deepEqual(r.warnings, ['凭据可能过期']);
  assert.equal(r.requestId, 'req-1');
});
