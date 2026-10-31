// FE-LIST-KEYNAV-2：管理面表格**行**键盘漫游（真实 DOM，非静态断言）。
//
// 跑法：node --import ./tests/register-aliases.mjs --test tests/table-row-keynav.test.ts
//
// 为什么上真实浏览器：被测是真实 DOM 焦点移动（↑↓/Home/End 落在哪一行、
// 焦点有没有丢到 <body>），SSR/renderToStaticMarkup 不执行也不反映焦点。
// 仓内无 jsdom / testing-library（引新依赖违反 ponytail），故沿用
// player-recreate.test.ts 与 search-overlay-focus.test.ts 既有模式：
// 复用 devDep vite（打包）+ @playwright/test（Chromium），**零新增依赖**。
//
// 验收口径（照 docs/FE-LIST-KEYNAV.md）：↑↓ 移动行 / Home/End / Enter 打开 / 焦点不丢。

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const HOST_ROOT = join(import.meta.dirname, '..');

/**
 * node_modules 的**绝对路径**。
 *
 * rv01 #4（主代理采纳）：探针 work 落 os.tmpdir()（fmby-queue 会把命令降权到 tefuir，
 * 而仓库树 host/ 是 root:755 ⇒ tefuir 不可写，在仓库树内建临时目录必 EACCES）。
 * 但 entry 一落到 /tmp，Rollup 就解析不到 bare specifier（实测 "failed to resolve
 * import react"）⇒ 改用 node_modules 下的绝对路径 import 绕开解析链。
 * vite 的 root 仍指 HOST_ROOT，故 @fmby/* 别名与 CSS Module 照旧生效。
 */
const NM = join(HOST_ROOT, 'node_modules');
const nmUrl = (rel: string) => pathToFileURL(join(NM, rel)).href;
const NM_REACT = nmUrl('react/index.js');
const NM_REACT_DOM_CLIENT = nmUrl('react-dom/client.js');
const NM_REACT_ROUTER = nmUrl('react-router/dist/development/index.mjs');
/** @tanstack/react-query（SessionsPage 等页面级组件要 QueryClientProvider）。 */
const NM_RQ = nmUrl('@tanstack/react-query/build/modern/index.js');

/** 把 entry 模板里的 `${NM_*}` 占位符（模板字面量内已转义）替换成真实绝对路径。 */
function withNmPaths(src: string): string {
  return src
    .replace(/\$\{NM_REACT_DOM_CLIENT\}/g, NM_REACT_DOM_CLIENT)
    .replace(/\$\{NM_REACT_ROUTER\}/g, NM_REACT_ROUTER)
    .replace(/\$\{NM_REACT\}/g, NM_REACT)
    .replace(/\$\{NM_RQ\}/g, NM_RQ);
}

/**
 * 探针：真实 `<table>` + 真实 `useTableRowRoving`（**不是重写一份逻辑**），
 * 复刻管理面行的真实结构：行内多个按钮（详情/编辑/删除）+ 一行无按钮
 * （对应「当前设备不可移除」这类行，历史上焦点会在这里掉到 <body>）。
 */
const PROBE_ENTRY = `
import { createElement, useRef, useState } from '\${NM_REACT}';
import { createRoot } from '\${NM_REACT_DOM_CLIENT}';
import { useTableRowRoving } from '${new URL('file:///PLACEHOLDER').href}';

function RovingHost({ tbodyRef, rowCount, onActivate }) {
  // hook 挂在内层（可独立卸载）；tbody 由外层 Table 持有 ⇒ 卸载内层时
  // 行 DOM 保留，便于验证 teardown 是否还原 roving tabindex（rv02 #24 M-1）。
  useTableRowRoving({ tbodyRef, rowCount, onActivate });
  return null;
}

function Table() {
  const tbodyRef = useRef(null);
  const [opened, setOpened] = useState(-1);
  const [hostMounted, setHostMounted] = useState(true);
  globalThis.__opened = () => opened;
  // 控制内层 RovingHost 挂载/卸载（tbody 保留），用于 teardown 断言。
  globalThis.__setHostMounted = (v) => setHostMounted(v);
  return createElement('table', null,
    createElement('tbody', { ref: tbodyRef },
      [0, 1, 2, 3].map((i) =>
        createElement('tr', { key: i, 'data-row-index': String(i) },
          createElement('td', null, 'row-' + i),
          // 第 2 行（index 2）无按钮 —— 焦点不得在此丢失
          i === 2 ? null : createElement('td', null,
            createElement('button', { 'data-act': 'view-' + i, type: 'button' }, 'view'),
            createElement('button', { 'data-act': 'edit-' + i, type: 'button' }, 'edit'),
          ),
        ),
      ),
    ),
    hostMounted
      ? createElement(RovingHost, { tbodyRef, rowCount: 4, onActivate: (i) => setOpened(i) })
      : null,
  );
}

const __root = createRoot(document.getElementById('root'));
__root.render(createElement(Table));
globalThis.__root = __root;
`;

async function mount(t: any) {
  if (!existsSync(join(HOST_ROOT, 'node_modules', 'react'))) {
    t.skip('未安装 host 依赖（pnpm install 后重跑）');
    return null;
  }
      // rv01/主代理裁定（FE-LIST-KEYNAV-3）：探针 entry 与 vite cacheDir 一律落
    // **临时目录**，不得写进受版本控制的 host/tests/（#537 后席位树 root:755，
    // 并发跑 node:test 时多个测试抢同一固定文件名 ⇒ EACCES/ENOENT）。
    // 落点必须在 host/ **之内**：出去了就解析不到 @fmby/* 别名与 CSS Module。
        // rv01 #4（主代理采纳）：work 落 **os.tmpdir()** —— fmby-queue 会把命令降权到
    // tefuir（/data/fmby-seats/* 于 2026-10-12 扩域），而仓库树 host/ 是 root:755，
    // tefuir 不可写 ⇒ 在仓库树内建临时目录必 EACCES。/tmp 对 tefuir 可写。
    const work = await mkdtemp(join(tmpdir(), 'fe02-table-'));
  const entryFile = join(work, `entry-${Date.now()}-${process.pid}.tsx`);
  const hookPath = `file://${join(HOST_ROOT, 'src/features/a11y/useTableRowRoving.ts')}`;
  await writeFile(entryFile, withNmPaths(PROBE_ENTRY.replace('file:///PLACEHOLDER', hookPath.replace('file://', ''))), 'utf8');
  try {
    await (
      await import('vite')
    ).build({
      configFile: false,
      root: HOST_ROOT,
      cacheDir: join(work, '.vite'),
      logLevel: 'error',
      define: { 'process.env.NODE_ENV': '"development"' },
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
        lib: { entry: entryFile, formats: ['iife'], name: 'TableKeynav', fileName: () => 'probe.js' },
      },
    });
  } finally {
  }

  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e: Error) => errors.push(String(e)));
  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
  await page.addScriptTag({ path: join(work, 'probe.js') });
  await page.waitForSelector('[data-row-index="0"]');
  return {
    page,
    errors,
    close: async () => {
      await browser.close();
      await rm(work, { recursive: true, force: true });
    },
  };
}

/**
 * hook 级探针：**只读表**（行内零可聚焦控件）+ 数据可整批替换。
 *
 * 为什么单独探针：I-1 的受害面正是「行里没有按钮、没法聚焦、Tab 又进不来」的表
 * —— 而上面的通用 PROBE_ENTRY 每行都有按钮，用户能先聚焦按钮再按方向键，
 * **掩盖**了 I-1。这里三行全是纯文本 <td>，键盘入口只能靠 roving 停靠点。
 * `__swap` 用来模拟换页/排序/等长替换/虚拟化挂载卸载。
 */
const ROVING_HOOK_ENTRY = `
import { createElement, useRef, useState } from '${'${NM_REACT}'}';
import { createRoot } from '${'${NM_REACT_DOM_CLIENT}'}';
import { useTableRowRoving } from 'file:///PLACEHOLDER';

function Table() {
  const tbodyRef = useRef(null);
  const [rows, setRows] = useState(['r0', 'r1', 'r2']);
  const [acts, setActs] = useState([]);
  useTableRowRoving({
    tbodyRef,
    rowCount: rows.length,
    onActivate: (i) => setActs((prev) => [...prev, i]),
  });
  globalThis.__swap = (next) => setRows(next);
  globalThis.__activations = acts;
  return createElement('table', null,
    createElement('tbody', { ref: tbodyRef },
      rows.map((label, i) =>
        createElement('tr', { key: label + ':' + i, 'data-row-index': String(i), 'data-label': label },
          createElement('td', null, label),
        ),
      ),
    ),
  );
}

createRoot(document.getElementById('root')).render(createElement(Table));
`;

async function mountRovingHookProbe(t: any, tmpPrefix: string) {
  if (!existsSync(join(HOST_ROOT, 'node_modules', 'react'))) {
    t.skip('未安装 host 依赖（pnpm install 后重跑）');
    return null;
  }
  const work = await mkdtemp(join(tmpdir(), tmpPrefix));
  const entryFile = join(work, `entry-${Date.now()}-${process.pid}.tsx`);
  const hookPath = `file://${join(HOST_ROOT, 'src/features/a11y/useTableRowRoving.ts')}`;
  await writeFile(
    entryFile,
    withNmPaths(ROVING_HOOK_ENTRY.replace('file:///PLACEHOLDER', hookPath.replace('file://', ''))),
    'utf8',
  );
  try {
    await (
      await import('vite')
    ).build({
      configFile: false,
      root: HOST_ROOT,
      cacheDir: join(work, '.vite'),
      logLevel: 'error',
      define: { 'process.env.NODE_ENV': '"development"' },
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
        lib: { entry: entryFile, formats: ['iife'], name: 'RovingHook', fileName: () => 'probe.js' },
      },
    });
  } catch (err) {
    await rm(work, { recursive: true, force: true });
    throw err;
  }

  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e: Error) => errors.push(String(e)));
  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
  await page.addScriptTag({ path: join(work, 'probe.js') });
  await page.waitForSelector('tbody tr[data-row-index="0"]');
  return {
    page,
    errors,
    close: async () => {
      await browser.close();
      await rm(work, { recursive: true, force: true });
    },
  };
}

/** 当前焦点所在的行索引（-1 = 不在任何行内 / 掉了）。 */
const focusedRow = (page: any) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return -1;
    const row = el.closest('[data-row-index]');
    return row ? Number(row.getAttribute('data-row-index')) : -1;
  });

test('表格行漫游：↑↓ 逐行移动，边界停住（不环绕、不越界）', async (t) => {
  const h = await mount(t);
  if (!h) return;
  try {
    const { page } = h;
    await page.focus('[data-row-index="0"] button');
    assert.equal(await focusedRow(page), 0);

    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRow(page), 1, '↓ 应到下一行');
    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRow(page), 2, '↓ 到无按钮行也不得丢焦点');
    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRow(page), 3, '↓ 到末行');

    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRow(page), 3, '末行 ↓ 停住（不环绕、不越界）');

    await page.keyboard.press('ArrowUp');
    assert.equal(await focusedRow(page), 2, '↑ 应回到上一行');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    assert.equal(await focusedRow(page), 0, '↑ 回首行');
    await page.keyboard.press('ArrowUp');
    assert.equal(await focusedRow(page), 0, '首行 ↑ 停住');

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

