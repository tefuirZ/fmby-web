// F10：section 级渲染错误边界——子页崩溃只替换该 section 内容区，AppShell 存活。
//
// 审计 F10：仅 main.tsx 一个顶层 ErrorBoundary + 根路由 errorElement ⇒ 任何子树
// 渲染异常都冒泡到根，整站（含导航）降级。修法：Browse/Manage/Settings 三个
// layout 路由各挂 `errorElement: <RouteErrorPage contained />`（contained 变体
// 不占整屏），根路由保留为兜底。
//
// 本探针钉死两条不变量：
//   ① 子路由组件渲染抛错 → contained 错误页出现在**父布局内部**（壳的标记仍在 DOM）；
//   ② 兜底链完整：无 contained 边界的直挂子路由仍由根 errorElement 接住。
//
// 跑法：node --import ./tests/register-aliases.mjs --test tests/section-error-boundary.dom.test.ts
// 沿用仓内 dom 探针模式（vite 打包 + playwright Chromium，零新增依赖）。

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const HOST_ROOT = join(import.meta.dirname, '..');
const NM = join(HOST_ROOT, 'node_modules');
const nmUrl = (rel: string) => pathToFileURL(join(NM, rel)).href;
const NM_REACT = nmUrl('react/index.js');
const NM_REACT_DOM_CLIENT = nmUrl('react-dom/client.js');
const ROUTER_MOD = nmUrl('react-router/dist/development/index.mjs');
const ROUTER_DOM = nmUrl('react-router/dist/development/dom-export.mjs');
const ROUTER_ENTRY = pathToFileURL(join(HOST_ROOT, 'src/app/router/index.tsx')).href;
const ROUTE_ERROR_PAGE = pathToFileURL(
  join(HOST_ROOT, 'src/app/router/RouteErrorPage.tsx'),
).href;

const PROBE_ENTRY = `
import { createElement } from '${NM_REACT}';
import { createRoot } from '${NM_REACT_DOM_CLIENT}';
import { createBrowserRouter, Outlet } from '${ROUTER_MOD}';
import { RouterProvider } from '${ROUTER_DOM}';
import { RouteErrorPage } from '${ROUTE_ERROR_PAGE}';

// 复刻真实装配形态：壳路由（AppShell 位）无自身边界 → 兜底归根；
// section 布局路由挂 contained 边界；一个子页**渲染即抛**。
function Shell() {
  return createElement('div', { id: 'shell' },
    createElement('nav', { id: 'shell-nav' }, '导航'),
    createElement(Outlet));
}
function BrowseSection() {
  return createElement('div', { id: 'browse-section' }, createElement(Outlet));
}
function CrashingPage() {
  throw new Error('F10 探针：子页渲染崩溃');
}
function HealthyPage() {
  return createElement('div', { id: 'healthy' }, '正常页');
}

const router = createBrowserRouter([
  {
    path: '/',
    element: createElement(Shell),
    errorElement: createElement(RouteErrorPage), // 根兜底（整页替换）
    children: [
      {
        element: createElement(BrowseSection),
        // 被测对象：section 级 contained 边界（与 router/index.tsx 同型）
        errorElement: createElement(RouteErrorPage, { contained: true }),
        children: [
          { path: 'crash', element: createElement(CrashingPage) },
          { path: 'healthy', element: createElement(HealthyPage) },
        ],
      },
    ],
  },
]);

createRoot(document.getElementById('root')).render(
  createElement(RouterProvider, { router }),
);
`;

const SKIP = Symbol('skip');

test('section contained 边界：子页渲染崩溃 → 错误页落在本 section 内、壳存活', async (t) => {
  if (!existsSync(join(HOST_ROOT, 'node_modules', 'react'))) {
    t.skip('未安装 host 依赖（pnpm install 后重跑）');
    throw SKIP;
  }
  const work = await mkdtemp(join(tmpdir(), 'f10-boundary-'));
  const entryFile = join(work, '__f10Boundary-entry.tsx');
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
        lib: { entry: entryFile, formats: ['iife'], name: 'F10Boundary', fileName: () => 'probe.js' },
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
  // 先挂路由再导航：HTML 携带 probe.js（goto 全量刷新后应用仍在），无网络依赖
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.endsWith('/probe.js')) {
      return route.fulfill({ path: join(outDir, 'probe.js'), contentType: 'text/javascript' });
    }
    return route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><body><div id="root"></div><script src="/probe.js"></script></body></html>',
    });
  });
  try {
    await page.goto('http://f10-probe.local/healthy');
    await page.waitForSelector('#healthy', { timeout: 10_000 });
    assert.ok(await page.locator('#shell').count(), '壳应已挂载');
    assert.deepEqual(pageErrors, [], '健康页阶段不得有 pageerror');

    // 切到崩溃页：contained 错误页出现在 section 内，壳不被替换
    await page.goto('http://f10-probe.local/crash');
    await page.waitForSelector('main', { timeout: 10_000 });
    const shellAlive = (await page.locator('#shell').count()) === 1;
    const navAlive = (await page.locator('#shell-nav').count()) === 1;
    const errorShown = (await page.locator('main').innerText()).includes('FMBY');
    assert.equal(shellAlive, true, '壳必须存活（整站降级 = F10 缺陷回归）');
    assert.equal(navAlive, true, '导航必须存活');
    assert.equal(errorShown, true, 'contained 错误页应渲染在 section 内');

    // 错误页不占整屏（contained 变体无 100vh）
    const minHeight = await page
      .locator('main')
      .evaluate((el: HTMLElement) => el.style.minHeight || '(none)');
    assert.equal(minHeight, '(none)', 'contained 变体不得占整屏');

    // 恢复导航到健康页：section 状态复位（错误页不残留）
    await page.goto('http://f10-probe.local/healthy');
    await page.waitForSelector('#healthy', { timeout: 10_000 });
    assert.equal(await page.locator('#shell-nav').count(), 1, '恢复正常渲染');
    assert.deepEqual(pageErrors, [], '探针不得抛错（健康页不应有 pageerror）');
  } finally {
    await browser.close();
    await rm(work, { recursive: true, force: true });
  }
});
