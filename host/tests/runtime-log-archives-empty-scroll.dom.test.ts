// A11Y-MOBILE-RUNTIME-LOGS：运行日志归档表「**空态不渲染滚动区**」的行为锁（DOM 级）。
//
// 为什么需要本文件：
//   该页在 **mobile 视口**曾触发 axe `[serious] scrollable-region-focusable`
//   （滚动区必须键盘可达）—— 触发条件是**归档为空**：空态渲染 `EmptyTableRow` ⇒
//   滚动区（`.tableScroll`，`overflow-x:auto` + 表格 `min-width:760px`）**零可聚焦后代**。
//   #56 的修法（已合入 main `39a9552`）：roving 表容器**不得**可聚焦（仓内契约
//   FE-WEB-UI-A②③：容器 tabIndex 会与行的 roving 停靠点构成「双停靠点」），
//   空态**干脆不渲染可滚动区**（与 `ShareItemBrowseSection` / `PreviewBrowseSection` 同形）。
//
//   为什么必须单独锁：`e2e/a11y.spec.ts` 只覆盖**该次种子态**；当初正是「有数据」的
//   种子下它绿、而「空归档」态才现形 ⇒ **空态这一半是漏网的**。本文件把它钉成
//   **双向**断言：空 ⇒ **没有**滚动区；有行 ⇒ **有**滚动区且**不带 tabindex**。
//
// 跑法：node --import ./tests/register-aliases.mjs --test tests/runtime-log-archives-empty-scroll.dom.test.ts
//
// 形态沿用仓内既有范式（secrets-override-select.dom.test.ts / table-row-keynav.test.ts）：
// vite 打包 + @playwright/test（Chromium），**零新增依赖**；entry 落 os.tmpdir()
// （仓库树 root:755，`pnpm test` 经 fmby-queue 降权后写不进 ⇒ 裸标识符 import
// 改 node_modules 绝对路径，同先例）；收尾 `rm` **整棵** work（同 LEAK 教训）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const HOST_ROOT = join(import.meta.dirname, '..');
const NM = join(HOST_ROOT, 'node_modules');
const nmUrl = (rel: string) => pathToFileURL(join(NM, rel)).href;

/** 被测组件（绝对 file URL，绕开 tmpdir 解析链）。 */
const COMPONENT_URL = pathToFileURL(
  join(HOST_ROOT, 'src/pages/manage/runtime-logs/RuntimeLogArchivesSection.tsx'),
).href;

/** 滚动区容器的可访问名前缀（`#56` 后仍保留 region + aria-label，见契约 A①/A④）。 */
const REGION_LABEL_PREFIX = '日志归档列表';

/** 后端清单 wire（snake_case，见 runtime-log-archives.contract.test.ts 的取证注释）。 */
type ArchiveWire = Record<string, unknown>;

/** ★必须走 `JSON.stringify`：手写 `{items:[],total:0,…}` 是**裸键** ⇒ 不是合法 JSON
 *  （JSON.parse 在 position 1 就报 `Expected property name`；本卡实测踩到）。 */
function rawList(items: ArchiveWire[]): string {
  return JSON.stringify({
    items,
    total: items.length,
    log_dir: '/tmp/logs',
    retention_days: 30,
  });
}

/** 一条归档（wire 形状；id 为 sha256 hex，此处用重复字符即可）。 */
const ONE_ARCHIVE: ArchiveWire = {
  id: 'a'.repeat(64),
  file_name: 'runtime-2026-10-01.log.gz',
  log_date: '2026-10-01',
  compressed_size_bytes: 1024,
  original_size_bytes: 4096,
  compression_ratio: 4.0,
  created_at: '2026-10-02T00:00:00Z',
  expires_at: '2026-10-31T16:00:00Z',
};

/**
 * 探针 entry：只挂真实组件 + QueryClient。
 *
 * ★清单端点**不在页内 stub**，由测试内的本地 http 服务器应答（见 `renderWith`）：
 *   组件经 `window.location.origin` 构造请求 URL，而 `page.setContent` 下 origin 非法
 *   （about:blank ⇒ `new URL` 抛 `Invalid base URL`，实测会落成 isError 分支）。
 *   有真 origin 后 react-query 直接请求 `/api/...`，由服务器应答 ⇒ 无需页内 stub。
 */
