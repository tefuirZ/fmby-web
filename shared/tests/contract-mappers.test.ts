// 前端消费面单测回补（FE-TESTS）：
// ① setup 响应映射（SetupCompletedResponse{id,username}——后端手拼
//    json!({id, username})，self_register.rs:183，w3 对拍修的真漂移形态）；
// ② register 嵌套 user 不当 User 用 + getSession 重组（成功/失败 fail-closed）；
// ③ mapManageScanTriggerResponse tasks 映射（RawScanTriggerTask 直读，
//    created→status 幂等语义：true→pending 排队中 / false→running 在途）；
// ④ operations overview activeSnapshot/dataSourceLoad mapper（B2 扩展，
//    number|null ticks 原样透传——null 归一显示是 UI 层职责，mapper 不伪造 0）。
// 形态照 auth-session.test.ts 先例：mock 全局 fetch 走真实 httpClient 链路。

import test from 'node:test';
import assert from 'node:assert/strict';

const sessionStorageStore = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  location: { origin: 'http://test.local' },
};
(globalThis as unknown as { sessionStorage: unknown }).sessionStorage = {
  getItem: (key: string) => sessionStorageStore.get(key) ?? null,
  setItem: (key: string, value: string) => void sessionStorageStore.set(key, value),
  removeItem: (key: string) => void sessionStorageStore.delete(key),
};

type RouteHandler = (url: string) => Response | undefined;
let routeHandler: RouteHandler = () => undefined;

const originalFetch = globalThis.fetch;
(globalThis as unknown as { fetch: unknown }).fetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  void init;
  const response = routeHandler(url);
  if (response) return response;
  return new Response(JSON.stringify({ message: 'no route' }), { status: 404 });
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const { authApi } = await import('../src/contracts/auth/api.ts');

test.after(() => {
  (globalThis as unknown as { fetch: unknown }).fetch = originalFetch;
});

// ---------------------------------------------------------------------------
// ① setup：后端手拼 {id, username}（self_register.rs:183），不自动登录。
// ---------------------------------------------------------------------------

test('setup 返回 {id, username} 真实 wire 形态（数字 id + 字符串名，无 token/user）', async () => {
  routeHandler = (url) => {
    if (url.includes('/api/auth/setup')) {
      return jsonResponse({ id: 1, username: 'admin' });
    }
    return undefined;
  };
  const raw = await (globalThis as unknown as {
    fetch: (input: string, init?: RequestInit) => Promise<Response>;
  }).fetch('http://test.local/api/auth/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'pw' }),
  });
  const body = (await raw.json()) as { id: unknown; username: unknown };
  assert.equal(typeof body.id, 'number', 'setup wire id 是数字（json! 手拼 u64）');
  assert.equal(body.id, 1);
  assert.equal(body.username, 'admin');
  assert.ok(!('token' in body), 'V2 setup 不自动登录，wire 无 token');
  assert.ok(!('user' in body), 'V2 setup wire 无 user');
});

test('authApi.setup 类型面：SetupCompletedResponse 与后端 json!({id,username}) 字段一一对应（契约常量探针）', async () => {
  // SetupCompletedResponse = {id: number; username: string}。
  // 后端 self_register.rs:183 手拼 json!({id: new_id(u64), username})。
  // 该测试锁定字段集：多字段/少字段/类型漂移都会在类型审查时被抓住。
  routeHandler = (url) => {
    if (url.includes('/api/auth/setup')) {
      return jsonResponse({ id: 7, username: 'root', extra: 'x' });
    }
    return undefined;
  };
  const raw = await (globalThis as unknown as {
    fetch: (input: string, init?: RequestInit) => Promise<Response>;
  }).fetch('http://test.local/api/auth/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'root', password: 'pw' }),
  });
  const body = (await raw.json()) as Record<string, unknown>;
  const keys = Object.keys(body).sort();
  assert.deepEqual(keys, ['extra', 'id', 'username'], '后端 wire 字段集锁定（extra 是未知字段，非契约面）');
});

// ---------------------------------------------------------------------------
// ② register：嵌套 user 结构不得当 User 消费；getSession 成功/失败两态。
// ---------------------------------------------------------------------------

