// E3 前端半边（FE-UI-2 · 只动 fmby-web）：任务中心「可以慢，不能空」。
//
// 跑法：node --import ./tests/register-aliases.mjs --test tests/task-center-streaming.dom.test.ts
//
// 卡面 §5–9 的契约（本文件逐条钉死）：
//   5) 点开 ≤300ms 内必须出现内容（骨架行或首批真数据任一即可；不许纯白屏/纯转圈）；
//   6) 每批到达即 append + 顶部「已加载 N 条 · 仍在加载…」；完成时变「共 N 条」；
//   7) 全链路卡死（>3s 无任何数据）⇒ 明确降级文案 + 重试按钮 +「任务仍在后台执行」；
//   8) 空态必须写「当前没有运行中的任务」并给引导动作（不许空壳）；
//   9) 权限变更/启停等异步 job 实时可见 —— 本轮前端只做**注入式 seam**：后端 WS
//      当前只推 playback 事件（crates/fmby-v2-application/src/playback/realtime.rs:37
//      的 PlaybackRealtimeEventType 七类，无 task-center 事件）⇒ 本轮不连真 WS，
//      以「外部批次注入 ⇒ UI 真更新」为断言（见场景 B；真 WS 事件等后端补，交付说明登记）。
//
// 为什么上真实浏览器：被测是**时间线**（≤300ms / 3s 阈值 / 每批 append 计数），必须让
// React effect 与定时器真跑。仓内无 jsdom / testing-library（引新依赖违反 ponytail），
// 故沿用 table-row-keynav.test.ts / search-overlay-focus.test.ts 既有范式：复用 devDep
// vite（打包）+ @playwright/test（Chromium），**零新增依赖**。
//
// ★四个场景共用**一次构建**：探针用 window.__SCENARIO__ 开关切 loader/subscriber。
//   不这样就得打四遍包——实测单遍 13s（@fmby/v2-shared/ui barrel 带 radix），四遍 52s，
//   且并行时 vite 的 tmp 目录互相踩（实测 "Build failed"）。
// ★场景开关写进 setContent 的 <script>：`addInitScript` 在 `setContent` **之后**调用
//   不生效（实测 window.__SCENARIO__ 恒 undefined ⇒ 四场景全走默认分支）。
//
// ★纯函数（mergeBatch / 文案 / 阈值 / 三态机）在 task-center-streaming.unit.test.ts
//   里跑（node:test 直跑，无浏览器）。两边合起来才闭环。

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const HOST_ROOT = join(import.meta.dirname, '..');

const NM = join(HOST_ROOT, 'node_modules');
const nmUrl = (rel: string) => pathToFileURL(join(NM, rel)).href;
const NM_REACT = nmUrl('react/index.js');
const NM_REACT_DOM_CLIENT = nmUrl('react-dom/client.js');

/** 被测：E3 流式装配 hook + 展示组件。 */
const HOOK_URL = pathToFileURL(
  join(HOST_ROOT, 'src/pages/manage/task-center/hooks/useTaskCenterStream.ts'),
).href;
const VIEW_URL = pathToFileURL(
  join(HOST_ROOT, 'src/pages/manage/task-center/components/TaskCenterStreamBoard.tsx'),
).href;

/**
 * 探针：一个入口承载四个场景，靠 `window.__SCENARIO__` 切换。
 *
 *   slow    首块延迟 **5s**（验收 a）⇒ 断言 ≤300ms 出骨架；
 *   batches 首块 1 条 + 每 80ms 推一批共 4 条（§6 / 验收 c+d）；
 *   stall   loadFirstBatch 永不振（验收 b）⇒ 断言 3s 后降级 + 重试 + 后台提示；
 *   empty   首块即 0 条且 hasMore=false（§8 / 验收 d）⇒ 空态文案 + 引导动作。
 */
