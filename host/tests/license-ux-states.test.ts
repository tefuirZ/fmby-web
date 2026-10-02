/**
 * LICENSE-UX-V1-PARITY：授权交互链路的状态诚实性与秘密处理（RED/回归）。
 *
 * 覆盖卡面点名场景（不重复 shared/tests/license-contract.test.ts 已有的枚举纯函数）：
 * ① 未激活态：status 映射 + 六态标签可区分（未激活 / 过期 / 宽限）；
 * ② 权益不足：limit entitlement 用量达上限 → exhausted；user_limit.exceeded 透出；
 * ③ 设备授权轮询：成功 authorized / 失败 denied / 超时（flow 到期未授权）；
 * ④ activation token 错误：后端 4xx 必须 reject 并保留真实 message，不得假成功；
 * ⑤ 秘密字段不回显：token 只进请求体，不进 URL / Storage / 返回的状态映射。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  licenseApi,
  getLicenseRuntimeStateLabel,
  getLicenseRuntimeStateTone,
  getLicensePollStatusLabel,
} from '@fmby/v2-shared/contracts/manage/license';

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

function usage(patch: Record<string, unknown> = {}) {
  return {
    user_count: 0,
    admin_count: 0,
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
    ...patch,
  };
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
      plan: { code: 'free', label: '免费版', tier: 'free', is_trial: false, source: 'free_baseline' },
      user_limit: { limit: 1, unlimited: false, current: 1, exceeded: false },
      enabled_features: [],
      capability_groups: [],
      visibility: {},
    },
    entitlements: [],
    usage: usage(),
    ...patch,
  };
}

test('① 未激活：status 映射 + 六态标签可区分（未激活/过期/宽限）', async () => {
  setResponse(statusPayload({ runtime_state: 'unactivated', business_access_allowed: false }));
  const status = await licenseApi.getStatus();
  assert.equal(status.runtimeState, 'unactivated');
  assert.equal(status.businessAccessAllowed, false);
  assert.equal(getLicenseRuntimeStateLabel(status.runtimeState), '未激活');
  assert.equal(getLicenseRuntimeStateTone(status.runtimeState), 'neutral');
  // 三态必须可区分，不得都塌成同一个标签/色调
  assert.notEqual(getLicenseRuntimeStateLabel('unactivated'), getLicenseRuntimeStateLabel('expired'));
  assert.notEqual(getLicenseRuntimeStateLabel('grace'), getLicenseRuntimeStateLabel('unactivated'));
  assert.equal(getLicenseRuntimeStateTone('expired'), 'danger');
  assert.equal(getLicenseRuntimeStateTone('grace'), 'warning');
});

test('② 权益不足：limit 用量达上限 → exhausted + user_limit.exceeded 透出', async () => {
  setResponse(
    statusPayload({
      summary: {
        plan: { code: 'free', label: '免费版', tier: 'free', is_trial: false, source: 'free_baseline' },
        user_limit: { limit: 3, unlimited: false, current: 3, exceeded: true },
        enabled_features: [],
        capability_groups: [],
        visibility: {},
      },
      entitlements: [
        { key: 'limit.users.max', value: 3 },
        { key: 'feature.storage.pan115.provider', value: false },
      ],
      usage: usage({ user_count: 3 }),
    }),
  );
  const status = await licenseApi.getStatus();
  const users = status.entitlements.find((item) => item.key === 'limit.users.max');
  assert.equal(users?.limitValue, 3);
  assert.equal(users?.usageValue, 3);
  assert.equal(users?.exhausted, true);
  assert.equal(users?.usageLabel, '当前用户');
  assert.equal(status.summary.userLimit.exceeded, true);
});

test('③ 设备授权轮询：成功 authorized / 失败 denied / 超时（flow 到期未授权）', async () => {
  // 成功
  setResponse({ status: statusPayload(), poll_status: 'authorized' });
  const success = await licenseApi.pollDeviceFlow();
  assert.equal(success.pollStatus, 'authorized');
  assert.equal(getLicensePollStatusLabel(success.pollStatus), '已授权');

  // 失败（授权服务返回 denied）
  setResponse({ status: statusPayload(), poll_status: 'denied' });
  const denied = await licenseApi.pollDeviceFlow();
  assert.equal(denied.pollStatus, 'denied');
  assert.equal(getLicensePollStatusLabel(denied.pollStatus), '已拒绝');

  // 失败（传输/服务错误必须 reject，不得吞）
  setResponse({ error_code: 'UNAVAILABLE', message: '授权服务暂不可用' }, 503);
  await assert.rejects(() => licenseApi.pollDeviceFlow());

  // 超时：flow 已到期但尚未授权
  const { isDeviceFlowExpired } = await import('../src/pages/manage/license/deviceFlow.ts');
  const now = 1_000_000;
  const flow = {
    deviceCode: 'dc',
    userCode: 'uc',
    verificationUri: 'https://verify.example',
    verificationUriComplete: null,
    expiresAt: now - 1,
    pollIntervalSecs: 5,
  };
  assert.equal(isDeviceFlowExpired(flow, now), true);
  assert.equal(isDeviceFlowExpired({ ...flow, expiresAt: now + 1 }, now), false);
  assert.equal(
    isDeviceFlowExpired({ ...flow, expiresAt: null }, now),
    false,
    '未提供到期时间不得被判成超时',
  );
});

test('④ activation token 错误：后端 4xx 必须 reject 且保留真实 message', async () => {
  setResponse(
    { error_code: 'invalid_activation_token', message: 'activation token 无效或已过期' },
    400,
  );
  await assert.rejects(
    () => licenseApi.activateWithToken({ activationToken: 'BAD-TOKEN' }),
    (error: unknown) => {
      assert.match(String((error as Error).message), /activation token 无效或已过期/);
      return true;
    },
  );
});

test('⑤ 秘密字段不回显：token 只进请求体，不进 URL / Storage / 状态映射', async () => {
  const writes: Array<[string, string]> = [];
  const store: Record<string, string> = {};
  const fakeStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      writes.push([key, value]);
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const key of Object.keys(store)) delete store[key];
    },
  };
  (globalThis as unknown as { localStorage: unknown }).localStorage = fakeStorage;
  (globalThis as unknown as { sessionStorage: unknown }).sessionStorage = fakeStorage;

  setResponse({ status: statusPayload() });
  const result = await licenseApi.activateWithToken({ activationToken: 'TOK-SECRET' });

  assert.deepEqual(captured.body, { activation_token: 'TOK-SECRET' }, 'token 只应出现在请求体');
  assert.ok(!String(captured.url).includes('TOK-SECRET'), 'token 不得出现在 URL');
  assert.ok(
    !JSON.stringify(result).includes('TOK-SECRET'),
    'token 不得被回写到返回的状态映射',
  );
  assert.equal(writes.length, 0, 'token 不得写入 localStorage / sessionStorage');
});