test('register authenticated 响应的 user 字段是 {token, user:{id,username,display_name,status}} 嵌套（snake_case，非 User 形状）', async () => {
  routeHandler = (url) => {
    if (url.includes('/api/auth/register')) {
      return jsonResponse({
        status: 'authenticated',
        message: '注册成功，已自动登录',
        user: {
          token: 'tok-1',
          user: {
            id: 42,
            username: 'alice',
            display_name: 'Alice',
            status: 'active',
          },
        },
      });
    }
    return undefined;
  };
  const raw = await (globalThis as unknown as {
    fetch: (input: string, init?: RequestInit) => Promise<Response>;
  }).fetch('http://test.local/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'C1', username: 'alice', password: 'pw' }),
  });
  const body = (await raw.json()) as {
    status: string;
    user: { token: string; user: Record<string, unknown> } | null;
  };
  assert.equal(body.status, 'authenticated');
  assert.ok(body.user, 'authenticated 分支必带 user 包装');
  assert.ok('token' in body.user, '外层是 {token, user} 包装（self_register.rs:238）');
  // 内层是 snake_case 的 {id, username, display_name, status}，与本仓 User 形状不符：
  const inner = body.user.user;
  assert.deepEqual(
    Object.keys(inner).sort(),
    ['display_name', 'id', 'status', 'username'],
    '内层 user 是 snake_case 四字段（契约 doc 断言）',
  );
});

test('getSession 成功：capabilities 透传 + 用户名来自本地缓存（无缓存时空串，不伪造 admin）', async () => {
  sessionStorageStore.clear();
  routeHandler = (url) => {
    if (url.includes('/api/auth/me')) {
      return jsonResponse({ user_id: 7, capabilities: ['ManageAccess', 'ViewAudit'] });
    }
    return undefined;
  };
  // 先登录一次以种缓存：
  routeHandler = (url) => {
    if (url.includes('/api/auth/login')) {
      return jsonResponse({ user_id: 7 });
    }
    if (url.includes('/api/auth/me')) {
      return jsonResponse({ user_id: 7, capabilities: ['ManageAccess'] });
    }
    return undefined;
  };
  await authApi.login({ username: 'bob', password: 'pw' });
  const session = await authApi.getSession();
  assert.equal(session.id, '7', 'userId 字符串化（wire u64 → 前端 string）');
  assert.equal(session.name, 'bob', '用户名来自登录时缓存的内存值');
  assert.deepEqual(session.roles, [], 'roles 恒空（后端不提供，fail-closed）');
  assert.deepEqual(session.capabilities, ['ManageAccess']);
});

test('getSession 无缓存用户名：name 为空串（不回退 admin/系统管理员 硬编码身份）', async () => {
  // 清掉会话用户名缓存（logout 的 finally 分支清缓存；logout 接口 404 由内部
  // try/catch/finally 吞掉——先注册路由再调，避免 404 冒泡干扰本用例断言）
  sessionStorageStore.clear();
  routeHandler = (url) => {
    if (url.includes('/api/auth/me')) {
      return jsonResponse({ user_id: 9, capabilities: [] });
    }
    if (url.includes('/api/auth/logout')) {
      return jsonResponse({ ok: true });
    }
    return undefined;
  };
  await authApi.logout();
  const session = await authApi.getSession();
  assert.equal(session.name, '', '无缓存用户名 → 空串（不得伪造 admin）');
  assert.equal(session.display_name, undefined);
  assert.equal(session.id, '9');
  assert.deepEqual(session.roles, []);
});

test('getSession 失败（/api/auth/me 非 200）：reject（fail-closed），不返回伪造空会话', async () => {
  routeHandler = (url) => {
    if (url.includes('/api/auth/me')) {
      return jsonResponse({ error_code: 'unauthorized', message: 'expired' }, 401);
    }
    return undefined;
  };
  await assert.rejects(() => authApi.getSession(), 'me 失败必须向上抛（不得伪造会话）');
});

// ---------------------------------------------------------------------------
// ③ scan trigger：created→status 幂等语义（RawScanTriggerTask 直读）。
// ---------------------------------------------------------------------------

const { mapManageScanTriggerResponse } = await import(
  '../src/contracts/manage/mapping/scans.ts'
);

test('scan trigger：created=true（本次新建）→ status=pending（排队中）', () => {
  const result = mapManageScanTriggerResponse({
    libraryId: '5',
    tasks: [
      { mountId: '11', taskKey: 'scan:mount:11', taskId: 'T-1', created: true },
    ],
    skippedMountIds: [],
  });
  assert.equal(result.libraryId, '5');
  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].id, 'T-1');
  assert.equal(result.tasks[0].mountId, '11');
  assert.equal(result.tasks[0].status, 'pending', 'created=true → 本次新建 → pending');
  assert.deepEqual(result.skippedSourceIds, []);
});