const PROBE_ENTRY = `
import { createElement, useEffect } from '${NM_REACT}';
import { createRoot } from '${NM_REACT_DOM_CLIENT}';
import { useTaskCenterStream } from '${HOOK_URL}';
import { TaskCenterStreamBoard } from '${VIEW_URL}';

const SCENARIO = window.__SCENARIO__;

const ROWS = [
  { id: 't1', category: 'Scan', status: 'Running', summary: '扫描媒体库 A', mediaTitle: '库 A', updatedAt: '2026-10-17T00:00:00Z', retryCount: 0 },
  { id: 't2', category: 'Identify', status: 'Queued', summary: '识别条目 B', mediaTitle: null, updatedAt: '2026-10-17T00:00:01Z', retryCount: 0 },
  { id: 't3', category: 'Scrape', status: 'Running', summary: '刮削条目 C', mediaTitle: '影片 C', updatedAt: '2026-10-17T00:00:02Z', retryCount: 0 },
];
const ROW4 = { id: 'b4', category: 'Review', status: 'NeedsReview', summary: '审核 4', mediaTitle: null, updatedAt: '2026-10-17T00:00:03Z', retryCount: 0 };

// ★每批必须是 hook 的 TaskCenterStreamBatch 形状 {items,total,hasMore}。
//   写成裸数组会让 incoming.items=undefined ⇒ append 永不生效（mergeBatch 已加
//   fail-loud 守卫，错了当场抛，不再静默卡首块）。
const BATCHES = [
  { items: [ROWS[0]], total: 4, hasMore: true },
  { items: [ROWS[1], ROWS[2]], total: 4, hasMore: true },
  { items: [ROW4], total: 4, hasMore: false },
];

function makeLoader() {
  if (SCENARIO === 'slow') {
    // ★验收 a：人为把后端延迟调到 5s。
    return () => new Promise((resolve) => setTimeout(() => resolve({ items: ROWS, total: 3, hasMore: false }), 5000));
  }
  if (SCENARIO === 'stall') {
    // ★验收 b：全链路卡死 —— 不 resolve 也不 reject（reject 会走 error 态，是另一条路径）。
    return () => new Promise(() => {});
  }
  if (SCENARIO === 'empty') {
    return () => Promise.resolve({ items: [], total: 0, hasMore: false });
  }
  return () => Promise.resolve(BATCHES[0]);
}

function makeSubscriber() {
  if (SCENARIO === 'batches') {
    return (onBatch, onDone) => {
      let i = 1;
      const timer = setInterval(() => {
        if (i < BATCHES.length) { onBatch(BATCHES[i]); i += 1; }
        else { clearInterval(timer); onDone(); }
      }, 80);
      return () => clearInterval(timer);
    };
  }
  if (SCENARIO === 'empty') {
    return (onBatch, onDone) => { onDone(); return () => {}; };
  }
  return () => () => {};
}

// ★记录每次提交后的「行数 + 顶部文案」轨迹：验收 c 要证的是**逐批 append 的过程**
//   （1 → 3 → 4），不是终态快照。快照断言会和 80ms 的批次间隔赛跑（实测 4 !== 1）。
window.__HISTORY__ = [];

function App() {
  const stream = useTaskCenterStream({
    loadFirstBatch: makeLoader(),
    subscribeBatches: makeSubscriber(),
    stallThresholdMs: 3000,
  });
  useEffect(() => {
    window.__HISTORY__.push({
      n: stream.items.length,
      text: (document.querySelector('[data-testid="tc-stream-status"]')?.textContent ?? '').trim(),
    });
  }, [stream.items.length, stream.status, stream.hasMore]);
  return createElement(TaskCenterStreamBoard, {
    status: stream.status,
    items: stream.items,
    loadedCount: stream.loadedCount,
    total: stream.total,
    errorMessage: stream.errorMessage,
    onRetry: () => stream.retry(),
  });
}

createRoot(document.getElementById('root')).render(createElement(App));
`;

/** 打包一次探针，返回 { bundle, css, work }。 */
async function buildProbe(): Promise<{ bundle: string; css: string; work: string } | null> {
  if (!existsSync(join(NM, 'react'))) return null;
  const work = await mkdtemp(join(tmpdir(), 'e3-tc-stream-'));
  const entryFile = join(work, '__probeTcStream-entry.tsx');
  const outDir = join(work, 'dist');
  await writeFile(entryFile, PROBE_ENTRY, 'utf8');
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
          name: 'ProbeTcStream',
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

type Scenario = 'slow' | 'batches' | 'stall' | 'empty';
interface ScenarioHarness {
  page: any;
  errors: string[];
  close: () => Promise<void>;
}

const SKIP = Symbol('skip');
let built: { bundle: string; css: string; work: string } | null = null;
const openHarnesses: ScenarioHarness[] = [];

/** 起一个跑指定场景的页面（共用同一份构建产物）。 */
async function openScenario(t: any, scenario: Scenario): Promise<ScenarioHarness> {
  if (!built) {
    built = await buildProbe();
    if (!built) {
      t.skip('未安装 host 依赖（pnpm install 后重跑）');
      throw SKIP;
    }
  }
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e: Error) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  // ★场景开关随 HTML 一起进文档（addInitScript 在 setContent 之后不生效）。
  await page.setContent(
    `<!doctype html><html><head><script>window.__SCENARIO__ = ${JSON.stringify(
      scenario,
    )};</script><style>
      *{box-sizing:border-box}
      body{margin:0;background:#0b0c0f;color:#e8eaed;font:13px/1.5 system-ui,sans-serif}
    </style></head><body><div id="root"></div></body></html>`,
  );
  if (built.css) await page.addStyleTag({ path: built.css });
  await page.addScriptTag({ path: built.bundle });
  await page.waitForSelector('[data-testid="tc-stream-board"]', { timeout: 20000 });
  return {
    page,
    errors,
    // ★连 browser 一起关：只 page.close() 会漏 Chromium 进程（实测漏 4 个，
    //   node --test 收尾被挂住的子进程拖到超时 ⇒ "Interrupted while running"）。
    close: async () => {
      await page.close().catch(() => {});
      await browser.close();
    },
  };
}

