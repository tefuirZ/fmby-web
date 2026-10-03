// FE-GAP-ROUND4：挂载↔媒体库绑定管理三端点契约对拍（RED → GREEN）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 后端 wire 取证（origin/main，G7-B「挂载→媒体库绑定管理面三端点」）：
//   GET    /api/manage/mounts/{id}/libraries             → {mount_id, library_ids[]}
//   POST   /api/manage/mounts/{id}/libraries             body {library_id}（幂等绑定）→ {ok}
//   DELETE /api/manage/mounts/{id}/libraries/{library_id} → {ok}
//   门 = session + MANAGE_LIBRARY；不可见挂载 R2.5 ⇒ 404。
// 前端全仓零调用（origin/main ref：mounts/{id}/libraries 等形态 0 命中）。

import test from 'node:test';
import assert from 'node:assert/strict';

(globalThis as { window?: unknown }).window = { location: { origin: 'http://localhost:5173' } };

const captured: Array<{ method: string; url: string; body: unknown }> = [];
let nextResponse: { status: number; json: unknown } = { status: 200, json: {} };

(globalThis as { fetch?: unknown }).fetch = async (input: unknown, init: Record<string, unknown> = {}) => {
  const url = typeof input === 'string' ? input : String((input as { url?: string })?.url ?? input);
  const method = String(init.method ?? 'GET').toUpperCase();
  let body: unknown;
  if (typeof init.body === 'string') {
    try { body = JSON.parse(init.body); } catch { body = init.body; }
  }
  captured.push({ method, url, body });
  const { status, json } = nextResponse;
  return new Response(JSON.stringify(json), {
    status,
    headers: status === 204 ? undefined : { 'content-type': 'application/json' },
  });
};

function reset(next: { status: number; json: unknown }): void {
  captured.length = 0;
  nextResponse = next;
}
const lastCall = (): { method: string; url: string; body: unknown } => captured[captured.length - 1]!;
const pathOf = (u: string): string => new URL(u).pathname;

const { manageApi } = await import('@fmby/v2-shared/contracts/manage');

test('① 绑定列表：GET /api/manage/mounts/{id}/libraries → mountId + libraryIds[]', async () => {
  reset({ status: 200, json: { mount_id: 7, library_ids: [1, 2] } });
  const res = await manageApi.listMountLibraries('7');
  assert.equal(lastCall().method, 'GET');
  assert.equal(pathOf(lastCall().url), '/api/manage/mounts/7/libraries');
  assert.equal(res.mountId, 7);
  assert.deepEqual(res.libraryIds, [1, 2]);
});

test('② 绑定：POST body {library_id}（snake wire）→ {ok}', async () => {
  reset({ status: 200, json: { ok: true } });
  const r = await manageApi.bindMountLibrary('7', '3');
  assert.equal(lastCall().method, 'POST');
  assert.equal(pathOf(lastCall().url), '/api/manage/mounts/7/libraries');
  assert.deepEqual((lastCall().body as { library_id: string }).library_id, '3');
  assert.equal(r.ok, true);
});

test('③ 解绑：DELETE /api/manage/mounts/{id}/libraries/{library_id} → {ok}', async () => {
  reset({ status: 200, json: { ok: true } });
  const r = await manageApi.unbindMountLibrary('7', '3');
  assert.equal(lastCall().method, 'DELETE');
  assert.equal(pathOf(lastCall().url), '/api/manage/mounts/7/libraries/3');
  assert.equal(r.ok, true);
});

test('④ 错误透传：不可见挂载 404 / 校验 400（不吞）', async () => {
  reset({ status: 404, json: { error_code: 'not_found', message: 'mount 7' } });
  await assert.rejects(() => manageApi.listMountLibraries('7'));
  reset({ status: 400, json: { error_code: 'validation', message: 'invalid id' } });
  await assert.rejects(() => manageApi.bindMountLibrary('abc', '3'));
});
