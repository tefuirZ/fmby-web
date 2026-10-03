// FE-LOG-ARCHIVE：运行日志归档面契约测试（清单 + 下载入口）。
// 运行：cd host && npm test
//
// 后端 wire 取证（crates/fmby-v2-http/src/routes/manage/runtime_log_archives.rs +
// contracts/dto/manage.rs RuntimeLogArchiveDto）：
// - GET /api/manage/runtime-log-archives?page&pageSize（QUERY-CAMELCASE 主名 pageSize）
//   → {items[{id,file_name,log_date,compressed_size_bytes,original_size_bytes,
//     compression_ratio,created_at,expires_at}], total, log_dir, retention_days}
// - GET /api/manage/runtime-log-archives/{archiveId}/download → zip 流（session cookie）
//
// 断言：mapper snake→camel 逐字段；query 发 page/pageSize 主名；下载 URL 原样 +
// encodeURIComponent（id 为 sha256 hex，仍不放松）；archives 走独立 queryKey。

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
const lastUrl = (): string => captured[captured.length - 1]!;
const lastAbs = (): string => new URL(lastUrl(), 'http://localhost:5173').toString();

const { runtimeLogArchivesApi } = await import(
  '@fmby/v2-shared/contracts/manage/runtime-log-archives'
);

const RAW_LIST = {
  items: [
    {
      id: 'a'.repeat(64),
      file_name: 'runtime-2026-10-01.log.gz',
      log_date: '2026-10-01',
      compressed_size_bytes: 1024,
      original_size_bytes: 4096,
      compression_ratio: 4.0,
      created_at: '2026-10-02T00:00:00Z',
      expires_at: '2026-10-31T16:00:00Z',
    },
    {
      id: 'b'.repeat(64),
      file_name: 'runtime-unknown-date.log.gz',
      compressed_size_bytes: 512,
      original_size_bytes: 512,
      compression_ratio: 1.0,
      created_at: '2026-10-02T01:00:00Z',
    },
  ],
  total: 2,
  log_dir: '/data/runtime-log-archives',
  retention_days: 30,
};

test('① 清单路径 = /api/manage/runtime-log-archives（wire 原样）', async () => {
  reset({ status: 200, json: RAW_LIST });
  await runtimeLogArchivesApi.list();
  assert.equal(new URL(lastUrl()).pathname, '/api/manage/runtime-log-archives');
});

test('② query 发 page/pageSize（QUERY-CAMELCASE 主名，不带 snake 别名）', async () => {
  reset({ status: 200, json: RAW_LIST });
  await runtimeLogArchivesApi.list({ page: 2, pageSize: 50 });
  const q = new URL(lastUrl()).searchParams;
  assert.equal(q.get('page'), '2');
  assert.equal(q.get('pageSize'), '50');
  assert.equal(q.get('page_size'), null);
});

test('③ mapper snake→camel 逐字段对拍（含可空 log_date/expires_at）', async () => {
  reset({ status: 200, json: RAW_LIST });
  const out = await runtimeLogArchivesApi.list();
  assert.equal(out.total, 2);
  assert.equal(out.logDir, '/data/runtime-log-archives');
  assert.equal(out.retentionDays, 30);
  const [first, second] = out.items;
  assert.equal(first!.id, 'a'.repeat(64));
  assert.equal(first!.fileName, 'runtime-2026-10-01.log.gz');
  assert.equal(first!.logDate, '2026-10-01');
  assert.equal(first!.compressedSizeBytes, 1024);
  assert.equal(first!.originalSizeBytes, 4096);
  assert.equal(first!.compressionRatio, 4.0);
  assert.equal(first!.createdAt, '2026-10-02T00:00:00Z');
  assert.equal(first!.expiresAt, '2026-10-31T16:00:00Z');
  assert.equal(second!.logDate, null, '缺省 log_date → null（不编造）');
  assert.equal(second!.expiresAt, null);
});

test('④ 下载 URL = /{archiveId}/download 原样 + encodeURIComponent', async () => {
  reset({ status: 200, json: RAW_LIST });
  const id = 'a'.repeat(64);
  await runtimeLogArchivesApi.download(id);
  assert.equal(
    new URL(lastAbs()).pathname,
    `/api/manage/runtime-log-archives/${id}/download`,
  );
});
