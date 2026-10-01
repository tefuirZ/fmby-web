/**
 * FE-STRICT-TYPES：httpClient 公共解析边界的诚实性（malformed/错误响应负例）。
 *
 * 背景：`executeOnce` 末尾的 `response.json() as T` 是**泛型信任点**（T 由调用方
 * 声明），本次为该断言补 ponytail 注释而非改契约。本测试锁定：错误响应/坏 body
 * 不得被静默当作空数据或成功返回。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { httpClient } from '../src/api/client.ts';

const captured: { url?: string } = {};
let nextResponse: { status: number; body: string | null; headers?: Record<string, string> } = {
  status: 200,
  body: null,
};

(globalThis as unknown as { window: unknown }).window = {
  location: { origin: 'http://localhost:5173' },
};
(globalThis as unknown as { fetch: unknown }).fetch = async (url: string) => {
  captured.url = String(url).replace('http://localhost:5173', '');
  const { status, body, headers } = nextResponse;
  return new Response(body, {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
};

function respond(status: number, body: string | null, headers?: Record<string, string>) {
  nextResponse = { status, body, headers };
}

test('200 + JSON body → 原样返回（契约正例）', async () => {
  respond(200, JSON.stringify({ ok: true }));
  const data = await httpClient.get<{ ok: boolean }>('/api/x');
  assert.deepEqual(data, { ok: true });
  assert.equal(captured.url, '/api/x');
});

test('204 → undefined（无 body，不尝试解析）', async () => {
  respond(204, null);
  const data = await httpClient.delete<unknown>('/api/x');
  assert.equal(data, undefined);
});

test('200 + 非 JSON body → reject，不得静默成空/成功', async () => {
  respond(200, '<html>login page</html>', { 'content-type': 'text/html' });
  await assert.rejects(() => httpClient.get<unknown>('/api/x'));
});

test('200 + 空 body → reject，不得静默成 undefined', async () => {
  respond(200, '');
  await assert.rejects(() => httpClient.get<unknown>('/api/x'));
});

test('500 + 非 JSON body → reject 且带 status 派生 code（不吞成成功）', async () => {
  respond(500, 'gateway exploded', { 'content-type': 'text/plain' });
  await assert.rejects(
    () => httpClient.get<unknown>('/api/x'),
    (error: unknown) => {
      const err = error as { code?: string; retryable?: boolean; message?: string };
      assert.equal(err.code, 'HTTP_500');
      assert.equal(err.retryable, true);
      assert.ok(err.message, '错误 message 必须存在');
      return true;
    },
  );
});

test('502 + 后端错误体 → reject 且透传后端 message/code', async () => {
  respond(502, JSON.stringify({ error_code: 'dependency_unavailable', message: '授权服务未装配' }));
  await assert.rejects(
    () => httpClient.get<unknown>('/api/x'),
    (error: unknown) => {
      const err = error as { code?: string; message?: string };
      assert.equal(err.code, 'dependency_unavailable');
      assert.equal(err.message, '授权服务未装配');
      return true;
    },
  );
});
