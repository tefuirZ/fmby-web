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
    // FE-WATCHDOG 观察缝：img src 迁移轨迹（MutationObserver，微任务级）。
    // about:blank 探针里相对 URL 不可解析 ⇒ thumb 档的 error 与 src 提交几乎
    // 同时到达，该瞬态可能**短于一帧** —— rAF 轮询的 waitForFunction 会整段
    // 漏采（farm 三红根因）。断言「链是否逐档经过 thumb」必须看 DOM 迁移轨迹，
    // 不能看渲染帧。
    await page.evaluate(() => {
      const w = window as unknown as { __artTrail: { kind: string; from: string | null; to: string | null }[] };
      w.__artTrail = [];
      const imgSrcOf = (n: Node): string | null => {
        if (!(n instanceof Element)) return null;
        if (n.tagName === 'IMG') return n.getAttribute('src');
        const img = n.querySelector('img');
        return img ? img.getAttribute('src') : null;
      };
      new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.type === 'attributes' && (m.target as Element).tagName === 'IMG') {
            w.__artTrail.push({ kind: 'src', from: m.oldValue, to: (m.target as Element).getAttribute('src') });
          }
          if (m.type === 'childList') {
            for (const n of m.addedNodes) {
              const s = imgSrcOf(n);
              if (s) w.__artTrail.push({ kind: 'add', from: null, to: s });
            }
            for (const n of m.removedNodes) {
              const s = imgSrcOf(n);
              if (s) w.__artTrail.push({ kind: 'remove', from: null, to: s });
            }
          }
        }
      }).observe(document.getElementById('root')!, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['src'],
        attributeOldValue: true,
      });
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
  // 终态断言（与上一测同款，帧无关、慢机安全）：二档链走完 ⇒ 海报 img 退场。
  await h.page.waitForFunction(
    () => !document.querySelector('img[alt="The Matrix 海报"]'),
    undefined,
    { timeout: 25000 },
  );
  // 轨迹断言（MutationObserver，微任务级）：img 的 src 必须真正「经过」thumb 档，
  // 不许 poster 直跳 done。thumb 瞬态可能短于一帧（见 remount 处观察缝注释），
  // 旧实现用 rAF waitForFunction 等 src 含 /thumb —— 竞态红（本机与 farm 均复现），
  // 改以 DOM 迁移轨迹为准。
  const trail = await h.page.evaluate(
    () => (window as unknown as { __artTrail: { kind: string; from: string | null; to: string | null }[] }).__artTrail,
  );
  const posterAdds = trail.filter((e) => e.kind === 'add' && String(e.to).includes('/images/poster'));
  const thumbFlips = trail.filter((e) => e.kind === 'src' && String(e.to).includes('/thumb'));
  assert.ok(
    posterAdds.length > 0,
    `轨迹应有 poster 档 img 挂载（trail=${JSON.stringify(trail)}）`,
  );
  assert.ok(
    thumbFlips.length > 0,
    `img src 必须经过 thumb 档再退场（不许跳变）（trail=${JSON.stringify(trail)}）`,
  );
});
