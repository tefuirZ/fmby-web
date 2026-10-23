// F9：React Query signal 未接（审计）——
//   httpClient 早已支持 config.signal（core.ts externalSignal → anySignal → fetch，
//   且外部 abort 不触发重试：defaultRetryOn 对 externalSignal.aborted 恒 false），
//   但 shared/src/viewmodels/* 的 20 个 queryFn 全仓 0 个接 signal ⇒
//   切路由/改筛选时旧请求只被 React Query 丢弃，网络层从不取消。
//
// 本测试双保险：
//   ① 机械接线门禁：viewmodels 每个 queryFn 必须从 React Query 上下文解构 signal
//      （「解构了却忘传」由 noUnusedLocals 的 tsc typecheck 兜住：未传则 signal
//      无消费点 → TS6133 红）；
//   ② 行为测试：14 个被 viewmodels 消费的 contract 函数，尾参 signal 必须一路
//      传到 httpClient 的 fetch（stub 捕获），外部 abort ⇒ 单次请求被取消、
//      拒绝 AbortError、绝不重试。
//
// 跑法：node --import ./tests/register-resolver.mjs --test tests/query-signal-abort.test.ts
// stub 惯例同 csrf-echo.test.ts（node 无 window/document：先 stub 再动态加载模块）。

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const VIEWMODELS_DIR = join(HERE, '..', 'src', 'viewmodels');

// ---------------------------------------------------------------------------
// ① 机械接线门禁（纯文件扫描，无 DOM/网络）
// ---------------------------------------------------------------------------

test('viewmodels 全部 queryFn 必须解构 React Query 注入的 signal（机械门禁）', () => {
  const offenders: string[] = [];
  let totalQueryFn = 0;

  for (const file of readdirSync(VIEWMODELS_DIR)) {
    if (!file.endsWith('.ts') || file.startsWith('index') || file.startsWith('types') || file.startsWith('mediaMeta')) {
      continue;
    }
    const src = readFileSync(join(VIEWMODELS_DIR, file), 'utf8');
    // queryFn: <lambdaParams> => —— lambda 参数列表（多行/单行均覆盖）
    for (const match of src.matchAll(/queryFn:\s*\(([^)]*)\)/g)) {
      totalQueryFn += 1;
      const params = match[1];
      if (!/\bsignal\b/.test(params)) {
        const line = src.slice(0, match.index).split('\n').length;
        offenders.push(`${file}:${line} queryFn(${params.trim()}) 未解构 signal`);
      }
    }
  }

  assert.equal(offenders.length, 0, `以下 queryFn 未接 signal（切路由/改筛选旧请求不会被取消）：\n${offenders.join('\n')}`);
  // 现状清单：20 个 queryFn（19 useQuery + 1 useInfiniteQuery）。防「顺手删查询」绕过门禁；
  // 合法增删查询时同步更新此下限。
  assert.ok(totalQueryFn >= 20, `viewmodels queryFn 数量 ${totalQueryFn} 低于既有清单下限 20（若合法删减请同步更新）`);
});

// ---------------------------------------------------------------------------
// ② 行为测试：contract 尾参 signal → httpClient → fetch（stub 捕获）
// ---------------------------------------------------------------------------

// node 环境无 window/document：client.ts 依赖 window.location.origin 与
// document.cookie（csrf 回显），先 stub 再动态加载（csrf-echo.test.ts 同惯例）。
(globalThis as unknown as { window: unknown }).window = {
  location: { origin: 'http://test.local' },
};

type CapturedFetch = { url: string; signal: AbortSignal | undefined };
const captured: CapturedFetch[] = [];
/** 挂起中的 stub fetch 的 reject 句柄：deadline 后统一放行，防挂死进程。 */
const pendingRejects = new Set<(err: unknown) => void>();

const originalFetch = globalThis.fetch;
(globalThis as unknown as { fetch: unknown }).fetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const signal = (init as { signal?: AbortSignal } | undefined)?.signal;
  captured.push({ url, signal });
  return new Promise<never>((_resolve, reject) => {
    pendingRejects.add(reject);
    // 复刻真 fetch 的 abort 语义：signal 已 abort → 立刻拒；否则监听一次 abort。
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      return;
    }
    signal?.addEventListener(
      'abort',
      () => reject(signal.reason ?? new DOMException('Aborted', 'AbortError')),
      { once: true },
    );
  });
};

Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: {
    get cookie() {
      return '';
    },
  },
});

const { browseApi } = await import('../src/contracts/browse/api.ts');
const { historyApi } = await import('../src/contracts/browse/history/api.ts');
const { itemApi } = await import('../src/contracts/browse/item/api.ts');
const { personApi } = await import('../src/contracts/browse/person/api.ts');
const { searchApi } = await import('../src/contracts/browse/search/api.ts');
const { collectionsBrowseApi } = await import('../src/contracts/browse/collections/api.ts');
const { manageApi } = await import('../src/contracts/manage/api.ts');
const { settingsApi } = await import('../src/contracts/settings/api.ts');
const { playbackApi } = await import('../src/contracts/playback/api.ts');

