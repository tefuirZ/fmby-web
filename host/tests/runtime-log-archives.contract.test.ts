/**
 * FE-LOG-ARCHIVE wire 对拍（运行日志归档清单 + 下载入口）。
 *
 * 真源：crates/fmby-v2-http/src/routes/manage/runtime_log_archives.rs
 *      crates/fmby-v2-contracts/src/dto/manage.rs（RuntimeLogArchiveDto / RuntimeLogArchivesQuery /
 *      ManagedRuntimeLogArchivesResponse）
 * 能力门 VIEW_AUDIT（与同域 /api/manage/runtime-logs 同口径）；GET 无需 CSRF。
 * wire：响应 snake_case；query 主名 camelCase `pageSize`（后端另有 snake 别名）。
 * 归档 id = sha256(file_name) —— 下载路径由 id 拼装，不得再拼 file_name。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { manageApi } from '@fmby/v2-shared/contracts/manage';
import { buildRuntimeLogArchiveDownloadUrl } from '../src/pages/manage/runtime-logs/archive';

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
  return new Response(JSON.stringify(nextResponse.json), {
    status: nextResponse.status,
    headers: { 'content-type': 'application/json' },
  });
};

test('① GET /api/manage/runtime-log-archives —— query camelCase pageSize，响应映射 camelCase', async () => {
  nextResponse = {
    status: 200,
    json: {
      items: [
        {
          id: 'sha256-abc',
          file_name: 'fmby-2026-10-03.zip',
          log_date: '2026-10-03',
          compressed_size_bytes: 1234,
          original_size_bytes: 4567,
          compression_ratio: 0.27,
          created_at: '2026-10-03T01:02:03Z',
          expires_at: '2026-11-02T16:00:00Z',
        },
      ],
      total: 1,
      log_dir: '/var/log/fmby/archive',
      retention_days: 30,
    },
  };

  const r = await manageApi.getRuntimeLogArchives({ page: 1, pageSize: 20 });

  assert.equal(captured.method, 'GET');
  assert.equal(captured.url, '/api/manage/runtime-log-archives?page=1&pageSize=20');
  assert.equal(r.total, 1);
  assert.equal(r.logDir, '/var/log/fmby/archive');
  assert.equal(r.retentionDays, 30);
  assert.equal(r.items.length, 1);
  const item = r.items[0];
  assert.equal(item.id, 'sha256-abc');
  assert.equal(item.fileName, 'fmby-2026-10-03.zip');
  assert.equal(item.logDate, '2026-10-03');
  assert.equal(item.compressedSizeBytes, 1234);
  assert.equal(item.originalSizeBytes, 4567);
  assert.equal(item.compressionRatio, 0.27);
  assert.equal(item.createdAt, '2026-10-03T01:02:03Z');
  assert.equal(item.expiresAt, '2026-11-02T16:00:00Z');
});

test('①b 不传 query ⇒ 不带任何查询串', async () => {
  nextResponse = { status: 200, json: { items: [], total: 0, log_dir: '/x', retention_days: 7 } };

  await manageApi.getRuntimeLogArchives();

  assert.equal(captured.url, '/api/manage/runtime-log-archives');
});

test('①c log_date / expires_at 缺失 ⇒ undefined（不造假值）', async () => {
  nextResponse = {
    status: 200,
    json: {
      items: [
        {
          id: 'i',
          file_name: 'f.zip',
          log_date: null,
          compressed_size_bytes: 1,
          original_size_bytes: 1,
          compression_ratio: 1,
          created_at: '2026-10-03T00:00:00Z',
          expires_at: null,
        },
      ],
      total: 1,
      log_dir: '/x',
      retention_days: 7,
    },
  };

  const r = await manageApi.getRuntimeLogArchives();
  assert.equal(r.items[0].logDate, undefined);
  assert.equal(r.items[0].expiresAt, undefined);
});

test('② 下载 URL：/api/manage/runtime-log-archives/{id}/download，id 需转义', () => {
  assert.equal(
    buildRuntimeLogArchiveDownloadUrl('sha256-abc'),
    '/api/manage/runtime-log-archives/sha256-abc/download',
  );
  // 路径穿越/特殊字符必须被编码（后端按 id 形状校验，前端不得原样拼接）
  assert.equal(
    buildRuntimeLogArchiveDownloadUrl('a/b'),
    '/api/manage/runtime-log-archives/a%2Fb/download',
  );
});