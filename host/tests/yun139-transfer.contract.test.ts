/**
 * YUN139-TRANSFERS-W1F 分享转存 wire 对拍（#658 前端 CAS 编排剩余项 ③ 转存/离线入口）。
 *
 * 真源：`crates/fmby-v2-http/src/routes/yun139_accounts.rs`（3 transfer 端点，全 MANAGE_MOUNT）
 *      `crates/fmby-v2-http/src/state/yun139_accounts.rs`（Yun139TransferRecordDto 等）
 *
 * ★诚实登记（非缺陷）：V2 无转存编排引擎，`prepare_transfer` 仅落一条 PENDING 记录
 *   （target_file_id / transfer_task_id 留空），**不真发起转存**（后端 handoff 边界的诚实降级）。
 *   前端据实呈现 status/target_file_discovery_status，不伪造「已转存」假态。
 *
 * ★形态差异（V1 URL vs V2 ID）：V1 `prepare_transfer` 是「提交 URL/ed2k/磁力直提」，
 *   V2 改成 ID-based（需 share_entry_id + source_file_id 等来自浏览分享项的内部 ID）。
 *   前端表单据实收 ID，不造 URL→ID 解析（那是 share-browse 另一特性，超本卡范围）。
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

/** 完整 29 字段原始记录（snake_case，对齐 Yun139TransferRecordDto）。 */
const RAW_TRANSFER = {
  id: 't-1',
  share_mount_id: 'm1',
  share_entry_id: 'se-1',
  credential_profile_id: 'p-1',
  source_file_id: 'f-1',
  source_relative_path: '/movies/a.mkv',
  source_name: 'a.mkv',
  destination_parent_file_id: 'dp-1',
  destination_base_path: '/139/转存',
  target_relative_path: '/转存/a.mkv',
  target_file_id: null,
  target_file_name: null,
  target_file_discovery_status: 'pending',
  target_recycle_item_id: null,
  retention_days: 7,
  purge_recycle_bin: true,
  status: 'pending',
  transfer_task_id: null,
  trash_operation_id: null,
  purge_operation_id: null,
  attempt_count: 0,
  next_retry_at: null,
  last_successful_played_at: null,
  expires_at: '2026-10-23T00:00:00Z',
  recycle_verified_at: null,
  last_error_kind: null,
  last_error_message: null,
  created_at: '2026-10-16T00:00:00Z',
  updated_at: '2026-10-16T00:00:00Z',
};

test('① GET share-mounts/{mount_id}/transfers — 列表响应 snake→camel 全映射', async () => {
  setResponse({ mount_id: 'm1', items: [RAW_TRANSFER] });
  const r = await yun139Api.listTransfers('m1');
  assert.equal(captured.method, 'GET');
  assert.equal(captured.url, '/api/manage/yun139/share-mounts/m1/transfers');
  assert.equal(r.mountId, 'm1');
  assert.equal(r.items.length, 1);
  const t = r.items[0];
  assert.equal(t.id, 't-1');
  assert.equal(t.shareMountId, 'm1');
  assert.equal(t.shareEntryId, 'se-1');
  assert.equal(t.sourceFileId, 'f-1');
  assert.equal(t.sourceRelativePath, '/movies/a.mkv');
  assert.equal(t.sourceName, 'a.mkv');
  assert.equal(t.targetFileDiscoveryStatus, 'pending');
  assert.equal(t.targetFileId, null);
  assert.equal(t.retentionDays, 7);
  assert.equal(t.purgeRecycleBin, true);
  assert.equal(t.status, 'pending');
  assert.equal(t.attemptCount, 0);
  assert.equal(t.expiresAt, '2026-10-23T00:00:00Z');
  assert.equal(t.lastErrorKind, null);
  assert.equal(t.createdAt, '2026-10-16T00:00:00Z');
  // 29 字段全映射，无 undefined
  for (const [k, v] of Object.entries(t)) {
    assert.notEqual(v, undefined, `transfer.${k} 不得为 undefined`);
  }
});

test('①b listTransfers 空 items → 空列表（不伪造记录）', async () => {
  setResponse({ mount_id: 'm1', items: [] });
  const r = await yun139Api.listTransfers('m1');
  assert.deepEqual(r.items, []);
  assert.equal(r.mountId, 'm1');
});

test('② POST transfers/prepare — 入参 snake_case，sourceSize 省略时不发送', async () => {
  setResponse({ transfer: RAW_TRANSFER });
  const r = await yun139Api.prepareTransfer('m1', {
    shareEntryId: 'se-1',
    sourceFileId: 'f-1',
    sourceRelativePath: '/movies/a.mkv',
    sourceName: 'a.mkv',
  });
  assert.equal(captured.method, 'POST');
  assert.equal(
    captured.url,
    '/api/manage/yun139/share-mounts/m1/transfers/prepare',
  );
  // ★sourceSize 未填 ⇒ 不臆造缺省，实际 body 只含填了的字段
  assert.deepEqual(captured.body, {
    share_entry_id: 'se-1',
    source_file_id: 'f-1',
    source_relative_path: '/movies/a.mkv',
    source_name: 'a.mkv',
  });
  assert.equal(r.transfer.id, 't-1');
  assert.equal(r.transfer.status, 'pending');
});

