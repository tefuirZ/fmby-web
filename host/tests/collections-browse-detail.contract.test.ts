// FE-USER-COLLECTIONS-BROWSE：用户面合集详情 wire 契约对拍（RED → GREEN）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 覆盖后端 USER-COLLECTIONS-SURFACE-BE 落地的用户面读面：
//  - GET /api/collections/{id}（session + BROWSE；Hidden ⇒ 404）
// 断言：路径必须是**用户面** `/api/collections/{id}`（不得误用 manage 路径）/
//       snake_case → camelCase 映射 / 404 透传（Hidden 不泄露、不吞成空）。

import test from 'node:test';
import assert from 'node:assert/strict';

(globalThis as { window?: unknown }).window = { location: { origin: 'http://localhost:5173' } };

interface Captured {
  method: string;
  url: string;
}
const captured: Captured[] = [];
let nextResponse: { status: number; json: unknown } = { status: 200, json: {} };

(globalThis as { fetch?: unknown }).fetch = async (
  input: unknown,
  init: Record<string, unknown> = {},
) => {
  const url = typeof input === 'string' ? input : String((input as { url?: string })?.url ?? input);
  const method = String(init.method ?? 'GET').toUpperCase();
  captured.push({ method, url });
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

const { collectionsBrowseApi } = await import('@fmby/v2-shared/contracts/browse/collections');

const RAW_DETAIL = {
  collection: {
    id: 'c-7',
    title: '周末片单',
    overview: '给周末看的片子',
    poster_url: null,
    source_kind: 'manual',
    collection_kind: 'custom',
    auto_expand_enabled: false,
    min_effective_members: null,
    artwork_mode: 'none',
    visibility: 'Active',
    created_at: 1_700_000_000,
    updated_at: 1_700_000_100,
  },
  members: [
    {
      id: 'm-1',
      collection_id: 'c-7',
      bound_item_id: 'itm-1',
      title_snapshot: '星际穿越',
      year_snapshot: 2014,
      media_kind: 'Movie',
      poster_url_snapshot: null,
      is_enabled: true,
      release_order: 1,
      watch_order: null,
      created_at: 1_700_000_000,
      updated_at: 1_700_000_000,
    },
  ],
  rules: [],
  member_overrides: [],
};

test('详情：GET /api/collections/{id}（用户面路径，非 manage）', async () => {
  reset({ status: 200, json: RAW_DETAIL });
  await collectionsBrowseApi.getCollection('c-7');
  assert.equal(lastCall().method, 'GET');
  assert.equal(pathOf(lastCall().url), '/api/collections/c-7');
});

test('详情：id 走 encodeURIComponent', async () => {
  reset({ status: 200, json: RAW_DETAIL });
  await collectionsBrowseApi.getCollection('a/b');
  assert.equal(pathOf(lastCall().url), '/api/collections/a%2Fb');
});

test('详情：snake_case → camelCase 映射（collection + members）', async () => {
  reset({ status: 200, json: RAW_DETAIL });
  const detail = await collectionsBrowseApi.getCollection('c-7');
  assert.equal(detail.collection.id, 'c-7');
  assert.equal(detail.collection.title, '周末片单');
  assert.equal(detail.collection.sourceKind, 'manual');
  assert.equal(detail.collection.autoExpandEnabled, false);
  assert.equal(detail.members.length, 1);
  assert.equal(detail.members[0]!.titleSnapshot, '星际穿越');
  assert.equal(detail.members[0]!.boundItemId, 'itm-1');
});

test('详情：Hidden ⇒ 404 透传（不吞成空、不泄露）', async () => {
  reset({ status: 404, json: { code: 'not_found', message: 'collection 7' } });
  await assert.rejects(() => collectionsBrowseApi.getCollection('7'));
});