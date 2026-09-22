// FE-COLLECTIONS-CONSUME-B2：成员移除(POST/members/remove) + 重排(POST/members/reorder) wire 契约对拍。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 覆盖：
//  - POST /{id}/members/remove  body 仅 {item_id}（取 bound_item_id），返回 Detail
//  - POST /{id}/members/reorder body {member_ids: [...]}
//  - fromMember 透传 bound_item_id（B1 mapper 曾漏映射 → 真实断链，本卡补回）
//  - moveMemberIds 纯函数：上/下移、边界不环绕
//  - 失败态（404/409/403）必须 reject，不吞成空

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
const { moveMemberIds } = await import(
  '../src/pages/manage/collections/components/memberReorder'
);

const RAW_DETAIL_WITH_BOUND = {
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
  members: [
    {
      id: 'm-1',
      collection_id: 'col-1',
      bound_item_id: 'itm-9',
      title_snapshot: '第九区',
      year_snapshot: 2009,
      media_kind: 'Movie',
      poster_url_snapshot: null,
      is_enabled: true,
      release_order: 1,
      watch_order: 1,
      created_at: 0,
      updated_at: 0,
    },
  ],
};

test('移除成员：POST 路径含 collectionId，body 仅 {item_id}（snake_case）', async () => {
  reset({ status: 200, json: RAW_DETAIL_WITH_BOUND });
  await peripheralsApi.removeCollectionMember('col-1', { itemId: 'itm-9' });
  assert.equal(lastCall().method, 'POST');
  assert.equal(pathOf(lastCall().url), '/api/manage/collections/col-1/members/remove');
  assert.deepEqual(lastCall().body, { item_id: 'itm-9' }, '只发 item_id');
});

test('移除成员：collectionId 需 URL 编码（防路径注入）', async () => {
  reset({ status: 200, json: RAW_DETAIL_WITH_BOUND });
  await peripheralsApi.removeCollectionMember('a/b?c=1', { itemId: 'i' });
  assert.ok(!lastCall().url.includes('a/b?c=1'), '路径段必须编码');
  assert.ok(lastCall().url.includes('a%2Fb'));
});

test('移除成员：响应 Detail 的 bound_item_id 必须透传到 record（B1 漏映射的真实断链）', async () => {
  reset({ status: 200, json: RAW_DETAIL_WITH_BOUND });
  const detail = await peripheralsApi.removeCollectionMember('col-1', { itemId: 'itm-9' });
  assert.equal(detail.members[0]!.id, 'm-1');
  assert.equal(detail.members[0]!.boundItemId, 'itm-9', 'bound_item_id 必须透传');
});

test('移除成员：404（合集或成员不存在）必须 reject', async () => {
  reset({ status: 404, json: { error_code: 'not_found', message: '合集或成员不存在', retryable: false } });
  await assert.rejects(() => peripheralsApi.removeCollectionMember('gone', { itemId: 'x' }));
});

test('移除成员：409（约束冲突）必须 reject', async () => {
  reset({ status: 409, json: { error_code: 'conflict', message: '冲突', retryable: false } });
  await assert.rejects(() => peripheralsApi.removeCollectionMember('col-1', { itemId: 'x' }));
});

test('移除成员：403（无权限）必须 reject', async () => {
  reset({ status: 403, json: { error_code: 'forbidden', message: '没有权限', retryable: false } });
  await assert.rejects(() => peripheralsApi.removeCollectionMember('col-1', { itemId: 'x' }));
});

test('重排成员：POST 路径 + body {member_ids: [...]}（顺序即 release_order 递增）', async () => {
  reset({ status: 200, json: { ok: true } });
  await peripheralsApi.reorderCollectionMembers('col-1', { memberIds: ['m-3', 'm-1', 'm-2'] });
  assert.equal(lastCall().method, 'POST');
  assert.equal(pathOf(lastCall().url), '/api/manage/collections/col-1/members/reorder');
  assert.deepEqual(lastCall().body, { member_ids: ['m-3', 'm-1', 'm-2'] });
});

test('重排成员：返回 {ok:true} 原样透传', async () => {
  reset({ status: 200, json: { ok: true } });
  const r = await peripheralsApi.reorderCollectionMembers('col-1', { memberIds: ['m-1'] });
  assert.equal(r.ok, true);
});

test('重排成员：400（成员不属于该合集）必须 reject', async () => {
  reset({ status: 400, json: { error_code: 'validation', message: '成员不属于该合集', retryable: false } });
  await assert.rejects(() =>
    peripheralsApi.reorderCollectionMembers('col-1', { memberIds: ['foreign'] }),
  );
});

test('moveMemberIds：上移（step=-1）交换相邻项', () => {
  const ids = ['a', 'b', 'c'];
  assert.deepEqual(moveMemberIds(ids, 1, -1), ['b', 'a', 'c']);
  assert.deepEqual(moveMemberIds(ids, 1, 1), ['a', 'c', 'b']);
});

test('moveMemberIds：已在边界时不动（不环绕）', () => {
  const ids = ['a', 'b', 'c'];
  assert.deepEqual(moveMemberIds(ids, 0, -1), ['a', 'b', 'c'], '首项目上移 = 原序');
  assert.deepEqual(moveMemberIds(ids, 2, 1), ['a', 'b', 'c'], '末项目下移 = 原序');
});

test('moveMemberIds：越界 index 返回原序副本', () => {
  const ids = ['a', 'b'];
  assert.deepEqual(moveMemberIds(ids, -1, 1), ['a', 'b']);
  assert.deepEqual(moveMemberIds(ids, 5, 1), ['a', 'b']);
  assert.deepEqual(moveMemberIds(ids, 0, 1), ['b', 'a']);
});
