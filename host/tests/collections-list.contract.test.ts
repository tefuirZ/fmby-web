// FE-USER-COLLECTIONS-LIST-PAGE-2：用户面合集列表 wire 契约对拍（RED → GREEN）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 后端 USER-COLLECTIONS-LIST-BE（3fa7baeaf）落地 `GET /api/collections`：
//   session + BROWSE；Active 可见性闸（Hidden 不泄露）；分页 `page`/`pageSize`
//   （snake alias page_size），默认 20 clamp[1,200]；响应
//   `{items,total,page,page_size,has_more}`；检索参数暂无（COLLECTIONS-LIST-SEARCH 在途）。
// 断言：路径/方法/query 参数名/DTO 字段 snake→camel 映射/分页边界，防再漂移。

import test from 'node:test';
import assert from 'node:assert/strict';

(globalThis as { window?: unknown }).window = { location: { origin: 'http://localhost:5173' } };

interface Captured {
  method: string;
  url: string;
}
const captured: Captured[] = [];
let nextResponse: { status: number; json: unknown } = { status: 200, json: {} };

(globalThis as { fetch?: unknown }).fetch = async (input: unknown) => {
  const url = typeof input === 'string' ? input : String((input as { url?: string })?.url ?? input);
  const method = 'GET';
  captured.push({ method, url });
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
const lastCall = (): Captured => captured[captured.length - 1]!;
const pathOf = (u: string): string => new URL(u).pathname;

const { collectionsBrowseApi } = await import('@fmby/v2-shared/contracts/browse/collections');

const RAW_DTO = {
  id: 'c-1',
  title: '周末片单',
  overview: null,
  poster_url: null,
  source_kind: 'manual',
  collection_kind: 'custom',
  auto_expand_enabled: false,
  min_effective_members: null,
  artwork_mode: 'none',
  visibility: 'Active',
  created_at: 1_700_000_000,
  updated_at: 1_700_000_100,
};

const RAW_PAGE = (overrides: Record<string, unknown> = {}) => ({
  items: [RAW_DTO],
  total: 1,
  page: 1,
  page_size: 20,
  has_more: false,
  ...overrides,
});

test('列表：GET /api/collections（用户面路径，非 manage）', async () => {
  reset({ status: 200, json: RAW_PAGE() });
  await collectionsBrowseApi.listCollections();
  assert.equal(lastCall().method, 'GET');
  assert.equal(pathOf(lastCall().url), '/api/collections');
});

test('列表：默认不发分页参数（page=1/page_size=20 由后端缺省）', async () => {
  reset({ status: 200, json: RAW_PAGE() });
  await collectionsBrowseApi.listCollections();
  assert.equal(new URL(lastCall().url).search, '', '缺省应无 query');
});

test('列表：page/pageSize 走 query 参数（camel 主名）', async () => {
  reset({ status: 200, json: RAW_PAGE() });
  await collectionsBrowseApi.listCollections({ page: 3, pageSize: 50 });
  const q = new URL(lastCall().url).searchParams;
  assert.equal(q.get('page'), '3');
  assert.equal(q.get('pageSize'), '50');
});

test('列表：DTO snake→camel 映射（items 元素 = ManagedCollectionRecord）', async () => {
  reset({ status: 200, json: RAW_PAGE() });
  const res = await collectionsBrowseApi.listCollections();
  assert.equal(res.total, 1);
  assert.equal(res.page, 1);
  assert.equal(res.pageSize, 20);
  assert.equal(res.hasMore, false);
  assert.equal(res.items.length, 1);
  assert.equal(res.items[0]!.id, 'c-1');
  assert.equal(res.items[0]!.title, '周末片单');
  assert.equal(res.items[0]!.sourceKind, 'manual');
  assert.equal(res.items[0]!.autoExpandEnabled, false);
});

test('列表：has_more=true 透传（分页语义）', async () => {
  reset({ status: 200, json: RAW_PAGE({ total: 45, page: 2, has_more: true }) });
  const res = await collectionsBrowseApi.listCollections({ page: 2 });
  assert.equal(res.hasMore, true);
});

test('列表：空列表不吞错、原样给 empty 语义', async () => {
  reset({ status: 200, json: RAW_PAGE({ items: [], total: 0, has_more: false }) });
  const res = await collectionsBrowseApi.listCollections();
  assert.deepEqual(res.items, []);
  assert.equal(res.total, 0);
});

test('列表：401/403 透传 reject（不吞成空列表）', async () => {
  reset({ status: 401, json: { code: 'unauthorized', message: 'x' } });
  await assert.rejects(() => collectionsBrowseApi.listCollections());
  reset({ status: 403, json: { code: 'forbidden', message: 'x' } });
  await assert.rejects(() => collectionsBrowseApi.listCollections());
});
