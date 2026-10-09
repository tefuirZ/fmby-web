// WEB-C1 ④ / #290：皮肤实时句柄的重渲回归锁。
//
// 跑法：node --import ./tests/register-aliases.mjs --test tests/skin-realtime-rerender.test.ts
//
// 为什么必须上真实浏览器：被测行为是 React **effect 依赖 + 订阅身份**语义，
// `renderToStaticMarkup`（SSR）不执行 effect ⇒ 恒测不到（卡面点名的盲区）；
// 仓内亦无 jsdom / react-test-renderer（pnpm-lock 无，且本卡不新增依赖）。
// 故复用仓内已有 devDep：vite（打包）+ @playwright/test（真实 Chromium）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const HOST_ROOT = join(import.meta.dirname, '..');

/** 探针 = 三个皮肤修复后的真实形态：effect 依赖 `subscribe`（而非 realtime 句柄）。 */
const PROBE_ENTRY = `
import { createElement, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useSkinRealtime } from '${pathToFileURL(join(HOST_ROOT, 'src/theme/skins/useSkinRealtime.ts')).href}';

const c = { renders: 0, effects: 0, listenerCalls: 0 };

function Probe() {
  c.renders += 1;
  const realtime = useSkinRealtime(50);
  const { subscribe } = realtime;
  const [, forceTick] = useState(0);
  useEffect(() => {
    c.effects += 1;
    const unsub = subscribe(() => {
      c.listenerCalls += 1;
      forceTick((t) => t + 1);
    });
    return unsub;
  }, [subscribe]);
  return createElement('div', null, 'probe');
}

createRoot(document.getElementById('root')).render(createElement(Probe));
globalThis.__c = c;
`;

/**
 * 探针：**同一个 hook 实例**上挂两个 listener，退掉其中一个。
 *
 * 形态要点（为何不能用「两个组件各订一次」）：每个组件各自调 useSkinRealtime
 * ⇒ 各自持有自己的 interval；被卸组件的 timer 自行清理，于是「退订失效」
 * 被 timer 掩盖（实测：故意不 delete listener 也测不出来）。故必须两订阅
 * 共用同一 hook 实例，让 timer 在退订后继续存在，退订才真正可观测。
 */
const UNMOUNT_ENTRY = `
import { createElement, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useSkinRealtime } from '${pathToFileURL(join(HOST_ROOT, 'src/theme/skins/useSkinRealtime.ts')).href}';

const c = { keptCalls: 0, droppedCalls: 0 };

const root = createRoot(document.getElementById('root'));

function Probe() {
  const realtime = useSkinRealtime(50);
  const { subscribe } = realtime;
  const [, forceTick] = useState(0);

  useEffect(() => {
    const unsubKept = subscribe(() => {
      c.keptCalls += 1;
      forceTick((t) => t + 1);
    });
    c.unsubDropped = subscribe(() => {
      c.droppedCalls += 1;
    });
    return unsubKept;
  }, [subscribe]);

  return createElement('div', null, 'probe');
}

root.render(createElement(Probe));
globalThis.__c = c;
globalThis.__dropSecond = () => c.unsubDropped();
`;

/**
 * 探针：订阅者**全部**退订后 timer 必须停（#290 修复把订阅计数从
 * `listenersRef.current.size` 改为 state `subscriberCount` 后的新风险面）。
 *
 * 覆盖的是前两条测试都没碰的路径：
 * - 前者只验「退订一个后另一个仍被调」；
 * - 后者只验「推送到达 + effect 不重建」。
 * 若 `subscriberCount` 因任何路径不归零，interval 会永久空转（无订阅者也在刷时间戳）。
 * 这里用 `lastRefreshedAt` 观察：全部退订后它必须**停止变化**。
 *
 * ★必须先证明 timer「活着」再验它停（w03 轮复核发现）：
 *   #290 前 timer 恒不启动 ⇒ 退订后它本来就不动 ⇒ 本断言空过。
 *   只断言「停」对死 timer 恒真，是**验不出 bug 的假绿**。
 *   故先取两拍证明在推进，再退订验停 —— 两个方向都绿才算数。
 */
