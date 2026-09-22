// FE-LIBRARY-ORDER-UI：媒体库排序契约层 wire 对拍（PUT /api/manage/libraries/order）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

(globalThis as { window?: unknown }).window = { location: { origin: 'http://localhost:5173' } };

interface Captured {
  method: string;
  url: string;
  body: unknown;
}
const captured: Captured[] = [];
let nextResponse: { status: number; json: unknown } = { status: 200, json: {} };

(globalThis as { fetch?: unknown }).fetch = async (
  input: unknown,
  init: Record<string, unknown> = {},
) => {
  const url = typeof input === 'string' ? input : String((input as { url?: string })?.url ?? input);
  const method = String(init.method ?? 'GET').toUpperCase();
  let body: unknown;
  if (typeof init.body === 'string') {
    try {
      body = JSON.parse(init.body);
    } catch {
      body = init.body;
    }
  }
  captured.push({ method, url, body });
  const { status, json } = nextResponse;
  return new Response(status === 204 ? null : JSON.stringify(json), {
    status,
    headers: status === 204 ? undefined : { 'content-type': 'application/json' },
  });
};

function reset(next: { status: number; json: unknown }): void {
  captured.length = 0;
  nextResponse = next;
}
const lastCall = (): Captured => captured[captured.length - 1]!;
const pathOf = (u: string): string => new URL(u).pathname;

const { manageApi } = await import('@fmby/v2-shared/contracts/manage');

const RAW_LIBRARY_LIST = {
  items: [
    { id: 'lib-3', name: 'C', description: '', library_type: 'movie', status: 'healthy', item_count: 1, source_names: [], actual_source_names: [], visibility: 'public', created_at: '0', updated_at: '0' },
    { id: 'lib-1', name: 'A', description: '', library_type: 'movie', status: 'healthy', item_count: 2, source_names: [], actual_source_names: [], visibility: 'public', created_at: '0', updated_at: '0' },
  ],
};

test('reorderLibraries：PUT /api/manage/libraries/order + body {library_ids}（snake_case）', async () => {
  reset({ status: 200, json: RAW_LIBRARY_LIST });
  await manageApi.reorderLibraries(['lib-3', 'lib-1']);
  assert.equal(lastCall().method, 'PUT');
  assert.equal(pathOf(lastCall().url), '/api/manage/libraries/order');
  assert.deepEqual(lastCall().body, { library_ids: ['lib-3', 'lib-1'] });
});

test('reorderLibraries：返回排序后的库列表（items 顺序随请求）', async () => {
  reset({ status: 200, json: RAW_LIBRARY_LIST });
  const res = await manageApi.reorderLibraries(['lib-3', 'lib-1']);
  assert.deepEqual(res.items.map((l) => l.id), ['lib-3', 'lib-1']);
});

test('reorderLibraries：失败态必须 reject（不吞成空列表）', async () => {
  reset({ status: 409, json: { error_code: 'conflict', message: '冲突', retryable: false } });
  await assert.rejects(() => manageApi.reorderLibraries(['lib-1', 'lib-3']));
});
