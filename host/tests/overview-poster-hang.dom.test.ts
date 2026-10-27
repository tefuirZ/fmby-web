// FE-WATCHDOG RED：概览海报在 img 请求**挂起**时永不降级（当前实现无看门狗）。
//
// 手法（可靠驱动）：blank 页上相对 URL 的 img 请求**挂起**（既不成功也不失败，
// 实测多轮）⇒ onError 永不触发 ⇒ 降级器永不前进 ⇒ 占位永不出现。
// 本测试在**未加看门狗**的实现上应 RED（12s 内占位不出现且 src 不变）；
// 加看门狗（默认 8s）后同用例 GREEN（~8s 降级到占位）。
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
  const work = await mkdtemp(join(tmpdir(), 'fewd-'));
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
  await page.addScriptTag({ path: built.bundle });
  harness = {
    page,
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

test('RED 前置实证：img 挂起（src 恒 poster、不 error、不降级）', async (t) => {
  const h = await getHarness(t);
  const img = h.page.locator(POSTER_SEL);
  await img.waitFor({ state: 'attached', timeout: 15000 });
  // 挂 3 秒：src 仍是 poster URL（请求挂起的形态）。
  await h.page.waitForTimeout(3000);
  assert.equal(
    await img.getAttribute('src'),
    '/api/assets/items/501/images/poster',
    '挂起形态：src 停在第一档',
  );
});

test('RED：12s 内占位不出现、img 不降级（无看门狗的现状）', async (t) => {
  const h = await getHarness(t);
  await h.page.waitForTimeout(12000);
  const imgStill = await h.page.locator(POSTER_SEL).count();
  assert.equal(
    imgStill > 0,
    true,
    '无看门狗现状：img 恒在（挂起永不降级）⇒ 修复后本断言应红（img 消失=已降级）',
  );
  const placeholders = await h.page.locator('text=暂无海报').count();
  assert.equal(placeholders, 0, '无看门狗现状：12s 内不应出现占位（出现=看门狗已生效）');
});
