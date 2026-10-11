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
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HOST_ROOT = join(import.meta.dirname, '..');

/**
 * 探针：真实 `<table>` + 真实 `useTableRowRoving`（**不是重写一份逻辑**），
 * 复刻管理面行的真实结构：行内多个按钮（详情/编辑/删除）+ 一行无按钮
 * （对应「当前设备不可移除」这类行，历史上焦点会在这里掉到 <body>）。
 */
const PROBE_ENTRY = `
import { createElement, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
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
  const work = await mkdtemp(join(tmpdir(), 'fe02-table-'));
  const entryFile = join(HOST_ROOT, 'tests', '__probeTableKeynav-entry.tsx');
  const hookPath = `file://${join(HOST_ROOT, 'src/features/a11y/useTableRowRoving.ts')}`;
  await writeFile(entryFile, PROBE_ENTRY.replace('file:///PLACEHOLDER', hookPath.replace('file://', '')), 'utf8');
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
        outDir: work,
        emptyOutDir: true,
        minify: false,
        lib: { entry: entryFile, formats: ['iife'], name: 'TableKeynav', fileName: () => 'probe.js' },
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