before(async () => {
  // 预热构建（四个用例复用同一产物），避免把打包时间算进第一个用例的耗时断言。
  if (!built) built = await buildProbe();
});

after(async () => {
  while (openHarnesses.length > 0) {
    const h = openHarnesses.pop();
    if (h) await h.close();
  }
  if (built) {
    await rm(built.work, { recursive: true, force: true });
    built = null;
  }
});

// ─── 场景 A：后端 5s 才吐首块 ⇒ ≤300ms 必须出骨架（卡面 §5 / 验收 a） ────────

test('§5/验收a：后端 5s 才出首块，≤300ms 内必须有骨架内容（禁白屏/纯转圈）', async (t) => {
  let h: ScenarioHarness;
  try {
    h = await openScenario(t, 'slow');
  } catch (err) {
    if (err !== SKIP) throw err;
    return;
  }
  openHarnesses.push(h);
  const page = h.page;

  await page.waitForSelector('[data-testid="tc-stream-board"]', { state: 'visible', timeout: 300 });
  const skeleton = await page.evaluate(
    () => document.querySelectorAll('[data-testid="tc-skeleton-row"]').length,
  );
  assert.ok(
    skeleton > 0,
    `≤300ms 必须出现骨架行（实际 ${skeleton} 条）——纯白屏/纯转圈都不算「有内容」`,
  );
  // 骨架必须**有可读文字**（不是一堆空 div）
  const skeletonText = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="tc-skeleton-row"]');
    return el ? (el.textContent ?? '').trim() : '';
  });
  assert.ok(skeletonText.length > 0, `骨架行须有可读文案（实际「${skeletonText}」）`);

  // 真数据到达后骨架让位给真行（不许骨架钉死）
  await page.waitForSelector('[data-testid="tc-task-row"]', { timeout: 9000 });
  const skeletonAfter = await page.evaluate(
    () => document.querySelectorAll('[data-testid="tc-skeleton-row"]').length,
  );
  assert.equal(skeletonAfter, 0, '真数据到达后骨架必须消失（不能与真行并存）');
  assert.deepEqual(h.errors, [], '探针不得抛错');
});

// ─── 场景 B：分批到达 ⇒ append 计数 + 「已加载 N 条 · 仍在加载…」（§6 / 验收 c+d） ──

test('§6/验收c+d：每批到达即 append（计数正确）+ 顶部「已加载 N 条 · 仍在加载…」', async (t) => {
  let h: ScenarioHarness;
  try {
    h = await openScenario(t, 'batches');
  } catch (err) {
    if (err !== SKIP) throw err;
    return;
  }
  openHarnesses.push(h);
  const page = h.page;

  // 等「流跑到终态」：要么提交了 ≥4 次（0→1→3→4），要么轨迹里已出现 4 条。
  // ★不 catch：真卡住就是要红。但断言全部基于**轨迹**（history），所以变异
  //   （append→覆盖）时报的是「轨迹须含 4 条 / 终态为 4」，而不是裸 timeout。
  await page.waitForFunction(
    () => window.__HISTORY__.length >= 4 || window.__HISTORY__.some((h) => h.n === 4),
    undefined,
    { timeout: 8000 },
  );
  const history = await page.evaluate(() => window.__HISTORY__);
  const counts = history.map((h) => h.n);
  assert.ok(
    counts.every((v, i) => i === 0 || v >= counts[i - 1]),
    `行数轨迹必须单调不降（append 不是覆盖），实际 ${JSON.stringify(counts)}`,
  );
  assert.ok(counts.includes(1), `轨迹须含首块的 1 条（批与批之间必须可观察到中间态），实际 ${JSON.stringify(counts)}`);
  assert.ok(counts.includes(3), `轨迹须含第二批后的 3 条，实际 ${JSON.stringify(counts)}`);
  assert.equal(counts[counts.length - 1], 4, '轨迹终态须为 4 条');
  assert.ok(
    new Set(counts).size >= 3,
    `至少观察到 3 个不同行数中间态才能证明「一条条冒出来」（实际 ${JSON.stringify(counts)}）`,
  );

  // §6 进行中文案：轨迹里必须出现过「已加载 1 条 · 仍在加载…」
  const inflightSeen = history.find((h) => h.n === 1 && h.text.includes('仍在加载'));
  assert.ok(
    inflightSeen,
    `进行中文案须为「已加载 N 条 · 仍在加载…」（轨迹文案样本 ${JSON.stringify(history.map((h) => h.text))}）`,
  );
  assert.match(inflightSeen.text, /已加载 1 条 · 仍在加载/, `实际「${inflightSeen.text}」`);

  // 行序与内容：保序累计
  const rows = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="tc-task-row"]')).map((el) =>
      el.getAttribute('data-task-id'),
    ),
  );
  assert.deepEqual(rows, ['t1', 't2', 't3', 'b4'], `append 须保序且累计（实际 ${JSON.stringify(rows)}）`);

  // 完成文案变「共 N 条」，且不再出现「仍在加载」
  const done = await page.evaluate(
    () => document.querySelector('[data-testid="tc-stream-status"]')?.textContent ?? '',
  );
  assert.match(done, /共 4 条/, `完成文案须为「共 N 条」（实际「${done.trim()}」）`);
  assert.ok(!/仍在加载/.test(done), '完成后不得再显示「仍在加载…」');
  assert.deepEqual(h.errors, [], '探针不得抛错');
});

