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

/** 把 entry 模板里的 `${NM_*}` 占位符（模板字面量内已转义）替换成真实绝对路径。 */
function withNmPaths(src: string): string {
  return src
    .replace(/\$\{NM_REACT_DOM_CLIENT\}/g, NM_REACT_DOM_CLIENT)
    .replace(/\$\{NM_REACT_ROUTER\}/g, NM_REACT_ROUTER)
    .replace(/\$\{NM_REACT\}/g, NM_REACT);
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
