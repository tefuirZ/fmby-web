// FE-CONTINUE-WATCHING：继续观看 / 最近添加独立分页契约对拍（RED → GREEN）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 后端（origin/main browse.rs + contracts/dto/browse.rs）：
//   GET /api/browse/resume          → {items[], next_cursor?, has_more}
//   GET /api/browse/recently-added  → 同形，另收 libraryId 作用域
//   共用 BrowsePagedQuery：pageSize（camel 主名+snake alias）、cursor（keyset，
//   非 OFFSET）、libraryId；错误 400 非法游标 / 500 端口未装配（fail-closed）。
// 前端此前零调用（首页 bootstrap 只给限量，无翻页浏览全部能力）。

import test from 'node:test';
import assert from 'node:assert/strict';

(globalThis as { window?: unknown }).window = { location: { origin: 'http://localhost:5173' } };

const captured: Array<{ method: string; url: string }> = [];
let nextResponse: { status: number; json: unknown } = { status: 200, json: {} };

(globalThis as { fetch?: unknown }).fetch = async (input: unknown) => {
  const url = typeof input === 'string' ? input : String((input as { url?: string })?.url ?? input);
  captured.push({ method: 'GET', url });
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
const lastUrl = (): string => captured[captured.length - 1]!.url;

const { browseApi } = await import('@fmby/v2-shared/contracts/browse');

const RAW_ITEM = {
  id: 'itm-1',
  title: '星际穿越',
  kind: 'movie',
  year: 2014,
  library_id: 'lib-1',
  series_id: null,
  season_id: null,
  episode_number: null,
  season_number: null,
  added_at: '2026-10-01T00:00:00Z',
  last_played_at: '2026-10-02T00:00:00Z',
  has_playable_source: true,
};

const RAW_PAGE = (items: unknown[], hasMore = false, cursor: string | null = null) => ({
  items,
  next_cursor: cursor,
  has_more: hasMore,
});

test('① resume：GET /api/browse/resume，缺省无 query（首屏）', async () => {
  reset({ status: 200, json: RAW_PAGE([RAW_ITEM]) });
  const page = await browseApi.getContinueWatching();
  assert.equal(pathOf(lastUrl()), '/api/browse/resume');
  assert.equal(new URL(lastUrl()).search, '');
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0]!.id, 'itm-1');
  assert.equal(page.items[0]!.title, '星际穿越');
  assert.equal(page.hasMore, false);
  assert.equal(page.nextCursor, null);
});

test('② resume 翻页：cursor + pageSize 走 query（keyset）', async () => {
  reset({ status: 200, json: RAW_PAGE([RAW_ITEM], true, 'cur-9') });
  const page = await browseApi.getContinueWatching({ cursor: 'cur-1', pageSize: 50 });
  const q = new URL(lastUrl()).searchParams;
  assert.equal(q.get('cursor'), 'cur-1');
  assert.equal(q.get('pageSize'), '50');
  assert.equal(page.hasMore, true);
  assert.equal(page.nextCursor, 'cur-9');
});

test('③ recently-added：GET /api/browse/recently-added + libraryId 作用域', async () => {
  reset({ status: 200, json: RAW_PAGE([RAW_ITEM]) });
  const page = await browseApi.getRecentlyAddedPaged({ libraryId: 'lib-1' });
  assert.equal(pathOf(lastUrl()), '/api/browse/recently-added');
  const q = new URL(lastUrl()).searchParams;
  assert.equal(q.get('libraryId'), 'lib-1');
  assert.equal(page.items[0]!.addedAt, '2026-10-01T00:00:00Z');
});

test('④ 错误透传：非法游标 400 / 未装配 500（fail-closed，不吞）', async () => {
  reset({ status: 400, json: { error_code: 'validation', message: 'invalid cursor' } });
  await assert.rejects(() => browseApi.getContinueWatching({ cursor: 'bad' }));
  reset({ status: 500, json: { error_code: 'dependency_unavailable', message: 'not wired' } });
  await assert.rejects(() => browseApi.getRecentlyAddedPaged());
});

function pathOf(u: string): string {
  return new URL(u).pathname;
}
