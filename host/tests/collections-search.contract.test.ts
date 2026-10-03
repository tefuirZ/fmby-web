// FE-COLLECTIONS-SEARCH-INPUT：合集列表检索参数对拍（RED → GREEN）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 后端 COLLECTIONS-LIST-SEARCH（wire 取证 crates/fmby-v2-http/src/routes/manage_collections.rs
// `CollectionsListQuery`）：主名 `search`（alias q/searchTerm/search_term）；
// 语义 = trim + lowercase 标题子串，**在 Active 可见性闸之后**应用（Hidden 不泄露）；
// 空白 = 不过滤（全量）；total/has_more 为过滤后语义。webui.md 契约行已含 `search`。
//
// 断言：参数名必须 `search`（前端发 camel 主名）；空白不传（后端语义等同全量）；
// 透传特殊字符（转义交 URLSearchParams，前端不自行加工）。

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

const { collectionsBrowseApi } = await import('@fmby/v2-shared/contracts/browse/collections');

const RAW_PAGE = {
  items: [],
  total: 0,
  page: 1,
  page_size: 20,
  has_more: false,
};

test('① 检索参数名 = `search`（wire 主名，不自造）', async () => {
  reset({ status: 200, json: RAW_PAGE });
  await collectionsBrowseApi.listCollections({ page: 1, search: '周末' });
  const q = new URL(lastUrl()).searchParams;
  assert.equal(q.get('search'), '周末');
  assert.equal(q.get('q'), null);
  assert.equal(q.get('searchTerm'), null);
});

test('② 空白关键词不传 search（后端 trim 空白 = 全量，等价缺省）', async () => {
  reset({ status: 200, json: RAW_PAGE });
  await collectionsBrowseApi.listCollections({ page: 1, search: '   ' });
  const q = new URL(lastUrl()).searchParams;
  assert.equal(q.get('search'), null);
  await collectionsBrowseApi.listCollections({ page: 1, search: '' });
  assert.equal(new URL(lastUrl()).searchParams.get('search'), null);
});

test('③ 无 search 入参时与拆分前 wire 完全一致（回归）', async () => {
  reset({ status: 200, json: RAW_PAGE });
  await collectionsBrowseApi.listCollections({ page: 2, pageSize: 50 });
  const q = new URL(lastUrl()).searchParams;
  assert.equal(q.get('page'), '2');
  assert.equal(q.get('pageSize'), '50');
  assert.equal(q.get('search'), null);
});

test('④ 特殊字符经 URLSearchParams 转义透传（% & + 空格），前端不二次加工', async () => {
  reset({ status: 200, json: RAW_PAGE });
  const needle = '50% & a+b 片单';
  await collectionsBrowseApi.listCollections({ page: 1, search: needle });
  const q = new URL(lastUrl()).searchParams;
  assert.equal(q.get('search'), needle);
});
