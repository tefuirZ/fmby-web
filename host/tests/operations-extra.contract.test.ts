/**
 * FE-PARITY-OPERATIONS-EXTRA wire 对拍（operations gap 两条只读端点）。
 *
 * 后端真源：`crates/fmby-v2-http/src/routes/manage_operations_gap.rs`
 *  - :145 data-sources/load（响应构造 :175-224）
 *  - :228 playback/active（响应构造 :294-300；limit clamp :238-241）
 *  - 路由注册 :473-482；能力门 ViewAudit；端口未装配 fail-closed 500。
 *
 * ★本模块 casing 分裂：既有 /overview 是 camelCase，这两条是 **snake_case**
 *   （同一 operations 模块内两种并存），逐条钉死。
 *
 * 形状参照既有 host/tests/operations-b2.test.ts。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  operationsApi,
  OPERATIONS_ACTIVE_PLAYBACK_LIMIT_DEFAULT,
  OPERATIONS_ACTIVE_PLAYBACK_LIMIT_MAX,
} from '@fmby/v2-shared/contracts/manage/operations';

// ─── fetch 桩 ────────────────────────────────────────────────────────────────
const captured: { method?: string; url?: string } = {};
let nextResponse = { status: 200, json: {} as unknown };

(globalThis as unknown as { window: unknown }).window = {
  location: { origin: 'http://localhost:5173' },
};
(globalThis as unknown as { fetch: unknown }).fetch = async (
  url: string,
  init?: { method?: string },
) => {
  captured.method = init?.method ?? 'GET';
  captured.url = url.replace('http://localhost:5173', '');
  const body = nextResponse.status === 204 ? null : JSON.stringify(nextResponse.json);
  return new Response(body, {
    status: nextResponse.status,
    headers: { 'content-type': 'application/json' },
  });
};

function setResponse(json: unknown, status = 200) {
  nextResponse = { status, json };
}

// ─── 真形状（照后端字段构造） ─────────────────────────────────────────────────
function loadItem(patch: Record<string, unknown> = {}) {
  return {
    source_id: '5',
    source_name: '主挂载',
    provider_type: 'pan115',
    mount_id: '5',
    active_session_count: 3,
    playing_count: 2,
    paused_count: 1,
    media_source_count: 12,
    last_heartbeat_at: '2026-01-01T00:00:00Z',
    load_level: 'ok',
    advice: null,
    requests_total: 100,
    success_total: 90,
    errors_total: 5,
    rejected_total: 2,
    rate_limited_total: 1,
    last_hold_ms: 30,
    ...patch,
  };
}

function session(patch: Record<string, unknown> = {}) {
  return {
    session_id: 'sess-1',
    device_session_id: null,
    remote_control_available: false,
    supported_commands: [],
    client_connection_status: null,
    last_command_status: null,
    client: {
      device_name: null,
      client_name: null,
      device_os: null,
      client_version: null,
    },
    client_info: null,
    user: { user_id: '101', username: 'alice', display_name: null },
    item: {
      item_id: '9001',
      title: '电影 A',
      media_type: 'Movie',
      series_title: null,
      season_number: null,
      episode_number: null,
    },
    source: {
      media_source_id: 'ms-1',
      source_name: '主挂载',
      provider_type: 'pan115',
      mount_id: '5',
    },
    status: 'playing',
    play_method: null,
    position_ticks: 3_000_000,
    duration_ticks: 6_000_000,
    progress_percent: 50,
    started_at: '2026-01-01T00:00:00Z',
    last_heartbeat_at: '2026-01-01T00:00:30Z',
    ...patch,
  };
}

// ─── data-sources/load ──────────────────────────────────────────────────────

test('① GET data-sources/load — 路径与方法，无 query', async () => {
  setResponse({ sampled_at: 't', cache_status: 'bypass', items: [] });
  const r = await operationsApi.mountLoad();
  assert.equal(captured.method, 'GET');
  assert.equal(captured.url, '/api/manage/operations/data-sources/load');
  assert.equal(r.sampledAt, 't');
  assert.equal(r.cacheStatus, 'bypass');
});

test('② load 条目 snake→camel 全字段映射，无 undefined', async () => {
  setResponse({
    sampled_at: 't',
    cache_status: 'bypass',
    items: [loadItem({ active_session_count: 120, load_level: 'critical', advice: '重点观察' })],
  });
  const item = (await operationsApi.mountLoad()).items[0];
  assert.equal(item.sourceId, '5');
  assert.equal(item.sourceName, '主挂载');
  assert.equal(item.providerType, 'pan115');
  assert.equal(item.mountId, '5');
  assert.equal(item.activeSessionCount, 120);
  assert.equal(item.playingCount, 2);
  assert.equal(item.pausedCount, 1);
  assert.equal(item.mediaSourceCount, 12);
  assert.equal(item.lastHeartbeatAt, '2026-01-01T00:00:00Z');
  // ★负载等级由后端下发，前端不重算
  assert.equal(item.loadLevel, 'critical');
  assert.equal(item.advice, '重点观察');
  assert.equal(item.requestsTotal, 100);
  assert.equal(item.lastHoldMs, 30);
  for (const [k, v] of Object.entries(item)) {
    assert.notEqual(v, undefined, `item.${k} 不得为 undefined`);
  }
});

test('③ ★OUTBOUND 端口未装配 → null 如实透传，不得补 0（未知 ≠ 0）', async () => {
  setResponse({
    sampled_at: 't',
    cache_status: 'bypass',
    items: [
      loadItem({
        requests_total: null,
        success_total: null,
        errors_total: null,
        rejected_total: null,
        rate_limited_total: null,
        last_hold_ms: null,
      }),
    ],
  });
  const item = (await operationsApi.mountLoad()).items[0];
  assert.equal(item.requestsTotal, null);
  assert.equal(item.successTotal, null);
  assert.equal(item.errorsTotal, null);
  assert.equal(item.rejectedTotal, null);
  assert.equal(item.rateLimitedTotal, null);
  assert.equal(item.lastHoldMs, null);
});

test('④ 负载阈值由后端判定：50/100 边界照实呈现（前端不自行算等级）', async () => {
  for (const [count, level] of [
    [49, 'ok'],
    [50, 'warning'],
    [99, 'warning'],
    [100, 'critical'],
  ] as const) {
    setResponse({
      sampled_at: 't',
      cache_status: 'bypass',
      items: [loadItem({ active_session_count: count, load_level: level })],
    });
    const item = (await operationsApi.mountLoad()).items[0];
    assert.equal(item.loadLevel, level, `count=${count} 应报 ${level}`);
  }
});

// ─── playback/active ────────────────────────────────────────────────────────

test('⑤ GET playback/active — 缺省不传 limit（后端缺省 200）', async () => {
  setResponse({ sampled_at: 't', cache_status: 'bypass', limit: 200, total_returned: 0, sessions: [] });
  const r = await operationsApi.activePlayback();
  assert.equal(captured.url, '/api/manage/operations/playback/active');
  assert.equal(r.limit, 200);
  assert.equal(r.totalReturned, 0);
});

test('⑥ limit=1 / 500 边界原值上送（clamp 由后端做，前端不截断）', async () => {
  setResponse({ sampled_at: 't', cache_status: 'bypass', limit: 1, total_returned: 1, sessions: [] });
  await operationsApi.activePlayback({ limit: 1 });
  assert.equal(captured.url, '/api/manage/operations/playback/active?limit=1');

  setResponse({ sampled_at: 't', cache_status: 'bypass', limit: 500, total_returned: 500, sessions: [] });
  await operationsApi.activePlayback({ limit: 500 });
  assert.equal(captured.url, '/api/manage/operations/playback/active?limit=500');
});

test('⑦ limit 越界（0 / 9999）也原值上送，由后端 clamp；前端不得本地截断', async () => {
  setResponse({ sampled_at: 't', cache_status: 'bypass', limit: 1, total_returned: 0, sessions: [] });
  await operationsApi.activePlayback({ limit: 0 });
  assert.equal(captured.url, '/api/manage/operations/playback/active?limit=0');
  assert.equal(captured.url.includes('limit=1'), false);

  setResponse({ sampled_at: 't', cache_status: 'bypass', limit: 500, total_returned: 0, sessions: [] });
  await operationsApi.activePlayback({ limit: 9999 });
  assert.equal(captured.url, '/api/manage/operations/playback/active?limit=9999');
  assert.equal(captured.url.includes('limit=500'), false);
});

test('⑧ 常量镜像与后端一致（缺省 200 / 上限 500）', () => {
  assert.equal(OPERATIONS_ACTIVE_PLAYBACK_LIMIT_DEFAULT, 200);
  assert.equal(OPERATIONS_ACTIVE_PLAYBACK_LIMIT_MAX, 500);
});

test('⑨ 会话 snake→camel 全映射；V2 无源字段恒 null/空也照实透传', async () => {
  setResponse({
    sampled_at: 't',
    cache_status: 'bypass',
    limit: 200,
    total_returned: 1,
    sessions: [session()],
  });
  const s = (await operationsApi.activePlayback()).sessions[0];
  assert.equal(s.sessionId, 'sess-1');
  assert.equal(s.user.username, 'alice');
  assert.equal(s.user.displayName, null); // V2 access_user 无 display_name 列
  assert.equal(s.item.title, '电影 A');
  assert.equal(s.item.seriesTitle, null);
  assert.equal(s.source.sourceName, '主挂载');
  assert.equal(s.status, 'playing');
  assert.equal(s.playMethod, null);
  assert.equal(s.positionTicks, 3_000_000);
  assert.equal(s.progressPercent, 50);
  assert.equal(s.startedAt, '2026-01-01T00:00:00Z');
  // 设备面 V2 无源
  assert.equal(s.deviceSessionId, null);
  assert.equal(s.remoteControlAvailable, false);
  assert.deepEqual(s.supportedCommands, []);
  assert.equal(s.client.deviceName, null);
  for (const [k, v] of Object.entries(s)) {
    assert.notEqual(v, undefined, `session.${k} 不得为 undefined`);
  }
});

test('⑩ source 缺失时后端 unwrap_or_default → 空串（不是 null），如实映射', async () => {
  setResponse({
    sampled_at: 't',
    cache_status: 'bypass',
    limit: 200,
    total_returned: 1,
    sessions: [
      session({
        source: { media_source_id: '', source_name: '', provider_type: '', mount_id: '' },
      }),
    ],
  });
  const s = (await operationsApi.activePlayback()).sessions[0];
  assert.equal(s.source.mediaSourceId, '');
  assert.equal(s.source.sourceName, '');
});

// ─── fail-closed ────────────────────────────────────────────────────────────

test('⑪ fail-closed：500 端口未装配必须抛出，不返空壳假数据', async () => {
  setResponse({ code: 'internal', message: 'operations port not assembled' }, 500);
  await assert.rejects(() => operationsApi.mountLoad());
  await assert.rejects(() => operationsApi.activePlayback());
});

test('⑫ fail-closed：403 缺 ViewAudit 必须抛出，不吞成空列表', async () => {
  setResponse({ code: 'forbidden', message: 'missing capability view:audit' }, 403);
  await assert.rejects(() => operationsApi.mountLoad());
});