test('②b prepare — sourceSize 填了才发送（snake_case）', async () => {
  setResponse({ transfer: RAW_TRANSFER });
  await yun139Api.prepareTransfer('m1', {
    shareEntryId: 'se-1',
    sourceFileId: 'f-1',
    sourceRelativePath: '/movies/a.mkv',
    sourceName: 'a.mkv',
    sourceSize: 123456,
  });
  assert.equal(captured.body?.source_size, 123456);
});

test('②c prepare 不真发起转存（V2 诚实降级）：记录 status/target_* 据实透传', async () => {
  // V2 无转存编排引擎 ⇒ prepare 返回的记录 target_file_id 仍为 null、status=pending
  setResponse({ transfer: RAW_TRANSFER });
  const r = await yun139Api.prepareTransfer('m1', {
    shareEntryId: 'se-1',
    sourceFileId: 'f-1',
    sourceRelativePath: '/movies/a.mkv',
    sourceName: 'a.mkv',
  });
  assert.equal(r.transfer.targetFileId, null);
  assert.equal(r.transfer.status, 'pending');
  assert.equal(r.transfer.transferTaskId, null);
});

test('③ POST transfers/{record_id}/playback-success — 回写播放成功', async () => {
  setResponse({
    transfer: {
      ...RAW_TRANSFER,
      last_successful_played_at: '2026-10-16T12:00:00Z',
    },
  });
  const r = await yun139Api.reportPlaybackSuccess('t-1', {
    playedAt: '2026-10-16T12:00:00Z',
  });
  assert.equal(captured.method, 'POST');
  assert.equal(
    captured.url,
    '/api/manage/yun139/transfers/t-1/playback-success',
  );
  assert.deepEqual(captured.body, { played_at: '2026-10-16T12:00:00Z' });
  assert.equal(r.transfer.lastSuccessfulPlayedAt, '2026-10-16T12:00:00Z');
});

test('③b playback-success — playedAt 省略时 body 为空对象（不臆造当前时间）', async () => {
  setResponse({ transfer: RAW_TRANSFER });
  await yun139Api.reportPlaybackSuccess('t-1');
  assert.deepEqual(captured.body, {});
});

test('④ fail-closed：403 缺 MANAGE_MOUNT 必须抛出，不吞成空列表', async () => {
  setResponse({ code: 'forbidden', message: 'missing capability manage:mount' }, 403);
  await assert.rejects(() => yun139Api.listTransfers('m1'));
  await assert.rejects(() =>
    yun139Api.prepareTransfer('m1', {
      shareEntryId: 'se-1',
      sourceFileId: 'f-1',
      sourceRelativePath: '/x',
      sourceName: 'x',
    }),
  );
  await assert.rejects(() => yun139Api.reportPlaybackSuccess('t-1'));
});

test('⑤ fail-closed：500 端口未装配必须抛出（不假装转存正常）', async () => {
  setResponse({ code: 'internal', message: 'yun139 port not assembled' }, 500);
  await assert.rejects(() => yun139Api.listTransfers('m1'));
});

test('⑥ URL 不带 confirmed（后端无 require_confirmed 二次确认闸）', async () => {
  setResponse({ transfer: RAW_TRANSFER });
  await yun139Api.prepareTransfer('m1', {
    shareEntryId: 'se-1',
    sourceFileId: 'f-1',
    sourceRelativePath: '/x',
    sourceName: 'x',
  });
  assert.equal(captured.url.includes('confirmed'), false);
});

// ───────────────────────────────────────────────────────────────────────────
// Yun139TransferSection 源码级契约（照 secrets-metadata FE1-1 范式）
// ───────────────────────────────────────────────────────────────────────────

test('⑦ Yun139TransferSection 源码含 MANAGE_MOUNT 权限门（PermissionGate ManageMount）', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(
    new URL('../src/pages/manage/yun139/Yun139TransferSection.tsx', import.meta.url),
    'utf8',
  );
  assert.match(src, /PermissionGate/, '必须用 PermissionGate 做 UX 权限降级');
  assert.match(src, /required="ManageMount"/, '权限门必须 required ManageMount（对齐后端 MANAGE_MOUNT）');
});

test('⑧ Yun139TransferSection 消费 yun139Api 三个 transfer 方法（不臆造数据/端点）', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(
    new URL('../src/pages/manage/yun139/Yun139TransferSection.tsx', import.meta.url),
    'utf8',
  );
  assert.match(src, /yun139Api\.listTransfers/, '列表必须走 yun139Api.listTransfers');
  assert.match(src, /yun139Api\.prepareTransfer/, '准备必须走 yun139Api.prepareTransfer');
  assert.match(src, /yun139Api\.reportPlaybackSuccess/, '回写播放成功必须走 yun139Api.reportPlaybackSuccess');
  // 不臆造 share-mounts 列表端点（后端无）
  assert.equal(src.includes('listShareMounts'), false, '不得臆造后端不存在的 share-mounts 列表端点');
});

test('⑨ Yun139TransferSection 据实标注 V2 不真发起转存（不伪造已转存假态）', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(
    new URL('../src/pages/manage/yun139/Yun139TransferSection.tsx', import.meta.url),
    'utf8',
  );
  assert.match(src, /不真发起转存|仅落记录|PENDING/, '必须诚实标注 V2 仅落记录不真转存');
});