function probeEntry(): string {
  return `
import { createElement } from '${nmUrl('react/index.js')}';
import { createRoot } from '${nmUrl('react-dom/client.js')}';
import { QueryClient, QueryClientProvider } from '${nmUrl('@tanstack/react-query/build/modern/index.js')}';
import { RuntimeLogArchivesSection } from '${COMPONENT_URL}';

const qc = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});
createRoot(document.getElementById('root')).render(
  createElement(QueryClientProvider, { client: qc }, createElement(RuntimeLogArchivesSection)),
);
`;
}

/** 打包探针（与数据无关 —— 数据由服务器按变体换），返回 bundle 路径与待清理的 work 根。 */
async function buildProbe(): Promise<{ bundle: string; work: string }> {
  const work = await mkdtemp(join(tmpdir(), 'fe-rla-dom-'));
  const entryFile = join(work, '__probeRuntimeLogArchives-entry.tsx');
  const outDir = join(work, 'dist');
  await writeFile(entryFile, probeEntry(), 'utf8');
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
        lib: {
          entry: entryFile,
          formats: ['iife'],
          name: 'ProbeRuntimeLogArchives',
          fileName: () => 'probe.js',
        },
      },
    });
  } finally {
    await rm(entryFile, { force: true });
  }
  return { bundle: join(outDir, 'probe.js'), work };
}

/**
 * 用**本地 http 服务器**供页（真 origin）+ 按 items 应答清单端点，渲染并读回滚动区状态。
 */
async function renderWith(
  browser: import('@playwright/test').Browser,
  bundle: string,
  items: ArchiveWire[],
): Promise<{ regionExists: boolean; hasTabIndexAttr: boolean; text: string }> {
  const html =
    '<!doctype html><html><body><div id="root"></div>' +
    '<script src="/probe.js"></script></body></html>';
  const server = createServer((req, res) => {
    const url = req.url ?? '/';
    if (url.startsWith('/api/manage/runtime-log-archives')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(rawList(items));
      return;
    }
    if (url === '/probe.js') {
      res.writeHead(200, { 'content-type': 'text/javascript' });
      res.end(readFileSync(bundle));
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const page = await browser.newPage();
  try {
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
    // 等首帧：空态与表格态都必然出现该卡片标题「日志归档」。
    await page.waitForFunction(() => document.body.innerText.includes('日志归档'), undefined, {
      timeout: 20000,
    });
    return await page.evaluate((prefix) => {
      const region = document.querySelector(`[aria-label^="${prefix}"]`);
      return {
        regionExists: region !== null,
        hasTabIndexAttr: region ? region.hasAttribute('tabindex') : false,
        text: document.body.innerText,
      };
    }, REGION_LABEL_PREFIX);
  } finally {
    await page.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test('归档为空 ⇒ 不渲染可滚动区（axe scrollable-region-focusable 的结构性消解）', async (t) => {
  if (!existsSync(join(NM, 'react'))) {
    t.skip('未安装 host 依赖（pnpm install 后重跑）');
    return;
  }
  const { chromium } = await import('@playwright/test');
  const { bundle, work } = await buildProbe();
  const browser = await chromium.launch();
  try {
    // 变体 A：空清单 ⇒ **没有**滚动区（没有内容要横滚）+ 空态文案在场
    const empty = await renderWith(browser, bundle, []);
    assert.equal(
      empty.regionExists,
      false,
      '归档为空时不得渲染可滚动区（否则 axe `scrollable-region-focusable` 会因滚动区内零可聚焦后代而 serious）',
    );
    assert.ok(
      empty.text.includes('暂无归档'),
      `空态文案应在场，实际：${empty.text.slice(0, 160)}`,
    );

    // 变体 B：有一条归档 ⇒ **有**滚动区，且容器**不带 tabindex**
    //   （roving 表容器可聚焦 = 仓内契约 FE-WEB-UI-A②③ 禁止的「双停靠点」）
    const one = await renderWith(browser, bundle, [ONE_ARCHIVE]);
    assert.equal(
      one.regionExists,
      true,
      '有归档时必须渲染可滚动区（region + aria-label），否则 A①/A④ 契约与横向滚动都丢了',
    );
    assert.equal(
      one.hasTabIndexAttr,
      false,
      'roving 表的滚动区容器不得带 tabindex（FE-WEB-UI-A②③；键盘入口由活动行 roving 提供）',
    );

    // 反事实：两态必须**不同**，否则说明断言未真的区分空/非空（真空断言）
    assert.notEqual(
      empty.regionExists,
      one.regionExists,
      '空态与非空态必须呈现不同的滚动区结构（否则本条断言不承重）',
    );
  } finally {
    await browser.close();
    await rm(work, { recursive: true, force: true });
  }
});
