// FE-PARITY-MOUNTS-REFRESH 契约对拍测试。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 覆盖：
// - POST /api/manage/mounts/batch/refresh-abnormal 必须带 ?confirmed=true（后端保留在 20 条危险闸内）
// - 失败态（403/409）必须透传后端错误，不吞成空/假成功

import test from 'node:test';
import assert from 'node:assert/strict';
import { manageApi } from '@fmby/v2-shared/contracts/manage';

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

const CONFIRM_BODY = { confirmAction: 'batch-refresh-abnormal-mounts' };

test('batchRefreshAbnormalMounts 带 ?confirmed=true', async () => {
  reset({ status: 200, json: { results: [] } });
  await manageApi.batchRefreshAbnormalMounts(CONFIRM_BODY);
  const call = lastCall();
  assert.equal(call.method, 'POST');
  assert.equal(new URL(call.url).pathname, '/api/manage/mounts/batch/refresh-abnormal');
  assert.equal(queryOf(call.url).get('confirmed'), 'true');
  assert.equal((call.body as { confirm_action?: string }).confirm_action, 'batch-refresh-abnormal-mounts');
});

test('batchRefreshAbnormalMounts 在 403 下必须 reject（不吞成成功）', async () => {
  reset({ status: 403, json: { code: 'FORBIDDEN', message: '没有危险操作权限' } });
  await assert.rejects(
    () => manageApi.batchRefreshAbnormalMounts(CONFIRM_BODY),
    (err: Error) => err.message.includes('没有危险操作权限'),
  );
});

test('batchRefreshAbnormalMounts 在 409 下必须 reject（不吞成成功）', async () => {
  reset({ status: 409, json: { code: 'CONFLICT', message: '无异常挂载可刷新' } });
  await assert.rejects(
    () => manageApi.batchRefreshAbnormalMounts(CONFIRM_BODY),
    (err: Error) => err.message.includes('无异常挂载可刷新'),
  );
});
