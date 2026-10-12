// fe02：管理面**真实页面**的可访问名扫描（DOM 级，非正则猜）。
//
// 为什么必须是 DOM 级：静态正则扫描 button 的可见文字会大量误报
//    —— 三元表达式 `{a ? '发起中…' : '发送验证码'}`、图标 + 文字混排、
//      多行 JSX 体，正则都取不到文字（实测首轮误报率 327/327 → 精化后仍 59 条
//      且抽查 5 条**全部是误报**）。
//    故改为渲染真实页面后按「可访问名」判定：
//      可访问名 = aria-label > aria-labelledby > 可见文本 > title
//    只有**四者皆空**才判为缺陷 —— 这是可证伪的口径。
//
// 跑法：node --import ./tests/register-aliases.mjs --test tests/manage-a11y-name-scan.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

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

/** 被测页面：真实组件 + 构造最小可用 props（不连后端）。 */
const PAGES: Array<{ name: string; file: string; entry: string }> = [
  {
    name: 'LibraryTable（管理面·媒体库表）',
    file: 'src/pages/manage/libraries/components/LibraryTable.tsx',
    entry: `
import { createElement } from '\${NM_REACT}';
import { createRoot } from '\${NM_REACT_DOM_CLIENT}';
import { MemoryRouter } from '\${NM_REACT_ROUTER}';
import { LibraryTable } from '{PATH}';
const libs = [0,1,2].map((i) => ({
  id: 'lib-'+i, name: '库 '+i, libraryType: 'movie', typeLabel: '电影',
  itemCount: i, status: 'healthy', sourceNames: [], actualSourceNames: [],
}));
function App() {
  return createElement(MemoryRouter, null, createElement(LibraryTable, {
    libraries: libs, filteredLibraries: libs, keyword: '', statusFilter: 'all',
    typeFilter: 'all', onKeywordChange: () => {}, onStatusFilterChange: () => {},
    onTypeFilterChange: () => {}, onOpenView: () => {}, onOpenEdit: () => {},
    onRequestDelete: () => {}, onCreateClick: () => {}, onMoveLibrary: () => {},
    reorderPending: false,
  }));
}
createRoot(document.getElementById('root')).render(createElement(App));
`,
  },  {
    name: 'UserTable（管理面·用户表）',
    file: 'src/pages/manage/users/components/UserTable.tsx',
    entry: `
import { createElement } from '\${NM_REACT}';
import { createRoot } from '\${NM_REACT_DOM_CLIENT}';
import { MemoryRouter } from '\${NM_REACT_ROUTER}';
import { UserTable } from '{PATH}';
const mkUser = (i) => ({
  id: 'u-'+i, username: 'user'+i, accountKind: 'human', roles: [], roleLabel: '普通用户',
  status: 'active', libraryScopes: [], sourceGrants: [], mustChangePassword: false,
});
const users = [0,1,2].map(mkUser);
function App() {
  return createElement(MemoryRouter, null, createElement(UserTable, {
    users, total: users.length, page: 1, pageSize: 20, totalPages: 1,
    isFetching: false, isPageTransitioning: false, currentUserId: 'u-0',
    keyword: '', statusFilter: 'all', accountKindFilter: 'all', selectedUserIds: [],
    onKeywordChange: () => {}, onStatusFilterChange: () => {}, onAccountKindFilterChange: () => {},
    onPreviousPage: () => {}, onNextPage: () => {}, onSelectUser: () => {}, onSelectAll: () => {},
    onOpenView: () => {}, onOpenEdit: () => {}, onResetPassword: () => {},
    onToggleUserStatus: () => {}, onResetLoginRisk: () => {}, onReviewRegistration: () => {},
  }));
}
createRoot(document.getElementById('root')).render(createElement(App));
`,
  },
];

/** 页面内：可访问名为空的控件（四者皆空）。 */
const SCAN_JS = `
(() => {
  const out = [];
  for (const el of document.querySelectorAll('button, [role="button"], input:not([type=hidden]), select, textarea, a[href]')) {
    const aria = el.getAttribute('aria-label');
    const labelledby = el.getAttribute('aria-labelledby');
    let byLabelledby = '';
    if (labelledby) {
      byLabelledby = labelledby.split(/\\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ').trim();
    }
    const text = (el.textContent ?? '').trim();
    const title = el.getAttribute('title') ?? '';
    // <input> 还要考虑关联 <label>
    let byLabel = '';
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
      if (el.id) {
        const l = document.querySelector('label[for="' + el.id + '"]');
        if (l) byLabel = (l.textContent ?? '').trim();
      }
      if (!byLabel && el.closest('label')) byLabel = (el.closest('label').textContent ?? '').trim();
    }
    const name = (aria ?? '') || byLabelledby || text || title || byLabel;
    if (!name.trim()) {
      out.push({
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type'),
        cls: (el.className || '').toString().slice(0, 60),
        html: el.outerHTML.slice(0, 120),
      });
    }
  }
  return out;
})()
`;

async function scan(t: any, pageDef: (typeof PAGES)[number]) {
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
    const work = await mkdtemp(join(tmpdir(), 'fe02-scan-'));
  const entryFile = join(work, `entry-${Date.now()}-${process.pid}.tsx`);
  const compPath = pathToFileURL(join(HOST_ROOT, pageDef.file)).href;
  await writeFile(entryFile, withNmPaths(pageDef.entry.replace('{PATH}', compPath)), 'utf8');
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
        lib: { entry: entryFile, formats: ['iife'], name: 'Scan', fileName: () => 'probe.js' },
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
  await page.waitForSelector('#root > *');
  await page.waitForTimeout(150);
  return {
    page,
    errors,
    close: async () => {
      await browser.close();
      await rm(work, { recursive: true, force: true });
    },
  };
}

for (const pageDef of PAGES) {
  test(`可访问名扫描：${pageDef.name} 不得有「四者皆空」的控件`, async (t) => {
    const h = await scan(t, pageDef);
    if (!h) return;
    try {
      const unnamed = await h.page.evaluate(SCAN_JS);
      assert.deepEqual(h.errors, [], '探针不得抛错');
      assert.equal(
        unnamed.length,
        0,
        `存在无可访问名的控件（aria-label / aria-labelledby / 可见文本 / title / 关联 label 皆空）：\n` +
          unnamed.map((u: any) => `  - <${u.tag}${u.type ? ` type=${u.type}` : ''}> ${u.html}`).join('\n'),
      );
    } finally {
      await h.close();
    }
  });
}
