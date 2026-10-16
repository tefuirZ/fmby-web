// REVIEW-FE45-R2 补证：ManageSecretsPage 的「覆盖写入」下拉必须**随后端单一真源
// `overridable_keys` 变化** —— DOM 级证据。
//
// 为什么需要本文件：`secrets-metadata.contract.test.ts` 的 FE1-4 只在**纯函数层**
// （`resolveOverridableKeys`）做了「置真/置空」变异；页面那一环（:61 取真源 → :229
// 渲染成唯一动态 `<option>`）此前**只有静态接线**，无渲染级证据。本文件把整条链
// 跑真 DOM，钉死「下拉 ≡ overridable_keys」。
//
// 跑法：node --import ./tests/register-aliases.mjs --test tests/secrets-override-select.dom.test.ts
//
// 形态沿用仓内既有范式（table-row-keynav.test.ts / search-overlay-focus.test.ts）：
// devDep vite（打包）+ @playwright/test（Chromium），**零新增依赖**。
// ★entry 落 os.tmpdir()（非仓库树）：`pnpm test` 经 fmby-queue 降权到 tefuir，
//   仓库树 root:755 写不进 ⇒ 裸标识符 import 改 node_modules 绝对路径（同先例）。
// ★`overridable_keys` 直接编入 entry（每变体各打包一次），不用 addInitScript ——
//   实测 initScript 在 setContent 路径下未生效。
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
const NM_RQ = nmUrl('@tanstack/react-query/build/modern/index.js');

/** 被测页面（绝对 file URL，绕开 tmpdir 解析链）。 */
const PAGE_URL = pathToFileURL(
  join(HOST_ROOT, 'src/pages/manage/ManageSecretsPage.tsx'),
).href;

/** 探针 entry：真实 ManageSecretsPage + 预填 `['manage','secrets','status']` 缓存。 */
function probeEntry(overridableKeysLiteral: string): string {
  return `
import { createElement } from '${NM_REACT}';
import { createRoot } from '${NM_REACT_DOM_CLIENT}';
import { QueryClient, QueryClientProvider } from '${NM_RQ}';
import { ManageSecretsPage } from '${PAGE_URL}';

const KEYS = ${overridableKeysLiteral};
const RAW = {
  entries: [
    { key: 'providers.tmdb.api_key', source: 'env', configured: true, label: 'TMDB API Key' },
    { key: 'telegram.webhook_secret', source: 'builtin', configured: false },
  ],
  overrides_file: '/etc/fmby/secrets.local.toml',
  microsoft_editions: ['Global', 'China21Vianet'],
  overridable_keys: KEYS,
};

// ★stub fetch：命中 secrets 状态端点即回 RAW。不加它，react-query 挂载后 refetch
// 会在探针环境失败 ⇒ 页面 L110 的 isError 分支直接渲染错误态（实测踩到）。
globalThis.fetch = async (input) => {
  const url = String(input);
  if (url.includes('/api/manage/secrets/status')) {
    return new Response(JSON.stringify(RAW), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const qc = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});
// 预填缓存 ⇒ 首帧即 ready（fetch stub 再保证任何 refetch 也成功）。
qc.setQueryData(['manage', 'secrets', 'status'], {
  entries: [
    { key: 'providers.tmdb.api_key', source: 'env', configured: true, label: 'TMDB API Key' },
    { key: 'telegram.webhook_secret', source: 'builtin', configured: false },
  ],
  overridesFile: '/etc/fmby/secrets.local.toml',
  microsoftEditions: ['Global', 'China21Vianet'],
  overridableKeys: KEYS,
});
createRoot(document.getElementById('root')).render(
  createElement(QueryClientProvider, { client: qc }, createElement(ManageSecretsPage)),
);
`;
}

/** 打包一份探针（把 overridableKeys 字面量编入），返回 bundle 路径。 */
async function buildProbe(overridableKeysLiteral: string): Promise<string | null> {
  if (!existsSync(join(NM, 'react'))) return null;
  const work = await mkdtemp(join(tmpdir(), 'fe45-select-'));
  const entryFile = join(work, '__probeSecretsSelect-entry.tsx');
  const outDir = join(work, 'dist');
  await writeFile(entryFile, probeEntry(overridableKeysLiteral), 'utf8');
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
          name: 'ProbeSecretsSelect',
          fileName: () => 'probe.js',
        },
      },
    });
  } catch (error) {
    await rm(work, { recursive: true, force: true });
    throw error;
  } finally {
    await rm(entryFile, { force: true });
  }
  return join(outDir, 'probe.js');
}

/**
 * 渲染页面并读回「覆盖写入」下拉的**键 option**（去掉 value="" 的占位项）。
 * 读回后立即清理该变体的产物目录。
 */
async function selectOptionsFor(
  browser: import('@playwright/test').Browser,
  overridableKeysLiteral: string,
): Promise<string[]> {
  const bundle = await buildProbe(overridableKeysLiteral);
  if (!bundle) throw new Error('build skipped');
  const dir = join(bundle, '..');
  let page: import('@playwright/test').Page | undefined;
  try {
    page = await browser.newPage();
    await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
    await page.addScriptTag({ path: bundle });
    await page.waitForFunction(
      () => document.querySelector('#secrets-override-key') !== null,
      undefined,
      { timeout: 20000 },
    );
    const values = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll<HTMLOptionElement>('#secrets-override-key option'),
      ).map((o) => o.value),
    );
    return values.filter((v) => v !== '');
  } finally {
    await page?.close();
    await rm(dir, { recursive: true, force: true });
  }
}

test('覆盖写入下拉 ≡ 后端 overridable_keys 单一真源（DOM 级：置真/置空各跑一遍）', async (t) => {
  if (!existsSync(join(NM, 'react'))) {
    t.skip('未安装 host 依赖（pnpm install 后重跑）');
    return;
  }
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  try {
    // 变体 A：真源置真 ⇒ 下拉只有真源里的键（不可覆盖键 telegram.webhook_secret **不**漏进）
    const withKeys = await selectOptionsFor(browser, `['providers.tmdb.api_key']`);
    assert.deepEqual(
      withKeys,
      ['providers.tmdb.api_key'],
      `置真：下拉应只有 overridable_keys 里的键，实际 ${JSON.stringify(withKeys)}`,
    );

    // 变体 B：真源置空 ⇒ 下拉空（fail-closed，不回落 entries 推导）
    const emptyKeys = await selectOptionsFor(browser, `[]`);
    assert.deepEqual(
      emptyKeys,
      [],
      `置空：下拉应为空（fail-closed），实际 ${JSON.stringify(emptyKeys)}`,
    );

    // 变体 C：真源缺失 ⇒ 下拉空（fail-closed）
    const undefKeys = await selectOptionsFor(browser, `undefined`);
    assert.deepEqual(
      undefKeys,
      [],
      `缺失：下拉应为空（fail-closed），实际 ${JSON.stringify(undefKeys)}`,
    );

    // 反事实：真源变化 ⇒ 下拉**随之**变化（两次观测必须不同，否则说明下拉未接真源）
    assert.notDeepEqual(
      withKeys,
      emptyKeys,
      '真源置真与置空的下拉必须不同（否则下拉未随真源变化）',
    );
  } finally {
    await browser.close();
  }
});
