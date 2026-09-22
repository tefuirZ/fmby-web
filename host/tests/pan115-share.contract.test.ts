import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pan115Api } from '@fmby/v2-shared/contracts/manage/pan115';
import type {
  Pan115ShareBrowseResponse,
  Pan115SyncOverview,
  Pan115SyncEnqueueResponse,
} from '@fmby/v2-shared/contracts/manage/pan115';

// ─── 测试桩：捕获 httpClient 真实发出的 {method,url,body} ──────────────────────
// 复用 EMAIL-WEB-UI 同款 harness：stub globalThis.window（buildUrl 需要 origin）
// + globalThis.fetch（解析 init.body 为 JSON），按 nextResponse 返回。
const captured: { method?: string; url?: string; body?: unknown } = {};
let nextResponse = { status: 200, json: {} as unknown };

function installFetchStub() {
  (globalThis as unknown as { window: unknown }).window = {
    location: { origin: 'http://localhost:5173' },
  };
  (globalThis as unknown as { fetch: unknown }).fetch = async (
    url: string,
    init?: { method?: string; body?: string },
  ) => {
    captured.method = init?.method ?? 'GET';
    // httpClient.buildUrl 产出完整 URL（含 origin），只保留 path 便于断言。
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
    const body =
      nextResponse.status === 204 ? null : JSON.stringify(nextResponse.json);
    return new Response(body, {
      status: nextResponse.status,
      headers: { 'content-type': 'application/json' },
    });
  };
}

function setResponse(json: unknown, status = 200) {
  nextResponse = { status, json };
}

// ─── 类型守卫（node --test 无 DOM，只验契约层映射）─────────────────────────────
function assertShareBrowse(x: unknown): asserts x is Pan115ShareBrowseResponse {
  assert.ok(x && typeof x === 'object');
  const r = x as Record<string, unknown>;
  assert.equal(typeof r.currentPath, 'string');
  assert.equal(typeof r.currentCid, 'string');
  assert.equal(typeof r.hasMore, 'boolean');
  assert.equal(Array.isArray(r.entries), true);
  const e0 = (r.entries as unknown[])[0] as Record<string, unknown> | undefined;
  if (e0) {
    assert.equal(typeof e0.name, 'string');
    assert.equal(typeof e0.cid, 'string');
    assert.equal(typeof e0.isDir, 'boolean');
  }
}

test('① browsePreview → POST /api/manage/pan115/previews/{preview_id}/browse（snake_case body）', async () => {
  installFetchStub();
  setResponse({
    current_path: '/',
    parent_path: null,
    current_cid: '0',
    total: 1,
    offset: 0,
    limit: 200,
    has_more: false,
    next_offset: null,
    entries: [{ name: 'a', path: '/a', cid: 'c1', is_dir: true, size: null }],
  });
  const resp = await pan115Api.browsePreview('pv-1', { path: '/', offset: 0 });
  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, '/api/manage/pan115/previews/pv-1/browse');
  // limit 未传 → undefined → JSON.stringify 落线时丢弃。
  assert.deepEqual(captured.body, { path: '/', offset: 0 });
  assertShareBrowse(resp);
  assert.equal(resp.entries[0].cid, 'c1');
  assert.equal(resp.entries[0].isDir, true);
  assert.equal(resp.entries[0].size, null);
});

test('② browseShareItem → POST /api/manage/pan115/share-items/browse（share_code 必填 snake_case）', async () => {
  installFetchStub();
  setResponse({
    current_path: '/',
    parent_path: null,
    current_cid: '0',
    total: 2,
    offset: 0,
    limit: 200,
    has_more: false,
    next_offset: null,
    entries: [{ name: 'x', path: '/x', cid: 'cx', is_dir: false, size: 1024 }],
  });
  const resp = await pan115Api.browseShareItem({
    shareCode: 'SC123',
    receiveCode: 'rc',
  });
  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, '/api/manage/pan115/share-items/browse');
  // 注意：undefined 字段经 JSON.stringify 落线时被丢弃（仅发必填字段），
  // 故断言实际请求的 body 不含多余空字段。
  assert.deepEqual(captured.body, { share_code: 'SC123', receive_code: 'rc' });
  assertShareBrowse(resp);
  assert.equal(resp.entries[0].size, 1024);
});