test('表格行漫游：Home/End 跨行跳首/末项（原报告登记的死键缺口）', async (t) => {
  const h = await mount(t);
  if (!h) return;
  try {
    const { page } = h;
    await page.focus('[data-row-index="1"] button');
    assert.equal(await focusedRow(page), 1);

    await page.keyboard.press('End');
    assert.equal(await focusedRow(page), 3, 'End → 末项（表格无「行内右端」，必须跨行）');

    await page.keyboard.press('Home');
    assert.equal(await focusedRow(page), 0, 'Home → 首项');

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

test('表格行漫游：焦点始终不丢（经过无按钮行也不掉到 body）', async (t) => {
  const h = await mount(t);
  if (!h) return;
  try {
    const { page } = h;
    await page.focus('[data-row-index="1"] button');
    // 走满一圈，每一步都断言焦点仍在文档内且落在某一行
    for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'End', 'Home', 'ArrowDown']) {
      await page.keyboard.press(key);
      const row = await focusedRow(page);
      assert.ok(row >= 0, `按 ${key} 后焦点掉出了表格（row=${row}）`);
      const isBody = await page.evaluate(() => document.activeElement === document.body);
      assert.equal(isBody, false, `按 ${key} 后焦点掉到 <body>`);
    }
    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

test('表格行漫游：Enter 在行本身上触发打开；焦点在按钮上时不抢按钮语义', async (t) => {
  const h = await mount(t);
  if (!h) return;
  try {
    const { page } = h;
    // ① 焦点落在 <tr> 本身（无按钮行必然如此）→ Enter 触发 onActivate
    await page.evaluate(() => {
      const row = document.querySelector('[data-row-index="2"]') as HTMLElement;
      row.tabIndex = -1;
      row.focus();
    });
    assert.equal(await focusedRow(page), 2);
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => (globalThis as any).__opened?.()), 2, 'Enter 应打开当前行');

    // ② 焦点在行内按钮上 → Enter 归按钮（hook 不 preventDefault、不抢）
    await page.evaluate(() => {
      const btn = document.querySelector('[data-act="view-1"]') as HTMLElement;
      btn.focus();
    });
    await page.keyboard.press('Enter');
    const openedAfter = await page.evaluate(() => (globalThis as any).__opened?.());
    assert.equal(openedAfter, 2, 'Enter 在按钮上不应触发行打开（避免抢按钮语义）');

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/**
 * 集成探针：渲染**真实的 LibraryTable 组件**（不是复刻），验证接线真的生效
 * —— hook 单测再绿，也不代表页面接对了（data-row-index / tbodyRef / rowCount）。
 */
const LIB_TABLE_ENTRY = `
import { createElement } from '\${NM_REACT}';
import { createRoot } from '\${NM_REACT_DOM_CLIENT}';
import { MemoryRouter } from '\${NM_REACT_ROUTER}';
import { LibraryTable } from '${'${LIB_TABLE_PATH}'}';

const libs = [0, 1, 2].map((i) => ({
  id: 'lib-' + i,
  name: '库 ' + i,
  libraryType: 'movie',
  typeLabel: '电影',
  itemCount: i,
  status: 'healthy',
  sourceNames: [],
  actualSourceNames: [],
}));

globalThis.__opened = [];
function App() {
  return createElement(MemoryRouter, null,
    createElement(LibraryTable, {
      libraries: libs,
      filteredLibraries: libs,
      keyword: '',
      statusFilter: 'all',
      typeFilter: 'all',
      onKeywordChange: () => {},
      onStatusFilterChange: () => {},
      onTypeFilterChange: () => {},
      onOpenView: (id) => { globalThis.__opened.push(id); },
      onOpenEdit: () => {},
      onRequestDelete: () => {},
      onCreateClick: () => {},
      onMoveLibrary: () => {},
      reorderPending: false,
    }),
  );
}

createRoot(document.getElementById('root')).render(createElement(App));
`;

async function mountLibTable(t: any) {
  if (!existsSync(join(HOST_ROOT, 'node_modules', 'react'))) {
    t.skip('未安装 host 依赖（pnpm install 后重跑）');
    return null;
  }
      // rv01/主代理裁定（FE-LIST-KEYNAV-3）：探针 entry 与 vite cacheDir 一律落
    // **临时目录**，不得写进受版本控制的 host/tests/（#537 后席位树 root:755，
    // 并发跑 node:test 时多个测试抢同一固定文件名 ⇒ EACCES/ENOENT）。
    // 落点必须在 host/ **之内**：出去了就解析不到 @fmby/* 别名与 CSS Module。
      const work = await mkdtemp(join(tmpdir(), 'fe02-libtable-'));
  const entryFile = join(work, `entry-${Date.now()}-${process.pid}.tsx`);
  const libPath = `file://${join(HOST_ROOT, 'src/pages/manage/libraries/components/LibraryTable.tsx')}`;
  await writeFile(entryFile, withNmPaths(LIB_TABLE_ENTRY.replace('${LIB_TABLE_PATH}', libPath)), 'utf8');
  try {
    await (
      await import('vite')
    ).build({
      configFile: false,
      root: HOST_ROOT,
      cacheDir: join(work, '.vite'),
      logLevel: 'error',
      define: { 'process.env.NODE_ENV': '"development"' },
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
        lib: { entry: entryFile, formats: ['iife'], name: 'LibTable', fileName: () => 'probe.js' },
      },
    });
  } finally {
  }
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e: Error) => errors.push(String(e)));
  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
  await page.addScriptTag({ path: join(work, 'probe.js') });
  await page.waitForSelector('[data-row-index="0"]');
  return {
    page,
    errors,
    close: async () => {
      await browser.close();
      await rm(work, { recursive: true, force: true });
    },
  };
}

test('契约①：↑↓/Home/End 后 activeElement 必须是行本身（<tr>）', async (t) => {
  const h = await mount(t);
  if (!h) return;
  try {
    const { page } = h;
    await page.focus('[data-row-index="0"] button');
    for (const key of ['ArrowDown', 'ArrowDown', 'End', 'Home']) {
      await page.keyboard.press(key);
      const tag = await page.evaluate(() => document.activeElement?.tagName);
      const isRow = await page.evaluate(
        () => document.activeElement?.matches('[data-row-index]') ?? false,
      );
      assert.ok(
        isRow,
        `按 ${key} 后 activeElement 应为行本身（<tr>），实际 <${tag}> —— ` +
          '若落到行内首控件，UserTable 的行首 checkbox 会让 Enter 变成「切换选中」',
      );
    }
    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

test('契约②：Enter 在行焦点上触发 onActivate（死分支守卫）', async (t) => {
  const h = await mount(t);
  if (!h) return;
  try {
    const { page } = h;
    await page.focus('[data-row-index="0"] button');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    assert.equal(
      await page.evaluate(() => (globalThis as any).__opened?.()),
      1,
      '↑↓ 落到行后按 Enter 必须触发 onActivate（否则 37 表铺开时该分支是死代码）',
    );
    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

test('契约③：行本身进 Tab 序（roving 单一停靠点），行内控件仍可 Tab 达', async (t) => {
  const h = await mount(t);
  if (!h) return;
  try {
    const { page } = h;
    await page.focus('[data-row-index="0"] button');
    await page.keyboard.press('ArrowDown');
    const rowTabindex = await page.evaluate(
      () => document.querySelector('[data-row-index="1"]')?.getAttribute('tabindex'),
    );
    assert.equal(
      rowTabindex,
      '0',
      '焦点行须是唯一的 tabindex=0 停靠点（I-1：键盘入口可达；行内控件不受影响）',
    );
    // I-1 完整语义：整表**恰好一个** tabindex=0，其余数据行一律 -1。
    // 只断言目标行为 0 会漏掉「旧行残留 0 ⇒ 出现第二个停靠点」这类回归。
    const tabindexByRow = await page.evaluate(() =>
      Array.from(document.querySelectorAll('tbody tr[data-row-index]')).map((r) => [
        r.getAttribute('data-row-index'),
        r.getAttribute('tabindex'),
      ]),
    );
    const stops = tabindexByRow.filter(([, ti]) => ti === '0').map(([i]) => i);
    assert.deepEqual(stops, ['1'], 'roving 必须留唯一 Tab 停靠点，且跟随焦点行');
    assert.equal(
      tabindexByRow.filter(([, ti]) => ti !== '0' && ti !== '-1').length,
      0,
      '非活动行必须显式为 tabindex=-1（不得留空，否则会重新进 Tab 序）',
    );
    const controlsNegative = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll('[data-row-index] button')).filter(
          (b) => b.getAttribute('tabindex') === '-1',
        ).length,
    );
    assert.equal(controlsNegative, 0, '行内控件不得被设 tabindex=-1（Tab 可达性零回归）');
    // I-1 只接管**行本身**的 Tab 序；不得顺手把行内按钮也变成不可聚焦。
    const controlsDisabled = await page.evaluate(
      () => document.querySelectorAll('[data-row-index] button[disabled]').length,
    );
    assert.equal(controlsDisabled, 0, '行内按钮不得被禁用（roving 不改变行内控件语义）');
    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

test('反向守卫：文本输入框内方向键不得被劫持（防修过头）', async (t) => {
  const h = await mount(t);
  if (!h) return;
  try {
    const { page } = h;
    // 往第 1 行塞一个文本框并聚焦：方向键须归光标，不得移动行
    await page.evaluate(() => {
      const row = document.querySelector('[data-row-index="1"]') as HTMLElement;
      const td = document.createElement('td');
      const input = document.createElement('input');
      input.id = 'probe-text';
      input.type = 'text';
      td.appendChild(input);
      row.appendChild(td);
      input.focus();
    });
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'probe-text');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('End');
    assert.equal(
      await page.evaluate(() => document.activeElement?.id),
      'probe-text',
      '文本框内方向键应归光标，不得被漫游劫持（否则无法移动输入光标）',
    );
    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

test('teardown 断言：卸载 RovingHost 后不残留 roving tabindex（rv02 #24 M-1 防回归）', async (t) => {
  const h = await mount(t);
  if (!h) return;
  try {
    const { page } = h;
    // ★I-1 语义（rv02 #24 合并后）：↓ 的目标行是**活动行** ⇒ tabindex=0（真 Tab 停靠点），
    //   其余 -1。tbody 由外层 Table 持有，卸载内层后行 DOM 保留。
    await page.focus('[data-row-index="0"] button');
    await page.keyboard.press('ArrowDown');
    const before = await page.evaluate(
      () => document.querySelector('[data-row-index="1"]')?.getAttribute('tabindex'),
    );
    assert.equal(before, '0', '前置：↓ 的目标行是活动行，应有 tabindex=0（I-1）');
    const prevRow = await page.evaluate(
      () => document.querySelector('[data-row-index="0"]')?.getAttribute('tabindex'),
    );
    assert.equal(prevRow, '-1', '前置：非活动行 tabindex=-1（roving）');

    // 卸载内层 RovingHost（tbody/DOM 保留）⇒ 触发 hook cleanup
    await page.evaluate(() => (globalThis as any).__setHostMounted(false));
    await page.waitForTimeout(50);
    const after = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll('[data-row-index]')).map((r) =>
          r.getAttribute('tabindex'),
        ),
    );
    // ★防回归：若删 cleanup 还原行，此断言转红（残留 tabindex 破坏 Tab 序 / 可访问性）
    assert.deepEqual(
      after,
      [null, null, null, null],
      '卸载后所有行的 roving tabindex 须被还原（不残留 0/-1）',
    );
  } finally {
    await h.close();
  }
});

test('接线实证（真实 LibraryTable）：↑↓ 在行间移动 + Enter 开详情', { timeout: 60000 }, async (t) => {
  // ★rv02 #24 Minor：此实证较重（真实组件打包 + Chromium 启动，本地 ~16s）。
  // 显式留 60s 余量，避免 CI/农场抖动把单测误杀（node:test 默认无单测上限，
  // 这里主动标注耗时量级，便于后续若再变重时排查）。
  const h = await mountLibTable(t);
  if (!h) return;
  try {
    const { page } = h;
    await page.focus('[data-row-index="0"] button');
    assert.equal(await focusedRow(page), 0);

    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRow(page), 1, '真实表格：↓ 应到下一行');
    await page.keyboard.press('End');
    assert.equal(await focusedRow(page), 2, '真实表格：End → 末项');
    await page.keyboard.press('Home');
    assert.equal(await focusedRow(page), 0, '真实表格：Home → 首项');

    // Enter 在行本身上 → 开「详情」（接线传入的 onOpenView）
    await page.evaluate(() => {
      const row = document.querySelector('[data-row-index="2"]');
      row.setAttribute('tabindex', '-1');
      row.focus();
    });
    await page.keyboard.press('Enter');
    const opened = await page.evaluate(() => (globalThis as any).__opened ?? []);
    assert.deepEqual(opened, ['lib-2'], 'Enter 应打开当前行的详情');

    // tableWrap 滚动区 a11y（第八批）：媒体库列表 tableWrap 补 role=region + aria-label（roving 表无 tabIndex）。
    const libTw = await page.evaluate(() => {
      const el = document.querySelector('div[aria-label="媒体库列表（可横向滚动）"]');
      return el ? [el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('aria-label')] : null;
    });
    assert.deepEqual(libTw, ['region', null, '媒体库列表（可横向滚动）'], '媒体库列表 tableWrap 应为 role=region + aria-label');

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

test('接线实证（真实 LibraryTable）：行内按钮 Tab 可达性未被破坏（无回归）', { timeout: 60000 }, async (t) => {
  // ★rv02 #24 Minor：同上，重实证显式留 60s 余量。
  const h = await mountLibTable(t);
  if (!h) return;
  try {
    const { page } = h;
    // 行内按钮不得被设成 tabindex=-1（本卡裁定：不夺行内按钮可达性）
    const negative = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-row-index] button')).filter(
        (b) => b.getAttribute('tabindex') === '-1',
      ).length,
    );
    assert.equal(negative, 0, '行内按钮不得被 roving 设为 tabindex=-1（会让删除/编辑键盘不可达）');
    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/* ------------------------------------------------------------------ */
/* UserTable 接线实证（FE-LIST-KEYNAV-4 · 主代理裁定口径）          */
/* ------------------------------------------------------------------ */

const USER_TABLE_ENTRY = `
import { createElement } from '${'${NM_REACT}'}';
import { createRoot } from '${'${NM_REACT_DOM_CLIENT}'}';
import { MemoryRouter } from '${'${NM_REACT_ROUTER}'}';
import { UserTable } from '${'${USER_TABLE_PATH}'}';

// 当前页 3 行（服务端分页：漫游域 = 当前页）
const users = [0, 1, 2].map((i) => ({
  id: 'u-' + i, username: 'user' + i, accountKind: 'human', roles: [],
  roleLabel: '普通用户', status: 'active', libraryScopes: [], sourceGrants: [],
  mustChangePassword: false,
}));

globalThis.__opened = [];
globalThis.__toggles = [];
function App() {
  return createElement(MemoryRouter, null,
    createElement(UserTable, {
      users, total: users.length, page: 1, pageSize: 20, totalPages: 1,
      isFetching: false, isPageTransitioning: false, currentUserId: 'me-not-in-list',
      keyword: '', statusFilter: 'all', accountKindFilter: 'all', selectedUserIds: [],
      onKeywordChange: () => {}, onStatusFilterChange: () => {}, onAccountKindFilterChange: () => {},
      onPreviousPage: () => {}, onNextPage: () => {},
      // 行首 checkbox：裁定要求「不动 tabIndex」，且其自身 Enter/Space 行为不变
      onSelectUser: (id, checked) => { globalThis.__toggles.push([id, checked]); },
      onSelectAll: () => {},
      onOpenView: (id) => { globalThis.__opened.push(id); },
      onOpenEdit: () => {}, onResetPassword: () => {}, onToggleUserStatus: () => {},
      onResetLoginRisk: () => {}, onReviewRegistration: () => {},
    }),
  );
}

createRoot(document.getElementById('root')).render(createElement(App));
`;

async function mountUserTable(t: any) {
  if (!existsSync(join(HOST_ROOT, 'node_modules', 'react'))) {
    t.skip('未安装 host 依赖（pnpm install 后重跑）');
    return null;
  }
  const work = await mkdtemp(join(tmpdir(), 'fe02-usertable-'));
  const entryFile = join(work, `entry-${Date.now()}-${process.pid}.tsx`);
  const userPath = `file://${join(HOST_ROOT, 'src/pages/manage/users/components/UserTable.tsx')}`;
  await writeFile(entryFile, withNmPaths(USER_TABLE_ENTRY.replace('${USER_TABLE_PATH}', userPath)), 'utf8');
  try {
    await (
      await import('vite')
    ).build({
      configFile: false,
      root: HOST_ROOT,
      cacheDir: join(work, '.vite'),
      logLevel: 'error',
      define: { 'process.env.NODE_ENV': '"development"' },
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
        lib: { entry: entryFile, formats: ['iife'], name: 'UserTable', fileName: () => 'probe.js' },
      },
    });
  } finally {
  }
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e: Error) => errors.push(String(e)));
  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
  await page.addScriptTag({ path: join(work, 'probe.js') });
  await page.waitForSelector('[data-row-index="0"]');
  return {
    page,
    errors,
    close: async () => {
      await browser.close();
      await rm(work, { recursive: true, force: true });
    },
  };
}

test('接线实证（真实 UserTable）：↑↓/Home/End 在行间移动，漫游域 = 当前页', async (t) => {
  const h = await mountUserTable(t);
  if (!h) return;
  try {
    const { page } = h;
    await page.focus('[data-row-index="0"] input[type="checkbox"]');
    assert.equal(await focusedRow(page), 0);

    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRow(page), 1, '↓ 应到下一行');
    await page.keyboard.press('End');
    assert.equal(await focusedRow(page), 2, 'End → 当前页末行（服务端分页下不跨页）');
    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRow(page), 2, '末行 ↓ 停住（不越界、不跨页）');
    await page.keyboard.press('Home');
    assert.equal(await focusedRow(page), 0, 'Home → 当前页首行');

    // tableWrap 滚动区 a11y（最后一批）：账号列表 tableWrap 补 role=region + aria-label（roving 表无 tabIndex）。
    const userTw = await page.evaluate(() => {
      const el = document.querySelector('div[aria-label="账号列表（可横向滚动）"]');
      return el ? [el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('aria-label')] : null;
    });
    assert.deepEqual(userTw, ['region', null, '账号列表（可横向滚动）'], '用户列表 tableWrap 应为 role=region + aria-label');

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

test('UserTable：行首 checkbox 的 Enter/Space 语义不变（裁定：不动其 tabIndex）', async (t) => {
  const h = await mountUserTable(t);
  if (!h) return;
  try {
    const { page } = h;
    // ① ↑↓ 后焦点必须落在行本身（不是 checkbox）—— 否则 Enter 会变成「切换选中」
    await page.focus('[data-row-index="0"] input[type="checkbox"]');
    await page.keyboard.press('ArrowDown');
    const tag = await page.evaluate(() => document.activeElement?.tagName);
    const isRow = await page.evaluate(
      () => document.activeElement?.matches('[data-row-index]') ?? false,
    );
    assert.ok(isRow, `↑↓ 后焦点应在行本身，实际 <${tag}>（落 checkbox 会让 Enter 变选中）`);

    // ② Enter 在行本身 ⇒ 打开该行（onOpenView），**不**触发 checkbox 切换
    await page.keyboard.press('Enter');
    const opened = await page.evaluate(() => (globalThis as any).__opened ?? []);
    const toggles = await page.evaluate(() => (globalThis as any).__toggles ?? []);
    assert.deepEqual(opened, ['u-1'], 'Enter 应打开当前行');
    assert.deepEqual(toggles, [], 'Enter 在行焦点上不得触发 checkbox 切换');

    // ③ 焦点**在** checkbox 上时，Space 仍照旧切换（原生语义未被破坏）
    await page.focus('[data-row-index="0"] input[type="checkbox"]');
    await page.keyboard.press('Space');
    const toggles2 = await page.evaluate(() => (globalThis as any).__toggles ?? []);
    assert.ok(toggles2.length >= 1, 'checkbox 上的 Space 应照旧切换选中（原生语义不变）');

    // ④ checkbox 未被设 tabindex=-1（Tab 可达性零回归）
    const negative = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll('[data-row-index] input[type="checkbox"]')).filter(
          (c) => c.getAttribute('tabindex') === '-1',
        ).length,
    );
    assert.equal(negative, 0, '行首 checkbox 不得被设 tabindex=-1（Tab 可达性零回归）');

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/* ------------------------------------------------------------------ */
/* ProbeTaskTable 接线实证（第一批 2/3）                             */
/* ------------------------------------------------------------------ */

const PROBE_TASK_ENTRY = `
import { createElement } from '${'${NM_REACT}'}';
import { createRoot } from '${'${NM_REACT_DOM_CLIENT}'}';
import { ProbeTaskTable } from '${'${PROBE_TASK_PATH}'}';

const mk = (i) => ({
  sourceId: 'src-' + i,
  mediaItemId: 'item-' + i,
  title: '条目 ' + i,
  libraryId: 'lib-1',
  libraryName: '库',
  mountId: 'mount-1',
  mountName: '挂载',
  providerType: 'webdav',
  mountStatus: 'ok',
  availabilityState: 'available',
  sourcePath: '/p/' + i,
  sourceStatus: 'ok',
  status: 'idle',
  attemptCount: 0,
});

const tasks = [0, 1, 2].map(mk);

globalThis.__selected = [];
function App() {
  return createElement(ProbeTaskTable, {
    tasks,
    filteredTasks: tasks,
    keyword: '',
    statusFilter: 'all',
    onKeywordChange: () => {},
    onStatusFilterChange: () => {},
    onClearScope: () => {},
    onSelectSource: (id) => { globalThis.__selected.push(id); },
  });
}

createRoot(document.getElementById('root')).render(createElement(App));
`;

async function mountProbeTaskTable(t: any) {
  if (!existsSync(join(HOST_ROOT, 'node_modules', 'react'))) {
    t.skip('未安装 host 依赖（pnpm install 后重跑）');
    return null;
  }
  const work = await mkdtemp(join(tmpdir(), 'fe02-probetask-'));
  const entryFile = join(work, `entry-${Date.now()}-${process.pid}.tsx`);
  const compPath = `file://${join(HOST_ROOT, 'src/pages/manage/probe-tasks/components/ProbeTaskTable.tsx')}`;
  await writeFile(entryFile, withNmPaths(PROBE_TASK_ENTRY.replace('${PROBE_TASK_PATH}', compPath)), 'utf8');
  try {
    await (
      await import('vite')
    ).build({
      configFile: false,
      root: HOST_ROOT,
      cacheDir: join(work, '.vite'),
      logLevel: 'error',
      define: { 'process.env.NODE_ENV': '"development"' },
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
        lib: { entry: entryFile, formats: ['iife'], name: 'ProbeTask', fileName: () => 'probe.js' },
      },
    });
  } finally {
  }
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e: Error) => errors.push(String(e)));
  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
  await page.addScriptTag({ path: join(work, 'probe.js') });
  await page.waitForSelector('[data-row-index="0"]');
  return {
    page,
    errors,
    close: async () => {
      await browser.close();
      await rm(work, { recursive: true, force: true });
    },
  };
}

test('接线实证（真实 ProbeTaskTable）：↑↓/Home/End 移动行 + Enter 选源', async (t) => {
  const h = await mountProbeTaskTable(t);
  if (!h) return;
  try {
    const { page } = h;
    await page.focus('[data-row-index="0"] button');
    assert.equal(await focusedRow(page), 0);

    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRow(page), 1, '↓ 应到下一行');
    const tag = await page.evaluate(() => document.activeElement?.tagName);
    assert.equal(tag, 'TR', '↑↓ 后焦点应在行本身（<tr>）');
    await page.keyboard.press('End');
    assert.equal(await focusedRow(page), 2, 'End → 末行');
    await page.keyboard.press('Home');
    assert.equal(await focusedRow(page), 0, 'Home → 首行');

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    assert.deepEqual(
      await page.evaluate(() => (globalThis as any).__selected ?? []),
      ['src-1'],
      'Enter 应选中当前行来源（onSelectSource）',
    );

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/* ------------------------------------------------------------------ */
/* MountTable 接线实证（第一批 3/3）                                 */
/* ------------------------------------------------------------------ */

const MOUNT_TABLE_ENTRY = `
import { createElement } from '${'${NM_REACT}'}';
import { createRoot } from '${'${NM_REACT_DOM_CLIENT}'}';
import { MountTable } from '${'${MOUNT_TABLE_PATH}'}';

const mk = (i) => ({
  id: 'm-' + i, name: '挂载 ' + i, mountType: 'webdav', typeLabel: 'WebDAV',
  path: '/srv/' + i, pathLabel: '/srv/' + i,
  healthStatus: 'healthy', capabilities: ['scan'],
  linkedLibraries: [{ id: 'lib-' + i, name: '库 ' + i }],
  referenceCounts: { libraries: 0, rules: 0, tasks: 0 },
  unavailableBindingCount: 0,
  note: '', rateConfig: null, visibilityRule: '{}',
  sidecarNfo: false, sidecarSubtitle: false, sidecarPoster: false,
  credentialStatus: 'ok',
});

const mounts = [0, 1, 2].map(mk);
const noop = { isPending: false, variables: undefined, mutate: () => {} };

globalThis.__opened = [];
globalThis.__toggles = [];
function App() {
  return createElement(MountTable, {
    mounts, filteredMounts: mounts,
    keyword: '', statusFilter: 'all', typeFilter: 'all',
    onKeywordChange: () => {}, onStatusFilterChange: () => {}, onTypeFilterChange: () => {},
    onOpenView: (id) => { globalThis.__opened.push(id); },
    onOpenEdit: () => {}, onRequestDelete: () => {}, onCreateClick: () => {},
    validateMutation: noop,
    selectedIds: [], headerState: 'unchecked',
    onToggleRow: (id, checked) => { globalThis.__toggles.push([id, checked]); },
    onSelectAll: () => {}, onClearVisible: () => {}, onInvertVisible: () => {},
  });
}

createRoot(document.getElementById('root')).render(createElement(App));
`;

async function mountMountTable(t: any) {
  if (!existsSync(join(HOST_ROOT, 'node_modules', 'react'))) {
    t.skip('未安装 host 依赖（pnpm install 后重跑）');
    return null;
  }
  const work = await mkdtemp(join(tmpdir(), 'fe02-mounttable-'));
  const entryFile = join(work, `entry-${Date.now()}-${process.pid}.tsx`);
  const compPath = `file://${join(HOST_ROOT, 'src/pages/manage/mounts/components/MountTable.tsx')}`;
  await writeFile(
    entryFile,
    withNmPaths(MOUNT_TABLE_ENTRY.replace('${MOUNT_TABLE_PATH}', compPath)),
    'utf8',
  );
  try {
    await (
      await import('vite')
    ).build({
      configFile: false,
      root: HOST_ROOT,
      cacheDir: join(work, '.vite'),
      logLevel: 'error',
      define: { 'process.env.NODE_ENV': '"development"' },
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
        lib: { entry: entryFile, formats: ['iife'], name: 'MountTable', fileName: () => 'probe.js' },
      },
    });
  } finally {
  }
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e: Error) => errors.push(String(e)));
  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
  await page.addScriptTag({ path: join(work, 'probe.js') });
  await page.waitForSelector('[data-row-index="0"]');
  return {
    page,
    errors,
    close: async () => {
      await browser.close();
      await rm(work, { recursive: true, force: true });
    },
  };
}

test('接线实证（真实 MountTable）：↑↓/Home/End 移动行 + Enter 开详情', async (t) => {
  const h = await mountMountTable(t);
  if (!h) return;
  try {
    const { page } = h;
    await page.focus('[data-row-index="0"] button');
    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRow(page), 1, '↓ 应到下一行');
    assert.equal(
      await page.evaluate(() => document.activeElement?.tagName),
      'TR',
      '↑↓ 后焦点应在行本身（<tr>），不能落到行首 checkbox',
    );
    await page.keyboard.press('End');
    assert.equal(await focusedRow(page), 2, 'End → 末行');
    await page.keyboard.press('Home');
    assert.equal(await focusedRow(page), 0, 'Home → 首行');

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    assert.deepEqual(
      await page.evaluate(() => (globalThis as any).__opened ?? []),
      ['m-1'],
      'Enter 应打开当前行挂载详情（onOpenView）',
    );
    // tableWrap 滚动区 a11y（第十批）：挂载点列表 tableWrap 补 role=region + aria-label（roving 表无 tabIndex）。
    const mountTw = await page.evaluate(() => {
      const el = document.querySelector('div[aria-label="来源列表（可横向滚动）"]');
      return el ? [el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('aria-label')] : null;
    });
    assert.deepEqual(mountTw, ['region', null, '来源列表（可横向滚动）'], '挂载点列表 tableWrap 应为 role=region + aria-label');

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

test('MountTable：行首 checkbox 的 Enter/Space 仍走原生选中语义（不动 tabIndex）', async (t) => {
  const h = await mountMountTable(t);
  if (!h) return;
  try {
    const { page } = h;
    // 焦点直接落在行首 checkbox 上：Space 应触发 onToggleRow（而非 onOpenView）
    // MountTable 的 Checkbox 是 @radix-ui 的 <button role="checkbox">（非原生 input）
    await page.focus('[data-row-index="0"] [role="checkbox"]');
    await page.keyboard.press('Space');
    assert.deepEqual(
      await page.evaluate(() => (globalThis as any).__toggles ?? []),
      [['m-0', true]],
      'checkbox 上 Space 必须仍是「切换选中」，不得被漫游劫持成打开详情',
    );
    assert.deepEqual(
      await page.evaluate(() => (globalThis as any).__opened ?? []),
      [],
      'checkbox 上不得触发 onOpenView',
    );
    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/* ------------------------------------------------------------------ */
/* TaskCenterList 接线实证（第二批 1/3）                             */
/* ------------------------------------------------------------------ */

const TASK_CENTER_ENTRY = `
import { createElement, useState } from '${'${NM_REACT}'}';
import { createRoot } from '${'${NM_REACT_DOM_CLIENT}'}';
import { TaskCenterList } from '${'${TASK_CENTER_PATH}'}';

// 当前页 3 行（服务端分页：漫游域 = 当前页）
const items = [0, 1, 2].map((i) => ({
  category: 'probe',
  id: 't-' + i,
  status: 'failed',
  createdAt: '2026-01-0' + (i + 1) + 'T00:00:00Z',
  updatedAt: '2026-01-0' + (i + 1) + 'T00:00:00Z',
  mediaItemId: 'item-' + i,
  mediaTitle: '条目 ' + i,
  retryCount: i,
  summary: '摘要 ' + i,
}));

globalThis.__selected = [];
function App() {
  const [, setSelectedTask] = useState(null);
  return createElement(TaskCenterList, {
    items, total: items.length, page: 1, totalPages: 1, isFetching: false,
    setSelectedTask: (v) => {
      const next = typeof v === 'function' ? v(null) : v;
      globalThis.__selected.push(next ? next.category + ':' + next.id : null);
    },
    setPage: () => {},
  });
}

createRoot(document.getElementById('root')).render(createElement(App));
`;

async function mountTaskCenter(t: any) {
  if (!existsSync(join(HOST_ROOT, 'node_modules', 'react'))) {
    t.skip('未安装 host 依赖（pnpm install 后重跑）');
    return null;
  }
  const work = await mkdtemp(join(tmpdir(), 'fe02-taskcenter-'));
  const entryFile = join(work, `entry-${Date.now()}-${process.pid}.tsx`);
  const compPath = `file://${join(HOST_ROOT, 'src/pages/manage/task-center/components/TaskCenterList.tsx')}`;
  await writeFile(
    entryFile,
    withNmPaths(TASK_CENTER_ENTRY.replace('${TASK_CENTER_PATH}', compPath)),
    'utf8',
  );
  try {
    await (
      await import('vite')
    ).build({
      configFile: false,
      root: HOST_ROOT,
      cacheDir: join(work, '.vite'),
      logLevel: 'error',
      define: { 'process.env.NODE_ENV': '"development"' },
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
        lib: { entry: entryFile, formats: ['iife'], name: 'TaskCenter', fileName: () => 'probe.js' },
      },
    });
  } finally {
  }
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e: Error) => errors.push(String(e)));
  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
  await page.addScriptTag({ path: join(work, 'probe.js') });
  await page.waitForSelector('[data-row-index="0"]');
  return {
    page,
    errors,
    close: async () => {
      await browser.close();
      await rm(work, { recursive: true, force: true });
    },
  };
}

test('接线实证（真实 TaskCenterList）：↑↓/Home/End 移动行 + Enter 开详情', async (t) => {
  const h = await mountTaskCenter(t);
  if (!h) return;
  try {
    const { page } = h;
    await page.focus('[data-row-index="0"] button');
    assert.equal(await focusedRow(page), 0);

    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRow(page), 1, '↓ 应到下一行');
    assert.equal(
      await page.evaluate(() => document.activeElement?.tagName),
      'TR',
      '↑↓ 后焦点应在行本身（<tr>）',
    );
    await page.keyboard.press('End');
    assert.equal(await focusedRow(page), 2, 'End → 末行');
    await page.keyboard.press('Home');
    assert.equal(await focusedRow(page), 0, 'Home → 首行');

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    assert.deepEqual(
      await page.evaluate(() => (globalThis as any).__selected ?? []),
      ['probe:t-1'],
      'Enter 应选中当前行任务（setSelectedTask），与行内「详情」按钮同语义',
    );
    // tableWrap 滚动区 a11y（最后一批）：任务列表 tableWrap 补 role=region + aria-label（roving 表无 tabIndex）。
    const tcTw = await page.evaluate(() => {
      const el = document.querySelector('div[aria-label="任务列表（可横向滚动）"]');
      return el ? [el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('aria-label')] : null;
    });
    assert.deepEqual(tcTw, ['region', null, '任务列表（可横向滚动）'], '任务列表 tableWrap 应为 role=region + aria-label');

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/* ------------------------------------------------------------------ */
/* ManageSessionsPage 接线实证（第二批 2/3）                         */
/* ------------------------------------------------------------------ */

const SESSIONS_ENTRY = `
import { createElement } from '${'${NM_REACT}'}';
import { createRoot } from '${'${NM_REACT_DOM_CLIENT}'}';
import { QueryClient, QueryClientProvider } from '${'${NM_RQ}'}';
import { ManageSessionsPage } from '${'${SESSIONS_PATH}'}';

const sessions = [0, 1, 2].map((i) => ({
  id: 's-' + i,
  userId: 1,
  userName: 'user' + i,
  deviceName: '设备 ' + i,
  clientName: '客户端 ' + i,
  clientHeader: null,
  ipAddress: '10.0.0.' + (i + 1),
  status: i === 0 ? 'current' : 'active',
  current: false,
  createdAt: '2026-01-0' + (i + 1) + 'T00:00:00Z',
  lastActiveAt: '2026-01-0' + (i + 1) + 'T01:00:00Z',
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
globalThis.__enters = [];
function App() {
  return createElement(QueryClientProvider, { client: qc },
    createElement(ManageSessionsPage, null));
}

// 拦截 fetch，直接返回 sessions（真实 API 形状由页面自行 map）
const realFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  const u = String(url);
  const body = u.includes('/api/manage/sessions')
    ? { items: sessions }
    : u.includes('/api/auth/me')
      ? { id: 1, username: 'admin' }
      : {};
  return new Response(JSON.stringify(body), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};

createRoot(document.getElementById('root')).render(createElement(App));
globalThis.__restoreFetch = () => { globalThis.fetch = realFetch; };
`;

async function mountSessionsPage(t: any) {
  if (!existsSync(join(HOST_ROOT, 'node_modules', 'react'))) {
    t.skip('未安装 host 依赖（pnpm install 后重跑）');
    return null;
  }
  const work = await mkdtemp(join(tmpdir(), 'fe02-sessions-'));
  const entryFile = join(work, `entry-${Date.now()}-${process.pid}.tsx`);
  const compPath = `file://${join(HOST_ROOT, 'src/pages/manage/ManageSessionsPage.tsx')}`;
  await writeFile(
    entryFile,
    withNmPaths(SESSIONS_ENTRY.replace('${SESSIONS_PATH}', compPath)),
    'utf8',
  );
  try {
    await (
      await import('vite')
    ).build({
      configFile: false,
      root: HOST_ROOT,
      cacheDir: join(work, '.vite'),
      logLevel: 'error',
      define: { 'process.env.NODE_ENV': '"development"' },
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
        lib: {
          entry: entryFile,
          formats: ['iife'],
          name: 'SessionsPage',
          fileName: () => 'probe.js',
        },
      },
    });
  } finally {
  }
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e: Error) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  // ★必须先 goto 一个真实 http(s) origin：页面级组件会走 httpClient，而它依赖
  // window.location.origin 解析相对 URL。setContent 的 about:blank 无 origin ⇒
  // 抛「Failed to construct 'URL': Invalid base URL」，页面停在「加载失败」。
  await page.route('**/*', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body><div id="root"></div></body></html>' }),
  );
  await page.goto('http://probe.local/');
  await page.addScriptTag({ path: join(work, 'probe.js') });
  try {
    await page.waitForSelector('[data-row-index="0"]', { timeout: 20000 });
  } catch {
    // 页面可能停在 loading/error 态；如实报出，便于判断是接线错还是 fixture 错
    const body = (await page.textContent('body'))?.slice(0, 300) ?? '';
    throw new Error(`SessionsPage 未渲染出行。页面文本：${body}｜pageerror：${errors.join(' | ')}`);
  }
  return {
    page,
    errors,
    close: async () => {
      await browser.close();
      await rm(work, { recursive: true, force: true });
    },
  };
}

test('接线实证（真实 ManageSessionsPage）：↑↓/Home/End 移动行（无破坏性 Enter）', async (t) => {
  const h = await mountSessionsPage(t);
  if (!h) return;
  try {
    const { page } = h;
    await page.focus('[data-row-index="0"] button');
    assert.equal(await focusedRow(page), 0);

    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRow(page), 1, '↓ 应到下一行');
    assert.equal(
      await page.evaluate(() => document.activeElement?.tagName),
      'TR',
      '↑↓ 后焦点应在行本身（<tr>）',
    );
    await page.keyboard.press('End');
    assert.equal(await focusedRow(page), 2, 'End → 末行');
    await page.keyboard.press('Home');
    assert.equal(await focusedRow(page), 0, 'Home → 首行');
    // tableWrap 滚动区 a11y（第八批）：会话列表 tableWrap 补 role=region + aria-label（roving 表无 tabIndex）。
    const sessTw = await page.evaluate(() => {
      const el = document.querySelector('div[aria-label="会话管理（可横向滚动）"]');
      return el ? [el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('aria-label')] : null;
    });
    assert.deepEqual(sessTw, ['region', null, '会话管理（可横向滚动）'], '会话列表 tableWrap 应为 role=region + aria-label');

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

test('SessionsPage 裁定：行焦点上按 Enter **不**触发移除（破坏性动作须点按钮）', async (t) => {
  const h = await mountSessionsPage(t);
  if (!h) return;
  try {
    const { page } = h;
    // 先把焦点移到行本身（第 1 行非 current，有「移除会话」按钮）
    await page.focus('[data-row-index="0"] button');
    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRow(page), 1);

    // 按 Enter：不得弹出移除确认框（不得出现 dialog）
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const dialogShown = await page.evaluate(
      () => document.querySelector('[role="dialog"]') !== null,
    );
    assert.equal(dialogShown, false, 'Enter 不得触发「移除会话」确认框（破坏性动作须点按钮）');

    // 行内「移除会话」按钮仍可 Tab 到达（可达性零回归）
    const reachable = await page.evaluate(() => {
      const btn = document.querySelector('[data-row-index="1"] button');
      return btn !== null && btn.getAttribute('tabindex') !== '-1';
    });
    assert.equal(reachable, true, '行内「移除会话」按钮不得被设 tabindex=-1');
    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/* ------------------------------------------------------------------ */
/* ManageAuditLogsPage 接线实证（第二批 3/3）                        */
/* ------------------------------------------------------------------ */

const AUDIT_LOGS_ENTRY = `
import { createElement } from '${'${NM_REACT}'}';
import { createRoot } from '${'${NM_REACT_DOM_CLIENT}'}';
import { QueryClient, QueryClientProvider } from '${'${NM_RQ}'}';
import { ManageAuditLogsPage } from '${'${AUDIT_LOGS_PATH}'}';

// fixture 必须是**后端原始 snake_case**（shared/src/contracts/manage/raw-types.ts:188
// RawAuditLogRecord）—— httpClient 直接把 JSON 交给 mapAuditLogRecord，喂 camelCase
// 会让字段全 undefined、页面渲染不出行。
const items = [0, 1, 2].map((i) => ({
  id: 'a-' + i,
  user_id: 'u-' + i,
  username: 'user' + i,
  display_name: '操作者 ' + i,
  action: 'action.' + i,
  summary: '摘要 ' + i,
  target_type: 'item',
  target_id: 'item-' + i,
  detail_json: null,
  ip_address: '10.0.0.' + (i + 1),
  created_at: '2026-01-0' + (i + 1) + 'T00:00:00Z',
}));

globalThis.fetch = async (url) => {
  const u = String(url);
  const body = u.includes('/api/manage/audit-logs') ? { items } : {};
  return new Response(JSON.stringify(body), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')).render(
  createElement(QueryClientProvider, { client: qc }, createElement(ManageAuditLogsPage, null)),
);
`;

/** 页面级组件通用挂载：需真实 http origin（httpClient 依赖 location.origin）。 */
async function mountPageProbe(
  t: any,
  tmpPrefix: string,
  entrySrc: string,
  compFile: string,
  /**
   * 可选的「渲染完成」等待选择器。默认等 `[data-row-index="0"]`（行已就绪的表）。
   * 有些页面（如 MicrosoftOAuthSection）的表要先走完 mutation 流程才有行，
   * 初始 DOM 里一个 data-row-index 都没有，必须换成一个立即可见的标志。
   */
  readySelector = '[data-row-index="0"]',
) {
  if (!existsSync(join(HOST_ROOT, 'node_modules', 'react'))) {
    t.skip('未安装 host 依赖（pnpm install 后重跑）');
    return null;
  }
  const work = await mkdtemp(join(tmpdir(), tmpPrefix));
  const entryFile = join(work, `entry-${Date.now()}-${process.pid}.tsx`);
  await writeFile(
    entryFile,
    // 通用替换：entry 模板里的组件路径占位符（各探针用不同名字）
    withNmPaths(
      entrySrc
        .replace('${AUDIT_LOGS_PATH}', `file://${compFile}`)
        .replace('${SECRETS_PATH}', `file://${compFile}`)
        .replace('${MEDIA_ITEM_PATH}', `file://${compFile}`)
        .replace('${REG_CODE_PATH}', `file://${compFile}`)
        .replace('${PRESETS_PATH}', `file://${compFile}`)
        .replace('${YUN139_PATH}', `file://${compFile}`)
        .replace('${LEDGER_PATH}', `file://${compFile}`)
        .replace('${MS_ACCOUNTS_PATH}', `file://${compFile}`)
        .replace('${MS_OAUTH_PATH}', `file://${compFile}`)
        .replace('${RUNTIME_ARCHIVES_PATH}', `file://${compFile}`)
        .replace('${NESTED_PATH}', `file://${compFile}`)
        .replace('${SYNC_JOBS_PATH}', `file://${compFile}`)
        // 补测批次 A 起的通用占位符：不再为每个新探针加一行 replace。
        // 新探针统一写 file:///COMPONENT_PATH_PLACEHOLDER。
        .replace('file:///COMPONENT_PATH_PLACEHOLDER', `file://${compFile}`)
        .replace('file:///AI_PATH_PLACEHOLDER', compFile.replace('file://', ''))
        // 需要真实 mutations hook 的段落（MediaItemArtworkSection 等）用这个占位符。
        .replace(
          'file:///MUTATIONS_PATH_PLACEHOLDER',
          `file://${join(HOST_ROOT, 'src/pages/manage/media-items/hooks/useMediaItemMutations.ts')}`,
        )
    ),
    'utf8',
  );
  try {
    await (
      await import('vite')
    ).build({
      configFile: false,
      root: HOST_ROOT,
      cacheDir: join(work, '.vite'),
      logLevel: 'error',
      define: { 'process.env.NODE_ENV': '"development"' },
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
        lib: { entry: entryFile, formats: ['iife'], name: 'AuditLogs', fileName: () => 'probe.js' },
      },
    });
  } finally {
  }
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e: Error) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text());
  });
  // ★必须 goto 真实 origin：页面级组件走 httpClient，依赖 window.location.origin。
  // setContent 的 about:blank 无 origin ⇒ 页面停在「加载失败」。
  await page.route('**/*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><body><div id="root"></div></body></html>',
    }),
  );
  await page.goto('http://probe.local/');
  await page.addScriptTag({ path: join(work, 'probe.js') });
  try {
    await page.waitForSelector(readySelector, { timeout: 20000 });
  } catch {
    const body = (await page.textContent('body'))?.slice(0, 300) ?? '';
    throw new Error(
      `未渲染出「${readySelector}」。页面文本：${body}｜pageerror：${errors.join(' | ')}`,
    );
  }
  return {
    page,
    errors,
    close: async () => {
      await browser.close();
      await rm(work, { recursive: true, force: true });
    },
  };
}

test('接线实证（真实 ManageAuditLogsPage）：↑↓/Home/End 移动行（只读表不给 Enter）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-auditlogs-',
    AUDIT_LOGS_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/ManageAuditLogsPage.tsx'),
  );
  if (!h) return;
  try {
    const { page } = h;
    // ★只读表行内**没有任何可聚焦控件**（无详情/编辑/删除按钮）。能起步完全
    // 依赖 hook 留下的 roving Tab 停靠点（I-1）。
    // 这里从**真实按键** Tab 起步，不脚本 focus、不手动设 tabindex ——
    // 否则会掩盖 hook 的 bug。
    assert.deepEqual(
      await rovingStops(page),
      ['0'],
      'hook 必须在挂载时把首行留成唯一 tabindex=0 停靠点（否则 Tab 进不去、漫游是死路）',
    );
    assert.equal(await tabIntoRow(page), 0, '连按 Tab 应能走到活动行（真实键盘入口）');

    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRow(page), 1, '↓ 应到下一行');
    assert.equal(
      await page.evaluate(() => document.activeElement?.tagName),
      'TR',
      '↑↓ 后焦点应在行本身（<tr>）',
    );
    await page.keyboard.press('End');
    assert.equal(await focusedRow(page), 2, 'End → 末行');
    await page.keyboard.press('Home');
    assert.equal(await focusedRow(page), 0, 'Home → 首行');
    // tableWrap 滚动区 a11y（第八批）：审计日志 tableWrap 补 role=region + aria-label（roving 表无 tabIndex）。
    const auditTw = await page.evaluate(() => {
      const el = document.querySelector('div[aria-label="操作记录（可横向滚动）"]');
      return el ? [el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('aria-label')] : null;
    });
    assert.deepEqual(auditTw, ['region', null, '操作记录（可横向滚动）'], '审计日志 tableWrap 应为 role=region + aria-label');

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

test('只读表裁定：ManageAuditLogsPage 行上按 Enter 不产生任何副作用', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-auditlogs2-',
    AUDIT_LOGS_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/ManageAuditLogsPage.tsx'),
  );
  if (!h) return;
  try {
    const { page } = h;
    await page.focus('[data-row-index="0"]');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    // 未接 onActivate ⇒ 行 tabindex 应为 -1（可聚焦但不在 Tab 序），Enter 不应打开任何东西
    assert.equal(await focusedRow(page), 1, 'Enter 后焦点应仍在行上');
    const dialogShown = await page.evaluate(
      () => document.querySelector('[role="dialog"]') !== null,
    );
    assert.equal(dialogShown, false, '只读表不得因 Enter 弹出对话框');
    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/* ------------------------------------------------------------------ */
/* ManageSecretsPage 接线实证（第三批 1/3）                          */
/* ------------------------------------------------------------------ */

const SECRETS_ENTRY = `
import { createElement } from '${'${NM_REACT}'}';
import { createRoot } from '${'${NM_REACT_DOM_CLIENT}'}';
import { QueryClient, QueryClientProvider } from '${'${NM_RQ}'}';
import { ManageSecretsPage } from '${'${SECRETS_PATH}'}';

// 形状对齐 shared/src/contracts/manage/peripherals/api.ts:380 fromSecretEntry
// （key / source / configured 原样透传；外层再带 overrides_file、microsoft_editions）
globalThis.fetch = async () =>
  new Response(
    JSON.stringify({
      entries: [
        { key: 'JWT_SECRET', source: 'env', configured: true },
        { key: 'DB_PASSWORD', source: 'secrets_file', configured: true },
        { key: 'SMTP_PASS', source: 'unset', configured: false },
      ],
      overrides_file: '/run/secrets.env',
      microsoft_editions: ['consumer', 'business'],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')).render(
  createElement(QueryClientProvider, { client: qc }, createElement(ManageSecretsPage, null)),
);
`;

test('接线实证（真实 ManageSecretsPage）：只读表 ↑↓/Home/End 漫游（第三批 1/3）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-secrets-',
    SECRETS_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/ManageSecretsPage.tsx'),
  );
  if (!h) return;
  try {
    const { page } = h;
    // 依赖 hook 留下的 roving 停靠点（I-1）；真实 Tab 起步而非脚本聚焦。
    assert.deepEqual(
      await rovingStops(page),
      ['0'],
      'hook 必须在挂载时把首行留成唯一 tabindex=0 停靠点，否则漫游无从起步',
    );
    assert.equal(await tabIntoRow(page), 0, '连按 Tab 应能走到活动行（真实键盘入口）');

    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRow(page), 1, '↓ 应到下一行');
    assert.equal(
      await page.evaluate(() => document.activeElement?.tagName),
      'TR',
      '↑↓ 后焦点应在行本身（<tr>）',
    );
    await page.keyboard.press('End');
    assert.equal(await focusedRow(page), 2, 'End → 末行');
    await page.keyboard.press('Home');
    assert.equal(await focusedRow(page), 0, 'Home → 首行');
    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

test('ManageSecretsPage 裁定：只读来源表按 Enter 无副作用（不伪造语义）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-secrets2-',
    SECRETS_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/ManageSecretsPage.tsx'),
  );
  if (!h) return;
  try {
    const { page } = h;
    await page.focus('[data-row-index="0"]');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    assert.equal(await focusedRow(page), 1, 'Enter 后焦点应仍在行上');
    assert.equal(
      await page.evaluate(() => document.querySelector('[role="dialog"]') !== null),
      false,
      '只读来源表不得因 Enter 弹出对话框',
    );
    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/* ------------------------------------------------------------------ */
/* MediaItemListTable 接线实证（第三批 2/3）                        */
/* ------------------------------------------------------------------ */

const MEDIA_ITEM_ENTRY = `
import { createElement } from '${'${NM_REACT}'}';
import { createRoot } from '${'${NM_REACT_DOM_CLIENT}'}';
import { MemoryRouter, Routes, Route, useLocation } from '${'${NM_REACT_ROUTER}'}';
import { MediaItemListTable } from '${'${MEDIA_ITEM_PATH}'}';

const mk = (i) => ({
  id: 'mi-' + i,
  title: '条目 ' + i,
  originalTitle: null,
  typeLabel: 'movie',
  year: 2020 + i,
  posterUrl: null,
  ownership: 'library',
  libraryName: '库',
  libraryId: 'lib-1',
  mountName: '挂载',
  sourceId: 'src-' + i,
  sourceCount: 1,
  metadataStatus: 'ok',
  sourceStatus: 'ok',
  sizeBytes: null,
  updatedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
});

const items = [0, 1, 2].map(mk);
const noop = () => {};

// ★location 记录器必须放在 **Router 外层的兄弟节点**：导航后 /manage/media-items
// 路由失配 ⇒ 表格所在子树整体卸载，若把 useLocation 放在该子树内，它随之卸载、
// 再也不上报 location，断言就会「路径没变」的假象。
globalThis.__path = null;
function LocationProbe() {
  const loc = useLocation();
  globalThis.__path = loc.pathname;
  return null;
}
function Probe() {
  return createElement(MediaItemListTable, {
    items,
    pendingSourceDelete: null,
    resolveDeletePending: false,
    deletePending: false,
    onRequestDelete: noop,
    selectedIds: [], headerState: 'unchecked',
    onToggleRow: noop, onSelectAll: noop, onClearVisible: noop,
  });
}
function App() {
  return createElement(MemoryRouter, { initialEntries: ['/manage/media-items'] },
    createElement(LocationProbe, null),
    createElement(Routes, null,
      createElement(Route, { path: '/manage/media-items', element: createElement(Probe) }),
      createElement(Route, { path: '/manage/media/items/:id', element: createElement('div', null, 'detail') }),
    ),
  );
}
createRoot(document.getElementById('root')).render(createElement(App));
`;

test('接线实证（真实 MediaItemListTable）：↑↓/Home/End 移动行 + Enter 打开详情（第三批 2/3）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-mediaitems-',
    MEDIA_ITEM_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/media-items/components/MediaItemListTable.tsx'),
  );
  if (!h) return;
  try {
    const { page } = h;
    await page.focus('[data-row-index="0"] button');
    assert.equal(await focusedRow(page), 0);

    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRow(page), 1, '↓ 应到下一行');
    assert.equal(
      await page.evaluate(() => document.activeElement?.tagName),
      'TR',
      '↑↓ 后焦点应在行本身（<tr>），不能落到行首 checkbox',
    );
    await page.keyboard.press('End');
    assert.equal(await focusedRow(page), 2, 'End → 末行');
    await page.keyboard.press('Home');
    assert.equal(await focusedRow(page), 0, 'Home → 首行');

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    assert.equal(
      await page.evaluate(() => (globalThis as any).__path),
      '/manage/media/items/mi-1',
      'Enter 应走该行既有的「查看详情」Link（与点击按钮同语义）',
    );
    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

test('MediaItemListTable：行首 checkbox 的 Space 仍是切换选中（非打开详情）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-mediaitems2-',
    MEDIA_ITEM_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/media-items/components/MediaItemListTable.tsx'),
  );
  if (!h) return;
  try {
    const { page } = h;
    // Radix Checkbox ⇒ <button role="checkbox">，不是原生 input
    await page.focus('[data-row-index="0"] [role="checkbox"]');
    const before = await page.evaluate(() => (globalThis as any).__path);
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    assert.equal(
      await page.evaluate(() => (globalThis as any).__path),
      before,
      'checkbox 上 Space 不得被劫持成「打开详情」',
    );
    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/* ------------------------------------------------------------------ */
/* RegistrationCodeDetailTable 接线实证（第三批 3/3）                */
/* ------------------------------------------------------------------ */

const REG_CODE_ENTRY = `
import { createElement } from '${'${NM_REACT}'}';
import { createRoot } from '${'${NM_REACT_DOM_CLIENT}'}';
import { RegistrationCodeDetailTable } from '${'${REG_CODE_PATH}'}';

const mk = (i) => ({
  id: 'rc-' + i,
  code: 'CODE-' + i,
  status: i === 0 ? 'unused' : 'used',
  createdAt: '2026-01-0' + (i + 1) + 'T00:00:00Z',
  expiresAt: null,
  usedAt: null,
  usedByUserId: null,
  sessionLimit: 1,
  sessionUsed: 0,
  defaultLibraries: ['lib-1'],
});

const records = [0, 1, 2].map(mk);
globalThis.__statusActions = [];
globalThis.__deletes = [];
function App() {
  return createElement(RegistrationCodeDetailTable, {
    records,
    libraryNameMap: new Map([['lib-1', '主库']]),
    onStatusAction: (r) => { globalThis.__statusActions.push(r.id); },
    onDelete: (r) => { globalThis.__deletes.push(r.id); },
  });
}
createRoot(document.getElementById('root')).render(createElement(App));
`;

test('接线实证（真实 RegistrationCodeDetailTable）：↑↓/Home/End 漫游（第三批 3/3）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-regcode-',
    REG_CODE_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/registration-codes/components/RegistrationCodeDetailTable.tsx'),
  );
  if (!h) return;
  try {
    const { page } = h;
    assert.deepEqual(
      await rovingStops(page),
      ['0'],
      'hook 必须在挂载时把首行留成唯一 tabindex=0 停靠点',
    );
    assert.equal(await tabIntoRow(page), 0, '连按 Tab 应能走到活动行（真实键盘入口）');

    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRow(page), 1, '↓ 应到下一行');
    assert.equal(
      await page.evaluate(() => document.activeElement?.tagName),
      'TR',
      '↑↓ 后焦点应在行本身（<tr>）',
    );
    await page.keyboard.press('End');
    assert.equal(await focusedRow(page), 2, 'End → 末行');
    await page.keyboard.press('Home');
    assert.equal(await focusedRow(page), 0, 'Home → 首行');
    // tableWrap 滚动区 a11y（最后一批）：注册码详情 tableWrap 补 role=region + aria-label（roving 表无 tabIndex）。
    const rcTw = await page.evaluate(() => {
      const el = document.querySelector('div[aria-label="注册码详情（可横向滚动）"]');
      return el ? [el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('aria-label')] : null;
    });
    assert.deepEqual(rcTw, ['region', null, '注册码详情（可横向滚动）'], '注册码详情 tableWrap 应为 role=region + aria-label');

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

test('RegistrationCodeDetailTable 裁定：行上按 Enter 不触发启用/停用也不删除（写操作留给按钮）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-regcode2-',
    REG_CODE_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/registration-codes/components/RegistrationCodeDetailTable.tsx'),
  );
  if (!h) return;
  try {
    const { page } = h;
    await page.focus('[data-row-index="0"]');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    assert.deepEqual(
      await page.evaluate(() => (globalThis as any).__statusActions ?? []),
      [],
      'Enter 不得触发启用/停用（改服务端状态的写操作须点行内按钮）',
    );
    assert.deepEqual(
      await page.evaluate(() => (globalThis as any).__deletes ?? []),
      [],
      'Enter 不得触发删除（破坏性动作须点行内按钮）',
    );
    // 行内按钮仍可 Tab 到达（可达性零回归）
    const reachable = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll('[data-row-index] button')).every(
          (b) => b.getAttribute('tabindex') !== '-1',
        ),
    );
    assert.equal(reachable, true, '行内按钮不得被设 tabindex=-1');
    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/* ------------------------------------------------------------------ */
/* UpstreamMappingPresetsSection 接线实证（第四批 1/3）              */
/* ------------------------------------------------------------------ */

const PRESETS_ENTRY = `
import { createElement } from '${'${NM_REACT}'}';
import { createRoot } from '${'${NM_REACT_DOM_CLIENT}'}';
import { QueryClient, QueryClientProvider } from '${'${NM_RQ}'}';
import { UpstreamMappingPresetsSection } from '${'${PRESETS_PATH}'}';

// 形状对齐 shared/src/contracts/manage/upstreams 的预设记录
const presets = [0, 1, 2].map((i) => ({
  id: 'p-' + i,
  sourceId: 'src-1',
  name: '预设 ' + i,
  enabled: true,
  updatedAt: '2026-01-0' + (i + 1) + 'T00:00:00Z',
  libraryType: 'movie',
  titleKeywords: ['k' + i],
  categoryIds: ['c' + i],
}));

globalThis.fetch = async () =>
  new Response(JSON.stringify({ items: presets }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')).render(
  createElement(QueryClientProvider, { client: qc },
    createElement(UpstreamMappingPresetsSection, { sourceId: 'src-1' })),
);
`;

test('接线实证（UpstreamMappingPresetsSection）：↑↓/Home/End 移动行 + Enter 编辑（第四批 1/3）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-presets-',
    PRESETS_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/upstreams/UpstreamMappingPresetsSection.tsx'),
  );
  if (!h) return;
  try {
    const { page } = h;
    await page.focus('[data-row-index="0"] button');
    assert.equal(await focusedRow(page), 0);

    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRow(page), 1, '↓ 应到下一行');
    assert.equal(
      await page.evaluate(() => document.activeElement?.tagName),
      'TR',
      '↑↓ 后焦点应在行本身（<tr>）',
    );
    await page.keyboard.press('End');
    assert.equal(await focusedRow(page), 2, 'End → 末行');
    await page.keyboard.press('Home');
    assert.equal(await focusedRow(page), 0, 'Home → 首行');

    // Enter → 点击行内「编辑」⇒ 弹出编辑对话框（标题含该预设名）
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    const dialogText = await page.evaluate(
      () => (document.querySelector('[role="dialog"]') as HTMLElement)?.textContent ?? '',
    );
    assert.match(dialogText, /预设 1/, 'Enter 应打开该行的「编辑」对话框（与点按钮同语义）');
    // tableWrap 滚动区 a11y（第十二批）：映射预设表 tableWrap 补 role=region + aria-label（roving 表无 tabIndex）。
    const presetTw = await page.evaluate(() => {
      const el = document.querySelector('div[aria-label="映射预设（可横向滚动）"]');
      return el ? [el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('aria-label')] : null;
    });
    assert.deepEqual(presetTw, ['region', null, '映射预设（可横向滚动）'], '映射预设表 tableWrap 应为 role=region + aria-label');

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

test('UpstreamMappingPresetsSection：行上 Enter 不触发删除确认框（破坏性动作须点按钮）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-presets2-',
    PRESETS_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/upstreams/UpstreamMappingPresetsSection.tsx'),
  );
  if (!h) return;
  try {
    const { page } = h;
    await page.focus('[data-row-index="0"] button');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    // 编辑对话框是「编辑预设」，删除确认是「删除预设」；断言标题不是删除
    const titles = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[role="dialog"]')).map(
        (d) => (d as HTMLElement).textContent ?? '',
      ),
    );
    assert.equal(
      titles.filter((s) => s.includes('删除')).length,
      0,
      'Enter 不得触发删除确认（破坏性动作须点行内「删除」按钮）',
    );
    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/* ------------------------------------------------------------------ */
/* Yun139ProfilesSection 接线实证（第四批 2/3）                     */
/* ------------------------------------------------------------------ */

const YUN139_ENTRY = `
import { createElement } from '${'${NM_REACT}'}';
import { createRoot } from '${'${NM_REACT_DOM_CLIENT}'}';
import { QueryClient, QueryClientProvider } from '${'${NM_RQ}'}';
import { Yun139ProfilesSection } from '${'${YUN139_PATH}'}';

// ★fixture 必须是**后端原始 snake_case**，且包在 { items: [...] } 里
// （shared/src/contracts/manage/yun139/api.ts:133 读 raw.items；
//   同文件 :81 fromProfile 逐字段读 snake_case）。
// 曾因喂裸数组 + camelCase 导致列表为空、页面渲染不出行。
// ★注意：本段注释位于模板字符串内部，不能出现反引号。
const profiles = [0, 1, 2].map((i) => ({
  id: 'y-' + i,
  display_name: '档案 ' + i,
  account_identity_mask: '138****' + i,
  status: 'active',
  can_refresh: true,
  authorization_expires_at: '2099-01-01T00:00:00Z',
  last_success_at: '2026-01-0' + (i + 1) + 'T00:00:00Z',
  last_error_at: null,
  last_error_kind: null,
  last_error_message: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}));

globalThis.fetch = async () =>
  new Response(JSON.stringify({ items: profiles }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')).render(
  createElement(QueryClientProvider, { client: qc }, createElement(Yun139ProfilesSection, null)),
);
`;

test('接线实证（Yun139ProfilesSection）：↑↓/Home/End 漫游（第四批 2/3）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-yun139-',
    YUN139_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/yun139/Yun139ProfilesSection.tsx'),
  );
  if (!h) return;
  try {
    const { page } = h;
    assert.deepEqual(
      await rovingStops(page),
      ['0'],
      'hook 必须在挂载时把首行留成唯一 tabindex=0 停靠点',
    );
    assert.equal(await tabIntoRow(page), 0, '连按 Tab 应能走到活动行（真实键盘入口）');

    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRow(page), 1, '↓ 应到下一行');
    assert.equal(
      await page.evaluate(() => document.activeElement?.tagName),
      'TR',
      '↑↓ 后焦点应在行本身（<tr>）',
    );
    await page.keyboard.press('End');
    assert.equal(await focusedRow(page), 2, 'End → 末行');
    await page.keyboard.press('Home');
    assert.equal(await focusedRow(page), 0, 'Home → 首行');
    // tableWrap 滚动区 a11y（最后一批）：云 139 配置 tableWrap 补 role=region + aria-label（roving 表无 tabIndex）。
    const yunTw = await page.evaluate(() => {
      const el = document.querySelector('div[aria-label="凭据档案（可横向滚动）"]');
      return el ? [el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('aria-label')] : null;
    });
    assert.deepEqual(yunTw, ['region', null, '凭据档案（可横向滚动）'], '云 139 配置 tableWrap 应为 role=region + aria-label');

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

test('Yun139ProfilesSection 裁定：行上 Enter 不触发删除确认（行内唯一动作是删除）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-yun1392-',
    YUN139_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/yun139/Yun139ProfilesSection.tsx'),
  );
  if (!h) return;
  try {
    const { page } = h;
    await page.focus('[data-row-index="0"]');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    assert.equal(
      await page.evaluate(() => document.querySelector('[role="dialog"]') !== null),
      false,
      'Enter 不得触发删除确认框（破坏性动作须点行内「删除」按钮）',
    );
    // 行内「删除」按钮仍可 Tab 到达
    const reachable = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll('[data-row-index] button')).every(
          (b) => b.getAttribute('tabindex') !== '-1',
        ),
    );
    assert.equal(reachable, true, '行内删除按钮不得被设 tabindex=-1');
    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/* ------------------------------------------------------------------ */
/* RewardsLedgerSection 接线实证（第四批 3/3）                        */
/* ------------------------------------------------------------------ */

const LEDGER_ENTRY = `
import { createElement } from '${'${NM_REACT}'}';
import { createRoot } from '${'${NM_REACT_DOM_CLIENT}'}';
import { RewardsLedgerSection } from '${'${LEDGER_PATH}'}';

const ledger = [0, 1, 2].map((i) => ({
  id: 'r-' + i,
  createdAt: 1767225600000 + i * 1000,
  transactionType: 'earn',
  sourceType: 'invite',
  sourceId: 'src-' + i,
  delta: 10 + i,
  balanceAfter: 100 + i,
}));

createRoot(document.getElementById('root')).render(
  createElement(RewardsLedgerSection, {
    ledger, ledgerLimit: 50, onLedgerLimitChange: () => {}, isPending: false,
  }),
);
`;

test('接线实证（RewardsLedgerSection）：只读账本表 ↑↓/Home/End 漫游（第四批 3/3）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-ledger-',
    LEDGER_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/rewards/RewardsLedgerSection.tsx'),
  );
  if (!h) return;
  try {
    const { page } = h;
    // 只读账本表：行内零可聚焦控件 ⇒ 靠 roving 停靠点起步，真实 Tab 而非脚本聚焦。
    assert.deepEqual(
      await rovingStops(page),
      ['0'],
      '只读表也得在挂载时把首行留成唯一 tabindex=0 停靠点（否则 Tab 进不去、漫游是死路）',
    );
    assert.equal(await tabIntoRow(page), 0, '连按 Tab 应能走到活动行（真实键盘入口）');
    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRow(page), 1, '↓ 应到下一行');
    await page.keyboard.press('End');
    assert.equal(await focusedRow(page), 2, 'End → 末行');
    await page.keyboard.press('Home');
    assert.equal(await focusedRow(page), 0, 'Home → 首行');
    // tableWrap 滚动区 a11y（最后一批）：奖励账本表 tableWrap 补 role=region + aria-label（roving 表无 tabIndex）。
    const ledgerTw = await page.evaluate(() => {
      const el = document.querySelector('div[aria-label="积分流水（可横向滚动）"]');
      return el ? [el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('aria-label')] : null;
    });
    assert.deepEqual(ledgerTw, ['region', null, '积分流水（可横向滚动）'], '奖励账本表 tableWrap 应为 role=region + aria-label');

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

test('RewardsLedgerSection 裁定：只读账本行上 Enter 无副作用（无动作可绑定）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-ledger2-',
    LEDGER_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/rewards/RewardsLedgerSection.tsx'),
  );
  if (!h) return;
  try {
    const { page } = h;
    await page.focus('[data-row-index="0"]');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    assert.equal(
      await page.evaluate(() => document.querySelector('[role="dialog"]') !== null),
      false,
      'Enter 不得凭空造出语义（无动作可绑定）',
    );
    assert.equal(await focusedRow(page), 1, 'Enter 不得把焦点挪走');
    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/* ------------------------------------------------------------------ */
/* MicrosoftAccountsSection 接线实证（第五批 1/3）                    */
/* ------------------------------------------------------------------ */

const MS_ACCOUNTS_ENTRY = `
import { createElement } from '${'${NM_REACT}'}';
import { createRoot } from '${'${NM_REACT_DOM_CLIENT}'}';
import { MicrosoftAccountsSection } from '${'${MS_ACCOUNTS_PATH}'}';

const configItems = [0, 1, 2].map((i) => ({
  providerType: 'graph-' + i,
  clientIdConfigured: true,
  clientSecretConfigured: i !== 0,
  redirectUri: 'https://example.com/cb/' + i,
  clientIdSource: 'manual',
  tokenKeyStatus: 'ready',
}));

const profiles = [0, 1, 2].map((i) => ({
  id: 'acct-' + i,
  userPrincipalName: 'user' + i + '@example.com',
  principalId: 'p-' + i,
  providerType: 'graph',
  serviceKind: 'drive',
  status: 'active',
  displayName: '账号 ' + i,
  note: null,
}));

createRoot(document.getElementById('root')).render(
  createElement(MicrosoftAccountsSection, { configItems, profiles }),
);
`;

/** 一张表（tbody）内的当前焦点行索引；不在该表内则返回 null。 */
/**
 * 真实键盘入口：从 body 起连按 Tab，直到焦点落进第 `tableIndex` 个 tbody 的行上。
 *
 * 为什么不能一步到位：真实页面上表格前面还有筛选按钮 / 搜索框，
 * 用户必须连按若干次 Tab 才能走到表格 —— 这正是要验证的真实路径。
 * 返回命中的 `data-row-index`（超预算未命中返回 -1）。
 */
/** 逐次记录真实 Tab 路径上每个停靠点的可读描述（用于断言实测步数，不放宽口径）。 */
async function tabPathToRow(page: any, tableIndex = 0, maxPresses = 15) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.locator('body').click({ position: { x: 2, y: 2 } });
  const path: Array<{ presses: number; inRow: boolean; tag: string; text: string }> = [];
  for (let i = 1; i <= maxPresses; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate((ti: number) => {
      const tbody = document.querySelectorAll('tbody')[ti];
      const a = document.activeElement as HTMLElement | null;
      if (!a) return null;
      return {
        inRow: a.closest('tbody') === tbody && a.hasAttribute('data-row-index'),
        tag: a.tagName,
        text: (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 24),
      };
    }, tableIndex);
    if (!stop) continue;
    path.push({ presses: i, ...stop });
    if (stop.inRow) return path;
  }
  return path;
}

async function tabIntoRow(page: any, tableIndex = 0, maxPresses = 15): Promise<number> {
  // ⚠ 光 blur() 不够：Chrome 的**顺序焦点导航**会从上一个焦点元素继续往下走，
  // 于是「从 body 起步」实际是从上次停的地方起步（嵌套表里表现为永远走不到
  // 在 DOM 上位于子表之前的父表停靠点）。必须点一下不可聚焦区域重置起点。
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.locator('body').click({ position: { x: 2, y: 2 } });
  for (let i = 0; i < maxPresses; i++) {
    await page.keyboard.press('Tab');
    const hit = await page.evaluate((ti: number) => {
      const tbody = document.querySelectorAll('tbody')[ti];
      const active = document.activeElement as HTMLElement | null;
      // 按「最近 tbody 归属」判定：焦点若在子表行上，父表不算命中
      if (!active || active.closest('tbody') !== tbody) return null;
      const row = active.getAttribute('data-row-index');
      return row == null ? null : Number(row);
    }, tableIndex);
    if (hit != null) return hit;
  }
  return -1;
}

/**
 * 与 tabIntoRow 相同，但返回**实际按下的 Tab 次数**（超预算返回 -1）。
 *
 * 为什么单独要这个：补测要求「按实际 Tab 步数断言」，
 * 而不是硬编码一个猜测的步数。步数是真实可达性的直接证据：
 * 如果改成 0，说明该表在真实 Tab 顺序里根本走不到（回退到旧版时正是这个现象）。
 */
async function countTabPressesToRow(
  page: any,
  tableIndex = 0,
  maxPresses = 15,
): Promise<number> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.locator('body').click({ position: { x: 2, y: 2 } });
  for (let i = 1; i <= maxPresses; i++) {
    await page.keyboard.press('Tab');
    const hit = await page.evaluate((ti: number) => {
      const tbody = document.querySelectorAll('tbody')[ti];
      const active = document.activeElement as HTMLElement | null;
      if (!active || active.closest('tbody') !== tbody) return null;
      const row = active.getAttribute('data-row-index');
      return row == null ? null : Number(row);
    }, tableIndex);
    if (hit != null) return i;
  }
  return -1;
}

/** 整页所有 tbody 的 roving Tab 停靠点（用于单表表格）。 */
function rovingStops(page: any): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('tbody tr'))
      .filter((r) => r.getAttribute('tabindex') === '0')
      .map((r) => r.getAttribute('data-row-index')),
  );
}

/** 某个 tbody 索引内的 roving Tab 停靠点（tabindex=0 的行索引列表）。 */
async function rovingStopsIn(page: any, tableIndex: number): Promise<string[]> {
  return page.evaluate((ti: number) => {
    const tbody = document.querySelectorAll('tbody')[ti];
    if (!tbody) return [];
    // ⚠ 按「最近 tbody 归属」过滤：嵌套表里子行也是父 tbody 的 DOM 后代，
    // 直接 tbody.querySelectorAll 会把子表的停靠点算进父表（父子串台）。
    return Array.from(document.querySelectorAll('tr[data-row-index]'))
      .filter((r) => r.closest('tbody') === tbody && r.getAttribute('tabindex') === '0')
      .map((r) => r.getAttribute('data-row-index'));
  }, tableIndex);
}

async function focusedRowIn(page: any, tableIndex: number) {
  return page.evaluate((ti: number) => {
    const tbody = document.querySelectorAll('tbody')[ti];
    const active = document.activeElement as HTMLElement | null;
    if (!active || active.closest('tbody') !== tbody) return null;
    const idx = active.getAttribute('data-row-index');
    return idx == null ? null : Number(idx);
  }, tableIndex);
}

test('接线实证（MicrosoftAccountsSection）：两张只读表各自独立漫游（第五批 1/3）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-msacct-',
    MS_ACCOUNTS_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/microsoft/MicrosoftAccountsSection.tsx'),
  );
  if (!h) return;
  try {
    const { page } = h;
    assert.equal(
      await page.evaluate(() => document.querySelectorAll('tbody').length),
      2,
      '两张表应有各自 tbody（索引域独立）',
    );
    // 真实 Tab 起步（I-1）：两张只读表的行都是零控件的纯文本行，
    // 键盘入口全靠 roving 停靠点，不靠脚本聚焦。
    assert.deepEqual(await rovingStopsIn(page, 0), ['0'], '表1 首行应是唯一 Tab 停靠点');
    assert.equal(await tabIntoRow(page, 0), 0, '连按 Tab 应能走到表1 的活动行（真实键盘入口）');
    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRowIn(page, 0), 1, '表1 ↓ 应到第 2 行');
    assert.deepEqual(await rovingStopsIn(page, 0), ['1'], '表1 停靠点须跟着焦点走');
    // 从表1 的活动行**按一次 Tab** 自然走到表2，而不是回表1 头行。
    // 这里不能用 tabIntoRow —— 它会先 blur 再从 body 重 Tab，那是另一条路径
    // （证明的是「表2 单独可达」，不是「两张表之间 Tab 顺序正确」）。
    // 两表行内零控件、外层 .tableWrap 无 tabIndex ⇒ DOM 顺序上表1 停靠点之后
    // 紧接的就是表2 停靠点，故只需一次 Tab。
    await page.keyboard.press('Tab');
    assert.equal(
      await focusedRowIn(page, 1),
      0,
      '从表1 活动行按一次 Tab 应进入表2 的活动行（跨表 Tab 顺序）',
    );
    assert.equal(
      await focusedRowIn(page, 0),
      null,
      '焦点须已离开表1，不得回表1 头行',
    );
    // 第二张表索引域必须从 0 起算，不能被表1的焦点带着跑
    await page.keyboard.press('End');
    assert.equal(await focusedRowIn(page, 1), 2, '表2 End → 末行');
    assert.deepEqual(await rovingStopsIn(page, 1), ['2'], '表2 停靠点须跟着焦点走');
    // Shift+Tab 应能原路返回表1 的**活动停靠点**（此时在第 2 行，不是首行）。
    // 硬编码 0 会把「roving 记住了活动行」误判为失败。
    await page.keyboard.press('Shift+Tab');
    assert.equal(
      await focusedRowIn(page, 0),
      1,
      'Shift+Tab 应回到表1 的活动停靠行（第 2 行），而非首行',
    );
    assert.equal(
      await focusedRowIn(page, 1),
      null,
      '焦点须已离开表2',
    );

    // tableWrap 滚动区 a11y（第六批）：应用凭据配置状态表 + 已授权账号表 tableWrap 补 role=region + aria-label（roving 表无 tabIndex）。
    const maTw = await page.evaluate(() => {
      const grab = (label: string) => {
        const el = document.querySelector(`div[aria-label="${label}"]`);
        return el ? [el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('aria-label')] : null;
      };
      return {
        cred: grab('应用凭据配置状态（可横向滚动）'),
        acct: grab('已授权账号（可横向滚动）'),
      };
    });
    assert.deepEqual(maTw.cred, ['region', null, '应用凭据配置状态（可横向滚动）'], '应用凭据配置状态表 tableWrap 应为 role=region + aria-label');
    assert.deepEqual(maTw.acct, ['region', null, '已授权账号（可横向滚动）'], '已授权账号表 tableWrap 应为 role=region + aria-label');

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/**
 * MicrosoftOAuthSection：两张表都由 mutation 结果驱动，初始没有行。
 * entry 拦 fetch 把 token/start、token/complete、token/drives、token/sites
 * 全部打桩，再由测试点真按钮把流程跑通 —— 走的是真 onClick + 真 useMutation。
 */
const MS_OAUTH_ENTRY = `
import { createElement } from '${'${NM_REACT}'}';
import { createRoot } from '${'${NM_REACT_DOM_CLIENT}'}';
import { QueryClient, QueryClientProvider } from '${'${NM_RQ}'}';
import { MicrosoftOAuthSection } from '${'${MS_OAUTH_PATH}'}';

const json = (v) =>
  new Response(JSON.stringify(v), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

// wire 形状：snake_case 直出，由 api 层映射为 camelCase 域模型
const drives = [0, 1, 2].map((i) => ({
  id: 'd-' + i,
  name: 'drive ' + i,
  drive_type: i === 1 ? null : 'documentLibrary',
  web_url: 'https://example.com/d/' + i,
  quota: { total: 100, used: i * 10, remaining: 100 - i * 10 },
}));

const sites = [0, 1].map((i) => ({
  id: 's-' + i,
  name: 'site-' + i,
  display_name: '站点 ' + i,
  web_url: 'https://example.com/s/' + i,
}));

globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('/token/drives')) return json({ items: drives });
  if (u.includes('/token/sites')) return json({ items: sites });
  if (u.includes('/token/complete')) {
    return json({
      authorization_id: 'auth-1',
      provider_type: 'global',
      tenant_id: 't-1',
      service_kind: 'onedrive',
      access_token: 'AT',
      refresh_token: 'RT',
      expires_at: '2026-01-02T00:00:00Z',
      principal_id: 'p-1',
      user_principal_name: 'a@example.com',
      display_name: 'A B',
      oauth_client_kind: 'custom',
    });
  }
  if (u.includes('/token/start')) {
    return json({
      authorization_id: 'auth-1',
      auth_profile_id: 'prof-1',
      provider_type: 'global',
      tenant_id: 't-1',
      drive_id: 'd-0',
      service_kind: 'onedrive',
      redirect_uri: 'https://example.com/cb',
      authorize_url: 'https://login.example.com/x',
      oauth_client_kind: 'custom',
    });
  }
  return json({});
};

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')).render(
  createElement(QueryClientProvider, { client: qc },
    createElement(MicrosoftOAuthSection, {})),
);
`;

/** 按可见文本点真按钮（走真实 onClick，不走脚本 API）。 */
async function clickButtonByText(page: any, text: string) {
  await page.locator('button', { hasText: text }).first().click();
}

/**
 * 把 OAuthSection 跑到两张表都有行的状态。
 * 真实链路：发起 token 流 → 取得令牌（需要 authorizationId + callbackUrl）→ 列举 drive / 搜索站点。
 * 按钮文案严格照抄组件里的可见文本，改文案这里会先红。
 */
async function renderMicrosoftOAuthTables(page: any) {
  await clickButtonByText(page, '发起 token 流');
  await page.waitForSelector('input[placeholder]', { timeout: 20000 });
  // token/complete 要求 authorizationId + callbackUrl 都非空
  await page.locator('input[placeholder]').fill('https://example.com/cb?code=xyz');
  await clickButtonByText(page, '换取令牌');
  // 搜索站点按钮在 siteQuery 为空时是 disabled，必须先按 label 定位真输入框填关键字
  await page
    .locator('label', { hasText: '站点搜索关键字' })
    .locator('input')
    .fill('站点');
  await clickButtonByText(page, '列举 drive');
  await clickButtonByText(page, '搜索站点');
  // ⚠ 不能只等第一张表的第一行：drives 的 setState 先 commit，sites 表稍后才挂上，
  // 只等 [data-row-index="0"] 会在两表之间抢跑（实测 TBODY_COUNT=1）。
  await page.waitForFunction(
    () =>
      document.querySelectorAll('tbody').length === 2 &&
      document.querySelectorAll('tbody')[1]?.querySelector('[data-row-index="0"]') != null,
    undefined,
    { timeout: 20000 },
  );
}


test('接线实证（MicrosoftOAuthSection）：两张只读表各自独立漫游（第七批 1/1）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-msoauth-',
    MS_OAUTH_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/microsoft/MicrosoftOAuthSection.tsx'),
    // 初始没有行，不能等 [data-row-index="0"]（表要先走完 mutation 才有行）
    'body',
  );
  if (!h) return;
  try {
    const { page } = h;
    await renderMicrosoftOAuthTables(page);
    assert.equal(
      await page.evaluate(() => document.querySelectorAll('tbody').length),
      2,
      'drives / sites 两张表应有各自 tbody（索引域独立）',
    );
    // 真实 Tab 起步（I-1）：两表行都是零控件纯文本行，键盘入口全靠 roving 停靠点。
    assert.deepEqual(await rovingStopsIn(page, 0), ['0'], 'drive 表首行应是唯一 Tab 停靠点');
    assert.equal(await tabIntoRow(page, 0), 0, '连按 Tab 应能走到 drive 表的活动行（真实键盘入口）');
    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRowIn(page, 0), 1, 'drive 表 ↓ 应到第 2 行');
    assert.deepEqual(await rovingStopsIn(page, 0), ['1'], 'drive 表停靠点须跟着焦点走');
    await page.keyboard.press('End');
    assert.equal(await focusedRowIn(page, 0), 2, 'drive 表 End → 末行');
    await page.keyboard.press('Home');
    assert.equal(await focusedRowIn(page, 0), 0, 'drive 表 Home → 首行');
    // 表2 独立索引域：从 0 起算
    assert.equal(await tabIntoRow(page, 1), 0, '再按 Tab 应能走到 site 表的活动行');
    await page.keyboard.press('End');
    assert.equal(await focusedRowIn(page, 1), 1, 'site 表 End → 末行（索引域独立于 drive 表）');

    // tableWrap 滚动区 a11y（第七批）：OneDrive 网盘表 + SharePoint 站点表 tableWrap 补 role=region + aria-label（roving 表无 tabIndex）。
    const moTw = await page.evaluate(() => {
      const grab = (label: string) => {
        const el = document.querySelector(`div[aria-label="${label}"]`);
        return el ? [el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('aria-label')] : null;
      };
      return {
        drives: grab('OneDrive 网盘列表（可横向滚动）'),
        sites: grab('SharePoint 站点列表（可横向滚动）'),
      };
    });
    assert.deepEqual(moTw.drives, ['region', null, 'OneDrive 网盘列表（可横向滚动）'], 'OneDrive 网盘表 tableWrap 应为 role=region + aria-label');
    assert.deepEqual(moTw.sites, ['region', null, 'SharePoint 站点列表（可横向滚动）'], 'SharePoint 站点表 tableWrap 应为 role=region + aria-label');

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

test('MicrosoftOAuthSection 裁定：只读清单行上 Enter 无副作用', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-msoauth2-',
    MS_OAUTH_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/microsoft/MicrosoftOAuthSection.tsx'),
    'body',
  );
  if (!h) return;
  try {
    const { page } = h;
    await renderMicrosoftOAuthTables(page);
    await page.locator('tbody').nth(0).locator('[data-row-index="0"]').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    assert.equal(
      await page.evaluate(() => document.querySelector('[role="dialog"]') !== null),
      false,
      '只读清单 Enter 不得凭空造出语义',
    );
    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

test('MicrosoftAccountsSection 裁定：只读凭据表行上 Enter 无副作用', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-msacct2-',
    MS_ACCOUNTS_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/microsoft/MicrosoftAccountsSection.tsx'),
  );
  if (!h) return;
  try {
    const { page } = h;
    await page.locator('tbody').nth(0).locator('[data-row-index="0"]').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    assert.equal(
      await page.evaluate(() => document.querySelector('[role="dialog"]') !== null),
      false,
      '凭据表 Enter 不得凭空造出语义',
    );
    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/* ------------------------------------------------------------------ */
/* RuntimeLogArchivesSection 接线实证（第五批 2/3）                    */
/* ------------------------------------------------------------------ */

const RUNTIME_ARCHIVES_ENTRY = `
import { createElement } from '${'${NM_REACT}'}';
import { createRoot } from '${'${NM_REACT_DOM_CLIENT}'}';
import { QueryClient, QueryClientProvider } from '${'${NM_RQ}'}';
import { RuntimeLogArchivesSection } from '${'${RUNTIME_ARCHIVES_PATH}'}';

// wire 形状（snake_case 直出），由 api 层映射
const items = [0, 1, 2].map((i) => ({
  id: 'sha-' + i,
  file_name: 'runtime-' + i + '.zip',
  log_date: '2026-01-0' + (i + 1),
  compressed_size_bytes: 1024 * (i + 1),
  original_size_bytes: 4096 * (i + 1),
  compression_ratio: 4.0,
  created_at: '2026-01-0' + (i + 1) + 'T00:00:00Z',
  expires_at: '2026-02-0' + (i + 1) + 'T00:00:00Z',
}));

globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('/download')) {
    window.__downloads = (window.__downloads || []);
    window.__downloads.push(u);
    return new Response(new Blob(['zip']), { status: 200 });
  }
  return new Response(
    JSON.stringify({ items, total: items.length, log_dir: '/var/log/fmby', retention_days: 30 }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')).render(
  createElement(QueryClientProvider, { client: qc },
    createElement(RuntimeLogArchivesSection, {})),
);
`;

test('接线实证（RuntimeLogArchivesSection）：↑↓/Home/End 漫游（第五批 2/3）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-rtarch-',
    RUNTIME_ARCHIVES_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/runtime-logs/RuntimeLogArchivesSection.tsx'),
  );
  if (!h) return;
  try {
    const { page } = h;
    await page.focus('[data-row-index="0"]');
    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRow(page), 1, '↓ 应到下一行');
    await page.keyboard.press('End');
    assert.equal(await focusedRow(page), 2, 'End → 末行');
    await page.keyboard.press('Home');
    assert.equal(await focusedRow(page), 0, 'Home → 首行');
    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

test('RuntimeLogArchivesSection 裁定：Enter 复用既有「下载」动作（取回类、无破坏）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-rtarch2-',
    RUNTIME_ARCHIVES_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/runtime-logs/RuntimeLogArchivesSection.tsx'),
  );
  if (!h) return;
  try {
    const { page } = h;
    await page.focus('[data-row-index="1"]');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => (window.__downloads || []).length > 0, null, { timeout: 10000 });
    const urls = await page.evaluate(() => (window as any).__downloads);
    assert.equal(urls.length, 1, 'Enter 应恰好触发一次下载');
    assert.ok(
      String(urls[0]).includes('/sha-1/download'),
      'Enter 应下载**焦点所在行**（索引 1），不是首行：' + String(urls[0]),
    );
    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/** 换成一批数据并等 React 真正 commit（concurrent 下 setState 不 flush）。 */
async function swapRows(page: any, next: string[]) {
  const first = next[0];
  await page.evaluate((rows) => (window as any).__swap(rows), next);
  await page.waitForFunction(
    (label) => document.querySelector('tbody tr[data-row-index="0"]')?.getAttribute('data-label') === label,
    first,
    { timeout: 10000 },
  );
}

test('I-1 契约：行内零可聚焦控件的只读表也能用 Tab 走进表格（roving 留唯一停靠点）', async (t) => {
  const h = await mountRovingHookProbe(t, 'fe02-roving-i1-');
  if (!h) return;
  try {
    const { page } = h;
    // 初始焦点在 body：从**真实按键**起步，不脚本聚焦数据行。
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    assert.deepEqual(await rovingStops(page), ['0'], '挂载后首行应是唯一 Tab 停靠点');

    await page.keyboard.press('Tab');
    assert.equal(
      await page.evaluate(() => document.activeElement?.getAttribute('data-row-index')),
      '0',
      'Tab 应直接落到活动行（I-1：键盘入口可达）',
    );

    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRow(page), 1, '↓ 应到下一行');
    assert.deepEqual(await rovingStops(page), ['1'], '移动后停靠点必须跟着走（旧行不得留在 Tab 序）');
    await page.keyboard.press('End');
    assert.equal(await focusedRow(page), 2, 'End → 末行');
    assert.deepEqual(await rovingStops(page), ['2']);
    await page.keyboard.press('Home');
    assert.equal(await focusedRow(page), 0, 'Home → 首行');
    assert.deepEqual(await rovingStops(page), ['0'], '回到首行后停靠点应在首行');

    await page.keyboard.press('Enter');
    assert.deepEqual(await page.evaluate(() => (window as any).__activations), [0], 'Enter 只触发一次');
    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

test('I-2 契约：行数不变的整表替换后 tabindex 必须重算（旧值不得残留）', async (t) => {
  const h = await mountRovingHookProbe(t, 'fe02-roving-i2-');
  if (!h) return;
  try {
    const { page } = h;
    await page.keyboard.press('Tab');
    assert.equal(await focusedRow(page), 0);
    // 停靠点移到第 3 行，再做**等长**替换：rowCount 不变 ⇒ 仅靠 rowCount
    // 依赖的 effect 不会重跑（这正是 I-2 的根因）。
    await page.keyboard.press('End');
    assert.deepEqual(await rovingStops(page), ['2']);
    await swapRows(page, ['x', 'y', 'z']);

    assert.deepEqual(
      await rovingStops(page),
      ['2'],
      '换数据后仍须恰好 1 个停靠点（旧行的 tabindex 不得整批残留）',
    );
    assert.equal(
      await page.evaluate(
        () => document.querySelector('tbody tr[tabindex="0"]')?.getAttribute('data-label'),
      ),
      'z',
      '停靠点应落在**新数据**上（旧 DOM 已卸载，停靠点跟随索引位置而非旧节点）',
    );

    // 新数据仍可漫游（属性确实写进去了，不是只读属性算出来的假象）。
    await page.keyboard.press('Tab');
    assert.equal(await focusedRow(page), 2, 'Tab 应落到保留下来的停靠点');
    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRow(page), 2, '末行再按 ↓ 应停在末行（不得越界丢焦点）');
    await page.keyboard.press('Home');
    assert.equal(await focusedRow(page), 0, 'Home 应回到新数据首行');
    assert.deepEqual(await rovingStops(page), ['0']);
    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

test('I-2 契约：虚拟化行挂载/卸载后不产生重复停靠点', async (t) => {
  const h = await mountRovingHookProbe(t, 'fe02-roving-virt-');
  if (!h) return;
  try {
    const { page } = h;
    await page.keyboard.press('Tab');
    assert.equal(await focusedRow(page), 0, 'Tab 应落到首行');
    await page.keyboard.press('ArrowDown');
    assert.deepEqual(await rovingStops(page), ['1']);
    // 模拟虚拟化：行数减少（滚动出视口被卸载）
    await swapRows(page, ['a', 'b']);
    assert.deepEqual(
      await rovingStops(page),
      ['1'],
      '卸载末行后停靠点仍应唯一（不得因索引域缩小而残留重复项）',
    );
    // 行数变多（滚回视口重新挂载）
    await swapRows(page, ['a', 'b', 'c', 'd', 'e']);
    assert.deepEqual(await rovingStops(page), ['1'], '重新挂载后仍唯一且保留活动行');
    // 旧行节点被卸载，焦点随之掉到 body（真实行为）；用户需重新 Tab 进停靠点。
    assert.equal(await tabIntoRow(page), 1, '换批数据后仍能 Tab 回到保留下来的停靠点');
    await page.keyboard.press('End');
    assert.deepEqual(await rovingStops(page), ['4'], '新挂载的行也可成为停靠点');
    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/* ------------------------------------------------------------------ */
/* AiInterventionThreadList 接线实证（第六批）                            */
/* ------------------------------------------------------------------ */


test('接线实证（AiInterventionThreadList）：真实 Tab 起步 + ↑↓/Home/End 漫游 + Enter 选中（第六批）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-aithr-',
    AI_THREAD_LIST_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/naming-rules/ai-intervention/components/AiInterventionThreadList.tsx'),
  );
  if (!h) return;
  try {
    const { page } = h;
    // 真实键盘入口：从 body 连按 Tab 走进表格（页面上方还有关键词框/筛选控件）。
    assert.equal(await tabIntoRow(page), 0, '连按 Tab 应能走到活动行（真实键盘入口）');
    assert.deepEqual(await rovingStops(page), ['0'], '行不得再全部进 Tab 序（只有唯一停靠点）');

    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRow(page), 1, '↓ 应到下一行');
    assert.deepEqual(await rovingStops(page), ['1'], '停靠点须跟着焦点走');
    await page.keyboard.press('End');
    assert.equal(await focusedRow(page), 3, 'End → 末行');
    assert.deepEqual(await rovingStops(page), ['3']);
    await page.keyboard.press('Home');
    assert.equal(await focusedRow(page), 0, 'Home → 首行');

    await page.keyboard.press('Enter');
    const sel = await page.evaluate(() => (window as any).__selections);
    assert.deepEqual(sel, ['media-0'], 'Enter 应选中**焦点所在行**的媒体项（且只一次）');
    // tableWrap 滚动区 a11y（第十一批）：干预线程表 tableWrap 补 role=region + aria-label（roving 表无 tabIndex）。
    const threadTw = await page.evaluate(() => {
      const el = document.querySelector('div[aria-label="AI 干预线程（可横向滚动）"]');
      return el ? [el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('aria-label')] : null;
    });
    assert.deepEqual(threadTw, ['region', null, 'AI 干预线程（可横向滚动）'], '干预线程表 tableWrap 应为 role=region + aria-label');

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

test('AiInterventionThreadList 裁定：Space 仍能选中（不因移除行内 Enter 而丢失激活途径）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-aithr2-',
    AI_THREAD_LIST_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/naming-rules/ai-intervention/components/AiInterventionThreadList.tsx'),
  );
  if (!h) return;
  try {
    const { page } = h;
    assert.equal(await tabIntoRow(page), 0, '真实 Tab 应能走进表格');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRow(page), 2);
    await page.keyboard.press(' ');
    const sel = await page.evaluate(() => (window as any).__selections);
    assert.deepEqual(sel, ['media-2'], 'Space 仍应选中行内媒体项');
    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

const AI_THREAD_LIST_ENTRY = `
import { createElement, useState } from '\${NM_REACT}';
import { createRoot } from '\${NM_REACT_DOM_CLIENT}';
import { AiInterventionThreadList } from 'file:///AI_PATH_PLACEHOLDER';

function makeThread(i) {
  return {
    id: 'thr-' + i,
    mediaItemId: 'media-' + i,
    latestRunId: null,
    latestAutoTaskId: null,
    latestSummaryJson: '{}',
    latestEvidenceJson: '{}',
    latestResultJson: '{}',
    latestDiffJson: '{}',
    latestSkillKey: 'naming_cleanup',
    latestProvider: 'gemini',
    latestModel: 'gemini-2.5',
    latestRunStatus: 'Succeeded',
    latestAppliedRunId: null,
    latestAppliedResultJson: '{}',
    sessionState: 'Open',
    currentSessionId: null,
    currentSessionSkillKey: null,
    sessionOpenedByUserId: null,
    sessionOpenedAt: null,
    sessionLastActivityAt: null,
    archivedSessionSummaryJson: '',
    createdAt: 1767225600000 + i,
    updatedAt: 1767225600000 + i,
  };
}

const threads = [0, 1, 2, 3].map(makeThread);

function Probe() {
  const [selected, setSelected] = useState(null);
  return createElement(AiInterventionThreadList, {
    threads,
    isPending: false,
    error: null,
    selectedMediaItemId: selected,
    onSelect: (id) => {
      window.__selections = (window.__selections || []).concat([id]);
      setSelected(id);
    },
  });
}

createRoot(document.getElementById('root')).render(createElement(Probe, {}));
`;

// ─────────────────────────────────────────────────────────────────────────────
// 嵌套表（A 方案）：CollectionListTable 是**全仓唯一一处逻辑父子表** ——
// 展开行的 <td> 里再出一张表（CollectionMemberPanel）。
// A 方案 = 父子各自独立索引域，data-row-index 各从 0 起。
// ─────────────────────────────────────────────────────────────────────────────

const NESTED_ENTRY = `
import { createElement } from '${'${NM_REACT}'}';
import { createRoot } from '${'${NM_REACT_DOM_CLIENT}'}';
import { QueryClient, QueryClientProvider } from '${'${NM_RQ}'}';
import { ManageCollectionsPage } from '${'${NESTED_PATH}'}';

const json = (v) =>
  new Response(JSON.stringify(v), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

// wire 形状：snake_case 直出，由 api 层映射为 camelCase 域模型
const rawCollection = (i) => ({
  id: 'c-' + i,
  title: '合集 ' + i,
  overview: null,
  poster_url: null,
  source_kind: 'manual',
  collection_kind: 'custom',
  auto_expand_enabled: false,
  min_effective_members: null,
  artwork_mode: 'poster',
  visibility: 'Active',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
});

const rawMember = (collectionId, i) => ({
  id: 'm-' + collectionId + '-' + i,
  collection_id: collectionId,
  bound_item_id: null,
  member_origin: 'manual',
  title_snapshot: '成员 ' + i,
  year_snapshot: 2000 + i,
  media_kind: 'movie',
  poster_url_snapshot: null,
  is_enabled: true,
  release_order: i,
  watch_order: i,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
});

const collections = [rawCollection(0), rawCollection(1)];

globalThis.fetch = async (url) => {
  const u = String(url);
  // detail：/api/manage/collections/{id}（含斜杠 + id）
  if (/\\/manage\\/collections\\/.+/.test(u)) {
    const id = u.split('/manage/collections/')[1].split('?')[0];
    return json({
      collection: collections.find((c) => c.id === id) ?? rawCollection(0),
      members: [rawMember(id, 0), rawMember(id, 1)],
      rules: [],
      member_overrides: [],
    });
  }
  if (u.includes('/manage/collections')) return json(collections);
  return json({});
};

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')).render(
  createElement(QueryClientProvider, { client: qc },
    createElement(ManageCollectionsPage, {})),
);
`;

/** 焦点所在行的**归属 tbody** 下标（子表的行在 DOM 上也属于父 tbody ⇒ 不能用 contains 判定）。 */
function focusOwnerTbody(page: any): Promise<number> {
  return page.evaluate(() => {
    const tbodies = Array.from(document.querySelectorAll('tbody'));
    const owner = (document.activeElement as HTMLElement | null)?.closest('tbody') ?? null;
    return owner ? tbodies.indexOf(owner) : -1;
  });
}

/** 焦点所在行的 data-row-index（按归属 tbody 判定，避免父子串台）。 */
function focusRowIndex(page: any): Promise<number | null> {
  return page.evaluate(() => {
    const idx = (document.activeElement as HTMLElement | null)
      ?.closest('[data-row-index]')
      ?.getAttribute('data-row-index');
    return idx == null ? null : Number(idx);
  });
}

test('嵌套表 A 方案：父子各自独立索引域，子表 ↑↓ 不得串到父表', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-nested-',
    NESTED_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/ManageCollectionsPage.tsx'),
  );
  if (!h) return;
  try {
    const { page } = h;
    // 展开第一行：点真按钮「成员」（aria-expanded 由它驱动）
    await page.locator('tbody tr[data-row-index="0"] button', { hasText: '成员' }).first().click();
    await page.waitForFunction(
      () =>
        document.querySelectorAll('tbody').length === 2 &&
        document.querySelectorAll('tbody')[1]?.querySelectorAll('[data-row-index]').length === 2,
      undefined,
      { timeout: 20000 },
    );

    // A 方案核心断言①：两个域**各自**从 0 起算，互不相加。
    // ⚠ 不能用 tbody.querySelectorAll：子表的行在 DOM 上**也是**父 tbody 的后代
    // （实测父域读出 ['0','0','1','1']）。必须按「最近 tbody 归属」划分。
    const domainOf = (ti: number) =>
      page.evaluate((i: number) => {
        const tbody = document.querySelectorAll('tbody')[i];
        return Array.from(document.querySelectorAll('[data-row-index]'))
          .filter((r) => r.closest('tbody') === tbody)
          .map((r) => r.getAttribute('data-row-index'));
      }, ti);
    assert.deepEqual(await domainOf(0), ['0', '1'], '父表索引域：0..N-1');
    assert.deepEqual(
      await domainOf(1),
      ['0', '1'],
      '★子表索引域同样从 0 起（A 方案：不接在父表后面变 2,3）',
    );

    // A 方案核心断言②：两域各留**一个** Tab 停靠点（共 2 个，但分属不同 tbody）
    assert.deepEqual(await rovingStopsIn(page, 0), ['0'], '父表唯一停靠点');
    assert.deepEqual(await rovingStopsIn(page, 1), ['0'], '★子表也有自己的唯一停靠点');

    // ── 子表内漫游：真实 Tab 走进子表，再按 ↓ ──
    const childStart = await tabIntoRow(page, 1);
    assert.equal(childStart, 0, 'Tab 应能走进子表的停靠点（子域从 0 起）');
    assert.equal(await focusOwnerTbody(page), 1, '焦点归属子 tbody');

    await page.keyboard.press('ArrowDown');
    assert.equal(await focusRowIndex(page), 1, '子表内 ↓ → 子表第 2 行');
    assert.equal(
      await focusOwnerTbody(page),
      1,
      '★焦点必须仍在子 tbody：不得被父表 handler 抢走（keydown 会从子 tbody 冒泡到父 tbody）',
    );
    assert.deepEqual(await rovingStopsIn(page, 1), ['1'], '子表停靠点跟着走');
    assert.deepEqual(
      await rovingStopsIn(page, 0),
      ['0'],
      '★父表停靠点不受子表漫游影响（独立索引域）',
    );

    // ── 父表内漫游仍正常 ──
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const parentStart = await tabIntoRow(page, 0);
    assert.equal(parentStart, 0, 'Tab 走进父表停靠点');
    await page.keyboard.press('ArrowDown');
    assert.equal(await focusRowIndex(page), 1, '父表内 ↓ → 父表第 2 行');
    assert.equal(await focusOwnerTbody(page), 0, '焦点归属父 tbody');

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// 契约改造（主代理裁决「选项 2」）：UpstreamSyncJobsSection 两张作业表。
// 原本每行写死 tabIndex={0} + 行内 Enter/Space ⇒ 与 roving 契约冲突
// （N 行全进 Tab 序）。改由 roving 接管：唯一停靠点 + 方向键漫游 +
// Enter 走 onActivate（仍是「查看详情」，用户感知零变化），Space 仍行内处理。
// ─────────────────────────────────────────────────────────────────────────────

const SYNC_JOBS_ENTRY = `
import { createElement } from '${'${NM_REACT}'}';
import { createRoot } from '${'${NM_REACT_DOM_CLIENT}'}';
import { QueryClient, QueryClientProvider } from '${'${NM_RQ}'}';
import { UpstreamSyncJobsSection } from '${'${SYNC_JOBS_PATH}'}';

const json = (v) =>
  new Response(JSON.stringify(v), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

// wire 形状：snake_case 直出，由 api 层映射为 camelCase 域模型
const rawJob = (kind, i, override) => ({
  id: kind + '-' + i,
  source_id: 'src-1',
  sourceId: 'src-1',
  job_kind: kind,
  status: 'Succeeded',
  category_ids: [],
  page_size: null,
  worker_count: null,
  result_summary: {},
  last_error_message: null,
  attempt_count: 1,
  max_attempts: 3,
  created_by: null,
  started_at: null,
  finished_at: null,
  created_at: 1767225600000 + i,
  updated_at: 1767225600000 + i,
  ...(override || {}),
});

const syncItems = [rawJob('sync', 0), rawJob('sync', 1), rawJob('sync', 2)];

globalThis.fetch = async (url) => {
  const u = String(url);
  // sec/remove-emby-upstream：原第二张表（Emby 导入作业）与其付费闸 stub 已随
  // 能力整除删除；本页现在只有 sync-jobs 一张表。
  if (u.includes('/sync-jobs')) return json({ items: syncItems, total: syncItems.length });
  return json({});
};

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')).render(
  createElement(QueryClientProvider, { client: qc },
    createElement(UpstreamSyncJobsSection, { sourceId: 'src-1' })),
);
`;

test('契约改造（选项 2）：UpstreamSyncJobsSection 真实 Tab 起步 + Enter 走 onActivate 查看详情', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-syncjobs-',
    SYNC_JOBS_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/upstreams/UpstreamSyncJobsSection.tsx'),
  );
  if (!h) return;
  try {
    const { page } = h;
    await page.waitForFunction(
      () => document.querySelectorAll('tbody').length === 1,
      undefined,
      { timeout: 20000 },
    );

    // ── ① Tab 步数才是本次要治的病：3 行只应有 1 个停靠点（旧实现是 3 个）──
    assert.deepEqual(await rovingStopsIn(page, 0), ['0'], 'sync 表唯一停靠点');

    // ── ② 真实 Tab 起步 ──
    assert.equal(await tabIntoRow(page, 0), 0, '真实 Tab 应能走进 sync 表');

    // ── ③ ↓/End 漫游 ──
    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRow(page), 1, '↓ → 第 2 行');
    await page.keyboard.press('End');
    assert.equal(await focusedRow(page), 2, 'End → 末行');
    assert.deepEqual(await rovingStopsIn(page, 0), ['2'], '停靠点必须跟着走（旧值不得残留）');

    // ── ④ Enter 走 onActivate ⇒ 打开「作业详情」，且只一次 ──
    await page.keyboard.press('Enter');
    await page.waitForSelector('text=作业详情', { timeout: 10000 });
    assert.match(
      (await page.textContent('body')) ?? '',
      /作业详情（sync-2）/,
      'Enter 应打开**焦点所在行**（末行 sync-2）的详情',
    );

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/* ================================================================== */
/* 补测批次 A：一表一证（第四~九批未实证文件）                         */
/* ================================================================== */
/*
 * 背景：第七~九批接线后，仍有 16 个接线文件在测试文本里没有被点名，
 * 也没有自己的真实 DOM 实证（旧版回退后 keynav suite 仍然 45/45 pass，
 * 证明这些用例对它们无约束力）。本批开始逐表补齐。
 *
 * 每个用例的硬判据（四条同时满足才算「一表一证」）：
 *   ① 真实连续 Tab 进入（countTabPressesToRow，禁脚本 focus）
 *   ② 按实际 Tab 步数断言（实测值，非硬编码猜测）
 *   ③ 唯一 roving 停靠点（该 tbody 内 tabindex=0 恰好一个）
 *   ④ 回退旧组件后本用例至少一条断言失败
 *
 * 本批 4 个文件：AiInterventionDetailPanel / MediaItemArtworkSection /
 *             ProviderDiagnosticsCard / ManageMediaReviewsPage
 */

/* ------------------------------------------------------------------ */
/* AiInterventionDetailPanel：runs 表（纯只读，不传 onActivate）       */
/* ------------------------------------------------------------------ */

/**
 * runs 表是纯只读清单（行内无控件）⇒ 组件刻意不传 onActivate，
 * roving 停靠点是它唯一的键盘入口（I-1 的典型受害面）。
 */
const AI_PANEL_ENTRY = `
import { createElement } from '${'${NM_REACT}'}';
import { createRoot } from '${'${NM_REACT_DOM_CLIENT}'}';
import { AiInterventionDetailPanel } from 'file:///COMPONENT_PATH_PLACEHOLDER';

const runs = [0, 1, 2].map((i) => ({
  id: 'run-' + i,
  threadId: 'th-1',
  mediaItemId: 'mi-1',
  sessionId: null,
  aiTaskId: null,
  runKind: 'AutoRun',
  skillKey: 'naming_cleanup',
  provider: 'openai',
  model: 'gpt-x',
  runStatus: i === 1 ? 'failed' : 'succeeded',
  turnIndex: i,
  summaryJson: '{}',
  evidenceSnapshotJson: '{}',
  resultSnapshotJson: '{}',
  diffSnapshotJson: '{}',
  errorCode: i === 1 ? 'E1' : null,
  errorMessage: i === 1 ? 'boom' : null,
  requestedByUserId: null,
  appliedByUserId: null,
  appliedAt: null,
  createdAt: 1700000000000 + i,
  updatedAt: 1700000000000 + i,
}));

const detail = {
  thread: {
    id: 'th-1',
    mediaItemId: 'mi-1',
    latestRunId: 'run-2',
    latestAutoTaskId: null,
    latestSummaryJson: '{}',
    latestEvidenceJson: '{}',
    latestResultJson: '{}',
    latestDiffJson: '{}',
    latestSkillKey: 'naming_cleanup',
    latestProvider: 'openai',
    latestModel: 'gpt-x',
    latestRunStatus: 'succeeded',
    latestAppliedRunId: null,
    latestAppliedResultJson: '{}',
    sessionState: 'Idle',
    currentSessionId: null,
    currentSessionSkillKey: null,
  },
  messages: [],
  runs,
};

const noop = () => {};
createRoot(document.getElementById('root')).render(
  createElement(AiInterventionDetailPanel, {
    mediaItemId: 'mi-1',
    detail,
    isPending: false,
    error: null,
    openPending: false,
    sendPending: false,
    closePending: false,
    applyPending: false,
    actionError: null,
    onOpen: noop,
    onSend: noop,
    onClose: noop,
    onApply: noop,
    onDismissError: noop,
  }),
);
`;

test('AiInterventionDetailPanel runs 表：真实 Tab 步数 + 唯一停靠点 + 只读不激活', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-aipanel-',
    AI_PANEL_ENTRY,
    join(
      HOST_ROOT,
      'src/pages/manage/naming-rules/ai-intervention/components/AiInterventionDetailPanel.tsx',
    ),
  );
  if (!h) return;
  try {
    const { page } = h;
    // ③ 唯一停靠点
    assert.deepEqual(
      await rovingStopsIn(page, 0),
      ['0'],
      'runs 表初始必须恰好 1 个 roving 停靠点，且是第 0 行',
    );

    // ①② 真实连续 Tab + 按实测步数断言
    const presses = await countTabPressesToRow(page, 0);
    assert.ok(presses >= 1, `真实 Tab 必须能走进只读 runs 表（实测 ${presses} 次）`);
    assert.equal(await focusedRowIn(page, 0), 0, 'Tab 落在首个停靠行');

    // 方向键漫游（只读表唯一的交互）
    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRowIn(page, 0), 1, 'ArrowDown → 第 1 行');
    await page.keyboard.press('End');
    assert.equal(await focusedRowIn(page, 0), 2, 'End → 末行');
    assert.deepEqual(await rovingStopsIn(page, 0), ['2'], '停靠点必须跟随焦点');
    await page.keyboard.press('Home');
    assert.equal(await focusedRowIn(page, 0), 0, 'Home → 首行');

    // 只读表：Enter 不得凭空造出语义，也不得把焦点挪走
    await page.keyboard.press('Enter');
    assert.equal(await focusedRowIn(page, 0), 0, '只读表 Enter 不得挪走焦点');

    // tableWrap 滚动区 a11y（第十一批）：干预运行记录表 tableWrap 补 role=region + aria-label（roving 表无 tabIndex）。
    const runsTw = await page.evaluate(() => {
      const el = document.querySelector('div[aria-label="干预运行记录（可横向滚动）"]');
      return el ? [el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('aria-label')] : null;
    });
    assert.deepEqual(runsTw, ['region', null, '干预运行记录（可横向滚动）'], '干预运行记录表 tableWrap 应为 role=region + aria-label');

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/* ------------------------------------------------------------------ */
/* MediaItemArtworkSection：remoteAssets 表（纯只读）                   */
/* ------------------------------------------------------------------ */

const ARTWORK_ENTRY = `
import { createElement } from '${'${NM_REACT}'}';
import { createRoot } from '${'${NM_REACT_DOM_CLIENT}'}';
import { MediaItemArtworkSection } from 'file:///COMPONENT_PATH_PLACEHOLDER';
import { ToastProvider } from '@fmby/v2-shared/ui';
import { QueryClient, QueryClientProvider } from '${'${NM_RQ}'}';
import { useManageMediaItemMetadataMutations } from 'file:///MUTATIONS_PATH_PLACEHOLDER';

const remoteAssets = [0, 1, 2].map((i) => ({
  id: 'asset-' + i,
  mediaItemId: 'mi-1',
  assetType: 'poster',
  assetTypeLabel: '海报',
  language: 'zh',
  isCached: i !== 1,
  cachePath: i !== 1 ? '/cache/' + i : undefined,
  filePath: '/mnt/a/file-' + i + '.jpg',
  mountId: 'm-1',
  mountName: '主库',
  url: 'https://example.com/a' + i,
  createdAt: '2026-01-0' + (i + 1) + 'T00:00:00Z',
}));

const detail = {
  item: { id: 'mi-1', title: '示例影片' },
  baseMetadata: {},
  effectiveMetadata: {},
  scrapedArtworks: [],
  sources: [],
  remoteAssets,
  artworkOverrides: [],
  subtitleOverrides: [],
  metadataStatus: {},
};

// ⚠ 两层 Provider 都不能少（都与 main.tsx / 真实页面一致）：
//   ① ToastProvider —— 组件首行 useToast()，缺了就抛「useToast 必须在 <ToastProvider> 内部使用」；
//   ② QueryClientProvider —— mutations 不能传 {} 糊弄：组件直接解构
//      uploadArtworkMutation.isPending，undefined.isPending 会 TypeError 白屏。
//      这里调真实 hook（真实 useMutation 实例），不造假的 mutation 形状。
function Probe() {
  const mutations = useManageMediaItemMetadataMutations('mi-1');
  return createElement(MediaItemArtworkSection, { detail, mutations });
}

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')).render(
  createElement(ToastProvider, null,
    createElement(QueryClientProvider, { client: qc }, createElement(Probe, null))),
);
`;

test('MediaItemArtworkSection remoteAssets 表：真实 Tab 步数 + 唯一停靠点', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-artwork-',
    ARTWORK_ENTRY,
    join(
      HOST_ROOT,
      'src/pages/manage/media-item-detail/components/MediaItemArtworkSection.tsx',
    ),
  );
  if (!h) return;
  try {
    const { page } = h;
    assert.deepEqual(
      await rovingStopsIn(page, 0),
      ['0'],
      'remoteAssets 表初始必须恰好 1 个停靠点',
    );

    const presses = await countTabPressesToRow(page, 0);
    assert.ok(presses >= 1, `真实 Tab 必须能进入（实测 ${presses} 次）`);
    assert.equal(await focusedRowIn(page, 0), 0, 'Tab 落在首个停靠行');

    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRowIn(page, 0), 1, 'ArrowDown → 第 1 行');
    assert.deepEqual(
      await rovingStopsIn(page, 0),
      ['1'],
      '停靠点必须跟随焦点（旧值不得残留）',
    );

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/* ------------------------------------------------------------------ */
/* ProviderDiagnosticsCard：自检步骤表（真按钮 → 真 useMutation）      */
/* ------------------------------------------------------------------ */

/**
 * 表由 mutation 结果驱动，初始无行。entry 拦 fetch 打桩 diagnostics 端点，
 * 测试点**真按钮**「开始自检」触发真 useMutation —— 不是脚本直接塞数据。
 */
const DIAG_CARD_ENTRY = `
import { createElement } from '${'${NM_REACT}'}';
import { createRoot } from '${'${NM_REACT_DOM_CLIENT}'}';
import { QueryClient, QueryClientProvider } from '${'${NM_RQ}'}';
import { ProviderDiagnosticsCard } from 'file:///COMPONENT_PATH_PLACEHOLDER';

const json = (v) =>
  new Response(JSON.stringify(v), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('/diagnostics')) {
    return json({
      run_id: 'run-1',
      provider: 'smtp',
      scenario: 'validate_config',
      // ⚠ status/summary/artifacts 缺一个就是 TypeError：
      // 卡片无条件读 result.status（StatusBadge variant 三分支）与
      // result.summary.title（<strong>{result.summary.title}</strong>）⇒
      // 缺 summary 会直接白屏，而不是“没渲染出预期表格”。
      status: 'success',
      summary: { title: '配置校验通过', message: '一切正常' },
      steps: [0, 1, 2].map((i) => ({
        code: 's-' + i,
        title: '步骤 ' + i,
        status: i === 1 ? 'failed' : 'success',
        message: 'msg ' + i,
        retryable: false,
        started_at: '2026-01-01T00:00:00Z',
        finished_at: '2026-01-01T00:00:01Z',
      })),
      artifacts: {},
      warnings: [],
      request_id: 'req-1',
      tested_at: '2026-01-01T00:00:02Z',
    });
  }
  return json({ items: [] });
};

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')).render(
  createElement(QueryClientProvider, { client: qc },
    createElement(ProviderDiagnosticsCard, { provider: 'smtp', displayName: 'SMTP' })),
);
`;

test('ProviderDiagnosticsCard 自检步骤表：真按钮触发后真实 Tab 步数 + 唯一停靠点', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-diag-',
    DIAG_CARD_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/auth-providers/ProviderDiagnosticsCard.tsx'),
    // 初始没有行（表要跑完 mutation 才有行），不能等默认的 [data-row-index="0"]。
    // 先等真实「开始自检」按钮出现，证明卡片真的挂上了。
    'button:has-text("开始自检")',
  );
  if (!h) return;
  try {
    const { page } = h;
    // 初始无行 ⇒ 无停靠点（确认表确实是 mutation 驱动的）
    assert.deepEqual(await rovingStopsIn(page, 0), [], '自检未跑前不应有停靠点');

    await clickButtonByText(page, '开始自检');
    await page.waitForSelector('tbody tr[data-row-index="0"]', { timeout: 20000 });

    assert.deepEqual(
      await rovingStopsIn(page, 0),
      ['0'],
      '自检出 3 行后必须恰好 1 个停靠点',
    );

    const presses = await countTabPressesToRow(page, 0);
    assert.ok(presses >= 1, `真实 Tab 必须能进入（实测 ${presses} 次）`);
    assert.equal(await focusedRowIn(page, 0), 0, 'Tab 落在首个停靠行');

    await page.keyboard.press('End');
    assert.equal(await focusedRowIn(page, 0), 2, 'End → 末行');
    assert.deepEqual(await rovingStopsIn(page, 0), ['2'], '停靠点必须跟随焦点');

    // tableWrap 滚动区 a11y（第九批）：自检步骤表 tableWrap 补 role=region + aria-label（roving 表无 tabIndex）。
    const pdTw = await page.evaluate(() => {
      const el = document.querySelector('div[aria-label="自检步骤（可横向滚动）"]');
      return el ? [el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('aria-label')] : null;
    });
    assert.deepEqual(pdTw, ['region', null, '自检步骤（可横向滚动）'], '自检步骤表 tableWrap 应为 role=region + aria-label');

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/* ------------------------------------------------------------------ */
/* ManageMediaReviewsPage：待审项表（HTTP mock + 真实 api.ts 转换）     */
/* ------------------------------------------------------------------ */

const MEDIA_REVIEWS_ENTRY = `
import { createElement } from '${'${NM_REACT}'}';
import { createRoot } from '${'${NM_REACT_DOM_CLIENT}'}';
import { QueryClient, QueryClientProvider } from '${'${NM_RQ}'}';
import { ManageMediaReviewsPage } from 'file:///COMPONENT_PATH_PLACEHOLDER';

const json = (v) =>
  new Response(JSON.stringify(v), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('/api/manage/media-reviews')) {
    return json({
      items: [0, 1, 2].map((i) => ({
        id: 'mr-' + i,
        media_item_id: 'mi-' + i,
        title: '待审影片 ' + i,
        provider_name: 'tmdb',
        field: 'title',
        old_value: '旧标题 ' + i,
        new_value: '新标题 ' + i,
        status: 'pending',
        created_at: '2026-01-0' + (i + 1) + 'T00:00:00Z',
      })),
    });
  }
  return json({ items: [] });
};

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')).render(
  createElement(QueryClientProvider, { client: qc },
    createElement(ManageMediaReviewsPage, {})),
);
`;

test('ManageMediaReviewsPage 待审项表：真实 Tab 步数 + 唯一停靠点 + 漫游', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-mediarev-',
    MEDIA_REVIEWS_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/ManageMediaReviewsPage.tsx'),
  );
  if (!h) return;
  try {
    const { page } = h;
    assert.deepEqual(
      await rovingStopsIn(page, 0),
      ['0'],
      '待审项表初始必须恰好 1 个停靠点',
    );

    const presses = await countTabPressesToRow(page, 0);
    assert.ok(presses >= 1, `真实 Tab 必须能进入（实测 ${presses} 次）`);
    assert.equal(await focusedRowIn(page, 0), 0, 'Tab 落在首个停靠行');

    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRowIn(page, 0), 1, 'ArrowDown → 第 1 行');
    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRowIn(page, 0), 2, 'ArrowDown → 第 2 行');
    await page.keyboard.press('Home');
    assert.equal(await focusedRowIn(page, 0), 0, 'Home → 首行');

    // tableWrap 滚动区 a11y（第十三批）：媒体审核待审项 tableWrap 补 role=region + aria-label（roving 表无 tabIndex）。
    const mrTw = await page.evaluate(() => {
      const el = document.querySelector('div[aria-label="审核队列（可横向滚动）"]');
      return el ? [el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('aria-label')] : null;
    });
    assert.deepEqual(mrTw, ['region', null, '审核队列（可横向滚动）'], '媒体审核待审项 tableWrap 应为 role=region + aria-label');

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/* ------------------------------------------------------------------ */
/* ManageSystemAboutPage 接线实证（补测批次 B 1/N）                     */
/* ------------------------------------------------------------------ */

/**
 * 本页三张表：运行时（静态 4 行）、运行依赖（query 驱动）、链接（静态 4 行）。
 * 三个 roving 域彼此独立，其中两张的行数与 query 完全无关 —— 正好用来钉死
 * 「依赖表就绪不影响另外两表停靠点」。
 *
 * fixture 必须是**后端原始 snake_case**（shared/src/contracts/manage/system-about/api.ts
 * 的 RawSystemAboutResponse）：httpClient 把 JSON 直接交给 fromRaw，喂 camelCase
 * 会让 runtime/links/dependencies 全 undefined 而渲染不出行。
 */
const SYSTEM_ABOUT_ENTRY = `
import { createElement } from '${'${NM_REACT}'}';
import { createRoot } from '${'${NM_REACT_DOM_CLIENT}'}';
import { QueryClient, QueryClientProvider } from '${'${NM_RQ}'}';
import { ManageSystemAboutPage } from 'file:///COMPONENT_PATH_PLACEHOLDER';

const dependencies = [0, 1, 2].map((i) => ({
  id: 'dep-' + i,
  name: '依赖' + i,
  status: ['ok', 'missing', 'error'][i],
  required: i !== 2,
  version: '1.' + i + '.0',
  message: i === 1 ? '探测失败' : null,
}));

globalThis.fetch = async (url) => {
  const u = String(url);
  const body = u.includes('/api/manage/system/about')
    ? {
        generated_at: '2026-01-01T00:00:00Z',
        app: { name: 'fmby', version: '0.1.0' },
        links: {
          github_profile: 'https://example.com/profile',
          source_repo: 'https://example.com/src',
          distribution_repo: 'https://example.com/dist',
          dockerhub_repo: 'https://example.com/hub',
          changelog: 'https://example.com/changelog',
        },
        runtime: {
          rust_package_version: '0.1.0',
          target_os: 'linux',
          target_arch: 'x86_64',
          features: ['a', 'b'],
        },
        dependencies,
        warnings: [],
      }
    : {};
  return new Response(JSON.stringify(body), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')).render(
  createElement(QueryClientProvider, { client: qc }, createElement(ManageSystemAboutPage, null)),
);
`;

test('接线实证（ManageSystemAboutPage）：三张表各自独立漫游，两张静态表行数不受 query 影响（补测批次 B 1/N）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-sysabout-',
    SYSTEM_ABOUT_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/ManageSystemAboutPage.tsx'),
  );
  if (!h) return;
  try {
    const { page } = h;
    assert.equal(
      await page.evaluate(() => document.querySelectorAll('tbody').length),
      3,
      '运行时/运行依赖/链接三张表应有各自 tbody（索引域独立）',
    );
    // 运行时表：静态 4 行、零控件 ⇒ 键盘入口全靠 roving 停靠点（真实键盘起步）。
    assert.deepEqual(await rovingStopsIn(page, 0), ['0'], '运行时表首行应是唯一 Tab 停靠点');
    assert.equal(await tabIntoRow(page, 0), 0, '连按 Tab 应能走到运行时表活动行');
    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRowIn(page, 0), 1, '运行时表 ↓ → 第 2 行');
    await page.keyboard.press('End');
    assert.equal(await focusedRowIn(page, 0), 3, '运行时表 End → 末行');
    assert.deepEqual(await rovingStopsIn(page, 0), ['3'], '运行时表停靠点须跟着焦点走');

    // 运行依赖表：由 query 驱动，3 行。停靠点独立于运行时表（index 各从 0 起）。
    assert.deepEqual(await rovingStopsIn(page, 1), ['0'], '依赖表首行应是唯一停靠点');
    await tabIntoRow(page, 1);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRowIn(page, 1), 2, '依赖表 ↓↓ → 第 3 行');
    assert.equal(await focusedRowIn(page, 0), null, '焦点须在依赖表，不得串到运行时表');

    // 链接表：静态 4 行。必须仍停在 index 0 —— 上一表走到第 3 行不能带偏它。
    assert.deepEqual(await rovingStopsIn(page, 2), ['0'], '链接表停靠点须独立，仍为首行');
    assert.equal(await tabIntoRow(page, 2), 0, '连按 Tab 应能走到链接表活动行');
    await page.keyboard.press('Home');
    assert.equal(await focusedRowIn(page, 2), 0, '链接表 Home → 首行');

    // tableWrap 滚动区 a11y（第二批）：3 张表 tableWrap 补 role=region + aria-label
    // （roving 表不加 tabIndex=0，避免双停靠点破坏 roving 停靠点，见第一批实测）。desktopOnly 类保留。
    const tw = await page.evaluate(() => {
      const grab = (label: string) => {
        const el = document.querySelector(`div[aria-label="${label}"]`);
        return el ? [el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('aria-label')] : null;
      };
      return {
        runtime: grab('运行时（可横向滚动）'),
        deps: grab('运行依赖（可横向滚动）'),
        links: grab('链接（可横向滚动）'),
      };
    });
    assert.deepEqual(tw.runtime, ['region', null, '运行时（可横向滚动）'], '运行时信息表 tableWrap 应为 role=region + aria-label');
    assert.deepEqual(tw.deps, ['region', null, '运行依赖（可横向滚动）'], '依赖表 tableWrap 应为 role=region + aria-label');
    assert.deepEqual(tw.links, ['region', null, '链接（可横向滚动）'], '链接表 tableWrap 应为 role=region + aria-label');

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/**
 * SyncSection（115 同步管理）探针。
 *
 * 与前面「首屏就有行」的页面不同：这里是 `enabled: mountId.trim().length > 0`，
 * 初始只有「请输入挂载 ID 以载入同步概览。」，**一个 data-row-index 都没有**。
 * 所以 readySelector 必须等那个提示消失后的可见标志，不能等默认的行选择器。
 *
 * 这恰好是 roving 初始化最容易翻车的一种形态：tbody 是在**用户输入之后**才挂载的，
 * 与 ca0e215 修的「query 早退后晚挂载」同源（ref 变了没通知），当时靠
 * rowCount 从 0→N 巧合恢复；这里用真输入框驱动，验证用户视角下的真实路径。
 */
const SYNC_SECTION_ENTRY = `
import { createElement } from '${NM_REACT}';
import { createRoot } from '${NM_REACT_DOM_CLIENT}';
import { QueryClient, QueryClientProvider } from '${NM_RQ}';
import { SyncSection } from 'file:///COMPONENT_PATH_PLACEHOLDER';

// fixture 必须是后端原始 snake_case（RawSyncSource / RawSyncTask）——
// httpClient 直接把 JSON 交给 fromSyncSource/fromSyncTask，喂 camelCase 会全 undefined。
const sources = [0, 1, 2].map((i) => ({
  source_id: 's-' + i,
  share_item_id: 'sh-' + i,
  display_name: '来源 ' + i,
  source_kind: 'share',
  status: i === 1 ? 'error' : 'ok',
  root_node_id: 'n-' + i,
  last_error_message: i === 1 ? '拉取失败' : null,
  updated_at: '2026-01-01T00:00:00Z',
}));

const recentTasks = [0, 1].map((i) => ({
  id: 't-' + i,
  source_id: 's-0',
  share_item_id: 'sh-0',
  display_name: '任务 ' + i,
  task_kind: 'full_index',
  request_reason: 'manual',
  status: 'done',
  attempt_count: 1,
  max_attempts: 3,
  last_error_message: null,
  requested_at: '2026-01-01T00:00:00Z',
}));

globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('/api/manage/pan115/sync/mounts/')) {
    return new Response(
      JSON.stringify({
        mount_id: 'm-1',
        provider_type: 'pan115',
        sources,
        checkpoints: [],
        recent_tasks: recentTasks,
        supported_actions: [],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }
  return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')).render(
  createElement(QueryClientProvider, { client: qc }, createElement(SyncSection, null)),
);
`;

test('接线实证（真实 SyncSection）：输入挂载 ID 后两张只读表各自独立漫游（补测批次 B 2/N）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-syncsec-',
    SYNC_SECTION_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/pan115-share/components/SyncSection.tsx'),
    // 初始零行 ⇒ 等「请输入挂载 ID」这个立即可见的提示，而不是行。
    'text=请输入挂载 ID 以载入同步概览。',
  );
  if (!h) return;
  try {
    const { page } = h;

    // ★先钉死「未输入时没有任何停靠点」，否则后面的断言可能被初始 DOM 蒙混过关。
    assert.deepEqual(
      await page.evaluate(() =>
        Array.from(document.querySelectorAll('tbody tr[tabindex]')).map((r) => r.getAttribute('tabindex')),
      ),
      [],
      '未输入挂载 ID 时不应有任何 roving 停靠点（表还没渲染）',
    );

    // 真实用户路径：往真输入框打字，query 才 enabled。
    await page.locator('input[aria-label="挂载 ID"]').fill('m-1');
    await page.waitForSelector('[data-row-index="0"]', { timeout: 20000 });

    assert.equal(
      await page.evaluate(() => document.querySelectorAll('tbody').length),
      2,
      '同步来源 / 最近任务两张表应有各自 tbody（索引域独立）',
    );

    // 来源表 3 行：唯一停靠点。
    assert.deepEqual(await rovingStopsIn(page, 0), ['0'], '同步来源表首行应是唯一 Tab 停靠点');
    // 真实连续 Tab 步数：1→挂载 ID 输入框，2→.tableWrap 滚动容器
    // （裁决②要求保留 tabIndex=0 + role="region"），3→行停靠点。
    // 多一跳如实写死在这里，而不是写 maxTabIndex 上界把差异藏掉。
    assert.equal(await countTabPressesToRow(page, 0), 3, '真实 Tab 步数应为 输入框→滚动容器→行停靠点');
    assert.equal(await focusedRowIn(page, 0), 0, '同步来源表起始活动行应为 index 0');

    // 方向键漫游。
    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRowIn(page, 0), 1, '↓ 移到下一行');
    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRowIn(page, 0), 2, '↓ 移到末行');
    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRowIn(page, 0), 2, '末行再按 ↓ 不应越界回绕');
    await page.keyboard.press('End');
    assert.equal(await focusedRowIn(page, 0), 2, 'End → 末行');

    // 只读表：Enter 不应触发任何行操作（两张表都不传 onActivate）。
    await page.keyboard.press('Enter');
    assert.deepEqual(h.errors, [], '只读表按 Enter 不得抛错');

    // ★跨表：来源表停在末行（index 2），Tab 必须进到最近任务表的**活动行**，
    // 而不是「另一张表的第一行」——独立索引域的核心断言。
    assert.deepEqual(await rovingStopsIn(page, 1), ['0'], '最近任务表首行应是唯一 Tab 停靠点');
    assert.equal(await focusedRowIn(page, 0), 2, '来源表仍停在末行');
    const steps = await tabIntoRow(page, 1);
    assert.equal(steps, 0, '按一次 Tab 应从来源表活动行进入最近任务表活动行');
    assert.equal(await focusedRowIn(page, 1), 0, '进入最近任务表后应落在其活动行 index 0');

    // ★Shift+Tab 回去要跨过最近任务表自己的 .tableWrap 滚动容器：
    // DOM 顺序是 [表0wrap → 表0行 → 表1wrap → 表1行]，所以从表1行倒着走一步
    // 先回到**表1自己的** region，再一步才回到表0行。
    // 这两跳如实写死，不写上界把 region 的存在藏掉。
    await page.keyboard.press('Shift+Tab');
    assert.equal(
      await focusedRowIn(page, 0),
      null,
      '倒走一步应落在最近任务表自己的滚动容器（region），而非表0行',
    );
    await page.keyboard.press('Shift+Tab');
    assert.equal(
      await focusedRowIn(page, 0),
      2,
      '再倒走一步应回到来源表当前活动行 index 2（不是硬编码首行）',
    );

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/**
 * PreviewBrowseSection（预览凭据浏览）探针。
 *
 * 表由 useMutation 驱动：填完预览凭据 ID 点「浏览目录」提交表单才会有 tbody。
 * 初始 DOM 零 tbody，故 readySelector 用表单里立即可见的输入框，而不是行。
 */
const PREVIEW_BROWSE_ENTRY = `
import { createElement } from '${NM_REACT}';
import { createRoot } from '${NM_REACT_DOM_CLIENT}';
import { QueryClient, QueryClientProvider } from '${NM_RQ}';
import { PreviewBrowseSection } from 'file:///COMPONENT_PATH_PLACEHOLDER';

// fixture 用后端原始 snake_case（RawShareBrowseCommonResponse /
// RawShareBrowseEntry）—— fromShareBrowseResponse 直接读 JSON 原字段。
const entries = [0, 1, 2, 3].map((i) => ({
  name: '目录/文件 ' + i,
  path: '/dir/file-' + i,
  cid: 'c-' + i,
  is_dir: i % 2 === 0,
  size: i === 1 ? null : 1024 * i,
}));

globalThis.fetch = async (url, init) => {
  const u = String(url);
  const method = String(init?.method ?? 'GET').toUpperCase();
  if (method === 'POST' && u.includes('/api/manage/pan115/previews/')) {
    return new Response(
      JSON.stringify({
        current_path: '/dir',
        parent_path: '/',
        current_cid: 'c',
        total: entries.length,
        offset: 0,
        limit: 100,
        has_more: false,
        entries,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }
  return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')).render(
  createElement(QueryClientProvider, { client: qc }, createElement(PreviewBrowseSection, null)),
);
`;

test('接线实证（真实 PreviewBrowseSection）：提交表单后只读目录表独立漫游（补测批次 B 3/N）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-prevbrowse-',
    PREVIEW_BROWSE_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/pan115-share/components/PreviewBrowseSection.tsx'),
    'input[aria-label="预览凭据 ID"]',
  );
  if (!h) return;
  try {
    const { page } = h;

    // 提交前：连 tbody 都没有，不该有任何停靠点。
    assert.equal(
      await page.evaluate(() => document.querySelectorAll('tbody').length),
      0,
      '提交前不应渲染任何 tbody（mutation 未跑）',
    );

    // 真实用户路径：填 ID → 点提交按钮（disabled 初态靠 previewId 非空解锁）。
    await page.locator('input[aria-label="预览凭据 ID"]').fill('pv-1');
    await clickButtonByText(page, '浏览目录');
    await page.waitForSelector('[data-row-index="0"]', { timeout: 20000 });

    assert.equal(
      await page.evaluate(() => document.querySelectorAll('tbody').length),
      1,
      '浏览结果应渲染单张目录表',
    );

    assert.deepEqual(await rovingStopsIn(page, 0), ['0'], '目录表首行应是唯一 Tab 停靠点');
    // 真实连续 Tab 步数：1→previewId 输入框，2→path 输入框，3→提交按钮，
    // 4→.tableWrap(region)，5→行停靠点。
    assert.equal(
      await countTabPressesToRow(page, 0),
      5,
      '真实 Tab 步数应为 两个输入框→按钮→滚动容器→行停靠点',
    );
    assert.equal(await focusedRowIn(page, 0), 0, '目录表起始活动行应为 index 0');

    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRowIn(page, 0), 1, '↓ 移到下一行');
    await page.keyboard.press('End');
    assert.equal(await focusedRowIn(page, 0), 3, 'End → 末行');
    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRowIn(page, 0), 3, '末行再按 ↓ 不应越界回绕');
    await page.keyboard.press('Home');
    assert.equal(await focusedRowIn(page, 0), 0, 'Home → 首行');

    // 只读清单（行内无控件、不传 onActivate）：Enter 不应触发行操作。
    await page.keyboard.press('Enter');
    assert.deepEqual(h.errors, [], '只读表按 Enter 不得抛错');

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/**
 * ShareItemBrowseSection（匿名分享浏览）探针。
 *
 * 它不自己画表，而是委托给文件内的 BrowseResultTable（与 PreviewBrowseSection
 * 的内联表是**两套独立接线**，都要各自覆盖）。BrowseResultTable 还有一个
 * 别的表没有的分支：`data.entries.length === 0` 时 early return，tbody 根本不挂载。
 */
const SHARE_ITEM_BROWSE_ENTRY = `
import { createElement } from '${NM_REACT}';
import { createRoot } from '${NM_REACT_DOM_CLIENT}';
import { QueryClient, QueryClientProvider } from '${NM_RQ}';
import { ShareItemBrowseSection } from 'file:///COMPONENT_PATH_PLACEHOLDER';

const entries = [0, 1, 2].map((i) => ({
  name: '条目 ' + i,
  path: '/p/' + i,
  cid: 'c-' + i,
  is_dir: i === 0,
  size: i === 0 ? null : 2048,
}));

function body(over) {
  return {
    current_path: '/p',
    parent_path: '/',
    current_cid: 'c',
    total: entries.length,
    offset: 0,
    limit: 100,
    has_more: false,
    entries,
    ...over,
  };
}

globalThis.fetch = async (url, init) => {
  const u = String(url);
  const method = String(init?.method ?? 'GET').toUpperCase();
  if (method === 'POST' && u.includes('/api/manage/pan115/share-items/browse')) {
    // 提取码 empty ⇒ 走「该目录/分享下没有可列出的条目。」early return 分支。
    // ★wire 上是 snake_case（实测 body 为 {"share_code":...}），不是 camelCase。
    const text = String(init?.body ?? '');
    const empty = text.includes('"receive_code":"empty"');
    return new Response(
      JSON.stringify(body(empty ? { entries: [], total: 0 } : {})),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }
  return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')).render(
  createElement(QueryClientProvider, { client: qc }, createElement(ShareItemBrowseSection, null)),
);
`;

test('接线实证（真实 ShareItemBrowseSection / BrowseResultTable）：匿名分享表漫游 + 空结果早退（补测批次 B 4/N）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-sharebrowse-',
    SHARE_ITEM_BROWSE_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/pan115-share/components/ShareItemBrowseSection.tsx'),
    'input[aria-label="115 分享码"]',
  );
  if (!h) return;
  try {
    const { page } = h;
    assert.equal(
      await page.evaluate(() => document.querySelectorAll('tbody').length),
      0,
      '提交前不应渲染任何 tbody',
    );

    // —— 有数据分支 ——
    await page.locator('input[aria-label="115 分享码"]').fill('code-1');
    await clickButtonByText(page, '浏览分享');
    await page.waitForSelector('[data-row-index="0"]', { timeout: 20000 });

    assert.deepEqual(await rovingStopsIn(page, 0), ['0'], '浏览结果表首行应是唯一 Tab 停靠点');
    // 真实连续 Tab 步数：1→分享码，2→提取码，3→提交按钮，4→滚动容器，5→行。
    assert.equal(
      await countTabPressesToRow(page, 0),
      5,
      '真实 Tab 步数应为 两个输入框→按钮→滚动容器→行停靠点',
    );

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRowIn(page, 0), 2, '↓↓ 移到末行');
    await page.keyboard.press('End');
    assert.equal(await focusedRowIn(page, 0), 2, 'End → 末行');
    await page.keyboard.press('Home');
    assert.equal(await focusedRowIn(page, 0), 0, 'Home → 首行');
    await page.keyboard.press('Enter');
    assert.deepEqual(h.errors, [], '只读表按 Enter 不得抛错');

    // —— 空结果 early return 分支 ——
    // BrowseResultTable 在 entries.length === 0 时提前 return，tbody 整个不挂载。
    // 此时残留的 tabindex 必须一并消失，不能留下指向已卸载行的幽灵停靠点。
    await page.locator('input[aria-label="115 提取码"]').fill('empty');
    await clickButtonByText(page, '浏览分享');
    await page.waitForSelector('text=该目录/分享下没有可列出的条目。', { timeout: 20000 });
    assert.equal(
      await page.evaluate(() => document.querySelectorAll('tbody tr[tabindex]').length),
      0,
      '空结果早退后不得残留任何 roving 停靠点',
    );

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/**
 * AuthProvidersSection（提供方配置）探针。
 *
 * 本表行内是**原生 checkbox**（启用/登录/绑定/找回密码），是「行停靠点 + 行内控件
 * 各自独立 Tab 可达」这一形态的代表：roving 停靠点必须只有一个，但 checkbox 不能被
 * 吞进 roving 里，也必须保持原生 Tab 顺序。
 */
const AUTH_PROVIDERS_ENTRY = `
import { createElement } from '${NM_REACT}';
import { createRoot } from '${NM_REACT_DOM_CLIENT}';
import { QueryClient, QueryClientProvider } from '${NM_RQ}';
import { AuthProvidersSection } from 'file:///COMPONENT_PATH_PLACEHOLDER';

const mk = (provider, name) => ({
  provider,
  display_name: name,
  enabled: provider === 'discord',
  configured: true,
  allow_login: true,
  allow_binding: false,
  allow_password_reset: false,
  public_config: {},
  secret_fields_configured: ['client_secret'],
  updated_at: '2026-01-01T00:00:00Z',
});

globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes('/api/manage/auth-providers') && String(init?.method ?? 'GET') === 'GET') {
    return new Response(
      JSON.stringify({ items: [mk('discord', 'Discord'), mk('github', 'GitHub')] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }
  return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')).render(
  createElement(QueryClientProvider, { client: qc }, createElement(AuthProvidersSection, null)),
);
`;

/**
 * ManageRuntimeLogsPage 探针：覆盖运行日志表。
 *
 * 形态：行内有「查看详情」按钮（原生 Tab 可达）⇒ 不传 onActivate。
 * 注意：该组件把 useTableRowRoving 放在 isPending/isError 两个 early return
 * **之后**（ManageRuntimeLogsPage.tsx:124，early return 在 89/99 行），
 * 属条件调用；本例以真实 pending→loaded 迁移验证其可观察后果。
 */
const RUNTIME_LOGS_ENTRY = `
import { createElement } from '${NM_REACT}';
import { createRoot } from '${NM_REACT_DOM_CLIENT}';
import { QueryClient, QueryClientProvider } from '${NM_RQ}';
import { ManageRuntimeLogsPage } from 'file:///COMPONENT_PATH_PLACEHOLDER';

const RAW_LOGS = [
  {
    id: 'log-1',
    timestamp: '2026-01-01T00:00:00Z',
    level: 'info',
    target: 'fmby::manage',
    message: '启动完成',
    request_id: 'req-1',
    source_file: 'app.log',
    raw_line: 'line-1',
  },
  {
    id: 'log-2',
    timestamp: '2026-01-01T00:01:00Z',
    level: 'error',
    target: 'fmby::scan',
    message: '扫描失败',
    request_id: null,
    source_file: 'app.log',
    raw_line: 'line-2',
  },
];

globalThis.fetch = async (url) => {
  const u = String(url);
  const body = u.includes('/api/manage/runtime-logs')
    ? {
        items: RAW_LOGS,
        total: 2,
        truncated: false,
        log_dir: '/var/log/fmby',
        available_targets: ['fmby::manage'],
      }
    : u.includes('/api/manage/runtime-log-archives')
    ? {
        items: [
          {
            id: 'arc-1',
            file_name: 'app-2026-01-01.log.gz',
            log_date: '2026-01-01',
            compressed_size_bytes: 1024,
            original_size_bytes: 4096,
            compression_ratio: 4,
            created_at: '2026-01-01T00:00:00Z',
            expires_at: '2026-02-01T00:00:00Z',
          },
          {
            id: 'arc-2',
            file_name: 'app-2025-12-31.log.gz',
            log_date: '2025-12-31',
            compressed_size_bytes: 512,
            original_size_bytes: 2048,
            compression_ratio: 4,
            created_at: '2025-12-31T00:00:00Z',
            expires_at: '2026-01-31T00:00:00Z',
          },
        ],
        total: 2,
        log_dir: '/var/log/fmby',
        retention_days: 30,
      }
    : {};
  return new Response(JSON.stringify(body), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')).render(
  createElement(QueryClientProvider, { client: qc }, createElement(ManageRuntimeLogsPage, null)),
);
`;

/**
 * ProviderSearchPanel 探针：候选表（有行内「选用」按钮 ⇒ 不传 onActivate）。
 *
 * 形态要点：searchQuery 用 enabled 门控（关键词非空才发），所以候选表是
 * **输入后晚挂载** 的——tbodyRef 首次 commit 时为 null，但 rowCount 也是 0，
 * 随输入变为 N。本例据此验证真实 late-mount + 独立 roving 域。
 *
 * ⚠ 本卡既有结论：动态 rowCount 让 effect 巧合重跑，因此本例**不**承担
 * useTableRowRoving 的 attachedTbody 晚挂载回归职责（那由 ManageSystemAboutPage
 * 的静态 rowCount + pending early return 实证承担）。
 */
const MEDIA_REVIEW_SEARCH_ENTRY = `
import { createElement } from '${NM_REACT}';
import { createRoot } from '${NM_REACT_DOM_CLIENT}';
import { QueryClient, QueryClientProvider } from '${NM_RQ}';
import { ProviderSearchPanel } from 'file:///COMPONENT_PATH_PLACEHOLDER';

const CANDIDATES = [
  { provider: 'tmdb', entityType: 'movie', providerItemId: 'tt-1',
    title: '沙丘', originalTitle: 'Dune', year: 2021, overview: null,
    confidence: 0.9, externalId: null },
  { provider: 'tmdb', entityType: 'movie', providerItemId: 'tt-2',
    title: '沙丘2', originalTitle: 'Dune: Part Two', year: 2024, overview: null,
    confidence: 0.8, externalId: null },
];

globalThis.fetch = async (url) => {
  const u = String(url);
  const body = u.includes('/api/manage/media-reviews/provider-search')
    ? { provider: 'tmdb', query: 'dune', candidates: CANDIDATES }
    : {};
  return new Response(JSON.stringify(body), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')).render(
  createElement(QueryClientProvider, { client: qc },
    createElement(ProviderSearchPanel, { onPick: () => {} })),
);
`;

test('接线实证（真实 ProviderSearchPanel）：输入后晚挂载的候选表只有一个 Tab 停靠点（补测批次 C 4/N）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-mreview-',
    MEDIA_REVIEW_SEARCH_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/media-reviews/components.tsx'),
    // 查询被 enabled 门控，候选表要输入关键词才挂载 ⇒ 初始 DOM 里没有任何
    // data-row-index。改等「一直可见的输入框」，表格就绪由测试自己
    // fill + waitForSelector 把握。
    'input[placeholder="输入标题后搜索候选"]',
  );
  if (!h) return;
  try {
    const { page } = h;

    // enabled 门控：未输入关键词时无 tbody（候选表尚未挂载）。
    assert.equal(await page.evaluate(() => document.querySelectorAll('tbody').length), 0,
      '关键词为空时查询未发出，候选表不应存在');

    // 真实输入触发查询 → 候选表挂载。
    const input = page.locator('input[placeholder="输入标题后搜索候选"]');
    await input.fill('dune');
    await page.waitForSelector('tbody tr[data-row-index="0"]', { timeout: 20000 });

    assert.equal(await page.evaluate(() => document.querySelectorAll('tbody').length), 1,
      '候选表应恰好一个 tbody');

    assert.deepEqual(await rovingStopsIn(page, 0), ['0'], '候选表首行应是唯一 Tab 停靠点');

    // 真实 Tab 起步：provider select → 关键词输入框 → 行停靠点，共 3 跳。
    // 实测 2 跳：provider select → 关键词输入框 → 候选行停靠点。
    // fill 后焦点已在输入框内，故从输入框算起只需 1 次 Tab 到行；
    // 从 select 起算则共 2 跳（select 本身是第 1 个停靠点）。
    assert.equal(await countTabPressesToRow(page, 0), 2, '真实 Tab 2 跳到达候选行停靠点');
    assert.equal(await focusedRowIn(page, 0), 0, 'Tab 进入后活动行应为 index 0');

    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRowIn(page, 0), 1, '↓ 移到 index 1');
    await page.keyboard.press('End');
    assert.equal(await focusedRowIn(page, 0), 1, 'End 应停在末行（只有 2 行）');
    await page.keyboard.press('Home');
    assert.equal(await focusedRowIn(page, 0), 0, 'Home 回到首行');
    assert.deepEqual(await rovingStopsIn(page, 0), ['0'], '停靠点须跟着焦点走');

    // 行内「选用」按钮保持原生 Tab：不因 roving 变成 tabIndex=-1。
    assert.equal(await countTabPressesToRow(page, 0), 2, '行停靠点步数不受行内按钮影响');
    const pick = page.locator('tbody').nth(0).locator('tr[data-row-index="0"] button');
    assert.equal(await pick.count(), 1, '行内应有一个「选用」按钮');
    assert.equal((await pick.textContent())?.trim(), '选用', '行内按钮文案应为选用');
    assert.equal(await pick.evaluate((b: any) => b.getAttribute('tabindex')), null,
      '行内按钮不得被 roving 改写 tabindex（保持原生 Tab 行为）');

    // tableWrap 滚动区 a11y（第十批）：候选媒体表 tableWrap 补 role=region + aria-label（roving 表无 tabIndex）。
    const candTw = await page.evaluate(() => {
      const el = document.querySelector('div[aria-label="候选媒体（可横向滚动）"]');
      return el ? [el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('aria-label')] : null;
    });
    assert.deepEqual(candTw, ['region', null, '候选媒体（可横向滚动）'], '候选媒体表 tableWrap 应为 role=region + aria-label');

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

test('接线实证（真实 ManageRuntimeLogsPage）：行停靠点唯一 + 行内详情按钮保持原生 Tab（补测批次 C 3/N）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-rtlogs-',
    RUNTIME_LOGS_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/ManageRuntimeLogsPage.tsx'),
    'table',
  );
  if (!h) return;
  try {
    const { page } = h;
    await page.waitForSelector('tbody tr[data-row-index="0"]', { timeout: 20000 });

    // 两张表：日志表 + RuntimeLogArchivesSection 的归档表（独立组件、独立 roving 域）。
    // ⚠ 实测为 2 个 tbody —— 移动端卡片不是 table，归档表才是第二个。
    assert.equal(await page.evaluate(() => document.querySelectorAll('tbody').length), 2,
      '日志表 + 归档表应各有一个 tbody（索引域独立）');

    assert.deepEqual(await rovingStopsIn(page, 0), ['0'], '日志表首行应是唯一 Tab 停靠点');

    // ⚠ 必须按 tbody 限定：两表都有 data-row-index="0" 行，不限定会命中归档表行。
    const btn = page.locator('tbody').nth(0).locator('tr[data-row-index="0"] button');
    assert.equal(await btn.count(), 1, '行内应有一个「查看详情」按钮');
    assert.equal((await btn.textContent())?.trim(), '查看详情', '行内按钮文案应为查看详情');

    // 实测路径（13 跳，不是 1）：刷新按钮 → 4 个筛选 select（级别/条数/类别/方式）
    // → 6 个文本输入（路径/客户端/IP/用户/请求 ID/关键字）→ 清空筛选按钮 → 日志行。
    // 如实写死实测值；若日后精简筛选控件，此断言会失败并提示同步更新。
    assert.equal(await countTabPressesToRow(page, 0), 13, '真实 Tab 13 跳到达日志行停靠点');
    assert.equal(await focusedRowIn(page, 0), 0, 'Tab 进入后活动行应为 index 0');

    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRowIn(page, 0), 1, '↓ 移到 index 1');

    // 从活动行再按一次 Tab：应落到**同一行**内的原生按钮（roving 不吞行内控件）。
    await page.keyboard.press('Tab');
    const landedInRow0 = await page.evaluate(() => {
      const a = document.activeElement as HTMLElement | null;
      return { row: a?.closest('tr')?.getAttribute('data-row-index') ?? null, tag: a?.tagName ?? null };
    });
    assert.deepEqual(landedInRow0, { row: '1', tag: 'BUTTON' }, '活动行内 Tab 应落在本行按钮上');

    // roving 活动行不因焦点进入行内按钮而改变：用停靠点读数判定，而非 focusedRowIn
    // ——后者只在焦点**落在行元素本身**时返回 index，焦点在按钮上时本就该返回 null。
    assert.deepEqual(await rovingStopsIn(page, 0), ['1'], '焦点在行内按钮时停靠点仍停在 index 1');

    // ── 归档表（独立组件 RuntimeLogArchivesSection，独立 roving 域）
    // .tableScroll 是 role=region + tabIndex=0 的滚动容器 ⇒ 比日志表多一跳停靠点。
    assert.deepEqual(await rovingStopsIn(page, 1), ['0'], '归档表首行应是唯一 Tab 停靠点');
    // 实测 19 跳：日志表 13 跳到行 → 该行「查看详情」按钮 → 下一行 → 其按钮 → …（4 个
    // 行内按钮共 4 跳）→ 归档表 role=region 容器（tabIndex=0，再 1 跳）→ 归档行。
    // 即归档表比日志表多 6 跳；tabIntoRow 默认 maxPresses=15 不够，须显式放宽。
    assert.equal(await tabIntoRow(page, 1, 40), 0, '连按 Tab 应能走到归档表活动行');
    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRowIn(page, 1), 1, '归档表 ↓ → 第 2 行');
    await page.keyboard.press('Home');
    assert.equal(await focusedRowIn(page, 1), 0, '归档表 Home → 首行');
    assert.equal(await focusedRowIn(page, 0), null, '焦点须在归档表，不得串到日志表');

    // tableWrap 滚动区 a11y（第十三批）：运行日志 tableWrap 补 role=region + aria-label（roving 表无 tabIndex）。
    const rlTw = await page.evaluate(() => {
      const el = document.querySelector('div[aria-label="运行日志（可横向滚动）"]');
      return el ? [el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('aria-label')] : null;
    });
    assert.deepEqual(rlTw, ['region', null, '运行日志（可横向滚动）'], '运行日志 tableWrap 应为 role=region + aria-label');

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

test('接线实证（真实 AuthProvidersSection）：行停靠点唯一 + 行内 checkbox 保持原生 Tab 可达（补测批次 C 1/N）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-authprov-',
    AUTH_PROVIDERS_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/auth-providers/AuthProvidersSection.tsx'),
    'table',
  );
  if (!h) return;
  try {
    const { page } = h;

    // 行停靠点唯一 —— 这条断言直接压在 roving 接线缺失上：
    // 没有任何 useTableRowRoving 时所有 <tr> 都没有 tabindex，[] !== ['0']。
    assert.deepEqual(await rovingStopsIn(page, 0), ['0'], '提供方配置表首行应是唯一 Tab 停靠点');

    // 行内原生 checkbox 必须独立 Tab 可达，且不被 roving 吞掉。
    const box = page.locator('input[type="checkbox"][aria-label="启用 Discord"]');
    assert.equal(await box.count(), 1, '行内 checkbox 应存在');

    // ★先真实 Tab 进来再谈活动行：roving 只设置 tabindex，并不主动 focus()，
    //   所以「唯一停靠点」与「当前焦点在行上」是两件事，必须按真实顺序断言。
    assert.equal(await countTabPressesToRow(page, 0), 1, '真实 Tab 应一次到达行停靠点');
    assert.equal(await focusedRowIn(page, 0), 0, 'Tab 进入后活动行应为 index 0');

    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRowIn(page, 0), 1, '↓ 移到下一行');
    await page.keyboard.press('ArrowUp');
    assert.equal(await focusedRowIn(page, 0), 0, '↑ 回到上一行');

    // 从活动行走真实 Tab：应停在**同一行**的 checkbox（行停靠点之后紧邻行内控件）。
    const before = await page.evaluate(() => {
      const el = document.activeElement;
      const tr = el?.closest?.('tr');
      return { tr: !!tr, idx: tr?.getAttribute('data-row-index') ?? null, role: el?.getAttribute('type') ?? null };
    });
    assert.equal(before.tr, true, '按 Tab 前焦点应在行上');
    await page.keyboard.press('Tab');
    const after = await page.evaluate(() => {
      const el = document.activeElement;
      const tr = el?.closest?.('tr');
      return {
        tr: !!tr,
        idx: tr?.getAttribute('data-row-index') ?? null,
        type: el?.getAttribute('type') ?? null,
        label: el?.getAttribute('aria-label') ?? null,
      };
    });
    assert.equal(after.type, 'checkbox', '按一次 Tab 应落在原生 checkbox 上，而非另一行停靠点');
    assert.equal(after.idx, before.idx, 'checkbox 应属于同一行（不跳到下一行）');

    // checkbox 原生 Space 切换，roving 不应插手。
    await page.keyboard.press('Space');
    assert.equal(await box.isChecked(), false, 'Space 应切换 checkbox 原生状态');

    // tableWrap 滚动区 a11y（第九批）：认证提供方表 tableWrap 补 role=region + aria-label（roving 表无 tabIndex）。
    const apTw = await page.evaluate(() => {
      const el = document.querySelector('div[aria-label="提供方配置（可横向滚动）"]');
      return el ? [el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('aria-label')] : null;
    });
    assert.deepEqual(apTw, ['region', null, '提供方配置（可横向滚动）'], '认证提供方表 tableWrap 应为 role=region + aria-label');

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/**
 * UpstreamSourceListSection 探针：一次覆盖该文件两张表。
 *
 * 两张表形态不同，构成一组对照：
 *   - 源列表（查询驱动）：行内有启停/编辑/删除按钮，走原生 Tab；
 *   - 局域网发现结果（mutation 驱动）：行内纯只读，tbody 直到点「局域网发现」
 *     成功才挂载。
 *
 * ⚠ 本例**不**覆盖 useTableRowRoving 的 attachedTbody 生命周期修复：两张表的
 *   rowCount 都从 0 变到 N，effect 会顺带重跑，属「巧合恢复」。判据③须回退接线。
 *   attachedTbody 修复的专属实证在 ManageSystemAboutPage 的静态表（rowCount 恒定）。
 */
const UPSTREAM_SOURCE_LIST_ENTRY = `
import { createElement } from '${NM_REACT}';
import { createRoot } from '${NM_REACT_DOM_CLIENT}';
import { QueryClient, QueryClientProvider } from '${NM_RQ}';
import { UpstreamSourceListSection } from 'file:///COMPONENT_PATH_PLACEHOLDER';

const src = (id, name, status) => ({
  id, name,
  source_type: 'AppleCms',
  source_type_label: 'Apple CMS',
  base_url: 'http://' + id + '.local:8096',
  auth_method: 'password',
  status,
  username: null,
  user_agent: null,
  referer: null,
  extra_headers: {},
  has_secret: false,
  last_health_check_at: null,
  last_sync_at: null,
  last_error_at: null,
  last_error_message: null,
  created_by: null,
  created_at: 0,
  updated_at: 0,
});

globalThis.fetch = async (url, init) => {
  const u = String(url);
  const method = String(init?.method ?? 'GET').toUpperCase();
  if (u.includes('/api/manage/upstreams') && method === 'GET') {
    return new Response(
      JSON.stringify({ items: [src('s-1', '主库', 'ready'), src('s-2', '备用库', 'disabled')], total: 2 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }
  return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')).render(
  createElement(
    QueryClientProvider,
    { client: qc },
    createElement(UpstreamSourceListSection, { sourceType: '' }),
  ),
);
`;

test('接线实证（真实 UpstreamSourceListSection）：查询表独立 roving 域 + 真实 Tab 步数（补测批次 C 2/N；sec/remove-emby-upstream 后原 LAN 发现表已删）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-upsrc-',
    UPSTREAM_SOURCE_LIST_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/upstreams/UpstreamSourceListSection.tsx'),
    'table',
  );
  if (!h) return;
  try {
    const { page } = h;

    // ── 源列表（查询驱动：rowCount 0 → 2）
    assert.equal(await page.evaluate(() => document.querySelectorAll('tbody').length), 1,
      'sec/remove-emby-upstream 后本页只有源列表一张表');

    // ⚠ 索引解析辅助：按首格文本定位 tbody（单表形态下主要用于可读性）。
    const tbodyIndexOf = async (needle: string): Promise<number> => {
      const idx = await page.evaluate((n: string) => {
        return Array.from(document.querySelectorAll('tbody')).findIndex(
          (tb) => (tb.querySelector('tr td')?.textContent ?? '').includes(n),
        );
      }, needle);
      assert.notEqual(idx, -1, `应能找到首格含「${needle}」的表`);
      return idx;
    };

    const srcIdx0 = await tbodyIndexOf('主库');
    assert.deepEqual(await rovingStopsIn(page, srcIdx0), ['0'], '源列表首行应是唯一 Tab 停靠点');

    // ★按**实测**路径断言步数，不写死猜测值：真实 Tab 顺序是
    //   新建上游源按钮 → 类型 select → 行停靠点，实测 3 跳（原「局域网发现」按钮
    //   已删，少一跳但表单结构留有额外停靠位）。
    const path = await tabPathToRow(page, srcIdx0);
    assert.deepEqual(
      path.map((p) => p.text),
      ['新建上游源', '全部类型Apple CMSWebDAV', '主库Apple CMShttp://s-1.lo'],
      '源列表前的真实 Tab 路径应是新建按钮 + 类型 select',
    );
    assert.equal(path.at(-1)?.presses, 3, '真实 Tab 应 3 次到达源列表停靠点');
    assert.equal(await countTabPressesToRow(page, srcIdx0), 3, '实测步数应稳定可复现');
    assert.equal(await focusedRowIn(page, srcIdx0), 0, 'Tab 进入后活动行应为 index 0');

    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRowIn(page, srcIdx0), 1, '↓ 移到源列表 index 1');
    const stopsBefore = await rovingStopsIn(page, srcIdx0);
    assert.deepEqual(stopsBefore, ['1'], '源列表停靠点此时应在 index 1');

    // tableWrap 滚动区 a11y（第四批）：本区 2 处 tableWrap 补 role=region + aria-label（roving 表无 tabIndex）。
    const slTw = await page.evaluate(() => {
      const grab = (label: string) => {
        const el = document.querySelector(`div[aria-label="${label}"]`);
        return el ? [el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('aria-label')] : null;
      };
      return {
        sources: grab('上游源列表（可横向滚动）'),
      };
    });
    assert.deepEqual(slTw.sources, ['region', null, '上游源列表（可横向滚动）'], '上游源列表 tableWrap 应为 role=region + aria-label');

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});
;

/* ------------------------------------------------------------------ */
/* 补测批次 D 1/N：ManageCasPage —— 盘配置表（provider_type/drive_ref…） */
/* ------------------------------------------------------------------ */

/**
 * 本表形态：行内有 checkbox（纳入扇出）+ 数字输入（优先级）+ 「保存」按钮，
 * 三者都是原生 Tab 可达 ⇒ 组件刻意**不传** onActivate。
 * 因此「唯一 Tab 停靠点」是它唯一的 roving 入口，去掉接线必然转红。
 *
 * fixture 用**后端原始 snake_case**（RawCasDriveConfig）：httpClient 把 JSON 直接交给
 * mapCasDriveConfig，喂 camelCase 会让 providerType/driveRef 全 undefined 而渲染不出盘名。
 */
const CAS_DRIVES_ENTRY = `
import { createElement } from '${'${NM_REACT}'}';
import { createRoot } from '${'${NM_REACT_DOM_CLIENT}'}';
import { QueryClient, QueryClientProvider } from '${'${NM_RQ}'}';
import { ManageCasPage } from 'file:///COMPONENT_PATH_PLACEHOLDER';

const configs = [
  { provider_type: 'pan115', drive_ref: 'drive-a', enabled: true, priority: 1 },
  { provider_type: 'pan115', drive_ref: 'drive-b', enabled: false, priority: 2 },
  { provider_type: 'openlist', drive_ref: 'drive-c', enabled: true, priority: 3 },
];

globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('/api/admin/cas/drives')) {
    return new Response(JSON.stringify(configs), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')).render(
  createElement(QueryClientProvider, { client: qc }, createElement(ManageCasPage, null)),
);
`;

test('接线实证（真实 ManageCasPage）：盘配置表表头语义 + 3 行 + 唯一停靠点 + 行内控件原生 Tab', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-casdrives-',
    CAS_DRIVES_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/ManageCasPage.tsx'),
  );
  if (!h) return;
  try {
    const { page } = h;
    await page.waitForSelector('tbody tr[data-row-index="0"]', { timeout: 20000 });

    // ① 表头语义（不是「渲染不炸」）。
    const heads = await page.evaluate(() =>
      Array.from(document.querySelectorAll('thead th')).map((th) => th.textContent?.trim() ?? ''),
    );
    assert.deepEqual(heads, ['盘', '纳入扇出', '优先级', ''], '盘配置表表头应为 盘/纳入扇出/优先级/操作');

    // ② 行数 = fixture 条数。
    const rows = await page.evaluate(() => document.querySelectorAll('tbody tr[data-row-index]').length);
    assert.equal(rows, 3, '应渲染 3 行（与 fixture 一致）');

    // ③ roving 唯一停靠点 —— 「无接线」时所有 <tr> 没有 tabindex ⇒ [] !== ['0']。
    assert.deepEqual(await rovingStopsIn(page, 0), ['0'], '盘配置表首行应是唯一 Tab 停靠点');

    // ④ 真实键盘：Tab 进入 + 方向键漫游。
    const presses = await countTabPressesToRow(page, 0);
    assert.ok(presses >= 1, `真实 Tab 必须能进入（实测 ${presses} 次）`);
    assert.equal(await focusedRowIn(page, 0), 0, 'Tab 落在首个停靠行');
    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRowIn(page, 0), 1, 'ArrowDown → 第 1 行');
    await page.keyboard.press('End');
    assert.equal(await focusedRowIn(page, 0), 2, 'End → 末行（3 行）');
    assert.deepEqual(await rovingStopsIn(page, 0), ['2'], '停靠点须跟着焦点走');

    // ⑤ 行内控件保持原生 Tab（roving 不得改写它们的 tabindex）。
    const box = page.locator('tbody tr[data-row-index="0"] input[type="checkbox"]');
    assert.equal(await box.count(), 1, '行内应有一个「纳入扇出」checkbox');
    assert.equal(
      await box.evaluate((b: any) => b.getAttribute('tabindex')),
      null,
      '行内 checkbox 不得被 roving 改写 tabindex',
    );

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/* ------------------------------------------------------------------ */
/* 补测批次 D 2/N：UpstreamMappingWizardSection —— 映射预览结果表      */
/* ------------------------------------------------------------------ */

/**
 * 表在 PreviewResultCard 里，由 previewMutation（POST .../mapping/preview）结果驱动，
 * 初始无行 ⇒ 必须点真按钮「生成预览」触发。presetsQuery（GET .../mapping/presets）
 * 挂载即发，mock 一并打桩。纯只读结果清单（行内 StatusBadge 非可聚焦）⇒ 不传 onActivate。
 */
const UPSTREAM_WIZARD_ENTRY = `
import { createElement } from '${'${NM_REACT}'}';
import { createRoot } from '${'${NM_REACT_DOM_CLIENT}'}';
import { QueryClient, QueryClientProvider } from '${'${NM_RQ}'}';
import { UpstreamMappingWizardSection } from 'file:///COMPONENT_PATH_PLACEHOLDER';

const json = (v) =>
  new Response(JSON.stringify(v), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const preview = {
  source_id: 'src-1',
  items: [
    { category_id: 'c1', upstream_category_id: 'u1', category_name: '电影', selected: true, action: 'bind_existing', library_id: 'lib1', library_name: '电影库', create_key: null, create_library_name: null, create_library_type: null, skip_reason: null, conflict_message: null },
    { category_id: 'c2', upstream_category_id: 'u2', category_name: '剧集', selected: true, action: 'create_library', library_id: null, library_name: null, create_key: 'k2', create_library_name: '剧集库', create_library_type: 'Series', skip_reason: null, conflict_message: null },
    { category_id: 'c3', upstream_category_id: 'u3', category_name: '综艺', selected: true, action: 'skip', library_id: null, library_name: null, create_key: null, create_library_name: null, create_library_type: null, skip_reason: '已被排除', conflict_message: null },
  ],
  creates: [],
  bind_count: 1,
  create_count: 1,
  skip_count: 1,
  conflict_count: 0,
};

globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('/mapping/presets')) {
    return json({ items: [], total: 0 });
  }
  if (u.includes('/mapping/preview')) {
    return json(preview);
  }
  return json({});
};

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')).render(
  createElement(QueryClientProvider, { client: qc },
    createElement(UpstreamMappingWizardSection, { sourceId: 'src-1' })),
);
`;

test('接线实证（真实 UpstreamMappingWizardSection）：真按钮触发后预览结果表独立漫游（补测批次 D 2/N）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-wizard-',
    UPSTREAM_WIZARD_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/upstreams/UpstreamMappingWizardSection.tsx'),
    // 初始无行（表要跑完 previewMutation 才有行），先等真按钮出现证明组件挂上。
    'button:has-text("生成预览")',
  );
  if (!h) return;
  try {
    const { page } = h;
    // 初始无行 ⇒ 无停靠点（确认表确实是 previewMutation 驱动的）。
    assert.deepEqual(await rovingStopsIn(page, 0), [], '未生成预览前不应有停靠点');

    await clickButtonByText(page, '生成预览');
    await page.waitForSelector('tbody tr[data-row-index="0"]', { timeout: 20000 });

    // ① 表头语义。
    const heads = await page.evaluate(() =>
      Array.from(document.querySelectorAll('thead th')).map((th) => th.textContent?.trim() ?? ''),
    );
    assert.deepEqual(heads, ['类目', '动作', '目标库', '说明'], '预览结果表表头应为 类目/动作/目标库/说明');

    // ② 行数 = fixture 条数。
    const rows = await page.evaluate(() => document.querySelectorAll('tbody tr[data-row-index]').length);
    assert.equal(rows, 3, '应渲染 3 行（与 fixture 一致）');

    // ③ roving 唯一停靠点 —— 「无接线」时所有 <tr> 没有 tabindex ⇒ [] !== ['0']。
    assert.deepEqual(await rovingStopsIn(page, 0), ['0'], '预览结果表首行应是唯一 Tab 停靠点');

    // ④ 真实键盘：Tab 进入 + 方向键漫游。
    const presses = await countTabPressesToRow(page, 0);
    assert.ok(presses >= 1, `真实 Tab 必须能进入（实测 ${presses} 次）`);
    assert.equal(await focusedRowIn(page, 0), 0, 'Tab 落在首个停靠行');
    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRowIn(page, 0), 1, 'ArrowDown → 第 1 行');
    await page.keyboard.press('End');
    assert.equal(await focusedRowIn(page, 0), 2, 'End → 末行（3 行）');
    assert.deepEqual(await rovingStopsIn(page, 0), ['2'], '停靠点须跟着焦点走');

    // tableWrap 滚动区 a11y（第十二批）：映射预览结果表 tableWrap 补 role=region + aria-label（roving 表无 tabIndex）。
    const previewTw = await page.evaluate(() => {
      const el = document.querySelector('div[aria-label="预览结果（可横向滚动）"]');
      return el ? [el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('aria-label')] : null;
    });
    assert.deepEqual(previewTw, ['region', null, '预览结果（可横向滚动）'], '映射预览结果表 tableWrap 应为 role=region + aria-label');

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/* ------------------------------------------------------------------ */
/* 补测批次 D 3/N：UpstreamBindingsSection —— 类目与绑定表            */
/* ------------------------------------------------------------------ */

/**
 * 类目表由 categoriesQuery（GET .../apple-cms/categories）驱动，挂载即有行。
 * 行内有「绑定到」<select>（原生 Tab 可达）⇒ 不传 onActivate。
 * 另有 librariesQuery（GET /api/manage/libraries）喂下拉选项，一并打桩。
 */
const UPSTREAM_BINDINGS_ENTRY = `
import { createElement } from '${'${NM_REACT}'}';
import { createRoot } from '${'${NM_REACT_DOM_CLIENT}'}';
import { QueryClient, QueryClientProvider } from '${'${NM_RQ}'}';
import { UpstreamBindingsSection } from 'file:///COMPONENT_PATH_PLACEHOLDER';

const json = (v) =>
  new Response(JSON.stringify(v), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const categories = {
  items: [
    { id: 'c1', source_id: 'src-1', upstream_category_id: 'u1', parent_upstream_category_id: null, name: '电影', kind: 'category', library_id: 'lib1', library_name: '电影库', discovered_at: 1700000000000, updated_at: 1700000000000 },
    { id: 'c2', source_id: 'src-1', upstream_category_id: 'u2', parent_upstream_category_id: null, name: '剧集', kind: 'category', library_id: null, library_name: null, discovered_at: 1700000000000, updated_at: 1700000000000 },
    { id: 'c3', source_id: 'src-1', upstream_category_id: 'u3', parent_upstream_category_id: null, name: '综艺', kind: 'category', library_id: null, library_name: null, discovered_at: 1700000000000, updated_at: 1700000000000 },
  ],
  total: 3,
};

const libraries = {
  items: [
    { id: 'lib1', name: '电影库', kind: 'Movie', type_label: '电影', item_count: 0, total_items: 0, status: 'active', updated_at: '2026-01-01T00:00:00Z', sources: [] },
    { id: 'lib2', name: '剧集库', kind: 'Series', type_label: '剧集', item_count: 0, total_items: 0, status: 'active', updated_at: '2026-01-01T00:00:00Z', sources: [] },
  ],
};

globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('/apple-cms/categories')) {
    return json(categories);
  }
  if (u.includes('/api/manage/libraries')) {
    return json(libraries);
  }
  return json({ items: [] });
};

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')).render(
  createElement(QueryClientProvider, { client: qc },
    createElement(UpstreamBindingsSection, { sourceId: 'src-1' })),
);
`;

test('接线实证（真实 UpstreamBindingsSection）：类目表头语义 + 3 行 + 唯一停靠点 + 行内 select 原生 Tab（补测批次 D 3/N）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-bindings-',
    UPSTREAM_BINDINGS_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/upstreams/UpstreamBindingsSection.tsx'),
  );
  if (!h) return;
  try {
    const { page } = h;
    await page.waitForSelector('tbody tr[data-row-index="0"]', { timeout: 20000 });

    // ① 表头语义。
    const heads = await page.evaluate(() =>
      Array.from(document.querySelectorAll('thead th')).map((th) => th.textContent?.trim() ?? ''),
    );
    assert.deepEqual(heads, ['名称', '上游 ID', '当前绑定', '绑定到', '发现时间'], '类目表表头应为 名称/上游 ID/当前绑定/绑定到/发现时间');

    // ② 行数 = fixture 条数。
    const rows = await page.evaluate(() => document.querySelectorAll('tbody tr[data-row-index]').length);
    assert.equal(rows, 3, '应渲染 3 行（与 fixture 一致）');

    // ③ roving 唯一停靠点 —— 「无接线」时所有 <tr> 没有 tabindex ⇒ [] !== ['0']。
    assert.deepEqual(await rovingStopsIn(page, 0), ['0'], '类目表首行应是唯一 Tab 停靠点');

    // ④ 真实键盘：Tab 进入 + 方向键漫游。
    const presses = await countTabPressesToRow(page, 0);
    assert.ok(presses >= 1, `真实 Tab 必须能进入（实测 ${presses} 次）`);
    assert.equal(await focusedRowIn(page, 0), 0, 'Tab 落在首个停靠行');
    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRowIn(page, 0), 1, 'ArrowDown → 第 1 行');
    await page.keyboard.press('End');
    assert.equal(await focusedRowIn(page, 0), 2, 'End → 末行（3 行）');
    assert.deepEqual(await rovingStopsIn(page, 0), ['2'], '停靠点须跟着焦点走');

    // ⑤ 行内「绑定到」select 保持原生 Tab（roving 不得改写它的 tabindex）。
    const sel = page.locator('tbody tr[data-row-index="0"] select');
    assert.equal(await sel.count(), 1, '行内应有一个「绑定到」select');
    assert.equal(
      await sel.evaluate((s: any) => s.getAttribute('tabindex')),
      null,
      '行内 select 不得被 roving 改写 tabindex',
    );

    // tableWrap 滚动区 a11y（第四批）：已发现类目表 tableWrap 补 role=region + aria-label（roving 表无 tabIndex）。
    const bdTw = await page.evaluate(() => {
      const el = document.querySelector('div[aria-label="类目与绑定（可横向滚动）"]');
      return el ? [el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('aria-label')] : null;
    });
    assert.deepEqual(bdTw, ['region', null, '类目与绑定（可横向滚动）'], '已发现类目表 tableWrap 应为 role=region + aria-label');
    // 注：类目绑定表（行276，bindingsQuery 有数据才渲染）本场景未渲染（该源暂无绑定 empty 态）；
    // 其 tableWrap aria-label 已随实现补齐，待 bindingsQuery 有数据场景再断言。

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/* ------------------------------------------------------------------ */
/* 补测批次 D 4/N：OperationsGapSections —— 数据源负载表 + 活跃播放表 */
/* ------------------------------------------------------------------ */

/**
 * 两张只读统计表，各自由 mountLoad / activePlayback 两个 useQuery 驱动，挂载即有行。
 * useOperationsRealtime(WS) 在测试环境连不上 ⇒ fail-closed 回落 REST 数据
 * （WS 连接失败是网络事件，不触发 pageerror，探针不得抛错断言不受影响）。
 * 两张表各自独立 roving 域 ⇒ 一并断言。
 */
const OPS_GAP_ENTRY = `
import { createElement } from '${'${NM_REACT}'}';
import { createRoot } from '${'${NM_REACT_DOM_CLIENT}'}';
import { QueryClient, QueryClientProvider } from '${'${NM_RQ}'}';
import { OperationsGapSections } from 'file:///COMPONENT_PATH_PLACEHOLDER';

const json = (v) =>
  new Response(JSON.stringify(v), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

// 打桩 WebSocket：测试环境无 WS 服务，真实连接会触发 console error
//（net::ERR_NAME_NOT_RESOLVED）污染「探针不得抛错」。留一个永不触发 handler 的桩
// ⇒ hook 停在 connecting、不回连，effective* 回落 REST 数据（正是要测的 fail-closed 路径）。
globalThis.WebSocket = class {
  constructor(url) { this.url = url; }
  close() {}
};

const mountLoad = {
  sampled_at: '2026-01-01T00:00:00Z',
  cache_status: 'hit',
  items: [
    { source_id: 's1', source_name: '115 网盘', provider_type: 'pan115', mount_id: 'm1', active_session_count: 2, playing_count: 1, paused_count: 1, media_source_count: 5, last_heartbeat_at: '2026-01-01T00:00:00Z', load_level: 'normal', advice: null, requests_total: 100, success_total: 98, errors_total: 2, rejected_total: 0, rate_limited_total: 0, last_hold_ms: 10 },
    { source_id: 's2', source_name: 'Emby', provider_type: 'emby', mount_id: 'm2', active_session_count: 3, playing_count: 2, paused_count: 1, media_source_count: 8, last_heartbeat_at: '2026-01-01T00:00:00Z', load_level: 'warning', advice: '建议扩容', requests_total: null, success_total: null, errors_total: null, rejected_total: null, rate_limited_total: null, last_hold_ms: null },
    { source_id: 's3', source_name: 'OpenList', provider_type: 'openlist', mount_id: 'm3', active_session_count: 0, playing_count: 0, paused_count: 0, media_source_count: 0, last_heartbeat_at: '2026-01-01T00:00:00Z', load_level: 'critical', advice: null, requests_total: 50, success_total: 50, errors_total: 0, rejected_total: 0, rate_limited_total: 5, last_hold_ms: 0 },
  ],
};

const activePlayback = {
  sampled_at: '2026-01-01T00:00:00Z',
  cache_status: 'hit',
  limit: 50,
  total_returned: 2,
  sessions: [
    { session_id: 'sess1', device_session_id: null, remote_control_available: false, supported_commands: [], client_connection_status: null, last_command_status: null, client: { device_name: null, client_name: null, device_os: null, client_version: null }, client_info: null, user: { user_id: 'u1', username: 'alice', display_name: null }, item: { item_id: 'i1', title: '电影A', media_type: 'Movie', series_title: null }, source: { media_source_id: 'ms1', source_name: '115 网盘', provider_type: 'pan115', mount_id: 'm1' }, status: 'playing', play_method: null, position_ticks: null, duration_ticks: null, progress_percent: 42, started_at: '2026-01-01T00:00:00Z', last_heartbeat_at: '2026-01-01T00:00:00Z' },
    { session_id: 'sess2', device_session_id: null, remote_control_available: false, supported_commands: [], client_connection_status: null, last_command_status: null, client: { device_name: null, client_name: null, device_os: null, client_version: null }, client_info: null, user: { user_id: 'u2', username: 'bob', display_name: null }, item: { item_id: 'i2', title: '剧集B', media_type: 'Series', series_title: null }, source: { media_source_id: 'ms2', source_name: 'Emby', provider_type: 'emby', mount_id: 'm2' }, status: 'paused', play_method: null, position_ticks: null, duration_ticks: null, progress_percent: null, started_at: '2026-01-01T00:00:00Z', last_heartbeat_at: '2026-01-01T00:00:00Z' },
  ],
};

globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('/data-sources/load')) {
    return json(mountLoad);
  }
  if (u.includes('/playback/active')) {
    return json(activePlayback);
  }
  return json({ items: [], sessions: [] });
};

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')).render(
  createElement(QueryClientProvider, { client: qc },
    createElement(OperationsGapSections, null)),
);
`;

test('接线实证（真实 OperationsGapSections）：负载表 + 播放表各自独立漫游（补测批次 D 4/N）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-opsgap-',
    OPS_GAP_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/operations/OperationsGapSections.tsx'),
  );
  if (!h) return;
  try {
    const { page } = h;
    await page.waitForSelector('tbody tr[data-row-index="0"]', { timeout: 20000 });

    // ① 两张表各自独立 roving 域（首行都是唯一停靠点）。
    assert.deepEqual(await rovingStopsIn(page, 0), ['0'], '数据源负载表首行应是唯一 Tab 停靠点');
    assert.deepEqual(await rovingStopsIn(page, 1), ['0'], '活跃播放表首行应是独立域的停靠点');

    // ② 负载表头语义 + 行数。
    const loadHeads = await page.evaluate(() =>
      Array.from(document.querySelectorAll('table')[0].querySelectorAll('thead th'))
        .map((th) => th.textContent?.trim() ?? ''),
    );
    assert.deepEqual(
      loadHeads,
      ['数据源', '类型', '活跃', '播放中', '暂停', '等级', '请求', '成功', '错误', '限流'],
      '数据源负载表表头应为 数据源/类型/活跃/播放中/暂停/等级/请求/成功/错误/限流',
    );
    const loadRows = await page.evaluate(
      () => document.querySelectorAll('table')[0].querySelectorAll('tbody tr[data-row-index]').length,
    );
    assert.equal(loadRows, 3, '负载表应渲染 3 行（与 fixture 一致）');

    // ③ 负载表真实键盘：Tab 进入 + 方向键漫游。
    const presses = await countTabPressesToRow(page, 0);
    assert.ok(presses >= 1, `真实 Tab 必须能进入（实测 ${presses} 次）`);
    assert.equal(await focusedRowIn(page, 0), 0, 'Tab 落在负载表首个停靠行');
    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRowIn(page, 0), 1, 'ArrowDown → 负载表第 1 行');
    await page.keyboard.press('End');
    assert.equal(await focusedRowIn(page, 0), 2, 'End → 负载表末行（3 行）');
    assert.deepEqual(await rovingStopsIn(page, 0), ['2'], '停靠点须跟着焦点走');

    // tableWrap 滚动区 a11y（第五批）：负载表 + 播放表 tableWrap 补 role=region + aria-label（roving 表无 tabIndex）。
    const ogTw = await page.evaluate(() => {
      const grab = (label: string) => {
        const el = document.querySelector(`div[aria-label="${label}"]`);
        return el ? [el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('aria-label')] : null;
      };
      return {
        load: grab('数据源负载（可横向滚动）'),
        play: grab('播放记录（可横向滚动）'),
      };
    });
    assert.deepEqual(ogTw.load, ['region', null, '数据源负载（可横向滚动）'], '负载表 tableWrap 应为 role=region + aria-label');
    assert.deepEqual(ogTw.play, ['region', null, '播放记录（可横向滚动）'], '播放表 tableWrap 应为 role=region + aria-label');

    assert.deepEqual(h.errors, [], '探针不得抛错（WS 回落 REST 不应产生 pageerror）');
  } finally {
    await h.close();
  }
});

/* ------------------------------------------------------------------ */
/* 补测批次 D 5/N：ManageEventsPage —— 主事件表 + 嵌套时间线/审计表    */
/* ------------------------------------------------------------------ */

/**
 * 主事件表由 listQuery（GET /api/manage/events）驱动，挂载即有行；行内有「详情」按钮
 * （原生 Tab 可达）⇒ 不传 onActivate。点「详情」置 expandedId ⇒ detailQuery
 * （GET /api/manage/events/{requestId}）触发，EventDetailPanel 内渲染**嵌套**的
 * 「时间线」「审计记录」两张只读表。三表各自独立 roving 域（A 方案：父子各从 0 起）。
 */
const MANAGE_EVENTS_ENTRY = `
import { createElement } from '${'${NM_REACT}'}';
import { createRoot } from '${'${NM_REACT_DOM_CLIENT}'}';
import { QueryClient, QueryClientProvider } from '${'${NM_RQ}'}';
import { ManageEventsPage } from 'file:///COMPONENT_PATH_PLACEHOLDER';

const json = (v) =>
  new Response(JSON.stringify(v), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const list = {
  events: [
    { id: 'e1', kind: 'Identify', timestamp: 1700000000000, severity: 'info', title: '识别完成', module: 'identify', summary: '识别了 3 个条目', requestId: 'req-1' },
    { id: 'e2', kind: 'Scrape', timestamp: 1700000001000, severity: 'warning', title: '刮削告警', module: 'scrape', summary: '部分元数据缺失', requestId: 'req-2' },
    { id: 'e3', kind: 'Auth', timestamp: 1700000002000, severity: 'critical', title: '登录失败', module: 'auth', summary: '凭据过期', requestId: 'req-3' },
  ],
  total: 3, page: 1, pageSize: 100, runtimeSourceAvailable: false,
};

const detail = {
  requestId: 'req-1',
  timeline: [
    { step: 1, label: '接收请求', status: 'success', timestamp: 1700000000000, detail: null },
    { step: 2, label: '识别', status: 'success', timestamp: 1700000000500, detail: '命中缓存' },
    { step: 3, label: '完成', status: 'success', timestamp: 1700000001000, detail: null },
  ],
  result: 'ok', errorCode: null, diagnosis: null,
  auditRecords: [
    { timestamp: 1700000000000, actor: 'admin', action: 'identify.run', target: 'library:1', result: 'success', traceId: 'trace-1', fields: [] },
    { timestamp: 1700000001000, actor: 'admin', action: 'identify.commit', target: 'item:3', result: 'success', traceId: 'trace-1', fields: [] },
  ],
  runtimeRecords: [], runtimeSourceAvailable: false,
};

globalThis.fetch = async (url) => {
  const u = String(url);
  if (/\\/api\\/manage\\/events\\/[^?]/.test(u)) {
    return json(detail);
  }
  if (u.includes('/api/manage/events')) {
    return json(list);
  }
  return json({ events: [], total: 0 });
};

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')).render(
  createElement(QueryClientProvider, { client: qc },
    createElement(ManageEventsPage, null)),
);
`;

test('接线实证（真实 ManageEventsPage）：主事件表 + 嵌套时间线/审计表各自独立漫游（补测批次 D 5/N）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-events-',
    MANAGE_EVENTS_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/ManageEventsPage.tsx'),
  );
  if (!h) return;
  try {
    const { page } = h;
    await page.waitForSelector('tbody tr[data-row-index="0"]', { timeout: 20000 });

    // ① 主事件表（域 0）：表头语义 + 行数。
    const heads = await page.evaluate(() =>
      Array.from(document.querySelectorAll('table')[0].querySelectorAll('thead th'))
        .map((th) => th.textContent?.trim() ?? ''),
    );
    assert.deepEqual(heads, ['时间', '严重级', '种类', '模块', '标题', '摘要', '操作'], '主事件表表头应为 时间/严重级/种类/模块/标题/摘要/操作');
    assert.equal(
      await page.evaluate(() => document.querySelectorAll('table')[0].querySelectorAll('tbody tr[data-row-index]').length),
      3,
      '主事件表应渲染 3 行（与 fixture 一致）',
    );

    // ② 主事件表 roving 唯一停靠点 + 真实键盘漫游。
    assert.deepEqual(await rovingStopsIn(page, 0), ['0'], '主事件表首行应是唯一 Tab 停靠点');
    const presses = await countTabPressesToRow(page, 0);
    assert.ok(presses >= 1, `真实 Tab 必须能进入（实测 ${presses} 次）`);
    assert.equal(await focusedRowIn(page, 0), 0, 'Tab 落在主事件表首个停靠行');
    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRowIn(page, 0), 1, 'ArrowDown → 主事件表第 1 行');

    // ③ 行内「详情」按钮保持原生 Tab（roving 不得改写它的 tabindex）。
    const btn = page.locator('tbody tr[data-row-index="0"] button:has-text("详情")');
    assert.equal(await btn.count(), 1, '行内应有一个「详情」按钮');
    assert.equal(await btn.evaluate((b: any) => b.getAttribute('tabindex')), null, '行内「详情」按钮不得被 roving 改写 tabindex');

    // ④ 点「详情」⇒ detailQuery 触发 ⇒ EventDetailPanel 渲染嵌套的时间线/审计表。
    // treegrid 校验：展开前主表 role=treegrid，首行 aria-level=1，aria-expanded=false
    assert.equal(
      await page.evaluate(() => document.querySelectorAll('table')[0].getAttribute('role')),
      'treegrid',
      '主事件表 role 应为 treegrid',
    );
    assert.equal(
      await page.evaluate(() => document.querySelectorAll('tbody tr[data-row-index="0"]')[0].getAttribute('aria-level')),
      '1',
      '主事件表第 0 行 aria-level 应为 1',
    );
    assert.equal(
      await page.evaluate(() => document.querySelectorAll('tbody tr[data-row-index="0"]')[0].getAttribute('aria-expanded')),
      'false',
      '展开前主事件表第 0 行 aria-expanded 应为 false',
    );

    await btn.click();
    await page.waitForFunction(() => document.querySelectorAll('tbody').length >= 3, null, { timeout: 20000 });

    const btnAfter = page.locator('tbody tr[data-row-index="0"] button:has-text("收起")');
    // 展开后主表第 0 行 aria-expanded=true，详情按钮 aria-expanded=true
    assert.equal(
      await page.evaluate(() => document.querySelectorAll('tbody tr[data-row-index="0"]')[0].getAttribute('aria-expanded')),
      'true',
      '展开后主事件表第 0 行 aria-expanded 应为 true',
    );
    assert.equal(
      await btnAfter.evaluate((b: any) => b.getAttribute('aria-expanded')),
      'true',
      '展开后按钮 aria-expanded 应为 true',
    );

    // ⑤ 三表各自独立 roving 域（域 0 主表、域 1 时间线、域 2 审计）。
    assert.deepEqual(await rovingStopsIn(page, 1), ['0'], '嵌套时间线表应是独立域的首行停靠点');
    assert.deepEqual(await rovingStopsIn(page, 2), ['0'], '嵌套审计记录表应是独立域的首行停靠点');

    // ⑥ 嵌套时间线表头语义 + 行数。
    // 子表降级普通 table（去孤儿 treegrid），带可访问性 label
    assert.equal(
      await page.evaluate(() => document.querySelectorAll('table')[1].getAttribute('aria-label')),
      '事件处理时间线',
      '嵌套时间线表应有 aria-label',
    );
    assert.equal(
      await page.evaluate(() => document.querySelectorAll('table')[2].getAttribute('aria-label')),
      '事件审计记录',
      '嵌套审计记录表应有 aria-label',
    );
    const tlHeads = await page.evaluate(() =>
      Array.from(document.querySelectorAll('table')[1].querySelectorAll('thead th'))
        .map((th) => th.textContent?.trim() ?? ''),
    );
    assert.deepEqual(tlHeads, ['步', '标签', '状态', '时间', '详情'], '时间线表表头应为 步/标签/状态/时间/详情');
    assert.equal(
      await page.evaluate(() => document.querySelectorAll('table')[1].querySelectorAll('tbody tr[data-row-index]').length),
      3,
      '时间线表应渲染 3 行（与 fixture 一致）',
    );

    // tableWrap 滚动区 a11y（第十三批）：事件列表 tableWrap 补 role=region + aria-label（roving 表无 tabIndex）。
    const eventsTw = await page.evaluate(() => {
      const el = document.querySelector('div[aria-label="事件列表（可横向滚动）"]');
      return el ? [el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('aria-label')] : null;
    });
    assert.deepEqual(eventsTw, ['region', null, '事件列表（可横向滚动）'], '事件列表 tableWrap 应为 role=region + aria-label');

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

/* ------------------------------------------------------------------ */
/* 补测批次 D 6/N：ManageOperationsPage —— 概览多表各自独立漫游        */
/* ------------------------------------------------------------------ */

/**
 * 本页由单个 overviewQuery（GET /api/manage/operations/overview）驱动出 7 张只读统计表
 * （热播榜/活跃用户榜/媒体增长/用户注册/播放趋势/活跃快照/数据源负载，全 camelCase 直传），
 * 并内嵌 OperationsGapSections（另有 mountLoad/activePlayback 两查询 + WS 实时 hook）。
 * 全部只读 ⇒ 都不传 onActivate。本用例聚焦热播榜（tbody 0）为主域，并抽查其余域各自独立。
 */
const MANAGE_OPS_ENTRY = `
import { createElement } from '${'${NM_REACT}'}';
import { createRoot } from '${'${NM_REACT_DOM_CLIENT}'}';
import { QueryClient, QueryClientProvider } from '${'${NM_RQ}'}';
import { ManageOperationsPage } from 'file:///COMPONENT_PATH_PLACEHOLDER';

const json = (v) =>
  new Response(JSON.stringify(v), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

// 打桩 WebSocket：OperationsGapSections 的实时 hook 测试环境连不上会触发 console error。
globalThis.WebSocket = class {
  constructor(url) { this.url = url; }
  close() {}
};

const overview = {
  days: 7,
  windowStart: 1699900000000,
  now: 1700000000000,
  summary: { plays: 120, uniqueUsers: 30, totalMedia: 500, totalUsers: 80 },
  hotItems: [
    { itemId: 'i1', title: '电影A', mediaType: 'Movie', playCount: 40, uniqueUserCount: 20 },
    { itemId: 'i2', title: '剧集B', mediaType: 'Series', playCount: 30, uniqueUserCount: 15 },
    { itemId: 'i3', title: '综艺C', mediaType: 'Variety', playCount: 20, uniqueUserCount: 10 },
  ],
  activeUsers: [
    { userId: 'u1', username: 'alice', playCount: 15, latestPlayedAt: 1700000000000 },
    { userId: 'u2', username: 'bob', playCount: 10, latestPlayedAt: 1699999000000 },
  ],
  mediaTrend: [
    { date: '2026-01-01', added: 5, cumulative: 100 },
    { date: '2026-01-02', added: 3, cumulative: 103 },
  ],
  registrationTrend: [{ date: '2026-01-01', added: 2, cumulative: 50 }],
  playbackTrend: [{ date: '2026-01-01', playCount: 40, uniqueUserCount: 20 }],
  activeSnapshot: {
    activeSessionCount: 2,
    runningTasks: 1,
    sessions: [
      { sessionId: 's1', userId: 'u1', username: 'alice', itemId: 'i1', title: '电影A', paused: false, positionTicks: 1000, durationTicks: 2000, startedAt: 1700000000000, updatedAt: 1700000000000 },
      { sessionId: 's2', userId: 'u2', username: 'bob', itemId: 'i2', title: '剧集B', paused: true, positionTicks: null, durationTicks: null, startedAt: 1699999000000, updatedAt: 1699999000000 },
    ],
  },
  dataSourceLoad: [
    { mountId: 'm1', mountName: '115 网盘', providerType: 'pan115', activeSessionCount: 2, playingCount: 1, pausedCount: 1 },
    { mountId: 'm2', mountName: 'Emby', providerType: 'emby', activeSessionCount: 1, playingCount: 1, pausedCount: 0 },
  ],
};

const mountLoad = {
  sampled_at: '2026-01-01T00:00:00Z',
  cache_status: 'hit',
  items: [
    { source_id: 's1', source_name: '115 网盘', provider_type: 'pan115', mount_id: 'm1', active_session_count: 2, playing_count: 1, paused_count: 1, media_source_count: 5, last_heartbeat_at: '2026-01-01T00:00:00Z', load_level: 'normal', advice: null, requests_total: 100, success_total: 98, errors_total: 2, rejected_total: 0, rate_limited_total: 0, last_hold_ms: 10 },
  ],
};

const activePlayback = {
  sampled_at: '2026-01-01T00:00:00Z',
  cache_status: 'hit',
  limit: 50,
  total_returned: 1,
  sessions: [
    { session_id: 'sess1', device_session_id: null, remote_control_available: false, supported_commands: [], client_connection_status: null, last_command_status: null, client: { device_name: null, client_name: null, device_os: null, client_version: null }, client_info: null, user: { user_id: 'u1', username: 'alice', display_name: null }, item: { item_id: 'i1', title: '电影A', media_type: 'Movie', series_title: null }, source: { media_source_id: 'ms1', source_name: '115 网盘', provider_type: 'pan115', mount_id: 'm1' }, status: 'playing', play_method: null, position_ticks: null, duration_ticks: null, progress_percent: 42, started_at: '2026-01-01T00:00:00Z', last_heartbeat_at: '2026-01-01T00:00:00Z' },
  ],
};

globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('/operations/overview')) {
    return json(overview);
  }
  if (u.includes('/data-sources/load')) {
    return json(mountLoad);
  }
  if (u.includes('/playback/active')) {
    return json(activePlayback);
  }
  return json({});
};

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')).render(
  createElement(QueryClientProvider, { client: qc },
    createElement(ManageOperationsPage, null)),
);
`;

test('接线实证（真实 ManageOperationsPage）：概览多表各自独立漫游（补测批次 D 6/N）', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-ops-',
    MANAGE_OPS_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/ManageOperationsPage.tsx'),
  );
  if (!h) return;
  try {
    const { page } = h;
    await page.waitForSelector('tbody tr[data-row-index="0"]', { timeout: 20000 });

    // ① 热播榜（域 0）：表头语义 + 行数。
    const heads = await page.evaluate(() =>
      Array.from(document.querySelectorAll('table')[0].querySelectorAll('thead th'))
        .map((th) => th.textContent?.trim() ?? ''),
    );
    assert.deepEqual(heads, ['#', '标题', '类型', '播放次数', '活跃用户'], '热播榜表头应为 #/标题/类型/播放次数/活跃用户');
    assert.equal(
      await page.evaluate(() => document.querySelectorAll('table')[0].querySelectorAll('tbody tr[data-row-index]').length),
      3,
      '热播榜应渲染 3 行（与 fixture 一致）',
    );

    // ② 热播榜 roving 唯一停靠点 + 真实键盘漫游。
    assert.deepEqual(await rovingStopsIn(page, 0), ['0'], '热播榜首行应是唯一 Tab 停靠点');
    const presses = await countTabPressesToRow(page, 0);
    assert.ok(presses >= 1, `真实 Tab 必须能进入（实测 ${presses} 次）`);
    assert.equal(await focusedRowIn(page, 0), 0, 'Tab 落在热播榜首个停靠行');
    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedRowIn(page, 0), 1, 'ArrowDown → 热播榜第 1 行');
    await page.keyboard.press('End');
    assert.equal(await focusedRowIn(page, 0), 2, 'End → 热播榜末行（3 行）');
    assert.deepEqual(await rovingStopsIn(page, 0), ['2'], '停靠点须跟着焦点走');

    // ③ 概览区多表各自独立漫游域（域 1 活跃用户榜 / 域 6 数据源负载 各从 0 起）。
    const tbodyCount = await page.evaluate(() => document.querySelectorAll('tbody').length);
    assert.ok(tbodyCount >= 7, `概览区应至少 7 张表（实测 ${tbodyCount} 个 tbody）`);
    assert.deepEqual(await rovingStopsIn(page, 1), ['0'], '活跃用户榜应是独立域的首行停靠点');
    assert.deepEqual(await rovingStopsIn(page, 6), ['0'], '数据源负载表应是独立域的首行停靠点');

    // tableWrap 滚动区 a11y（第三批）：概览 5 处 tableWrap 补 role=region + aria-label
    // （roving 表不加 tabIndex=0，避免双停靠点破坏 roving 停靠点，见第一批实测）。
    const opsTw = await page.evaluate(() => {
      const grab = (label: string) => {
        const el = document.querySelector(`div[aria-label="${label}"]`);
        return el ? [el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('aria-label')] : null;
      };
      // TrendTable 的 aria-label 是模板串（title 由调用方给：媒体增长/用户注册/播放趋势）
      // ⇒ 不能按全等匹配，用「以（可横向滚动）结尾」抓第一张趋势表，并回读其真实 label。
      const grabTrend = () => {
        const el = document.querySelector('div[aria-label$="（可横向滚动）"][aria-label*="增长"]');
        return el ? [el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('aria-label')] : null;
      };
      return {
        content: grab('热播榜（可横向滚动）'),
        plays: grab('活跃用户榜（可横向滚动）'),
        tasks: grab('活跃快照（可横向滚动）'),
        // 命名对齐 ManageSectionCard title「数据源负载」的卡片——但 OperationsGapSections
        // 已占用同名「数据源负载」，同页两处同名会让读屏器无法区分 ⇒ 本表用「挂载负载」。
        mounts: grab('挂载负载（可横向滚动）'),
        trend: grabTrend(),
      };
    });
    assert.deepEqual(opsTw.content, ['region', null, '热播榜（可横向滚动）'], '热播榜 tableWrap 应为 role=region + aria-label');
    assert.deepEqual(opsTw.plays, ['region', null, '活跃用户榜（可横向滚动）'], '活跃用户榜 tableWrap 应为 role=region + aria-label');
    assert.deepEqual(opsTw.tasks, ['region', null, '活跃快照（可横向滚动）'], '活跃快照 tableWrap 应为 role=region + aria-label');
    assert.deepEqual(opsTw.mounts, ['region', null, '挂载负载（可横向滚动）'], '挂载负载 tableWrap 应为 role=region + aria-label');
    // 趋势表 label 由 props.title 决定 ⇒ 断言「真实值 + role + 无 tabindex」三件套。
    assert.equal(opsTw.trend?.[0], 'region', '趋势表 tableWrap 应为 role=region');
    assert.equal(opsTw.trend?.[1], null, '趋势表（roving）不得带 tabindex');
    assert.equal(opsTw.trend?.[2], '媒体增长（可横向滚动）', '趋势表 label 应取 props.title');

    assert.deepEqual(h.errors, [], '探针不得抛错（WS 回落 REST 不应产生 pageerror）');
  } finally {
    await h.close();
  }
});