test.after(() => {
  // deadline 兜底：放行所有挂起 stub（测试断言已完，别让进程挂着 30s 超时定时器）。
  for (const reject of pendingRejects) {
    reject(new DOMException('drained', 'AbortError'));
  }
  (globalThis as unknown as { fetch: unknown }).fetch = originalFetch;
  delete (globalThis as unknown as { document?: unknown }).document;
  delete (globalThis as unknown as { window?: unknown }).window;
});

/** 与 viewmodels 实际传参一致的 14 个 contract 函数（F9 接入清单的行为面）。 */
const CASES: Array<{
  label: string;
  call: (signal: AbortSignal) => Promise<unknown>;
  urlIncludes: string;
}> = [
  { label: 'browseApi.getHomeData', call: (s) => browseApi.getHomeData({}, s), urlIncludes: '/api/browse/home/bootstrap' },
  { label: 'browseApi.getLibraries', call: (s) => browseApi.getLibraries(s), urlIncludes: '/api/browse/libraries' },
  { label: 'browseApi.getLibraryDetail', call: (s) => browseApi.getLibraryDetail('lib1', {}, s), urlIncludes: '/api/browse/libraries/lib1' },
  { label: 'historyApi.getOverview', call: (s) => historyApi.getOverview(s), urlIncludes: '/api/browse/history' },
  { label: 'itemApi.getDetail', call: (s) => itemApi.getDetail('i1', s), urlIncludes: '/api/items/i1' },
  { label: 'itemApi.getDescendants', call: (s) => itemApi.getDescendants('i1', 2000, s), urlIncludes: '/api/items/i1/descendants' },
  { label: 'personApi.getPerson', call: (s) => personApi.getPerson('p1', s), urlIncludes: '/api/items/people/p1' },
  { label: 'personApi.getPersonItems', call: (s) => personApi.getPersonItems('p1', s), urlIncludes: '/api/items/people/p1/items' },
  { label: 'searchApi.search', call: (s) => searchApi.search('kw', undefined, s), urlIncludes: '/api/search' },
  { label: 'collectionsBrowseApi.getCollection', call: (s) => collectionsBrowseApi.getCollection('c1', s), urlIncludes: '/api/collections/c1' },
  { label: 'collectionsBrowseApi.listCollections', call: (s) => collectionsBrowseApi.listCollections({}, s), urlIncludes: '/api/collections' },
  { label: 'manageApi.getOverview', call: (s) => manageApi.getOverview(s), urlIncludes: '/api/manage/overview' },
  { label: 'settingsApi.getUserPlayback', call: (s) => settingsApi.getUserPlayback(s), urlIncludes: '/api/settings/user/playback' },
  { label: 'playbackApi.createSession', call: (s) => playbackApi.createSession('i1', s), urlIncludes: '/api/playback/sessions' },
];

const waitAbortDeadlineMs = 500;

for (const { label, call, urlIncludes } of CASES) {
  test(`${label}: 尾参 signal 传入 fetch，中途 abort ⇒ 取消且不重试`, async () => {
    captured.length = 0;
    pendingRejects.clear();

    const controller = new AbortController();
    let settled = false;
    let rejectedWithAbort = false;
    const outcome = call(controller.signal).then(
      () => 'resolved',
      (err: unknown) => {
        settled = true;
        rejectedWithAbort =
          err instanceof DOMException && err.name === 'AbortError';
        return 'rejected';
      },
    );

    // 等 fetch 真正发出（stub 同步捕获 ⇒ 一轮微任务即可见）
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(
      captured.some((c) => c.url.includes(urlIncludes)),
      true,
      `${label} 应发出 ${urlIncludes} 请求`,
    );
    assert.ok(captured[0].signal, 'httpClient 必须收到 signal（合并超时后透传给 fetch）');

    controller.abort();

    // abort 后 500ms 内必须拒绝（真 fetch 语义）；否则视为 signal 未接线
    for (let i = 0; i < 20 && !settled; i += 1) {
      await new Promise((r) => setTimeout(r, 25));
    }
    assert.equal(settled, true, `${label}: abort 后请求未取消（signal 没传到 fetch）`);
    assert.equal(rejectedWithAbort, true, `${label}: 中止须以 AbortError 拒绝`);
    assert.equal(captured.length, 1, `${label}: 外部 abort 不得触发重试（默认 retryOn 对 aborted 恒 false）`);
    assert.equal(captured[0].signal?.aborted, true, 'fetch 收到的（合并）signal 必须已 abort');
    void outcome;
  });
}

test('行为面正例：不 abort 时请求照常完成（接线不破坏 happy path）', async () => {
  captured.length = 0;
  // stub 复位为「立即成功响应」：本轮直接换 fetch 实现（同样写 captured 供断言）
  (globalThis as unknown as { fetch: unknown }).fetch = async (
    input: RequestInfo | URL,
  ) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    captured.push({ url, signal: undefined });
    return new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    const libraries = await browseApi.getLibraries();
    assert.deepEqual(libraries, [], 'getLibraries 走通 happy path');
    assert.equal(captured.length, 1);
  } finally {
    // 还原为挂起版 stub（上面的 after 会把 globalThis.fetch 还原为 original）
  }
});