const DRAIN_ENTRY = `
import { createElement, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { useSkinRealtime } from '${pathToFileURL(join(HOST_ROOT, 'src/theme/skins/useSkinRealtime.ts')).href}';

const c = { lastRefreshedAt: null };
const root = createRoot(document.getElementById('root'));

function Probe() {
  const realtime = useSkinRealtime(50);
  const { subscribe, lastRefreshedAt } = realtime;
  c.lastRefreshedAt = lastRefreshedAt;
  useEffect(() => {
    const unsub = subscribe(() => {});
    c.unsub = unsub;
    return unsub;
  }, [subscribe]);
  return createElement('div', null, 'probe');
}

root.render(createElement(Probe));
globalThis.__c = c;
globalThis.__dropAll = () => c.unsub();
`;

test('#290：单个订阅者退订后不再被调用（存活订阅者不受影响）', async (t) => {
  if (!existsSync(join(HOST_ROOT, 'node_modules', 'react'))) {
    t.skip('未安装 host 依赖（pnpm install 后重跑）');
    return;
  }

  const { build } = await import('vite');
  const { chromium } = await import('@playwright/test');

  const work = await mkdtemp(join(tmpdir(), 'probe290u-'));
  const entryFile = join(HOST_ROOT, 'tests', '__probe290-resub-entry.ts');
  await writeFile(entryFile, UNMOUNT_ENTRY, 'utf8');

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
        lib: { entry: entryFile, formats: ['iife'], name: 'P290U', fileName: () => 'probe.js' },
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
      await page.waitForTimeout(250);

      // 退掉第二个 listener；第一个仍在 ⇒ timer 必须继续跑。
      await page.evaluate(() => (globalThis as any).__dropSecond());
      await page.waitForTimeout(60);
      const afterDrop = await page.evaluate(() => ({ ...(globalThis as any).__c }));

      await page.waitForTimeout(250);
      const settled = await page.evaluate(() => ({ ...(globalThis as any).__c }));

      assert.deepEqual(pageErrors, [], '退订不得抛错（如 setState 于卸载后）');
      assert.ok(
        settled.keptCalls - afterDrop.keptCalls > 0,
        `存活订阅者必须持续收到推送（否则本测试无效：timer 已停）；${afterDrop.keptCalls} → ${settled.keptCalls}`,
      );
      assert.equal(
        settled.droppedCalls,
        afterDrop.droppedCalls,
        `已退订的 listener 不得再被调用（退订失效 ⇒ 泄漏 + 幽灵 setState）；${afterDrop.droppedCalls} → ${settled.droppedCalls}`,
      );
    } finally {
      await browser.close();
    }
  } finally {
    await rm(entryFile, { force: true });
    await rm(work, { recursive: true, force: true });
  }
});