/* ------------------------------------------------------------------ */
/* 嵌套表 treegrid ARIA：父子表 role=treegrid + 行 aria-level + aria-expanded */
/* ------------------------------------------------------------------ */

/**
 * 父子表 ARIA（rv01/rv02 评审返工后定稿）。
 *
 * ## 方案（rv02 Important-1 放行选项1 + Important-2）
 * - **父表**（合集表）role=treegrid，父数据行 aria-level=1 + aria-expanded（可展开父节点）。
 * - **子表**（成员表，嵌在父表展开行 <td> 内）**降级为普通 table**：去掉 role=treegrid 与
 *   aria-level，加 aria-label。理由：子表若标 treegrid + aria-level，会因「独立 treegrid 内
 *   无 level=1 祖先」成孤儿层级（r1 判据）。父子是「父表可展开树 + 子表数据明细表」的现实语义。
 *   父子层级由 **父行 aria-expanded** + **DOM 嵌套**（子表在父展开行 <td> 内）表达，spec 合规。
 * - **roving 独立（A 方案）不动**：用 data-row-index 漫游，与 role 无关（useTableRowRoving 不查 role）。
 * - **aria-expanded 同时落在行与展开按钮**上（Important-2 已修）：行覆盖 roving 行焦点、按钮覆盖
 *   Tab 按钮焦点，两种焦点都不丢展开态反馈。
 */
