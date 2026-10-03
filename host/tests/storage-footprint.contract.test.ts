// FE-STORAGE-FOOTPRINT：存储占用面契约测试（RED → GREEN）。
// 运行：cd host && npm test
//
// 后端 wire 取证（crates/fmby-v2-http/src/state/system_storage_footprint.rs）：
// GET /api/manage/system/storage-footprint，capability MANAGE_ACCESS。
// - PG 后端：supported=true + postgres{database_size_bytes, largest_relations, settings}；
// - SQLite 后端：HTTP 200 + supported=false + reason（优雅降级，不 500、不编造）；
// - file_search 恒 null（V2 未实现该子系统），原因并入 reason。
//
// 断言：mapper 把 snake_case wire 转 camelCase；supported=false 时 postgres=null 透传；
// 500 → isStorageFootprintUnwiredError；relation kind 标签不造文案（未知原样回显）。

import test from 'node:test';
import assert from 'node:assert/strict';

(globalThis as { window?: unknown }).window = { location: { origin: 'http://localhost:5173' } };

const captured: string[] = [];
let nextResponse: { status: number; json: unknown } = { status: 200, json: {} };

(globalThis as { fetch?: unknown }).fetch = async (input: unknown) => {
  captured.push(typeof input === 'string' ? input : String(input));
  const { status, json } = nextResponse;
  return new Response(JSON.stringify(json), {
    status,
    headers: { 'content-type': 'application/json' },
  });
};

function reset(next: { status: number; json: unknown }): void {
  captured.length = 0;
  nextResponse = next;
}

const { storageFootprintApi, isStorageFootprintUnwiredError } = await import(
  '@fmby/v2-shared/contracts/manage/storage-footprint'
);
const { storageRelationKindLabel } = await import(
  '@fmby/v2-shared/contracts/manage/storage-footprint'
);

const RAW_PG = {
  backend: 'postgres',
  supported: true,
  reason: null,
  generated_at: 1700000000000,
  postgres: {
    database_size_bytes: 123456789,
    largest_relations: [
      {
        relation_name: 'media_items',
        relation_kind: 'table',
        total_size_bytes: 90000000,
        table_size_bytes: 60000000,
        index_size_bytes: 30000000,
        live_tuples: 4321,
        dead_tuples: 12,
      },
    ],
    settings: [{ name: 'shared_buffers', setting: '128MB', unit: null, source: 'default' }],
  },
  file_search: null,
};

test('① 路径 = /api/manage/system/storage-footprint（wire 原样，勿自造）', async () => {
  reset({ status: 200, json: RAW_PG });
  await storageFootprintApi.footprint();
  const url = new URL(captured[captured.length - 1]!);
  assert.equal(url.pathname, '/api/manage/system/storage-footprint');
});

test('② PG wire → camelCase mapper 逐字段对拍', async () => {
  reset({ status: 200, json: RAW_PG });
  const out = await storageFootprintApi.footprint();
  assert.equal(out.backend, 'postgres');
  assert.equal(out.supported, true);
  assert.equal(out.reason, null);
  assert.equal(out.generatedAt, 1700000000000);
  assert.ok(out.postgres);
  assert.equal(out.postgres.databaseSizeBytes, 123456789);
  const rel = out.postgres.largestRelations[0]!;
  assert.equal(rel.relationName, 'media_items');
  assert.equal(rel.relationKind, 'table');
  assert.equal(rel.totalSizeBytes, 90000000);
  assert.equal(rel.tableSizeBytes, 60000000);
  assert.equal(rel.indexSizeBytes, 30000000);
  assert.equal(rel.liveTuples, 4321);
  assert.equal(rel.deadTuples, 12);
  assert.deepEqual(out.postgres.settings[0], {
    name: 'shared_buffers',
    setting: '128MB',
    unit: null,
    source: 'default',
  });
  assert.equal(out.fileSearch, null);
});

test('③ SQLite 优雅降级：supported=false ⇒ postgres=null（200，非错误）', async () => {
  reset({
    status: 200,
    json: {
      backend: 'sqlite',
      supported: false,
      reason: 'PG 系统目录仅 PG 后端可用；file-search 索引子系统 V2 未实现',
      generated_at: 1700000000001,
      postgres: null,
      file_search: null,
    },
  });
  const out = await storageFootprintApi.footprint();
  assert.equal(out.supported, false);
  assert.equal(out.postgres, null);
  assert.match(out.reason ?? '', /file-search/);
});

test('④ 500 ⇒ isStorageFootprintUnwiredError（fail-closed 判定，与 system-about 同口径）', async () => {
  // 走真实 client 错误映射路径：500 + 后端错误体 → 带 status 的 ApiError。
  reset({ status: 500, json: { error_code: 'internal', message: 'boom' } });
  const err = await storageFootprintApi.footprint().then(
    () => null,
    (e: unknown) => e,
  );
  assert.ok(err, '500 必须抛错');
  assert.equal(isStorageFootprintUnwiredError(err), true);
  // 404（非未装配）→ false，判别不误伤
  reset({ status: 404, json: { error_code: 'not_found', message: 'nope' } });
  const err404 = await storageFootprintApi.footprint().then(
    () => null,
    (e: unknown) => e,
  );
  assert.ok(err404);
  assert.equal(isStorageFootprintUnwiredError(err404), false);
});

test('⑤ relation kind 标签：已知映射 + 未知原样回显（勿造文案）', () => {
  assert.equal(storageRelationKindLabel('table'), '表');
  assert.equal(storageRelationKindLabel('index'), '索引');
  assert.equal(storageRelationKindLabel('materialized view'), '物化视图');
  assert.equal(storageRelationKindLabel('some_new_kind'), 'some_new_kind');
  assert.equal(storageRelationKindLabel(''), '未知');
});
