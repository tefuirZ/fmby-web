// fe02：两个真实 DOM 可访问性缺陷（FE-A11Y-KEYBOARD-AUDIT 登记的「待裁」项）
//   FC-01 搜索浮层关闭后**焦点须归还触发按钮**（WCAG 2.4.3 焦点顺序 / 2.1.2 无键盘陷阱）
//   FC-02 PlaybackSidebar 自绘 role="dialog" 却**不响应 Esc**（与 40+ 抽屉的 Radix 口径不一致）
//
// 跑法：node --import ./tests/register-aliases.mjs --test tests/search-overlay-focus.test.ts
//
// 为什么上真实浏览器：被测是 React effect 的挂载/卸载生命周期与真实 DOM 焦点
// （SSR/renderToStaticMarkup 不执行 effect ⇒ 测不到焦点）。仓内无 jsdom /
// react-test-renderer，故沿用 player-recreate.test.ts 既有模式：复用 devDep
// vite（打包）+ @playwright/test（Chromium），**零新增依赖**。
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const HOST_ROOT = join(import.meta.dirname, '..');

/**
 * 探针：复刻 TopBar 的真实接线（触发按钮 + 受控 SearchOverlay），
 * 用 id 标记以便断言「焦点是否回到触发按钮」。测试态 provider 只补齐被测组件
 * 的依赖（react-query / router），不复刻整个 App。
 */
const PROBE_ENTRY = `
import { createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { SearchOverlay } from '${pathToFileURL(join(HOST_ROOT, 'src/pages/browse/SearchOverlay.tsx')).href}';
import { PlaybackSidebar } from '${pathToFileURL(join(HOST_ROOT, 'src/pages/browse/play/PlaybackSidebar.tsx')).href}';

function Scene() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  return createElement('div', null,
    createElement('button', { id: 'trigger', onClick: () => setSearchOpen(true) }, 'search'),
    createElement(SearchOverlay, { open: searchOpen, onClose: () => setSearchOpen(false) }),
    createElement('button', { id: 'side-trigger', onClick: () => setSideOpen(true) }, 'queue'),
    createElement(PlaybackSidebar, {
      open: sideOpen,
      isEpisodeView: false,
      sidebarRef: { current: null },
      allowed: true,
      onRequestQuery: () => {},
      onClose: () => setSideOpen(false),
      episodeSeriesTitle: '',
      isResolvingSeriesRoot: false,
      isSeriesEpisodesLoading: false,
      recommendedItems: [],
      detailKind: 'movie',
      buildPlayPath: () => '/play/1',
    }),
  );
}

function App() {
  const [client] = useState(() => new QueryClient());
  return createElement(QueryClientProvider, { client },
    createElement(MemoryRouter, null, createElement(Scene)));
}

createRoot(document.getElementById('root')).render(createElement(App));
`;

type Harness = { page: any; close: () => Promise<void> };
let harness: Harness | null = null;

/**
 * 「未装依赖」与「真失败」必须分开（rv01 #2）：
 * 统一抛 `SKIP` 哨兵表示**显式跳过**；其余异常（Chromium 缺失、vite 打包失败、
 * 探针抛错）**原样上抛** ⇒ 测试为 fail，绝不被吞成 pass。
 */
const SKIP = Symbol('skip');

/** 打包一次 + 起一个浏览器。两个用例共用，避免重复花 30s 构建。 */
async function getHarness(t: any): Promise<Harness> {
  if (harness) return harness;
  if (!existsSync(join(HOST_ROOT, 'node_modules', 'react'))) {
    t.skip('未安装 host 依赖（pnpm install 后重跑）');
    throw SKIP;
  }
  const work = await mkdtemp(join(tmpdir(), 'fe02-dom-'));
  const entryFile = join(HOST_ROOT, 'tests', '__probeFe02Dom-entry.tsx');
  await writeFile(entryFile, PROBE_ENTRY, 'utf8');
  try {
    await (
      await import('vite')
    ).build({
      configFile: false,
      root: HOST_ROOT,
      logLevel: 'error',
      define: { 'process.env.NODE_ENV': '"development"' },
      // FE02：只给 workspace 别名，不套 host 的 proxy/manualChunks。
      resolve: {
        alias: {
          '@fmby/v2-shared': join(HOST_ROOT, '..', 'shared', 'src'),
          '@': join(HOST_ROOT, 'src'),
        },
      },
      build: {
        outDir: work,
        emptyOutDir: true,
        minify: false,
        lib: { entry: entryFile, formats: ['iife'], name: 'Fe02Dom', fileName: () => 'probe.js' },
      },
    });
  } finally {
    await rm(entryFile, { force: true });
  }

  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e: Error) => errors.push(String(e)));
  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
  await page.addScriptTag({ path: join(work, 'probe.js') });
  await page.waitForSelector('#trigger');
  harness = {
    page,
    close: async () => {
      await browser.close();
      await rm(work, { recursive: true, force: true });
    },
  };
  (harness as any).errors = errors;
  return harness;
}

before(async () => {
  // 先跑一次 warm-up：即便某个用例 skip，也让下面用例复用同一份构建产物。
});

after(async () => {
  if (harness) await harness.close();
});

test('PlaybackSidebar 须支持 Esc 关闭（自绘 role=dialog 的隐含契约）', async (t) => {
  let page: any;
  try {
    ({ page } = await getHarness(t));
  } catch (err) {
    // ★只放行显式 skip；其它一律 rethrow ⇒ fail-loud（不把「跑不起来」当成通过）。
    if (err !== SKIP) throw err;
    return;
  }
  const sidebar = page.locator('#playback-sidebar');
  await page.click('#side-trigger');
  await sidebar.waitFor({ state: 'visible' });
  assert.equal(await sidebar.getAttribute('role'), 'dialog');
  assert.equal(await sidebar.getAttribute('aria-modal'), 'true');

  await page.keyboard.press('Escape');
  await sidebar.waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
  const stillOpen = await sidebar.count();
  assert.equal(
    stillOpen,
    0,
    'Esc 应关闭播放侧栏（自绘 role=dialog + aria-modal，键盘用户无法退出 = 焦点陷阱）',
  );
  assert.deepEqual((harness as any).errors, [], '探针不得抛错');
});

test('SearchOverlay 关闭后焦点须归还触发按钮（不丢焦点到 body）', async (t) => {
  let page: any;
  try {
    ({ page } = await getHarness(t));
  } catch (err) {
    // ★只放行显式 skip；其它一律 rethrow ⇒ fail-loud（不把「跑不起来」当成通过）。
    if (err !== SKIP) throw err;
    return;
  }
  // 真实用户路径：触发按钮取得焦点 → 打开浮层
  await page.focus('#trigger');
  await page.click('#trigger');
  const overlay = page.locator('[role="dialog"][aria-label="全局搜索"]');
  await overlay.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.activeElement?.tagName === 'INPUT');

  // Esc 关闭 → 焦点必须回到触发按钮
  await page.keyboard.press('Escape');
  await overlay.waitFor({ state: 'detached' });
  const landed = await page.evaluate(
    () => document.activeElement?.id || document.activeElement?.tagName,
  );
  assert.deepEqual((harness as any).errors, [], '探针不得抛错');
  assert.equal(
    landed,
    'trigger',
    `关闭后焦点应归还触发按钮 #trigger，实际落在 ${landed}（掉到 <body> 会让键盘用户丢失位置）`,
  );
});