test('父子表 ARIA：父表 treegrid + 子表降级普通 table + 行/按钮 aria-expanded', async (t) => {
  const h = await mountPageProbe(
    t,
    'fe02-treegrid-',
    NESTED_ENTRY,
    join(HOST_ROOT, 'src/pages/manage/ManageCollectionsPage.tsx'),
  );
  if (!h) return;
  try {
    const { page } = h;
    await page.waitForSelector('tbody tr[data-row-index="0"]', { timeout: 20000 });

    // ① 折叠态：父表 role=treegrid；父数据行 aria-level=1 + aria-expanded=false。
    assert.equal(
      await page.evaluate(() => document.querySelectorAll('tbody')[0]?.closest('table')?.getAttribute('role')),
      'treegrid',
      '父合集表应为 role=treegrid',
    );
    const parentCollapsed = await page.evaluate(() => {
      const tr = document.querySelectorAll('tbody')[0]?.querySelector('tr[data-row-index="0"]');
      return { level: tr?.getAttribute('aria-level'), expanded: tr?.getAttribute('aria-expanded') };
    });
    assert.equal(parentCollapsed.level, '1', '父数据行 aria-level 应为 1');
    assert.equal(parentCollapsed.expanded, 'false', '折叠态父行 aria-expanded 应为 false');
    // ①b 展开按钮也带 aria-expanded（rv02 ②：照顾 Tab 聚焦按钮的用户）。
    // 用 button[aria-expanded] 精确选中「成员」按钮（行首 checkbox 也是 button，但不带 aria-expanded）。
    const btnCollapsed = await page.evaluate(() =>
      document.querySelector('tbody tr[data-row-index="0"] button[aria-expanded]')?.getAttribute('aria-expanded'),
    );
    assert.equal(btnCollapsed, 'false', '折叠态展开按钮 aria-expanded 应为 false');

    // ② 点「成员」展开 ⇒ 子表出现。
    await page.locator('tbody tr[data-row-index="0"] button', { hasText: '成员' }).first().click();
    await page.waitForFunction(
      () =>
        document.querySelectorAll('tbody').length === 2 &&
        (document.querySelectorAll('tbody')[1]?.querySelectorAll('[data-row-index]').length ?? 0) >= 1,
      undefined,
      { timeout: 20000 },
    );

    // ③ 子表**降级为普通 table**（rv02 Important-1 放行选项1）：**不是** treegrid、行**无** aria-level，
    // 但带 aria-label（让 AT 播报表名）。roving 独立（A 方案）仍生效（用 data-row-index，与 role 无关）。
    const childTable = await page.evaluate(() => {
      const el = document.querySelectorAll('tbody')[1]?.closest('table');
      return el ? { role: el.getAttribute('role'), label: el.getAttribute('aria-label') } : null;
    });
    assert.notEqual(childTable?.role, 'treegrid', '子成员表应降级为普通 table（非 treegrid，避免孤儿层级）');
    assert.ok(childTable?.label, '子成员表应带 aria-label（rv02 建议：普通 table + aria-label）');
    const childLevel = await page.evaluate(() =>
      document.querySelectorAll('tbody')[1]?.querySelector('tr[data-row-index="0"]')?.getAttribute('aria-level'),
    );
    assert.equal(childLevel, null, '子数据行不应带 aria-level（子表非 treegrid，无 per-tree level 语义）');
    // ③a 显式验证「父子嵌套」关系：子表 DOM 上是父表展开行 <td> 的后代（父 treegrid 的可展开行
    // 内含子数据表，而非两张并列平级表）—— 层级深度靠此结构嵌套 + 父行 aria-expanded 表达。
    const nestedInParent = await page.evaluate(() => {
      const child = document.querySelectorAll('tbody')[1]?.closest('table');
      const parent = document.querySelectorAll('tbody')[0]?.closest('table');
      return child != null && parent != null && parent.contains(child);
    });
    assert.equal(nestedInParent, true, '子表应物理嵌套在父表内（父可展开行内含子数据表，非并列平级表）');

    // ④ 展开态：父行 aria-expanded=true。
    const parentExpanded = await page.evaluate(() =>
      document.querySelectorAll('tbody')[0]?.querySelector('tr[data-row-index="0"]')?.getAttribute('aria-expanded'),
    );
    assert.equal(parentExpanded, 'true', '展开态父行 aria-expanded 应为 true');
    // ④b 展开按钮 aria-expanded 亦翻为 true。
    const btnExpanded = await page.evaluate(() =>
      document.querySelector('tbody tr[data-row-index="0"] button[aria-expanded]')?.getAttribute('aria-expanded'),
    );
    assert.equal(btnExpanded, 'true', '展开态展开按钮 aria-expanded 应为 true');

    // ⑤ tableWrap 滚动区 a11y（rv01 遗留 tableWrap scope 第一批）：父/子表的 tableWrap 均补
    // role=region + aria-label（**不加 tabIndex=0**——本表有 roving，行是唯一 Tab 停靠点；容器再加
    // tabIndex=0 会成双停靠点、让 Tab 先停到 tableWrap div 而破坏 roving 停靠点断言，实测回归）。
    // CSS 已证 .tableWrap 全是 overflow-x:auto 滚动容器 ⇒ 全补 role+aria-label；tabIndex=0 仅
    // 非 roving 只读表补（横向滚动区需键盘可达、无 roving 冲突）。aria-label 按表语义自拟（待审）。
    const wraps = await page.evaluate(() => {
      const list = document.querySelector('div[aria-label="合集列表（可横向滚动）"]');
      const member = document.querySelector('div[aria-label="合集成员明细（可横向滚动）"]');
      return {
        list: list ? [list.getAttribute('role'), list.getAttribute('tabindex'), list.getAttribute('aria-label')] : null,
        member: member ? [member.getAttribute('role'), member.getAttribute('tabindex'), member.getAttribute('aria-label')] : null,
      };
    });
    assert.deepEqual(wraps.list, ['region', null, '合集列表（可横向滚动）'], '合集列表 tableWrap 应为 role=region + aria-label（roving 表不加 tabIndex=0）');
    assert.deepEqual(wraps.member, ['region', null, '合集成员明细（可横向滚动）'], '合集成员明细 tableWrap 应为 role=region + aria-label（roving 表不加 tabIndex=0）');

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});