test('③ syncOverview → GET /api/manage/pan115/sync/mounts/{mount_id}（snake_case wire → domain camelCase）', async () => {
  installFetchStub();
  setResponse({
    mount_id: 'm1',
    provider_type: 'pan115',
    sources: [
      {
        source_id: 's1',
        share_item_id: 'si1',
        display_name: '分享A',
        source_kind: 'share',
        status: 'healthy',
        root_node_id: 'r1',
        last_full_sync_at: '2026-01-01T00:00:00Z',
        last_incremental_sync_at: null,
        last_share_diff_at: null,
        last_error_code: null,
        last_error_message: null,
        updated_at: '2026-01-01T00:00:00Z',
      },
    ],
    checkpoints: [
      {
        source_id: 's1',
        share_item_id: null,
        display_name: null,
        checkpoint_kind: 'full',
        checkpoint_value: 'v1',
        payload_json: '{}',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ],
    recent_tasks: [
      {
        id: 't1',
        source_id: 's1',
        share_item_id: null,
        display_name: null,
        task_kind: 'full-index',
        scope_node_id: null,
        scope_path_hint: null,
        request_reason: 'manual',
        status: 'succeeded',
        attempt_count: 1,
        max_attempts: 3,
        last_error_code: null,
        last_error_message: null,
        requested_at: '2026-01-01T00:00:00Z',
        started_at: '2026-01-01T00:00:00Z',
        finished_at: '2026-01-01T00:00:00Z',
      },
    ],
    supported_actions: ['full-index', 'life-poll', 'diff-refresh'],
  });
  const overview = (await pan115Api.syncOverview('m1')) as Pan115SyncOverview;
  assert.equal(captured.method, 'GET');
  assert.equal(captured.url, '/api/manage/pan115/sync/mounts/m1');
  assert.equal(overview.mountId, 'm1');
  assert.equal(overview.providerType, 'pan115');
  assert.equal(overview.sources[0].sourceId, 's1');
  assert.equal(overview.sources[0].displayName, '分享A');
  assert.equal(overview.checkpoints[0].checkpointKind, 'full');
  assert.equal(overview.recentTasks[0].taskKind, 'full-index');
  assert.deepEqual(overview.supportedActions, ['full-index', 'life-poll', 'diff-refresh']);
});

test('④ syncEnqueue → POST /api/manage/pan115/sync/mounts/{mount_id}/enqueue（body {action}）', async () => {
  installFetchStub();
  setResponse({
    mount_id: 'm1',
    action: 'full-index',
    accepted: true,
    message: '已入队，等待 worker 消费',
  });
  const resp = (await pan115Api.syncEnqueue('m1', {
    action: 'full-index',
  })) as Pan115SyncEnqueueResponse;
  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, '/api/manage/pan115/sync/mounts/m1/enqueue');
  assert.deepEqual(captured.body, { action: 'full-index' });
  assert.equal(resp.accepted, true);
  assert.equal(resp.message, '已入队，等待 worker 消费');
});

test('⑤ fail-closed：端口未装配 503 必须 reject（不吞成空；沿用 EMAIL-WEB-UI 同款断言）', async () => {
  installFetchStub();
  setResponse({ error_code: 'DEPENDENCY_UNAVAILABLE', message: 'pan115 分享下载面端口未装配' }, 503);
  // 仅验证 reject（不伪造成功）；错误文案透传由 getErrorMessage 在 UI 层兜底。
  await assert.rejects(() => pan115Api.browseShareItem({ shareCode: 'SC123' }));
});

test('⑥ shareCode 必填：body 恒带 share_code（缺失语义由后端 400 校验）', async () => {
  installFetchStub();
  setResponse({
    current_path: '/',
    parent_path: null,
    current_cid: '0',
    total: 0,
    offset: 0,
    limit: 200,
    has_more: false,
    next_offset: null,
    entries: [],
  });
  await pan115Api.browseShareItem({ shareCode: 'X' });
  assert.equal((captured.body as { share_code?: string }).share_code, 'X');
});
