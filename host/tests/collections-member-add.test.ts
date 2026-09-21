// FE-COLLECTIONS-CONSUME-B1：成员添加流的 wire 契约对拍（可证伪）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 覆盖两条此前**零调用**的端点：
//  - GET  /api/manage/collections/member-candidates?keyword=
//  - POST /api/manage/collections/{id}/members/add
//
// 断言：路径/方法/wire 字段名（snake_case）/响应映射/失败透传（不吞成空数组）。

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

const { peripheralsApi } = await import('@fmby/v2-shared/contracts/manage/peripherals');

const RAW_CANDIDATE = {
  item_id: 'itm-1',
  library_id: 'lib-1',
  library_name: '电影库',
  title: '星际穿越',
  original_title: 'Interstellar',
  media_kind: 'Movie',
  year: 2014,
  // 契约：V2 无源 → 恒 null，不伪造
  overview: null,
  community_rating: null,
  poster_url: null,
};

test('候选查询：GET 路径 + keyword 走 query 参数', async () => {
  reset({ status: 200, json: [RAW_CANDIDATE] });
  const list = await peripheralsApi.listCollectionMemberCandidates('星际');
  assert.equal(lastCall().method, 'GET');
  assert.equal(pathOf(lastCall().url), '/api/manage/collections/member-candidates');
  const u = new URL(lastCall().url);
  assert.equal(u.searchParams.get('keyword'), '星际');
});

test('候选查询：响应为裸数组，字段按 snake_case 映射为 camelCase', async () => {
  reset({ status: 200, json: [RAW_CANDIDATE] });
  const list = await peripheralsApi.listCollectionMemberCandidates('星际');
  assert.equal(list.length, 1);
  const c = list[0]!;
  assert.equal(c.itemId, 'itm-1');
  assert.equal(c.libraryId, 'lib-1');
  assert.equal(c.libraryName, '电影库');
  assert.equal(c.title, '星际穿越');
  assert.equal(c.originalTitle, 'Interstellar');
  assert.equal(c.mediaKind, 'Movie');
  assert.equal(c.year, 2014);
});

test('候选查询：恒 null 三字段原样透传（不伪造摘要/评分/海报）', async () => {
  reset({ status: 200, json: [RAW_CANDIDATE] });
  const list = await peripheralsApi.listCollectionMemberCandidates('星际');
  const c = list[0]!;
  assert.equal(c.overview, null, 'overview 恒 null，不得伪造');
  assert.equal(c.communityRating, null, 'community_rating 恒 null，不得回落 0');
  assert.equal(c.posterUrl, null, 'poster_url 恒 null，不得回落占位图');
});

test('候选查询：空数组不是错误（零命中）', async () => {
  reset({ status: 200, json: [] });
  const list = await peripheralsApi.listCollectionMemberCandidates('zzz');
  assert.equal(list.length, 0);
});

test('候选查询：400（keyword 过短）必须 reject，不吞成空列表', async () => {
  reset({
    status: 400,
    json: { error_code: 'validation', message: '关键词至少 2 个字符', retryable: false },
  });
  await assert.rejects(() => peripheralsApi.listCollectionMemberCandidates('a'));
});

test('加入成员：POST 路径含 collectionId，body 仅 {item_id}（snake_case）', async () => {
  reset({
    status: 200,
    json: {
      collection: {
        id: 'col-1',
        title: 'T',
        overview: null,
        poster_url: null,
        source_kind: 'manual',
        visibility: 'Active',
        created_at: 0,
        updated_at: 0,
      },
      members: [],
    },
  });
  await peripheralsApi.addCollectionMember('col-1', { itemId: 'itm-1' });
  assert.equal(lastCall().method, 'POST');
  assert.equal(pathOf(lastCall().url), '/api/manage/collections/col-1/members/add');
  assert.deepEqual(lastCall().body, { item_id: 'itm-1' });
});

test('加入成员：collectionId 需 URL 编码（防路径注入）', async () => {
  reset({
    status: 200,
    json: {
      collection: {
        id: 'x',
        title: 'T',
        overview: null,
        poster_url: null,
        source_kind: 'manual',
        visibility: 'Active',
        created_at: 0,
        updated_at: 0,
      },
      members: [],
    },
  });
  await peripheralsApi.addCollectionMember('a/b?c=1', { itemId: 'i' });
  assert.ok(!lastCall().url.includes('a/b?c=1'), '路径段必须编码');
  assert.ok(lastCall().url.includes('a%2Fb'));
});

test('加入成员：404（合集不存在）必须 reject，不假装成功', async () => {
  reset({
    status: 404,
    json: { error_code: 'not_found', message: '合集不存在', retryable: false },
  });
  await assert.rejects(() => peripheralsApi.addCollectionMember('gone', { itemId: 'i' }));
});

test('加入成员：409（成员冲突）必须 reject', async () => {
  reset({
    status: 409,
    json: { error_code: 'conflict', message: '成员冲突', retryable: false },
  });
  await assert.rejects(() => peripheralsApi.addCollectionMember('col-1', { itemId: 'dup' }));
});

test('加入成员：403（无权限）必须 reject', async () => {
  reset({
    status: 403,
    json: { error_code: 'forbidden', message: '没有权限', retryable: false },
  });
  await assert.rejects(() => peripheralsApi.addCollectionMember('col-1', { itemId: 'i' }));
});
