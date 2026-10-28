// FE-WATCHDOG GREEN：概览海报在 img 请求**挂起**时由看门狗强制降级收敛。
//
// RED 原文（修复前，commit b0a06db 的同文件）：「img 挂起（src 恒 poster）」
// + 「12s 内占位不出现、img 不降级」双 PASS ⇒ 缺陷在案。
// 修复：usePosterUrl/useBackdropUrl 增每档看门狗（默认 8s，可配 watchdogMs）；
// 到点走与 error 相同的下一档路径；成功/降级/换图/卸载即清。
//
// 时序：二档链（poster→thumb→done）× 看门狗 8s ⇒ 占位应在 ~16s 前出现。
//
// 跑法：node --import ./tests/register-aliases.mjs --test tests/overview-poster-hang.dom.test.ts

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const HOST_ROOT = join(import.meta.dirname, '..');
const NM = join(HOST_ROOT, 'node_modules');
const nmUrl = (rel: string) => pathToFileURL(join(NM, rel)).href;
const NM_REACT = nmUrl('react/index.js');
const NM_REACT_DOM_CLIENT = nmUrl('react-dom/client.js');
const NM_REACT_ROUTER = nmUrl('react-router/dist/development/index.mjs');

const SECTION_URL = pathToFileURL(
  join(HOST_ROOT, 'src/pages/manage/media-item-detail/components/MediaItemOverviewSection.tsx'),
).href;

const DETAIL = {
  item: {
    id: '501',
    libraryId: '1',
    libraryName: 'movies',
    title: 'The Matrix',
    mediaType: 'movie',
    typeLabel: '电影',
    sourceStatus: 'mounted',
    mountStatus: 'configured',
    metadataStatus: 'identified',
    hasLocalOverride: false,
    hasLocalMetadataOverride: false,
    hasLocalArtworkOverride: false,
    hasLocalSubtitleOverride: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
  },
  effectiveMetadata: {
    title: 'The Matrix',
    genres: [],
    directors: [],
    actors: [],
    studios: [],
    externalIds: [],
  },
};

function probeEntry(): string {
  return `
import { createElement } from '${NM_REACT}';
import { createRoot } from '${NM_REACT_DOM_CLIENT}';
import { MemoryRouter } from '${NM_REACT_ROUTER}';
import { MediaItemOverviewSection } from '${SECTION_URL}';

const detail = ${JSON.stringify(DETAIL)};

createRoot(document.getElementById('root')).render(
  createElement(MemoryRouter, null,
    createElement(MediaItemOverviewSection, { detail })),
);
`;
}

async function buildProbe(): Promise<{ bundle: string; css: string; work: string } | null> {
  if (!existsSync(join(NM, 'react'))) return null;
  const work = await mkdtemp(join(tmpdir(), 'fewdg-'));
  const entryFile = join(work, '__probeHang-entry.tsx');
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
          name: 'ProbeHang',
          fileName: () => 'probe.js',
        },
      },
    });
  } finally {
    await rm(entryFile, { force: true });
  }
  const cssName = (await readdir(outDir)).find((f) => f.endsWith('.css'));
  return { bundle: join(outDir, 'probe.js'), css: cssName ? join(outDir, cssName) : '', work };
}

type Harness = { page: any; close: () => Promise<void> };
let harness: Harness | null = null;

async function getHarness(t: any): Promise<Harness> {
  if (harness) return harness;
  const built = await buildProbe();
  if (!built) {
    t.skip('未安装 host 依赖（pnpm install 后重跑）');
    throw new Error('skip');
  }
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html><head><style>
    *{box-sizing:border-box}
    body{margin:0;background:#0b0c0f}
  </style></head><body><div id="root"></div></body></html>`);
  if (built.css) await page.addStyleTag({ path: built.css });
  const remount = async () => {
    await page.setContent(`<!doctype html><html><head><style>
      *{box-sizing:border-box}
      body{margin:0;background:#0b0c0f}
    </style></head><body><div id="root"></div></body></html>`);
    if (built.css) await page.addStyleTag({ path: built.css });
    // 换新容器：同容器二次 createRoot 会留下旧树。
    await page.evaluate(() => {
      const r = document.getElementById('root')!;
      const fresh = r.cloneNode(false);
      r.replaceWith(fresh);
    });
    await page.addScriptTag({ path: built.bundle });
  };
  await remount();
  harness = {
    page,
    remount,
    close: async () => {
      await browser.close();
      await rm(built.work, { recursive: true, force: true });
    },
  };
  return harness;
}

after(async () => {
  if (harness) await harness.close();
});

const POSTER_SEL = 'img[alt="The Matrix 海报"]';

test('GREEN：挂起的海报由看门狗收敛到文字占位（≤25s，有限步）', async (t) => {
  const h = await getHarness(t);
  const img = h.page.locator(POSTER_SEL);
  await img.waitFor({ state: 'attached', timeout: 15000 });
  // 看门狗 8s/档 × 二档（poster→thumb→done） ⇒ ~16s 内应落到「暂无海报」占位。
  await h.page.waitForFunction(
    () => !document.querySelector('img[alt="The Matrix 海报"]'),
    undefined,
    { timeout: 25000 },
  );
  const placeholders = await h.page.locator('text=暂无海报').count();
  assert.ok(placeholders > 0, '降级尽头应渲染「暂无海报」占位（界面收敛）');
});

test('GREEN 附：看门狗到点先降级到 thumb 档（链是逐档走的，不是跳变）', async (t) => {
  const h = await getHarness(t);
  await h.remount();
  const img = h.page.locator(POSTER_SEL);
  await img.waitFor({ state: 'attached', timeout: 15000 });
  await h.page.waitForFunction(
    () => (document.querySelector('img[alt="The Matrix 海报"]')?.getAttribute('src') ?? '').includes('/thumb'),
    undefined,
    { timeout: 15000 },
  );
});
