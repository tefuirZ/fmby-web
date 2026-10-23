// F9 端到端探针：**切路由后旧请求被 abort**（真浏览器 + 真 React Query 取消语义）。
//
// 审计 F9：viewmodels 的 useQuery 未把 React Query 注入的 signal 传给 httpClient ⇒
// 切路由/改筛选时旧请求只被 RQ 丢弃，网络层从不取消。接线后：组件卸载 →
// 观察者归零 → React Query v5 取消在途查询并 abort queryFn signal →
// httpClient 的 fetch（合并 signal）中止 ⇒ 浏览器侧表现为 net::ERR_ABORTED。
//
// 跑法：node --import ./tests/register-aliases.mjs --test tests/query-signal-route-abort.dom.test.ts
// 沿用 search-overlay-focus.test.ts 既有模式：devDep vite（打包）+ @playwright/test
// （Chromium），零新增依赖；entry 落 os.tmpdir()（fmby-queue 降权下 host/tests 不可写）。

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const HOST_ROOT = join(import.meta.dirname, '..');

/**
 * node_modules 的**绝对路径**（照 search-overlay-focus.test.ts 先例：entry 落
 * os.tmpdir() 后 Rollup 解析不到裸标识符，须给绝对路径绕开解析链）。
 */
const NM = join(HOST_ROOT, 'node_modules');
const nmUrl = (rel: string) => pathToFileURL(join(NM, rel)).href;
const NM_REACT = nmUrl('react/index.js');
const NM_REACT_DOM_CLIENT = nmUrl('react-dom/client.js');
const NM_REACT_ROUTER = nmUrl('react-router/dist/development/index.mjs');
const NM_RQ = nmUrl('@tanstack/react-query/build/modern/index.js');
const USE_HISTORY = pathToFileURL(
  join(HOST_ROOT, '..', 'shared', 'src', 'viewmodels', 'useHistory.ts'),
).href;

/**
 * 探针场景：MemoryRouter 双路由。
 * - `/` 挂真 viewmodel `useHistory()`（→ historyApi.getOverview → /api/browse/history）；
 * - `*` 空路由（切过去 = Route A 卸载 = RQ 观察者归零）。
 * `window.__nav` 暴露程序化导航，供测试侧触发「切路由」。
 */
const PROBE_ENTRY = `
import { createElement, useEffect, useState } from '${NM_REACT}';
import { createRoot } from '${NM_REACT_DOM_CLIENT}';
import { QueryClient, QueryClientProvider } from '${NM_RQ}';
import { MemoryRouter, Routes, Route, useNavigate } from '${NM_REACT_ROUTER}';
import { useHistory } from '${USE_HISTORY}';

function HistoryProbe() {
  const vm = useHistory({ typeFilter: 'all', stateFilter: 'all', timeRange: 'all' });
  return createElement('div', { id: 'probe-ready' }, 'state=' + vm.state);
}

function Gone() {
  return createElement('div', { id: 'gone' }, 'gone');
}

function Scene() {
  const navigate = useNavigate();
  useEffect(() => {
    window.__nav = (to) => navigate(to);
  }, [navigate]);
  return createElement(Routes, null,
    createElement(Route, { path: '/', element: createElement(HistoryProbe) }),
    createElement(Route, { path: '*', element: createElement(Gone) }),
  );
}

function App() {
  const [client] = useState(() => new QueryClient());
  return createElement(QueryClientProvider, { client },
    createElement(MemoryRouter, null, createElement(Scene)));
}

createRoot(document.getElementById('root')).render(createElement(App));
`;

const PROBE_ORIGIN = 'http://fmby-f9-probe.local';

const SKIP = Symbol('skip');

test('切路由（观察者归零）后旧请求被 abort（ERR_ABORTED）且不重试', async (t) => {
  if (!existsSync(join(HOST_ROOT, 'node_modules', 'react'))) {
    t.skip('未安装 host 依赖（pnpm install 后重跑）');
    throw SKIP;
  }

  const work = await mkdtemp(join(tmpdir(), 'f9-signal-'));
  const entryFile = join(work, '__f9Signal-entry.tsx');
  const outDir = join(work, 'dist');
  await writeFile(entryFile, PROBE_ENTRY, 'utf8');
  try {
    await (
      await import('vite')
    ).build({
      configFile: false,
      root: HOST_ROOT,
      logLevel: 'error',
      define: { 'process.env.NODE_ENV': '"development"' },
      resolve: {
        alias: {
          '@fmby/v2-shared': join(HOST_ROOT, '..', 'shared', 'src'),
          '@': join(HOST_ROOT, 'src'),
        },
      },
      build: {
        outDir,
        emptyOutDir: true,
        minify: false,
        lib: { entry: entryFile, formats: ['iife'], name: 'F9Signal', fileName: () => 'probe.js' },
      },
    });
  } finally {
    await rm(entryFile, { force: true });
  }

  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const pageErrors: string[] = [];
  page.on('pageerror', (e: Error) => pageErrors.push(String(e)));

  const apiRequests: string[] = [];
  let abortedErrorText: string | null = null;
  page.on('requestfailed', (req: { url: () => string; failure: () => { errorText: string } | null }) => {
    if (req.url().includes('/api/browse/history')) {
      abortedErrorText = req.failure()?.errorText ?? null;
    }
  });

  // 全拦截：页面/包本体走本地文件 fulfill；/api/browse/history 挂起不响应
  // （等 React Query 取消把它 abort 掉——若不取消则永远 pending = 测试红）。
  await page.route('**/*', async (route: { fulfill: (o: object) => Promise<void>; request: () => { url: () => string } }) => {
    const url = route.request().url();
    if (url.includes('/api/browse/history')) {
      apiRequests.push(url);
      await new Promise(() => {}); // 挂起：只有 abort 能终结它
      return;
    }
    if (url === `${PROBE_ORIGIN}/probe.js`) {
      await route.fulfill({ path: join(outDir, 'probe.js'), contentType: 'text/javascript' });
      return;
    }
    await route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html><body><div id="root"></div><script src="/probe.js"></script></body></html>',
    });
  });

  try {
    await page.goto(`${PROBE_ORIGIN}/`);
    await page.waitForSelector('#probe-ready', { timeout: 10_000 });

    // 等在途请求真实发出并稳定（防把「尚未发出」当「被取消」）
    for (let i = 0; i < 50 && apiRequests.length === 0; i += 1) {
      await page.waitForTimeout(20);
    }
    assert.ok(apiRequests.length >= 1, '/api/browse/history 应已发出');
    await page.waitForTimeout(150);

    // 切路由：Route A 卸载 → RQ 观察者归零 → cancel → signal abort → fetch 中止
    await page.evaluate(() => (window as unknown as { __nav: (to: string) => void }).__nav('/gone'));
    await page.waitForSelector('#gone', { timeout: 5_000 });

    let aborted = false;
    for (let i = 0; i < 120 && !aborted; i += 1) {
      await page.waitForTimeout(25);
      aborted = abortedErrorText !== null && abortedErrorText.includes('ERR_ABORTED');
    }
    assert.equal(
      aborted,
      true,
      `切路由后旧请求必须被 abort（requestfailed=${abortedErrorText}，请求数=${apiRequests.length}）`,
    );
    assert.equal(
      apiRequests.length,
      1,
      '取消不得触发重试（外部 abort 不进默认 retryOn）',
    );
    assert.deepEqual(pageErrors, [], '探针不得抛错');
  } finally {
    await browser.close();
    await rm(work, { recursive: true, force: true });
  }
});

after(() => {
  // 无全局清理需求；保留钩子位与仓内 dom 探针同构。
});
