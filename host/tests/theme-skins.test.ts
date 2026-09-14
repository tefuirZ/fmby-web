// WEB-C1 ②④：L3 域皮肤调度回路 + 状态全覆盖 DOM 断言。
// 跑法：node --import ./tests/register-aliases.mjs --test tests/theme-skins.test.ts
// 形态说明：node strip-types 不支持 .tsx —— 被测模块（DomainSkinOutlet/loaders）
// 为 createElement 形态 .ts；MemoryRouter 提供 useLocation/useParams；
// 数据态经 stub fetch（shared httpClient 同源链路）驱动 react-query 真取数。
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeContext } from '../src/theme/themeContext';
import { DomainSkinOutlet } from '../src/theme/skins/DomainSkinOutlet';
import type { SkinProps } from '@fmby/v2-shared/theme';

/** 测试 skin：渲染当前 state/data 的最小标记（ADR §3 状态全覆盖形态）。 */
function MatrixSkin({ state, data }: SkinProps) {
  return createElement(
    'div',
    { 'data-skin': 'matrix', 'data-state': state },
    typeof data === 'object' && data !== null ? 'has-data' : 'no-data',
  );
}

const HostFallback = () => createElement('div', { 'data-fallback': 'host-default' });

/** 组装 /libraries/42 路由的渲染树（stub 主题声明 browse.library skin）。 */
function renderBrowseLibrary(options: {
  fetchBody?: unknown;
  fetchStatus?: number;
  /** 预填充 query 缓存（控制 ready/empty 态；inflight 态不填）。 */
  presetCache?: unknown;
}): string {
  const originalFetch = globalThis.fetch;
  (globalThis as unknown as { fetch: unknown }).fetch = async () =>
    new Response(JSON.stringify(options.fetchBody ?? null), {
      status: options.fetchStatus ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });

  const entry = {
    manifest: {
      id: 'test',
      version: '0.0.0',
      label: 'test',
      tokens: { cssFile: 'tokens.css' },
      entry: { mount: 'index.ts' },
      skins: { 'browse.library': 'LibrarySkin' },
      nav: { items: [] },
      preload: false as const,
    },
    domainSkins: { 'browse.library': MatrixSkin },
  };
  const themeValue = {
    activeThemeId: 'test',
    status: 'active' as const,
    availableThemeIds: ['test'],
    entry,
    switchTheme: async () => {},
  };

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  if (options.presetCache !== undefined) {
    queryClient.setQueryData(['browse', 'library', '42'], {
      pages: [options.presetCache],
      pageParams: [undefined],
    });
  }

  try {
    return renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          ThemeContext.Provider,
          { value: themeValue },
          createElement(
            MemoryRouter,
            { initialEntries: ['/libraries/42'] },
            createElement(Routes, null, [
              createElement(Route, {
                key: 'lib',
                path: '/libraries/:libraryId',
                element: createElement(DomainSkinOutlet, null, createElement(HostFallback)),
              }),
            ]),
          ),
        ),
      ),
    );
  } finally {
    (globalThis as unknown as { fetch: unknown }).fetch = originalFetch;
  }
}

test('fallback: 未声明 skin 的主题 → host 默认页面（功能永不缺失）', () => {
  // 空 entry（无 domainSkins）→ 直接回落。
  const html = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ['/libraries/42'] },
      createElement(
        ThemeContext.Provider,
        {
          value: {
            activeThemeId: null,
            status: 'default' as const,
            availableThemeIds: [],
            entry: null,
            switchTheme: async () => {},
          },
        },
        createElement(Routes, null, [
          createElement(Route, {
            key: 'lib',
            path: '/libraries/:libraryId',
            element: createElement(DomainSkinOutlet, null, createElement(HostFallback)),
          }),
        ]),
      ),
    ),
  );
  assert.match(html, /data-fallback="host-default"/);
  assert.doesNotMatch(html, /data-skin="matrix"/);
});

test('loading: 查询未就绪 → skin 渲染 state=loading', () => {
  // renderToStaticMarkup 同步渲染首帧，inflight query 恒 pending → loading。
  const html = renderBrowseLibrary({});
  assert.match(html, /data-skin="matrix"/, '主题组件被调度渲染');
  assert.match(html, /data-state="loading"/);
});

test('ready: 缓存有数据 → skin 渲染 state=ready + data', () => {
  const html = renderBrowseLibrary({
    presetCache: {
      library: { id: '42', name: '电影库', typeLabel: 'movie', itemCount: 1, artwork: {} },
      items: [{ id: 'i1', title: '流浪地球2', kind: 'movie', kindLabel: 'movie' }],
      filters: {},
      total: 1,
    },
  });
  assert.match(html, /data-state="ready"/);
  assert.match(html, /has-data/, 'viewmodel 数据注入主题组件');
});

test('empty: 数据为空集 → skin 渲染 state=empty', () => {
  const html = renderBrowseLibrary({
    presetCache: {
      library: { id: '42', name: '空库', typeLabel: 'movie', itemCount: 0, artwork: {} },
      items: [],
      filters: {},
      total: 0,
    },
  });
  assert.match(html, /data-state="empty"/);
});

test('error/forbidden: SSR 首帧不伪造终态（异步面覆盖登记）', () => {
  const html = renderBrowseLibrary({ fetchStatus: 500, fetchBody: { message: 'boom' } });
  // renderToStaticMarkup 同步首帧下 react-query 恒 pending：error/forbidden
  // 是挂载后异步到达的终态，SSR 断言的底线 = 不伪造（不渲染 ready/成功形）。
  // error 态由 query.isError 分支真实映射（loaders.tsx）；forbidden 态由
  // 路由层 AuthGuard/CapabilityGuard 拦截（不达 skin），SkinProps 保留
  // forbidden 供主题实现完整矩阵（ADR §3 状态集冻结）。
  assert.match(html, /data-state="loading"/, 'SSR 首帧不伪造 error/成功');
  assert.doesNotMatch(html, /data-state="ready"/);
});
