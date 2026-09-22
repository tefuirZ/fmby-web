// FE-PARITY-MEDIA-ITEMS-DETAIL 契约对拍测试。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 覆盖：
// - 危险写（metadata/reset、visibility、identity/manual-match）URL 必须带 ?confirmed=true
// - identify / provider-search 不带 confirmed（非危险闸）
// - 失败态（403/404/409）必须透传后端错误，不能吞成空/假成功

import test from 'node:test';
import assert from 'node:assert/strict';
import { mediaItemsApi } from '@fmby/v2-shared/contracts/manage/media-items';

(globalThis as { window?: unknown }).window = { location: { origin: 'http://localhost:5173' } };

interface Captured {
  method: string;
  url: string;
  body: unknown;
}

const captured: Captured[] = [];
let nextResponse: { status: number; json: unknown } = { status: 200, json: {} };

(globalThis as { fetch?: unknown }).fetch = async (input: unknown, init: Record<string, unknown> = {}) => {
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
  const resBody = status === 204 ? null : JSON.stringify(json);
  return new Response(resBody, {
    status,
    headers: status === 204 ? undefined : { 'content-type': 'application/json' },
  });
};

function reset(next: { status: number; json: unknown }): void {
  captured.length = 0;
  nextResponse = next;
}

const lastCall = (): Captured => captured[captured.length - 1]!;
const queryOf = (url: string): URLSearchParams => new URL(url).searchParams;

const OK = { status: 200, json: {} };
const CONFIRM_BODY = { confirmAction: 'x', sessionConfirmation: undefined, currentPassword: undefined };

test('resetMediaItemMetadata 带 ?confirmed=true 且不是 400 裸奔', async () => {
  reset(OK);
  await mediaItemsApi.resetMediaItemMetadata('item-1', CONFIRM_BODY);
  const call = lastCall();
  assert.equal(call.method, 'POST');
  assert.equal(new URL(call.url).pathname, '/api/manage/media-items/item-1/metadata/reset');
  assert.equal(queryOf(call.url).get('confirmed'), 'true');
});

test('setMediaItemVisibility 危险闸带 ?confirmed=true', async () => {
  reset(OK);
  await mediaItemsApi.setMediaItemVisibility('item-1', 'hidden', CONFIRM_BODY);
  const call = lastCall();
  assert.equal(call.method, 'POST');
  assert.equal(new URL(call.url).pathname, '/api/manage/media-items/item-1/visibility/hidden');
  assert.equal(queryOf(call.url).get('confirmed'), 'true');
});

test('manualMatchMediaItemIdentity 危险闸带 ?confirmed=true', async () => {
  reset(OK);
  await mediaItemsApi.manualMatchMediaItemIdentity(
    'item-1',
    { provider: 'tmdb', providerItemId: 'abc', confirmAction: 'm' },
    CONFIRM_BODY,
  );
  const call = lastCall();
  assert.equal(call.method, 'POST');
  assert.equal(new URL(call.url).pathname, '/api/manage/media-items/item-1/identity/manual-match');
  assert.equal(queryOf(call.url).get('confirmed'), 'true');
});

test('identifyMediaItem 仅能力门、不带 confirmed', async () => {
  reset({ status: 200, json: { itemId: 'item-1', taskId: '7', outcome: 'queued', status: 'Queued', fingerprint: '' } });
  await mediaItemsApi.identifyMediaItem('item-1', {});
  const call = lastCall();
  assert.equal(call.method, 'POST');
  assert.equal(new URL(call.url).pathname, '/api/manage/media-items/item-1/identify');
  assert.equal(queryOf(call.url).get('confirmed'), null);
});

test('searchMediaItemProvider 走 GET 且参数映射为 provider/q', async () => {
  reset({ status: 200, json: { provider: 'tmdb', query: 'matrix', candidates: [] } });
  await mediaItemsApi.searchMediaItemProvider('item-1', { provider: 'tmdb', query: 'matrix' });
  const call = lastCall();
  assert.equal(call.method, 'GET');
  assert.equal(new URL(call.url).pathname, '/api/manage/media-items/item-1/provider-search');
  assert.equal(queryOf(call.url).get('provider'), 'tmdb');
  assert.equal(queryOf(call.url).get('q'), 'matrix');
});

test('resetMediaItemMetadata 在 403 下必须 reject（不吞成成功）', async () => {
  reset({ status: 403, json: { code: 'FORBIDDEN', message: '没有危险操作权限' } });
  await assert.rejects(
    () => mediaItemsApi.resetMediaItemMetadata('item-1', CONFIRM_BODY),
    (err: Error) => {
      // getErrorMessage 透传后端 message，而不是吞成空/伪造
      return err.message.includes('没有危险操作权限');
    },
  );
});

test('setMediaItemVisibility 在 409 下必须 reject（不吞成成功）', async () => {
  reset({ status: 409, json: { code: 'CONFLICT', message: '可见性状态冲突' } });
  await assert.rejects(
    () => mediaItemsApi.setMediaItemVisibility('item-1', 'hidden', CONFIRM_BODY),
    (err: Error) => err.message.includes('可见性状态冲突'),
  );
});

test('manualMatchMediaItemIdentity 在 404 下必须 reject（不吞成成功）', async () => {
  reset({ status: 404, json: { code: 'NOT_FOUND', message: '资源不存在' } });
  await assert.rejects(
    () =>
      mediaItemsApi.manualMatchMediaItemIdentity(
        'item-1',
        { provider: 'tmdb', providerItemId: 'abc', confirmAction: 'm' },
        CONFIRM_BODY,
      ),
    (err: Error) => err.message.includes('资源不存在'),
  );
});
