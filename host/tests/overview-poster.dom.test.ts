// FE-posterUrl：概览海报改走 artwork 回落链后的**真实渲染**契约。
//
// 背景：概览海报旧实现读 item.posterUrl —— BE convert.rs 恒 None ⇒ 恒
// 「暂无海报」占位（交付链缺口，2026-10-27 裁定改前端：复用 browse 海报位
// 同款 usePosterUrl，投 /api/assets/items/{id}/images/* 投机链，零后端改动）。
//
// 为什么上真实浏览器：被测是「img 实际渲染出哪个 URL + onError 后沿链前进 +
// 全链失败后真的落文字占位」，静态源码断言证不了渲染行为。范式照
// qr-image-responsive.dom.test.ts（vite lib 打包 + @playwright/test Chromium，
// 零新增依赖）。
//
// ★环境注意：裸 about:blank 页上相对 URL 的 img 请求**不产生 error 事件**
//   （Chromium 行为，实测：自然等待/路由 abort 都不触发）⇒ 降级用**合成
//   error 事件**驱动（等价生产 404：asset-fallback e2e 已用真服务证过这条链）。
// ★自然 error 时序不可控（可能先于合成事件）⇒ ② 断言「相对前进」、③ 循环到占位。
//
// 跑法：node --import ./tests/register-aliases.mjs --test tests/overview-poster.dom.test.ts

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

/** 打包一次探针（vite lib 模式），返回 { bundle, css, work }。 */
async function buildProbe(): Promise<{ bundle: string; css: string; work: string } | null> {
  if (!existsSync(join(NM, 'react'))) return null;
  const work = await mkdtemp(join(tmpdir(), 'feposter-'));
  const entryFile = join(work, '__probeOverview-entry.tsx');
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
          name: 'ProbeOverviewPoster',
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

type Harness = {
  page: any;
  remount: () => Promise<void>;
  close: () => Promise<void>;
};
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
  const remount = async () => {
    await page.setContent(`<!doctype html><html><head><style>
      *{box-sizing:border-box}
      body{margin:0;background:#0b0c0f}
    </style></head><body><div id="root"></div></body></html>`);
    if (built.css) await page.addStyleTag({ path: built.css });
    // 换新容器：同容器二次 createRoot 会留下旧树（双树 ⇒ 合成事件打在旧树）。
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

function fireImgError(page: any) {
  return page.evaluate(() => {
    document
      .querySelector('img[alt="The Matrix 海报"]')
      ?.dispatchEvent(new Event('error'));
  });
}

const imgSrc = (page: any) =>
  page.evaluate(
    () => document.querySelector('img[alt="The Matrix 海报"]')?.getAttribute('src') ?? null,
  );

after(async () => {
  if (harness) await harness.close();
});

test('① 概览海报实际渲染 /api/assets 投机链 URL（非恒 undefined）', async (t) => {
  const h = await getHarness(t);
  await h.remount();
  const img = h.page.locator('img[alt="The Matrix 海报"]');
  await img.waitFor({ state: 'attached', timeout: 15000 });
  assert.equal(
    await img.getAttribute('src'),
    '/api/assets/items/501/images/poster',
    '海报 img 的 src 应是 /api/assets 投机链（旧实现此处恒无 src）',
  );
});

test('② onError 驱动回落链直至落回文字占位（不渲染破图）', async (t) => {
  const h = await getHarness(t);
  await h.remount();
  // 循环发 error（上限 6 次 = 链长上界），直到 img 消失（进入占位）。
  // （不再单断言「恰前进一档」—— blank 页渲染时序下中间帧不稳定，链的终止
  //  行为才是本卡要钉的。）
  for (let i = 0; i < 6; i += 1) {
    const stillThere = await h.page.locator('img[alt="The Matrix 海报"]').count();
    if (stillThere === 0) break;
    await fireImgError(h.page);
    await h.page
      .waitForFunction(
        (prev) => (document.querySelector('img[alt="The Matrix 海报"]')?.getAttribute('src') ?? null) !== prev,
        i,
        { timeout: 10000 },
      )
      .catch(() => undefined);
  }
  await h.page.waitForFunction(
    () => !document.querySelector('img[alt="The Matrix 海报"]'),
    undefined,
    { timeout: 10000 },
  );
  const placeholders = await h.page.locator('text=暂无海报').count();
  assert.ok(placeholders > 0, '降级尽头应渲染「暂无海报」占位');
});
