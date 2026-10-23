// F4：运行日志表窗口化（'全部' 档 N 可达数千行 + 5s refetchInterval）。
//
// 行为守卫：
//   ① 窗口化生效——DOM 行数 ≪ N，且首尾 spacer（aria-hidden）补齐总高；
//   ② data-row-index 保留**真实索引**（roving/详情按钮依赖）；
//   ③ 键盘漫游（useTableRowRoving）在窗口化行上照常工作——
//      hook 的 liveRowCount() 按 DOM 数、MutationObserver 随窗口滑动重算（仓内
//      已预埋虚拟化容忍，本测试把这条不变量钉死）；
//   ④ 滚到尾部后尾部行真实渲染（窗口随页面滚动推进）。
//
// 跑法：node --import ./tests/register-aliases.mjs --test tests/runtime-logs-table-window.dom.test.ts
// 沿用 search-overlay-focus.test.ts 模式：devDep vite（打包）+ @playwright/test，零新增依赖。

import test, { after } from 'node:test';
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
const LOGS_TABLE = pathToFileURL(
  join(HOST_ROOT, 'src/pages/manage/runtime-logs/RuntimeLogsDesktopTable.tsx'),
).href;

const N = 1000;

const PROBE_ENTRY = `
import { createElement, useState } from '${NM_REACT}';
import { createRoot } from '${NM_REACT_DOM_CLIENT}';
import { RuntimeLogsDesktopTable } from '${LOGS_TABLE}';
import { useLogViewsRoving } from '${pathToFileURL(join(HOST_ROOT, 'src/pages/manage/runtime-logs/useLogViewsRoving.ts')).href}';

const makeView = (i) => ({
  record: { id: 'log' + i, timestamp: '2026-10-23T12:00:00Z', level: 'info', target: 'worker.scan' },
  targetLabel: 'worker #' + (i % 7),
  headline: '日志条目 ' + i,
  eventLabel: 'scan.completed',
  resultLabel: '成功',
  actorLabel: 'user-' + (i % 5),
  requestLabel: 'req-' + i,
  primaryFields: [],
  extraFields: [],
});

const LOG_VIEWS = Array.from({ length: ${N} }, (_, i) => makeView(i));

function Scene() {
  const [tick, setTick] = useState(0);
  // 生产接线同型：roving hook 在页面层持 tbodyRef 并传入表组件（rowCount=N，
  // 窗口化下 hook 的 liveRowCount()/MutationObserver 按 DOM 行自适应）。
  const tbodyRef = useLogViewsRoving(${N});
  return createElement('div', null,
    createElement('button', { id: 'tick', onClick: () => setTick(tick + 1) }, 'tick'),
    createElement(RuntimeLogsDesktopTable, {
      logViews: LOG_VIEWS,
      hasItems: true,
      tbodyRef,
      onDetail: () => {
        window.__detailClicked = (window.__detailClicked ?? 0) + 1;
      },
      'data-tick': tick,
    }),
  );
}

createRoot(document.getElementById('root')).render(createElement(Scene));
`;

const SKIP = Symbol('skip');

test('日志表窗口化：DOM 行 ≪ N、真实索引保留、roving 可用、滚到尾渲染尾行', async (t) => {
  if (!existsSync(join(HOST_ROOT, 'node_modules', 'react'))) {
    t.skip('未安装 host 依赖（pnpm install 后重跑）');
    throw SKIP;
  }

  const work = await mkdtemp(join(tmpdir(), 'f4-window-'));
  const entryFile = join(work, '__f4Window-entry.tsx');
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
        lib: { entry: entryFile, formats: ['iife'], name: 'F4Window', fileName: () => 'probe.js' },
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

  try {
    await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
    await page.addScriptTag({ path: join(outDir, 'probe.js') });
    await page.waitForSelector('table');

    // ① 窗口化生效：DOM 行数远小于 N（阈值 150 + 视口/overscan ⇒ 必然 < 250）
    const rowCount = await page.locator('tr[data-row-index]').count();
    assert.ok(rowCount < 250, `窗口化后 DOM 行数应 ≪ ${N}（实测 ${rowCount}）`);

    // ② 真实索引保留：首窗口从 0 开始
    const firstIndex = await page
      .locator('tr[data-row-index]')
      .first()
      .getAttribute('data-row-index');
    assert.equal(firstIndex, '0', '首行必须保留真实索引 0');

    // ③ 键盘漫游在窗口化行上工作：等 roving 给活动行写 tabindex=0 → 聚焦首行 → ↓ 移到下一行
    await page.waitForSelector('tr[data-row-index="0"][tabindex="0"]', { timeout: 3_000 });
    await page.locator('tr[data-row-index="0"]').focus();
    await page.keyboard.press('ArrowDown');
    const activeIndex = await page.evaluate(() =>
      Number(
        (document.activeElement as HTMLElement | null)?.getAttribute('data-row-index') ??
          Number.NaN,
      ),
    );
    assert.equal(activeIndex, 1, '↓ 应把焦点移到下一渲染行（roving 与窗口化兼容）');

    // 详情按钮仍可点（行内控件 Tab 序不动）
    await page.locator('tr[data-row-index="0"] button').first().click();
    const clicks = await page.evaluate(() => window.__detailClicked ?? 0);
    assert.equal(clicks, 1, '行内「查看详情」按钮照常工作');

    // ④ 重渲染（5s refetch 代理）不破坏窗口化
    await page.click('#tick');
    await page.waitForTimeout(100);
    const rowCountAfterTick = await page.locator('tr[data-row-index]').count();
    assert.ok(rowCountAfterTick < 250, `重渲染后仍窗口化（实测 ${rowCountAfterTick}）`);

    // ⑤ 滚到文档尾部 → 尾行（index=N-1）真实渲染
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForSelector('tr[data-row-index="999"]', { timeout: 3_000 });
    const lastIndex = await page
      .locator('tr[data-row-index]')
      .last()
      .getAttribute('data-row-index');
    assert.equal(Number(lastIndex), N - 1, '滚动到尾部后尾行必须真实渲染');
    assert.deepEqual(errors, [], '探针不得抛错');
  } finally {
    await browser.close();
    await rm(work, { recursive: true, force: true });
  }
});

after(() => {
  // 无全局清理需求；保留钩子位与仓内 dom 探针同构。
});
