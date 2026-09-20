// FE-CONTRACT-DRIFT-CLOSE：用户管理批量硬删 API 层对拍。
//
// 后端真值（V2 main，routes/mod.rs:333-336 + routes/manage_users.rs:149）：
//   POST /api/manage/users/batch/permanent-delete?confirmed=true
//   body = BatchUserIdsRequest{user_ids}，响应 {updated_count, results}。
// 前端此前打 `/batch/delete`（V1/V2 全仓无此路由）⇒ 404，批量硬删在 UI 断线。
// 本测试锁定：①路径 ②confirmed=true 查询参 ③body 形状 ④响应映射——
// 路径或 confirmed 回退任一即红。
import test from 'node:test';
import assert from 'node:assert/strict';

// node 环境无 window/sessionStorage：client.ts 依赖它们。
const sessionStorageStore = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  location: { origin: 'http://test.local' },
};
(globalThis as unknown as { sessionStorage: unknown }).sessionStorage = {
  getItem: (key: string) => sessionStorageStore.get(key) ?? null,
  setItem: (key: string, value: string) => void sessionStorageStore.set(key, value),
  removeItem: (key: string) => void sessionStorageStore.delete(key),
};

type RouteHandler = (url: string, init?: RequestInit) => Response | undefined;
let routeHandler: RouteHandler = () => undefined;
let lastBody: unknown = undefined;

const originalFetch = globalThis.fetch;
(globalThis as unknown as { fetch: unknown }).fetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (typeof init?.body === 'string') {
    try {
      lastBody = JSON.parse(init.body);
    } catch {
      lastBody = init.body;
    }
  }
  const response = routeHandler(url, init);
  if (response) return response;
  return new Response(JSON.stringify({ message: 'no route' }), { status: 404 });
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const { manageApi } = await import('../src/contracts/manage/api.ts');

test.after(() => {
  (globalThis as unknown as { fetch: unknown }).fetch = originalFetch;
});

test('批量硬删：打 /batch/permanent-delete?confirmed=true（不再打不存在的 /batch/delete）', async () => {
  let capturedUrl = '';
  let capturedMethod = '';
  routeHandler = (url, init) => {
    capturedUrl = url;
    capturedMethod = init?.method ?? 'GET';
    if (url.includes('/api/manage/users/batch/permanent-delete')) {
      return jsonResponse({
        updated_count: 2,
        results: [
          { id: '3', result: 'deleted', message: '已删除' },
          { id: '4', result: 'deleted', message: '已删除' },
        ],
      });
    }
    return jsonResponse({ message: 'no route' }, 404);
  };

  const result = await manageApi.batchDeleteUsers({
    userIds: ['3', '4'],
    confirmAction: 'delete-users',
    sessionConfirmation: 'sess-token',
  });

  // 路径与查询参（回退即红：任一回退到 /batch/delete 或丢 confirmed 即红）
  assert.ok(
    capturedUrl.includes('/api/manage/users/batch/permanent-delete'),
    `必须打 /batch/permanent-delete，实得 ${capturedUrl}`,
  );
  assert.ok(
    !capturedUrl.includes('/batch/delete'),
    '禁止再打全仓不存在的 /batch/delete',
  );
  assert.ok(
    capturedUrl.includes('confirmed=true'),
    `危险操作闸要求 ?confirmed=true，实得 ${capturedUrl}`,
  );
  assert.equal(capturedMethod, 'POST');

  // body 形状（BatchUserIdsRequest + 危险操作工件）
  const body = lastBody as Record<string, unknown>;
  assert.deepEqual(body.user_ids, ['3', '4'], 'body.user_ids（snake_case wire）');

  // 响应映射（updated_count → updatedCount，results 逐项）
  assert.equal(result.updatedCount, 2);
  assert.equal(result.results.length, 2);
  assert.equal(result.results[0].id, '3');
});
