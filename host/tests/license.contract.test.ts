/**
 * W5-G 卡② wire 对拍：授权面 5 端点（照后端 `routes/manage_license.rs` 真形）。
 *
 * 后端 DTO：`crates/fmby-v2-http/src/state/license.rs` —— 全 snake_case，
 * 时间字段 epoch ms；activation-token 请求体 `{activation_token}`（serde 默认字段名，无 rename）。
 *
 * 断言：① GET /status 路径 + epoch 映射 + entitlement 说明/用量标签（照 V1 元数据）；
 * ② 四条写端点路径/方法/请求体；③ 设备流 poll_status 四态解析；④ 500 fail-closed 必须 reject。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { licenseApi } from '@fmby/v2-shared/contracts/manage/license';

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
  captured.url = String(url).replace('http://localhost:5173', '');
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

function statusPayload(patch: Record<string, unknown> = {}) {
  return {
    runtime_state: 'active',
    business_access_allowed: true,
    server_base_url: 'https://license.example',
    realtime_enabled: false,
    realtime_status: null,
    protocol_version: 1,
    instance_id: 'inst-1',
    instance_public_key: 'pub',
    activation_id: 'act-1',
    license_id: 'lic-1',
    lease_id: 'lease-1',
    product_code: 'fmby',
    issued_at: 1735689600000,
    not_before: null,
    expires_at: 1767225600000,
    grace_expires_at: null,
    next_heartbeat_at: null,
    last_heartbeat_at: null,
    last_error_code: null,
    last_error_message: null,
    last_error_at: null,
    last_realtime_connected_at: null,
    last_realtime_event_id: null,
    last_realtime_event_kind: null,
    last_realtime_event_at: null,
    last_realtime_error: null,
    last_realtime_error_at: null,
    realtime_blocked_reason: null,
    realtime_blocked_at: null,
    device_flow: null,
    summary: {
      plan: { code: 'pro', label: '专业版', tier: 'pro', is_trial: false, source: 'signed_lease' },
      user_limit: { limit: 20, unlimited: false, current: 3, exceeded: false },
      enabled_features: ['feature.storage.pan115.provider'],
      capability_groups: [],
      visibility: { pan115_provider: true },
    },
    entitlements: [
      { key: 'feature.storage.pan115.provider', value: true },
      { key: 'limit.users.max', value: 20 },
    ],
    usage: {
      user_count: 3,
      admin_count: 1,
      library_count: 0,
      storage_mount_count: 0,
      pan115_mount_count: 0,
      pan115_share_mount_count: 0,
      microsoft_mount_count: 0,
      microsoft_account_count: 0,
      upstream_source_count: 0,
      upstream_emby_count: 0,
      upstream_apple_cms_count: 0,
      active_playback_session_count: 0,
      open_api_token_count: 0,
    },
    ...patch,
  };
}

test('① GET /manage/license/status：路径 + epoch 映射 + entitlement 说明/用量标签', async () => {
  setResponse(statusPayload());
  const status = await licenseApi.getStatus();
  assert.equal(captured.method, 'GET');
  assert.equal(captured.url, '/api/manage/license/status');
  assert.equal(status.runtimeState, 'active');
  assert.equal(status.expiresAt, 1767225600000);

  const feature = status.entitlements.find((e) => e.key === 'feature.storage.pan115.provider');
  assert.equal(feature?.label, '115 普通网盘');
  assert.ok(feature?.description && feature.description.length > 0, 'V1 元数据说明应被填入');

  const limit = status.entitlements.find((e) => e.key === 'limit.users.max');
  assert.equal(limit?.usageLabel, '当前用户');
  assert.equal(limit?.usageValue, 3);
  assert.equal(limit?.limitValue, 20);
  assert.equal(limit?.exhausted, false);
  assert.equal(status.summary.visibility.pan115Provider, true);
});

test('② POST 四条写端点：路径/方法/请求体', async () => {
  setResponse({ status: statusPayload() });
  await licenseApi.startDeviceFlow();
  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, '/api/manage/license/device-flow');

  setResponse({ status: statusPayload(), poll_status: 'authorized' });
  const poll = await licenseApi.pollDeviceFlow();
  assert.equal(captured.url, '/api/manage/license/device-flow/poll');
  assert.equal(poll.pollStatus, 'authorized');

  setResponse({ status: statusPayload() });
  await licenseApi.activateWithToken({ activationToken: 'TOK-1' });
  assert.equal(captured.url, '/api/manage/license/activation-token');
  assert.deepEqual(captured.body, { activation_token: 'TOK-1' });

  setResponse({ status: statusPayload() });
  await licenseApi.heartbeat();
  assert.equal(captured.url, '/api/manage/license/heartbeat');
});

test('③ 设备流 poll_status 非四态 → 解析抛错（不吞）', async () => {
  setResponse({ status: statusPayload(), poll_status: 'bogus' });
  await assert.rejects(() => licenseApi.pollDeviceFlow());
});

test('④ 端口未装配 fail-closed：500 必须 reject', async () => {
  setResponse({ error_code: 'INTERNAL', message: '授权服务未装配' }, 500);
  await assert.rejects(() => licenseApi.getStatus());
});
