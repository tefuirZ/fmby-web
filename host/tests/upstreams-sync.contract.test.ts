import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upstreamsApi } from '@fmby/v2-shared/contracts/manage/upstreams';

// ─── 测试桩：捕获 httpClient 真实发出的 {method,url,body} ──────────────────────
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

const JOB = {
  id: '600',
  source_id: '1',
  job_kind: 'EmbyImport',
  status: 'Pending',
  category_ids: ['7'],
  page_size: 100,
  worker_count: null,
  result_summary: {},
  last_error_message: null,
  attempt_count: 0,
  max_attempts: 3,
  created_by: '1',
  started_at: null,
  finished_at: null,
  created_at: 1000,
  updated_at: 1000,
};

test('① listSyncJobs → GET /api/manage/upstreams/{id}/sync-jobs', async () => {
  installFetchStub();
  setResponse({ items: [JOB], total: 1 });
  const r = await upstreamsApi.listSyncJobs('1');
  assert.equal(captured.method, 'GET');
  assert.equal(captured.url, '/api/manage/upstreams/1/sync-jobs');
  assert.equal(r.items[0].jobKind, 'EmbyImport');
  assert.equal(r.items[0].sourceId, '1');
  assert.equal(r.total, 1);
});

test('② getSyncJob → GET /api/manage/upstreams/{id}/sync-jobs/{job_id}', async () => {
  installFetchStub();
  setResponse(JOB);
  const r = await upstreamsApi.getSyncJob('1', '600');
  assert.equal(captured.method, 'GET');
  assert.equal(captured.url, '/api/manage/upstreams/1/sync-jobs/600');
  assert.equal(r.id, '600');
  assert.equal(r.status, 'Pending');
});

test('③ appleCmsSyncPage → POST .../apple-cms/sync-page（categoryId 必填 snake_case）', async () => {
  installFetchStub();
  setResponse({
    source_id: '1',
    category_id: '7',
    library_id: '9',
    page: 1,
    page_count: 3,
    total: 42,
    imported_item_count: 2,
    imported_variant_count: 5,
    synced_at: 1000,
  });
  const r = await upstreamsApi.appleCmsSyncPage('1', { categoryId: '7', page: 1 });
  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, '/api/manage/upstreams/1/apple-cms/sync-page');
  assert.deepEqual(captured.body, { categoryId: '7', page: 1 });
  assert.equal(r.categoryId, '7');
  assert.equal(r.importedVariantCount, 5);
});

test('④ appleCmsSync → POST .../apple-cms/sync（全量）', async () => {
  installFetchStub();
  setResponse({
    source_id: '1',
    page_size: 50,
    worker_count: 4,
    category_count: 1,
    discovered_category_count: 2,
    bound_category_count: 1,
    skipped_unbound_category_count: 1,
    imported_item_count: 3,
    imported_variant_count: 6,
    synced_at: 1000,
  });
  const r = await upstreamsApi.appleCmsSync('1', { categoryId: '7' });
  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, '/api/manage/upstreams/1/apple-cms/sync');
  assert.deepEqual(captured.body, { categoryId: '7' });
  assert.equal(r.importedItemCount, 3);
  assert.equal(r.skippedUnboundCategoryCount, 1);
});

test('⑤ embySync → POST .../emby/sync', async () => {
  installFetchStub();
  setResponse({
    source_id: '1',
    page_size: 100,
    category_count: 1,
    imported_item_count: 4,
    imported_variant_count: 7,
    synced_at: 1000,
  });
  const r = await upstreamsApi.embySync('1', { categoryId: '9' });
  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, '/api/manage/upstreams/1/emby/sync');
  assert.deepEqual(captured.body, { categoryId: '9' });
  assert.equal(r.importedVariantCount, 7);
});

test('⑥ embyImportPreview → POST .../emby/import/preview（dry-run）', async () => {
  installFetchStub();
  setResponse({
    source_id: '1',
    page_size: 100,
    category_count: 1,
    imported_item_count: 4,
    imported_variant_count: 7,
    synced_at: 1000,
  });
  const r = await upstreamsApi.embyImportPreview('1', {});
  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, '/api/manage/upstreams/1/emby/import/preview');
  assert.deepEqual(captured.body, {});
  assert.equal(r.importedItemCount, 4);
});

test('⑦ embyImportEnqueue → POST .../emby/import（返回作业）', async () => {
  installFetchStub();
  setResponse(JOB);
  const r = await upstreamsApi.embyImportEnqueue('1', {});
  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, '/api/manage/upstreams/1/emby/import');
  assert.equal(r.jobKind, 'EmbyImport');
  assert.equal(r.id, '600');
});

test('⑧ listEmbyImportJobs → GET .../emby/import/jobs', async () => {
  installFetchStub();
  setResponse({ items: [JOB], total: 1 });
  const r = await upstreamsApi.listEmbyImportJobs('1');
  assert.equal(captured.method, 'GET');
  assert.equal(captured.url, '/api/manage/upstreams/1/emby/import/jobs');
  assert.equal(r.items[0].id, '600');
});

test('⑨ getEmbyImportJob → GET .../emby/import/jobs/{job_id}', async () => {
  installFetchStub();
  setResponse(JOB);
  const r = await upstreamsApi.getEmbyImportJob('1', '600');
  assert.equal(captured.method, 'GET');
  assert.equal(captured.url, '/api/manage/upstreams/1/emby/import/jobs/600');
  assert.equal(r.status, 'Pending');
});

test('⑩ fail-closed：端口未装配 500 必须 reject（不吞成空）', async () => {
  installFetchStub();
  setResponse({ error_code: 'INTERNAL', message: 'upstream_sync 端口未装配' }, 500);
  await assert.rejects(() => upstreamsApi.listSyncJobs('1'));
});
