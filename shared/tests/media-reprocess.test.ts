import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { httpClient } from '@fmby/v2-shared/api/client';
import { mediaReprocessApi } from '@fmby/v2-shared/contracts/manage/operations';

/**
 * FE-MEDIA-REPROCESS-SURFACE：媒体重处理作业面契约对拍（RED→GREEN）。
 *
 * ★缺口核实（用 origin/main ref，不查工作区）：
 *   后端 5 端点已注册（`crates/fmby-v2-http/src/routes/router_manage.rs`，
 *   handler 在 `routes/manage_media_reprocess.rs`）；前端**零调用**且全仓无任何
 *   `reprocess` 标识符 ⇒ 缺口为真，非重复造。
 *
 * 后端真源（origin/main）：
 *   GET  /api/manage/operations/media-reprocess            （limit 夹取 1..100，缺省 20）
 *   POST /api/manage/operations/media-reprocess            （危险 mode 需 ?confirmed=true）
 *   GET  /api/manage/operations/media-reprocess/{id}
 *   POST /api/manage/operations/media-reprocess/{id}/cancel
 *   POST /api/manage/operations/media-reprocess/{id}/resume
 *   DTO：`crates/fmby-v2-http/src/dto/manage_media_reprocess.rs`
 *     - 任务 DTO **18 字段**，时间是 **RFC3339 字符串**（存储侧 epoch-ms）
 *     - 枚举 wire = **PascalCase**（mode 10 态 / status 6 态，单一真源在 domain）
 *     - Stats = 39 个计数（缺省 0）
 *
 * ★不造文案：错误走既有 `getErrorMessage`（出后端原文），本卡不新增错误码表。
 */

const TASK_RAW = {
  id: 't1',
  scope_library_id: null,
  mode: 'DryRun',
  status: 'Pending',
  cursor_media_item_id: null,
  cursor_source_id: null,
  batch_size: 25,
  stats: { scanned: 0, matched: 0 },
  requested_by_user_id: '7',
  lease_owner: null,
  lease_token: null,
  lease_expires_at: null,
  last_error_code: null,
  last_error_message: null,
  created_at: '2026-10-05T12:00:00Z',
  started_at: null,
  finished_at: null,
  updated_at: '2026-10-05T12:00:00Z',
};

test('GET 列表：走 /api/manage/operations/media-reprocess，limit 缺省 20 且夹到 1..100', async () => {
  const get = mock.method(httpClient, 'get', async () => [TASK_RAW]);

  const list = await mediaReprocessApi.listTasks();
  assert.deepEqual(get.mock.calls[0].arguments, [
    '/api/manage/operations/media-reprocess',
    { params: { limit: 20 } },
  ]);
  assert.equal(list.length, 1);

  await mediaReprocessApi.listTasks(500);
  assert.deepEqual(get.mock.calls[1].arguments[1], { params: { limit: 100 } }, '上限 100');

  await mediaReprocessApi.listTasks(0);
  assert.deepEqual(get.mock.calls[2].arguments[1], { params: { limit: 1 } }, '下限 1');

  get.mockRestore?.();
});

test('任务 DTO：18 字段 snake→camel 对拍，枚举 PascalCase 原样透传，时间保持 RFC3339 串', async () => {
  const get = mock.method(httpClient, 'get', async () => TASK_RAW);
  const task = await mediaReprocessApi.getTask('t1');

  assert.deepEqual(get.mock.calls[0].arguments[0], '/api/manage/operations/media-reprocess/t1');
  assert.deepEqual(task, {
    id: 't1',
    scopeLibraryId: null,
    mode: 'DryRun',
    status: 'Pending',
    cursorMediaItemId: null,
    cursorSourceId: null,
    batchSize: 25,
    stats: { scanned: 0, matched: 0 },
    requestedByUserId: '7',
    leaseOwner: null,
    leaseToken: null,
    leaseExpiresAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    createdAt: '2026-10-05T12:00:00Z',
    startedAt: null,
    finishedAt: null,
    updatedAt: '2026-10-05T12:00:00Z',
  });
  get.mockRestore?.();
});

test('创建：危险 mode 必须带 ?confirmed=true（两个 DryRun 免确认）', async () => {
  const post = mock.method(httpClient, 'post', async () => TASK_RAW);

  // ① DryRun（免确认）⇒ 不带 confirmed
  await mediaReprocessApi.createTask({ mode: 'DryRun' });
  const [p1, c1] = post.mock.calls[0].arguments as [
    string,
    { params?: Record<string, unknown>; body?: unknown },
  ];
  assert.equal(p1, '/api/manage/operations/media-reprocess');
  assert.equal(c1?.params, undefined, 'DryRun 免危险确认 ⇒ 不带 confirmed');

  // ② LocalNormalize（需确认）⇒ 必须 confirmed=true
  await mediaReprocessApi.createTask({ mode: 'LocalNormalize' });
  const [, c2] = post.mock.calls[1].arguments as [
    string,
    { params?: Record<string, unknown>; body?: unknown },
  ];
  assert.deepEqual(c2?.params, { confirmed: true }, '危险 mode 必须 ?confirmed=true');

  post.mockRestore?.();
});

test('cancel / resume：路径与 POST 语义', async () => {
  const post = mock.method(httpClient, 'post', async () => TASK_RAW);
  await mediaReprocessApi.cancelTask('t1');
  await mediaReprocessApi.resumeTask('t1');
  assert.deepEqual(post.mock.calls[0].arguments[0], '/api/manage/operations/media-reprocess/t1/cancel');
  assert.deepEqual(post.mock.calls[1].arguments[0], '/api/manage/operations/media-reprocess/t1/resume');
  post.mockRestore?.();
});