test('#290：轮询推送真的到达订阅者，且连续推送不重建皮肤 effect', async (t) => {
  if (!existsSync(join(HOST_ROOT, 'node_modules', 'react'))) {
    t.skip('未安装 host 依赖（pnpm install 后重跑）');
    return;
  }

  const { build } = await import('vite');
  const { chromium } = await import('@playwright/test');

  const work = await mkdtemp(join(tmpdir(), 'probe290-'));
  // entry 必须落在 host/tests/ 下：pnpm 的 node_modules 是按包的，
  // 从 /tmp 解析不到 react/react-dom。产物仍输出到 work（临时目录）。
  const entryFile = join(HOST_ROOT, 'tests', '__probe290-entry.ts');
  await writeFile(entryFile, PROBE_ENTRY, 'utf8');

  try {
    await build({
      // configFile:false —— 宿主 vite.config 的 manualChunks 与 inlineDynamicImports
      // 互斥（rollup 报错）；探针只要一个自足产物，不继承宿主打包策略。
      configFile: false,
      root: HOST_ROOT,
      logLevel: 'error',
      define: { 'process.env.NODE_ENV': '"development"' },
      build: {
        outDir: work,
        emptyOutDir: true,
        minify: false,
        lib: { entry: entryFile, formats: ['iife'], name: 'P290', fileName: () => 'probe.js' },
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

      // 静置：等首次订阅 + 轮询节拍起来（修复前此段内 listenerCalls 恒 0）。
      await page.waitForTimeout(200);
      const before = await page.evaluate(() => ({ ...(globalThis as any).__c }));

      // 收集「连续 10 次推送」窗口：50ms 轮询 ⇒ 600ms ≈ 12 拍，取前 10 拍。
      await page.waitForTimeout(500);
      const after = await page.evaluate(() => ({ ...(globalThis as any).__c }));

      assert.deepEqual(pageErrors, [], '探针不得抛错');

      const pushes = after.listenerCalls - before.listenerCalls;
      assert.ok(
        pushes >= 10,
        `轮询必须真的推到订阅者（#290 前：依赖 ref.size 致 timer 恒不启动 ⇒ 实时刷新整体失效）；实测 ${pushes} 次推送`,
      );

      const rebuilds = after.effects - before.effects;
      assert.ok(
        rebuilds <= 1,
        `连续 ${pushes} 次推送，皮肤 effect 重建 ${rebuilds} 次（应 ≤1：subscribe 身份稳定 ⇒ 依赖不失效）`,
      );
    } finally {
      await browser.close();
    }
  } finally {
    await rm(entryFile, { force: true });
    await rm(work, { recursive: true, force: true });
  }
});
test('#290：订阅者全部退订后 timer 必须停止（否则空转）', async (t) => {
  if (!existsSync(join(HOST_ROOT, 'node_modules', 'react'))) {
    t.skip('未安装 host 依赖（pnpm install 后重跑）');
    return;
  }

  const { build } = await import('vite');
  const { chromium } = await import('@playwright/test');

  const work = await mkdtemp(join(tmpdir(), 'probe290d-'));
  const entryFile = join(HOST_ROOT, 'tests', '__probe290-drain-entry.ts');
  await writeFile(entryFile, DRAIN_ENTRY, 'utf8');

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
        lib: { entry: entryFile, formats: ['iife'], name: 'P290D', fileName: () => 'probe.js' },
      },
    });

    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      const pageErrors: string[] = [];
      page.on('pageerror', (e) => pageErrors.push(String(e)));
      await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
      await page.addScriptTag({ path: join(work, 'probe.js') });
      await page.waitForFunction(() => Boolean((globalThis as any).__c));
      await page.waitForTimeout(200);

      // 先证 timer 活着：连续两拍 lastRefreshedAt 必须推进（否则下面「停」是空断言）。
      await page.waitForTimeout(200);
      const liveA = await page.evaluate(() => (globalThis as any).__c.lastRefreshedAt);
      await page.waitForTimeout(200);
      const liveB = await page.evaluate(() => (globalThis as any).__c.lastRefreshedAt);
      assert.ok(
        liveB !== null && liveB !== liveA,
        `退订前 timer 必须已在推进（否则「退订后停止」是空断言，测不出空转）: ${liveA} → ${liveB}`,
      );

      // 退订全部后，等足够多个轮询窗口（50ms × 6 = 300ms）。
      await page.evaluate(() => (globalThis as any).__dropAll());
      await page.waitForTimeout(300);
      const drained = await page.evaluate(() => (globalThis as any).__c.lastRefreshedAt);

      await page.waitForTimeout(400);
      const stillDrained = await page.evaluate(() => (globalThis as any).__c.lastRefreshedAt);

      assert.deepEqual(pageErrors, [], '全部退订不得抛错');
      assert.equal(
        stillDrained,
        drained,
        `全部退订后 lastRefreshedAt 仍在变化 ⇒ timer 未停（subscriberCount 未归零，空转）: ${drained} → ${stillDrained}`,
      );
    } finally {
      await browser.close();
    }
  } finally {
    await rm(entryFile, { force: true });
    await rm(work, { recursive: true, force: true });
  }
});
