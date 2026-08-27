// P0-08 ③④：登录 401 不触发全局会话失效 + getSession/login 不再伪造 Admin/name。
// 通过 mock 全局 fetch 走真实 httpClient 链路验证（含 requestPath 标记逻辑）。
// 注意：authApi 模块持有会话用户名内存缓存，测试按序执行并显式管理缓存状态。
import test from 'node:test';
import assert from 'node:assert/strict';

// node 环境无 window/sessionStorage：client.ts 的 buildUrl 依赖 window.location.origin，
// contracts/auth/api.ts 的用户名缓存依赖 sessionStorage，先 stub 再动态加载模块。
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
const { subscribeAuthFailure } = await import('../src/errors/authFailure.ts');

test.after(() => {
  (globalThis as unknown as { fetch: unknown }).fetch = originalFetch;
});

test('登录输错密码（login 401）不触发全局会话失效事件', async () => {
  let authFailureCount = 0;
  const unsubscribe = subscribeAuthFailure(() => {
    authFailureCount += 1;
  });

  // 后端 401 body 为 { error_code, message }（非 ApiError 形状），
  // 前端 mapResponseToApiError 归一化为 code=HTTP_401。
  routeHandler = (url) => {
    if (url.includes('/api/auth/login')) {
      return jsonResponse({ error_code: 'unauthorized', message: 'unauthorized' }, 401);
    }
    return undefined;
  };

  await assert.rejects(
    () => authApi.login({ username: 'admin', password: 'wrong-password' }),
    (error: unknown) => {
      assert.equal((error as { code?: string }).code, 'HTTP_401');
      return true;
    },
  );

  assert.equal(authFailureCount, 0, '登录 401 不得触发全局会话失效监听器');
  unsubscribe();
});

test('非登录接口 401 仍触发全局会话失效事件', async () => {
  let authFailureCount = 0;
  const unsubscribe = subscribeAuthFailure(() => {
    authFailureCount += 1;
  });

  routeHandler = (url) => {
    if (url.includes('/api/auth/me')) {
      return jsonResponse({ error_code: 'unauthorized', message: 'unauthorized' }, 401);
    }
    return undefined;
  };

  await assert.rejects(() => authApi.getSession());
  assert.equal(authFailureCount, 1, '既有会话过期的 401 应触发会话失效监听器');
  unsubscribe();
});

test('登录成功后用户身份来自真实响应：roles 不含伪造 Admin，用户名来自登录输入', async () => {
  routeHandler = (url) => {
    if (url.includes('/api/auth/login')) {
      return jsonResponse({ user_id: 7, expires_in_secs: 3600 });
    }
    if (url.includes('/api/auth/me')) {
      // 普通用户：只有 Browse 能力，无 ManageAccess
      return jsonResponse({ user_id: 7, capabilities: ['Browse'] });
    }
    return undefined;
  };

  const { user } = await authApi.login({ username: 'zhangsan', password: 'secret' });
  assert.equal(user.name, 'zhangsan');
  assert.deepEqual(user.roles, [], '登录契约不返回 roles，不得从用户名推断 Admin');
  assert.deepEqual(user.capabilities, ['Browse']);
});

test('getSession 恢复会话：用户名来自登录缓存，无 admin/系统管理员硬编码', async () => {
  routeHandler = (url) => {
    if (url.includes('/api/auth/me')) {
      return jsonResponse({ user_id: 7, capabilities: ['Browse', 'Play'] });
    }
    return undefined;
  };

  const session = await authApi.getSession();
  assert.equal(session.id, '7');
  assert.equal(session.name, 'zhangsan', '用户名应来自 login 时的缓存');
  assert.equal(session.display_name, 'zhangsan');
  assert.notEqual(session.name, 'admin');
  assert.notEqual(session.display_name, '系统管理员');
  assert.deepEqual(session.roles, [], '普通用户 roles 不得包含 Admin');
  assert.deepEqual(session.capabilities, ['Browse', 'Play']);
});

test('用户名为 admin 的登录也不再被推断为 Admin 角色', async () => {
  routeHandler = (url) => {
    if (url.includes('/api/auth/login')) {
      return jsonResponse({ user_id: 1, expires_in_secs: 3600 });
    }
    if (url.includes('/api/auth/me')) {
      return jsonResponse({ user_id: 1, capabilities: ['Browse', 'ManageAccess'] });
    }
    return undefined;
  };

  const { user } = await authApi.login({ username: 'admin', password: 'x' });
  assert.deepEqual(user.roles, [], '即使 username 字面为 admin 也不得伪造 Admin 角色');
  assert.deepEqual(user.capabilities, ['Browse', 'ManageAccess']);
});

test('logout 清除登录用户名缓存（storage 与内存）', async () => {
  routeHandler = (url) => {
    if (url.includes('/api/auth/login')) {
      return jsonResponse({ user_id: 7, expires_in_secs: 3600 });
    }
    if (url.includes('/api/auth/logout')) {
      return new Response(null, { status: 204 });
    }
    if (url.includes('/api/auth/me')) {
      return jsonResponse({ user_id: 7, capabilities: ['Browse'] });
    }
    return undefined;
  };

  await authApi.login({ username: 'logout-user', password: 'x' });
  assert.equal(sessionStorageStore.get('fmby:v2:session-username'), 'logout-user');

  await authApi.logout();
  assert.equal(sessionStorageStore.get('fmby:v2:session-username'), undefined, '登出后 storage 用户名缓存应被清除');

  const session = await authApi.getSession();
  assert.equal(session.name, '', '登出后内存缓存也已清空，不残留上一用户名');
});

test('登录失败（401）不写入用户名缓存', async () => {
  routeHandler = (url) => {
    if (url.includes('/api/auth/login')) {
      return jsonResponse({ error_code: 'unauthorized', message: 'unauthorized' }, 401);
    }
    return undefined;
  };

  sessionStorageStore.clear();
  await assert.rejects(() => authApi.login({ username: 'ghost', password: 'bad' }));
  assert.equal(sessionStorageStore.get('fmby:v2:session-username'), undefined, '失败的登录不得缓存用户名');
});

test('无登录缓存时 getSession 不伪造默认身份（fail-closed）', async () => {
  routeHandler = (url) => {
    if (url.includes('/api/auth/me')) {
      return jsonResponse({ user_id: 42, capabilities: ['Browse'] });
    }
    return undefined;
  };

  // 模拟新标签页/无缓存场景：清空 storage 并以带 query 的 URL 重新加载模块获取全新实例
  sessionStorageStore.clear();
  const freshModule = await import(`../src/contracts/auth/api.ts?fresh=${Date.now()}`);
  const session = await freshModule.authApi.getSession();
  assert.equal(session.name, '', '无缓存时用户名为空，不回退到 admin');
  assert.equal(session.display_name, undefined);
  assert.deepEqual(session.roles, [], '无缓存时不得伪造 Admin 角色');
  assert.deepEqual(session.capabilities, ['Browse']);
});

test('ApiError.requestPath 由 client 链路正确标记为登录路径', async () => {
  routeHandler = (url) => {
    if (url.includes('/api/auth/login')) {
      return jsonResponse({ error_code: 'unauthorized', message: 'unauthorized' }, 401);
    }
    return undefined;
  };
  await assert.rejects(
    () => authApi.login({ username: 'a', password: 'b' }),
    (error: unknown) => {
      assert.equal((error as { requestPath?: string }).requestPath, '/api/auth/login');
      return true;
    },
  );
});
