// F-48（fmby-web#2）：播放器不应因 poster / resumePosition 抖动而整体销毁重建。
//
// 跑法：node --import ./tests/register-aliases.mjs --test tests/player-recreate.test.ts
//
// 为什么上真实浏览器：被测是 React effect 依赖 + 真实 effect 生命周期，
// SSR（renderToStaticMarkup）不执行 effect ⇒ 测不到。仓内无 jsdom /
// react-test-renderer（pnpm-lock 无，且不新增依赖），故复用既有 devDep：
// vite（打包）+ @playwright/test（Chromium）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const HOST_ROOT = join(import.meta.dirname, '..');

/**
 * 探针：渲染真实 `VideoPlayer`，桩掉引擎适配器的 create（计 create/destroy）。
 * 形态照抄 PlayPage 的真实喂法：poster/resumePosition 随 detail 迟到与播放
 * 进度而变化（handleTimeUpdate 每次写 localStorage ⇒ render 期读出的值持续变）。
 *
 * 桩位选 PlayerEngineFactory 内的 registry 而非 createPlayerEngine 本体：
 * VideoPlayer 直接具名 import 该函数，替换 namespace 导出不生效（已实测）。
 */
const PROBE_ENTRY = `
import { createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { VideoPlayer } from '${pathToFileURL(join(HOST_ROOT, 'src/features/player/VideoPlayer.tsx')).href}';
import { ArtPlayerEngineAdapter } from '${pathToFileURL(join(HOST_ROOT, 'src/features/player/engines/ArtPlayerEngine.ts')).href}';

const c = { creates: 0, destroys: 0 };
const stubEngine = {
  destroy: () => { c.destroys += 1; },
  seek: () => {}, play: () => {}, pause: () => {},
  setSpeed: () => {}, setVolume: () => {},
};
ArtPlayerEngineAdapter.prototype.create = function () {
  c.creates += 1;
  return Promise.resolve(stubEngine);
};

function Probe() {
  const [tick, setTick] = useState(0);
  globalThis.__bump = () => setTick((t) => t + 1);
  return createElement(VideoPlayer, {
    url: 'https://example.test/a.mkv',
    poster: tick > 0 ? 'https://example.test/poster-late.jpg' : undefined,
    resumePosition: tick,
    onTimeUpdate: () => {},
  });
}

createRoot(document.getElementById('root')).render(createElement(Probe));
globalThis.__c = c;
`;

test('F-48：poster / resumePosition 抖动不得导致播放器引擎反复销毁重建', async (t) => {
  if (!existsSync(join(HOST_ROOT, 'node_modules', 'react'))) {
    t.skip('未安装 host 依赖（pnpm install 后重跑）');
    return;
  }

  const { build } = await import('vite');
  const { chromium } = await import('@playwright/test');

  const work = await mkdtemp(join(tmpdir(), 'f48-'));
  const entryFile = join(HOST_ROOT, 'tests', '__probeF48-entry.tsx');
  await writeFile(entryFile, PROBE_ENTRY, 'utf8');

  try {
    await build({
      configFile: false,
      root: HOST_ROOT,
      logLevel: 'error',
      define: { 'process.env.NODE_ENV': '"development"' },
      build: {
        outDir: work,
        emptyOutDir: true,
        minify: false,
        lib: { entry: entryFile, formats: ['iife'], name: 'F48', fileName: () => 'probe.js' },
      },
    });

    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(String(error)));
      await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
      await page.addScriptTag({ path: join(work, 'probe.js') });
      await page.waitForFunction(() => Boolean((globalThis as any).__c));
      await page.waitForTimeout(100);

      const initial = await page.evaluate(() => ({ ...(globalThis as any).__c }));

      // 连续 10 次「进度推进 / poster 迟到」——F-48 声称此时引擎被反复重建。
      for (let i = 0; i < 10; i += 1) {
        await page.evaluate(() => (globalThis as any).__bump());
        await page.waitForTimeout(20);
      }
      await page.waitForTimeout(100);

      const after = await page.evaluate(() => ({ ...(globalThis as any).__c }));
      assert.deepEqual(pageErrors, [], '探针不得抛错');

      const rebuilds = after.creates - initial.creates;
      const teardowns = after.destroys - initial.destroys;
      assert.ok(
        rebuilds <= 1,
        `10 次进度/海报抖动后引擎重建 ${rebuilds} 次、销毁 ${teardowns} 次（应 ≤1：同一条目播放不该 destroy+recreate，video 会从头重启）`,
      );
    } finally {
      await browser.close();
    }
  } finally {
    await rm(entryFile, { force: true });
    await rm(work, { recursive: true, force: true });
  }
});