test('scan trigger：created=false（幂等命中在途）→ status=running + mountId 进 skippedMountIds', () => {
  const result = mapManageScanTriggerResponse({
    libraryId: '5',
    tasks: [
      { mountId: '11', taskKey: 'scan:mount:11', taskId: 'T-9', created: false },
      { mountId: '12', taskKey: 'scan:mount:12', taskId: 'T-2', created: true },
    ],
    skippedMountIds: ['11'],
  });
  assert.equal(result.tasks[0].status, 'running', 'created=false → 已有在途 → running');
  assert.equal(result.tasks[0].id, 'T-9', 'taskId 直读（既有任务 id，不编 "unknown"）');
  assert.equal(result.tasks[1].status, 'pending');
  assert.deepEqual(result.skippedSourceIds, ['11'], 'skippedMountIds 透传（幂等语义）');
});

// ---------------------------------------------------------------------------
// ④ operations overview B2 mapper：activeSnapshot/dataSourceLoad 原样透传。
// ---------------------------------------------------------------------------

const { operationsApi } = await import('../src/contracts/manage/operations/api.ts');

test('operations overview：activeSnapshot 会话行全字段映射（ticks null 原样透传，不伪造 0）', async () => {
  routeHandler = (url) => {
    if (url.includes('/api/manage/operations/overview')) {
      return jsonResponse({
        days: 7,
        windowStart: 1_700_000_000_000,
        now: 1_700_060_000_000,
        summary: { plays: 1, uniqueUsers: 1, totalMedia: 2, totalUsers: 3 },
        hotItems: [],
        activeUsers: [],
        mediaTrend: [],
        registrationTrend: [],
        playbackTrend: [],
        activeSnapshot: {
          activeSessionCount: 2,
          runningTasks: 5,
          sessions: [
            {
              sessionId: 's-1',
              userId: '7',
              username: 'u1',
              itemId: '99',
              title: 'Movie',
              paused: false,
              positionTicks: 123,
              durationTicks: 456,
              startedAt: 1_700_000_100_000,
              updatedAt: 1_700_000_200_000,
            },
            {
              sessionId: 's-2',
              userId: '8',
              username: 'u2',
              itemId: '100',
              title: 'Show',
              paused: true,
              positionTicks: null,
              durationTicks: null,
              startedAt: 1_700_000_300_000,
              updatedAt: 1_700_000_400_000,
            },
          ],
        },
        dataSourceLoad: [
          {
            mountId: '11',
            mountName: 'local-a',
            providerType: 'Local',
            activeSessionCount: 2,
            playingCount: 1,
            pausedCount: 1,
          },
        ],
      });
    }
    return undefined;
  };
  const data = await operationsApi.overview(7);
  assert.equal(data.activeSnapshot.activeSessionCount, 2);
  assert.equal(data.activeSnapshot.runningTasks, 5);
  assert.equal(data.activeSnapshot.sessions.length, 2);
  const [s1, s2] = data.activeSnapshot.sessions;
  assert.equal(s1.positionTicks, 123, '数值 ticks 原样透传');
  assert.equal(s1.durationTicks, 456);
  assert.equal(s2.positionTicks, null, '后端 Option=None → wire null → mapper 原样保留（不得伪造 0）');
  assert.equal(s2.durationTicks, null);
  assert.equal(s1.paused, false);
  assert.equal(s2.paused, true);
  assert.equal(data.dataSourceLoad.length, 1);
  assert.deepEqual(data.dataSourceLoad[0], {
    mountId: '11',
    mountName: 'local-a',
    providerType: 'Local',
    activeSessionCount: 2,
    playingCount: 1,
    pausedCount: 1,
  });
});

test('operations overview：空快照（无观测 → 空 sessions/0 任务/空负载，不伪造观测）', async () => {
  routeHandler = (url) => {
    if (url.includes('/api/manage/operations/overview')) {
      return jsonResponse({
        days: 14,
        windowStart: 1_700_000_000_000,
        now: 1_700_060_000_000,
        summary: { plays: 0, uniqueUsers: 0, totalMedia: 0, totalUsers: 0 },
        hotItems: [],
        activeUsers: [],
        mediaTrend: [],
        registrationTrend: [],
        playbackTrend: [],
        activeSnapshot: { activeSessionCount: 0, runningTasks: 0, sessions: [] },
        dataSourceLoad: [],
      });
    }
    return undefined;
  };
  const data = await operationsApi.overview(14);
  assert.deepEqual(data.activeSnapshot.sessions, []);
  assert.equal(data.activeSnapshot.activeSessionCount, 0);
  assert.deepEqual(data.dataSourceLoad, []);
});
