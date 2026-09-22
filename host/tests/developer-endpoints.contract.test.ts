/**
 * FE-PARITY-DEVELOPER-ENDPOINTS wire 对拍。
 *
 * 真源：`crates/fmby-v2-http/src/routes/manage_developer_api.rs:37/165`
 * 能力门：MANAGE_ACCESS；`require_confirmed` 0 次 → URL 不带 confirmed=true。
 *
 * ★两处 casing 细节（易写反，逐条钉死）：
 * - 查询参数 canonical 是 **camelCase `pageSize`**（后端 `#[serde(rename="pageSize",
 *   alias="page_size")]`）；关键字字段既叫 `q`（`keyword` 只是 alias）。
 * - 响应体是 `serde_json::json!({items,total,page,pageSize})` → `pageSize` **保持
 *   camelCase**，不擅自改写成 page_size。
 * ★items 归 unknown：后端是 serde_json::Value，本卡不猜结构。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { developerApi } from '@fmby/v2-shared/contracts/manage/developerApi';

const captured: { method?: string; url?: string; body?: unknown } = {};
let nextResponse = { status: 200, json: {} as unknown };

(globalThis as unknown as { window: unknown }).window = {
  location: { origin: 'http://localhost:5173' },
};
(globalThis as unknown as { fetch: unknown }).fetch = async (
  url: string,
  init?: { method?: string; body?: string },
) => {
  captured.method = init?.method ?? 'GET';
  captured.url = url.replace('http://localhost:5173', '');
  captured.body = init?.body ? JSON.parse(init.body) : undefined;
  const body = nextResponse.status === 204 ? null : JSON.stringify(nextResponse.json);
  return new Response(body, {
    status: nextResponse.status,
    headers: { 'content-type': 'application/json' },
  });
};

function setResponse(json: unknown, status = 200) {
  nextResponse = { status, json };
}

test('① GET — 无筛选时只发路径，不带空参数', async () => {
  setResponse({ items: [], total: 0, page: 1, pageSize: 50 });
  const r = await developerApi.listEndpoints();
  assert.equal(captured.method, 'GET');
  assert.equal(captured.url, '/api/manage/developer/endpoints');
  assert.equal(r.items.length, 0);
  assert.equal(r.page, 1);
  assert.equal(r.pageSize, 50);
});

test('② 筛选参数：method/scope/q/page + camelCase pageSize', async () => {
  setResponse({ items: [], total: 0, page: 2, pageSize: 20 });
  await developerApi.listEndpoints({
    method: 'GET',
    scope: 'read',
    q: 'mounts',
    page: 2,
    pageSize: 20,
  });
  const url = captured.url ?? '';
  assert.equal(url.startsWith('/api/manage/developer/endpoints?'), true);
  assert.equal(url.includes('method=GET'), true);
  assert.equal(url.includes('scope=read'), true);
  // ★关键字字段是 q（keyword 只是后端别名）
  assert.equal(url.includes('q=mounts'), true);
  assert.equal(url.includes('page=2'), true);
  // ★canonical 是 camelCase pageSize，不得写成 page_size
  assert.equal(url.includes('pageSize=20'), true);
  assert.equal(url.includes('page_size'), false);
});

test('③ 响应 pageSize 保持 camelCase 原样（不改写为 page_size）', async () => {
  setResponse({ items: [{ foo: 1 }], total: 1, page: 1, pageSize: 100 });
  const r = await developerApi.listEndpoints();
  assert.equal(r.pageSize, 100);
  assert.equal(r.total, 1);
  assert.deepEqual(r.items, [{ foo: 1 }]);
});

test('④ items 结构不猜：原样透传，不做字段补全/改名', async () => {
  const rawItem = { path: '/api/x', method: 'POST', unknown_field: true };
  setResponse({ items: [rawItem], total: 1, page: 1, pageSize: 50 });
  const r = await developerApi.listEndpoints();
  // 契约层不得注入缺失字段，也不得改名
  assert.deepEqual(r.items[0], rawItem);
  assert.equal(Object.keys(r.items[0] as object).length, Object.keys(rawItem).length);
});

test('⑤ URL 不带 confirmed（后端本文件 require_confirmed=0）', async () => {
  setResponse({ items: [], total: 0, page: 1, pageSize: 50 });
  await developerApi.listEndpoints();
  assert.equal((captured.url ?? '').includes('confirmed'), false);
});

test('⑥ fail-closed：403 缺 MANAGE_ACCESS 必须抛出，不吞成空目录', async () => {
  setResponse({ code: 'forbidden', message: 'missing capability manage:access' }, 403);
  await assert.rejects(() => developerApi.listEndpoints());
});

test('⑦ fail-closed：端口未装配（后端 Validation 中文文案）必须抛出并透传文案', async () => {
  setResponse(
    { code: 'error', message: 'API 令牌服务未装配，请稍后重试或联系管理员。' },
    400,
  );
  // ★node:test 别名加载器下 ApiError 属不同 realm，regex 匹配会退化成
  //   '[object Object]'（known harness quirk）→ 改为捕获后直接断言 message。
  let thrown: unknown;
  try {
    await developerApi.listEndpoints();
  } catch (err) {
    thrown = err;
  }
  assert.ok(thrown, '必须抛出，不得吞成空目录');
  const message = (thrown as { message?: string }).message ?? '';
  assert.match(message, /API 令牌服务未装配/);
});
