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

function Table() {
  const tbodyRef = useRef(null);
  const [opened, setOpened] = useState(-1);
  useTableRowRoving({
    tbodyRef,
    rowCount: 4,
    onActivate: (i) => setOpened(i),
  });
  globalThis.__opened = () => opened;
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
  );
}

createRoot(document.getElementById('root')).render(createElement(Table));
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

test('契约③：行本身 tabindex=-1 ⇒ 不进 Tab 序，行内控件仍可 Tab 达', async (t) => {
  const h = await mount(t);
  if (!h) return;
  try {
    const { page } = h;
    await page.focus('[data-row-index="0"] button');
    await page.keyboard.press('ArrowDown');
    const rowTabindex = await page.evaluate(
      () => document.querySelector('[data-row-index="1"]')?.getAttribute('tabindex'),
    );
    assert.equal(rowTabindex, '-1', '行本身须 tabindex=-1（程序化可聚焦、不进 Tab 序）');
    const controlsNegative = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll('[data-row-index] button')).filter(
          (b) => b.getAttribute('tabindex') === '-1',
        ).length,
    );
    assert.equal(controlsNegative, 0, '行内控件不得被设 tabindex=-1（Tab 可达性零回归）');
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

test('接线实证（真实 LibraryTable）：↑↓ 在行间移动 + Enter 开详情', async (t) => {
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

    assert.deepEqual(h.errors, [], '探针不得抛错');
  } finally {
    await h.close();
  }
});

test('接线实证（真实 LibraryTable）：行内按钮 Tab 可达性未被破坏（无回归）', async (t) => {
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
async function mountPageProbe(t: any, tmpPrefix: string, entrySrc: string, compFile: string) {
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
        .replace('${YUN139_PATH}', `file://${compFile}`),
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
    await page.waitForSelector('[data-row-index="0"]', { timeout: 20000 });
  } catch {
    const body = (await page.textContent('body'))?.slice(0, 300) ?? '';
    throw new Error(`未渲染出行。页面文本：${body}｜pageerror：${errors.join(' | ')}`);
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
    // 只读表：行内无按钮，用行本身起步（hook 仍应响应方向键）
    // ★只读表行内**没有任何可聚焦控件**（无详情/编辑/删除按钮）。能起步完全
    // 依赖 hook 在挂载时给所有行设 tabindex="-1"（不进 Tab 序）。
    // 这里**不手动设 tabindex** —— 那会掩盖 hook 的 bug；只断言它已就位再聚焦。
    const tabindex0 = await page.evaluate(
      () => document.querySelector('[data-row-index="0"]')?.getAttribute('tabindex'),
    );
    assert.equal(tabindex0, '-1', 'hook 必须在挂载时给行设 tabindex=-1（只读表才能起步）');
    await page.focus('[data-row-index="0"]');
    assert.equal(await focusedRow(page), 0);
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
    // 依赖 hook 在挂载时给行设 tabindex=-1（上一提交 b80f508 的修复）
    assert.equal(
      await page.evaluate(
        () => document.querySelector('[data-row-index="0"]')?.getAttribute('tabindex'),
      ),
      '-1',
      'hook 必须在挂载时给只读表行设 tabindex=-1，否则漫游无从起步',
    );
    await page.focus('[data-row-index="0"]');
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
    assert.equal(
      await page.evaluate(
        () => document.querySelector('[data-row-index="0"]')?.getAttribute('tabindex'),
      ),
      '-1',
      'hook 必须在挂载时给行设 tabindex=-1',
    );
    await page.focus('[data-row-index="0"]');
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
    assert.equal(
      await page.evaluate(
        () => document.querySelector('[data-row-index="0"]')?.getAttribute('tabindex'),
      ),
      '-1',
      'hook 必须在挂载时给行设 tabindex=-1',
    );
    await page.focus('[data-row-index="0"]');
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