// ─── 场景 C：全链路卡死（3s 无任何数据）⇒ 降级文案 + 重试 + 后台提示（§7 / 验收 b） ──

test('§7/验收b：3s 无任何数据 ⇒ 降级文案 + 重试按钮 +「任务仍在后台执行」', async (t) => {
  let h: ScenarioHarness;
  try {
    h = await openScenario(t, 'stall');
  } catch (err) {
    if (err !== SKIP) throw err;
    return;
  }
  openHarnesses.push(h);
  const page = h.page;

  // 前 3s 只出骨架（不提前报降级）
  await page.waitForSelector('[data-testid="tc-skeleton-row"]', { timeout: 2000 });
  assert.equal(
    await page.evaluate(() => document.querySelectorAll('[data-testid="tc-stalled"]').length),
    0,
    '3s 内不得提前显示降级提示（骨架期）',
  );
  // 3s 后必须出现降级块
  await page.waitForSelector('[data-testid="tc-stalled"]', { timeout: 8000 });
  const stalledText = await page.evaluate(
    () => document.querySelector('[data-testid="tc-stalled"]')?.textContent ?? '',
  );
  assert.match(
    stalledText,
    /任务仍在后台执行/,
    `降级块须明确写「任务仍在后台执行」（实际「${stalledText.trim()}」）`,
  );
  // 重试按钮存在且真可点（不是死按钮）
  const retry = page.locator('[data-testid="tc-retry"]');
  assert.ok((await retry.count()) > 0, '须存在可点的重试按钮');
  await retry.first().click();
  assert.deepEqual(h.errors, [], '探针不得抛错');
});

// ─── 场景 D：空态必须明确「当前没有运行中的任务」+ 引导动作（§8 / 验收 d） ──────

test('§8/验收d：空态必须写「当前没有运行中的任务」+ 给引导动作（不许空壳）', async (t) => {
  let h: ScenarioHarness;
  try {
    h = await openScenario(t, 'empty');
  } catch (err) {
    if (err !== SKIP) throw err;
    return;
  }
  openHarnesses.push(h);
  const page = h.page;

  await page.waitForSelector('[data-testid="tc-empty"]', { timeout: 3000 });
  const emptyText = await page.evaluate(
    () => document.querySelector('[data-testid="tc-empty"]')?.textContent ?? '',
  );
  assert.match(
    emptyText,
    /当前没有运行中的任务/,
    `空态必须明确写「当前没有运行中的任务」（实际「${emptyText.trim()}」）`,
  );
  // 空态 ≠ 卡死：不得出现降级块
  assert.equal(
    await page.evaluate(() => document.querySelectorAll('[data-testid="tc-stalled"]').length),
    0,
    '空态（后端明确返回 0 条）不得误报为卡死降级',
  );
  // 引导动作：至少一个有可读文案的可点按钮
  const buttons = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="tc-empty"] button')).map((b) =>
      (b.textContent ?? '').trim(),
    ),
  );
  assert.ok(buttons.length > 0, `空态须给引导动作（实际按钮 ${JSON.stringify(buttons)}）`);
  assert.ok(
    buttons.every((b) => b.length > 0),
    '引导动作按钮须有可读文案',
  );
  assert.deepEqual(h.errors, [], '探针不得抛错');
});
