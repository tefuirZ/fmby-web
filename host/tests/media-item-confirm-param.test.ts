// FE-CONFIRM-PARAM-FIX：3 个危险操作必须带 `?confirmed=true` query 参数。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 覆盖：
//  - POST   /api/manage/media-items/{id}/metadata/reset       → URL 必须含 ?confirmed=true
//  - DELETE /api/manage/media-items/{id}/artwork/{oid}        → URL 必须含 ?confirmed=true
//  - DELETE /api/manage/media-items/{id}/subtitles/{oid}      → URL 必须含 ?confirmed=true
//
// 断言：直接断言最终请求 URL 字符串包含 `confirmed=true`（不恒真、不只断言「没抛错」）；
// 并各补失败态（404/409/403/401）必须 reject，不吞成成功。

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
const urlOf = (u: string): URL => new URL(u);

const { mediaItemsMutations } = await import(
  '@fmby/v2-shared/contracts/manage/media-items/api'
);

const OK_RESULT = { id: 'x', result: 'done', message: 'ok' };

test('重置元数据：POST 带 ?confirmed=true（URL 断言，非空真）', async () => {
  reset({ status: 200, json: OK_RESULT });
  await mediaItemsMutations.resetMediaItemMetadata('it-1', {
    confirmAction: 'reset-media-item-metadata',
  });
  assert.equal(lastCall().method, 'POST');
  const u = urlOf(lastCall().url);
  assert.equal(u.pathname, '/api/manage/media-items/it-1/metadata/reset');
  // 关键断言：query 必须含 confirmed=true（后端 require_confirmed 缺参必拒）
  assert.equal(u.searchParams.get('confirmed'), 'true', '必须带 ?confirmed=true');
});

test('重置元数据：404（媒体项不存在）必须 reject', async () => {
  reset({ status: 404, json: { error_code: 'not_found', message: '媒体项不存在', retryable: false } });
  await assert.rejects(() =>
    mediaItemsMutations.resetMediaItemMetadata('gone', { confirmAction: 'reset-media-item-metadata' }),
  );
});

test('删除封面：DELETE 带 ?confirmed=true（URL 断言）', async () => {
  reset({ status: 200, json: OK_RESULT });
  await mediaItemsMutations.deleteMediaItemArtwork('it-1', 'ov-9', {
    confirmAction: 'delete-media-item-artwork',
  });
  assert.equal(lastCall().method, 'DELETE');
  const u = urlOf(lastCall().url);
  assert.equal(u.pathname, '/api/manage/media-items/it-1/artwork/ov-9');
  assert.equal(u.searchParams.get('confirmed'), 'true', '必须带 ?confirmed=true');
});

test('删除封面：403（无权限）必须 reject', async () => {
  reset({ status: 403, json: { error_code: 'forbidden', message: '没有权限', retryable: false } });
  await assert.rejects(() =>
    mediaItemsMutations.deleteMediaItemArtwork('it-1', 'ov-9', {
      confirmAction: 'delete-media-item-artwork',
    }),
  );
});

test('删除字幕：DELETE 带 ?confirmed=true（URL 断言）', async () => {
  reset({ status: 200, json: OK_RESULT });
  await mediaItemsMutations.deleteMediaItemSubtitle('it-1', 'sub-3', {
    confirmAction: 'delete-media-item-subtitle',
  });
  assert.equal(lastCall().method, 'DELETE');
  const u = urlOf(lastCall().url);
  assert.equal(u.pathname, '/api/manage/media-items/it-1/subtitles/sub-3');
  assert.equal(u.searchParams.get('confirmed'), 'true', '必须带 ?confirmed=true');
});

test('删除字幕：409（冲突）必须 reject', async () => {
  reset({ status: 409, json: { error_code: 'conflict', message: '冲突', retryable: false } });
  await assert.rejects(() =>
    mediaItemsMutations.deleteMediaItemSubtitle('it-1', 'sub-3', {
      confirmAction: 'delete-media-item-subtitle',
    }),
  );
});

test('对照先例：删除源已正确带 ?confirmed=true（不应回归）', async () => {
  reset({ status: 200, json: OK_RESULT });
  await mediaItemsMutations.deleteMediaItemSource('it-1', 'src-2', {
    confirmAction: 'delete-media-item-source',
  });
  assert.equal(urlOf(lastCall().url).searchParams.get('confirmed'), 'true');
});
