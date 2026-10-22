import { test, expect } from '@playwright/test';
import { login, E2E_ENABLED, E2E_SKIP_REASON } from './fixtures/helpers';

test.skip(!E2E_ENABLED, E2E_SKIP_REASON);

/**
 * FE-PERF-19PAGES：19 个代表页的「传输 / 解析 / 渲染」三维复测（公测前复测卡）。
 *
 * 与 `perf-budget.spec.ts` 的关系：那条闸管 7 个核心页的「首内容/可交互」硬闸；
 * 本文件扩到 19 页并把一页的耗时分到三层，用来定位"超的是传输、解析还是渲染"：
 *
 *   - 传输（transport）：本页主文档 navigation 的 transferSize + 全部资源 transferSize 之和
 *     （`performance.getEntriesByType('resource')`）；同时给 request 数与 encodedBodySize。
 *   - 解析（parse/执行）：`domInteractive - responseEnd`（HTML 解析 + 同步脚本执行 + DOM 构建），
 *     与 JS 传输字节一起看（解析慢通常伴随大 JS）。
 *   - 渲染（render）：首内容探测（`querySelector` 轮询，禁 innerText 防 layout 自伤）与
 *     可交互探测；外加 paint timing 的 FCP（若有）。
 *
 * 口径与既有闸逐条同源：先预热一次（稳态口径，冷启动单列）、`waitUntil:'commit'`、
 * 浏览器内 DOM 探测 16ms 轮询、3 采样取 p50。
 *
 * 双口径：`FMBY_PERF_STRICT=1` 才硬闸；默认只打印测量（共享农场机噪声 2–3 倍）。
 * 预算：7 个核心页沿用 `docs/perf-budget.md` §2 既有数字；其余 12 页为**推定档**
 * （同族页面取同档），文件中逐行标 `derived`，超线只报不自判。
 */

type RouteSpec = {
  path: string;
  /** 首内容探针选择器 */
  first: string;
  /** 可交互探针选择器 */
  interactive: string;
  /** 首内容预算（ms）；null = 推定档（只测不闸） */
  firstBudget: number | null;
  /** 可交互预算（ms）；null = 推定档 */
  interactiveBudget: number | null;
  /** 传输预算（KB，全部资源 transferSize 之和）；null = 只测 */
  kbBudget: number | null;
};

/** 19 个代表页：覆盖浏览 / 条目 / 合集 / 设置 / 播放 / 管理六大面。 */
const ROUTES: RouteSpec[] = [
  // —— 核心 7 页：预算沿用 docs/perf-budget.md §2（独占机口径）——
  { path: '/', first: 'h1, h2, [class*="HeroSpotlight"], [class*="BrowseHome"]', interactive: 'a[href^="/libraries/"], button:not([disabled])', firstBudget: 600, interactiveBudget: 1000, kbBudget: 800 },
  { path: '/libraries', first: 'h1, a[href^="/libraries/"]', interactive: 'a[href^="/libraries/"], button:not([disabled])', firstBudget: 500, interactiveBudget: 800, kbBudget: 600 },
  { path: '/libraries/1', first: 'h1, [class*="LibraryDetail"], a[href^="/item/"]', interactive: 'a[href^="/item/"], button:not([disabled])', firstBudget: 600, interactiveBudget: 900, kbBudget: 700 },
  { path: '/item/101', first: 'h1, [class*="ItemDetail"], [class*="dossier"]', interactive: 'button:not([disabled]), a[href^="/play/"]', firstBudget: 700, interactiveBudget: 1000, kbBudget: 800 },
  { path: '/manage', first: 'h1, table, nav a[href^="/manage/"]', interactive: 'nav a[href^="/manage/"], button:not([disabled])', firstBudget: 500, interactiveBudget: 800, kbBudget: 600 },
  { path: '/manage/task-center', first: 'h1, table, [class*="FeedbackState"]', interactive: 'button:not([disabled]), a[href^="/manage/"]', firstBudget: 400, interactiveBudget: 700, kbBudget: 600 },
  { path: '/manage/users', first: 'h1, table', interactive: 'button:not([disabled]), input', firstBudget: 600, interactiveBudget: 900, kbBudget: 700 },
  // —— 浏览面（推定档，同 /libraries 族）——
  { path: '/collections', first: 'h1, a[href^="/collections/"]', interactive: 'a[href^="/collections/"], button:not([disabled])', firstBudget: null, interactiveBudget: null, kbBudget: null },
  { path: '/collections/1', first: 'h1, [class*="Collection"], a[href^="/item/"]', interactive: 'a[href^="/item/"], button:not([disabled])', firstBudget: null, interactiveBudget: null, kbBudget: null },
  { path: '/people/1', first: 'h1, [class*="Person"]', interactive: 'a[href^="/item/"], button:not([disabled])', firstBudget: null, interactiveBudget: null, kbBudget: null },
  { path: '/history', first: 'h1, [class*="History"]', interactive: 'a[href^="/item/"], button:not([disabled])', firstBudget: null, interactiveBudget: null, kbBudget: null },
  { path: '/play/101', first: 'h1, video, [class*="Play"]', interactive: 'button:not([disabled]), video', firstBudget: null, interactiveBudget: null, kbBudget: null },
  // —— 设置面（推定档，同 /manage 族）——
  { path: '/settings', first: 'h1, nav a[href^="/settings/"]', interactive: 'nav a[href^="/settings/"], button:not([disabled])', firstBudget: null, interactiveBudget: null, kbBudget: null },
  { path: '/profile', first: 'h1, form, [class*="Profile"]', interactive: 'button:not([disabled]), input', firstBudget: null, interactiveBudget: null, kbBudget: null },
  { path: '/rewards', first: 'h1, [class*="Reward"]', interactive: 'button:not([disabled])', firstBudget: null, interactiveBudget: null, kbBudget: null },
  // —— 管理面（推定档）——
  { path: '/manage/items', first: 'h1, table', interactive: 'table a, button:not([disabled])', firstBudget: null, interactiveBudget: null, kbBudget: null },
  { path: '/manage/libraries', first: 'h1, table, [class*="Librar"]', interactive: 'table a, button:not([disabled])', firstBudget: null, interactiveBudget: null, kbBudget: null },
  { path: '/manage/mounts', first: 'h1, table, [class*="Mount"]', interactive: 'table a, button:not([disabled])', firstBudget: null, interactiveBudget: null, kbBudget: null },
  { path: '/manage/runtime-logs', first: 'h1, table, pre', interactive: 'table a, button:not([disabled]), input', firstBudget: null, interactiveBudget: null, kbBudget: null },
];

const STRICT = process.env.FMBY_PERF_STRICT === '1';
const SAMPLES = Number(process.env.FMBY_PERF_SAMPLES ?? 3);

type Sample = {
  first: number;
  interactive: number;
  fcp: number;
  docKb: number;
  resKb: number;
  reqCount: number;
  jsKb: number;
  parseMs: number;
};

const p50 = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? -1;
};

async function probeInPage(page: import('@playwright/test').Page, selector: string, limitMs: number) {
  return page.evaluate(
    async ([sel, limit]) => {
      const t0 = performance.now();
      return new Promise<number>((resolve) => {
        const iv = window.setInterval(() => {
          if (document.querySelector(sel as string)) {
            window.clearInterval(iv);
            resolve(performance.now() - t0);
          }
        }, 16);
        window.setTimeout(() => {
          window.clearInterval(iv);
          resolve(-1);
          // ★#1938 同型教训（page.evaluate 序列化边界）：这里必须用**入参** `limit`，
          //   引用外层 `limitMs` 在浏览器上下文是 ReferenceError（闭包不过 evaluate 边界）
          //   ⇒ 整个 probeInPage 必炸，perf 验收结论被测试 bug 挡死（两项目同炸实证）。
        }, Math.max(limit * 3, 3_000));
      });
    },
    [selector, limitMs] as const,
  );
}

/** 三层指标采集（当前文档已 commit 后调用）。 */
async function collectMetrics(page: import('@playwright/test').Page): Promise<Omit<Sample, 'first' | 'interactive'>> {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const res = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const sum = (xs: number[]) => xs.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
    const js = res.filter((r) => /\.js(\?|$)/.test(r.name) || r.initiatorType === 'script');
    const paint = performance.getEntriesByName('first-contentful-paint')[0] as PerformanceEntry | undefined;
    return {
      docKb: nav ? nav.transferSize / 1024 : -1,
      resKb: sum(res.map((r) => r.transferSize)) / 1024,
      reqCount: res.length + 1,
      jsKb: sum(js.map((r) => r.transferSize)) / 1024,
      parseMs: nav ? Math.max(0, nav.domInteractive - nav.responseEnd) : -1,
      fcp: paint ? paint.startTime : -1,
    };
  });
}

test.describe.configure({ mode: 'serial' });

test('19 页面预算复测：传输 / 解析 / 渲染', async ({ page }, testInfo) => {
  await login(page);
  const rows: Array<{ spec: RouteSpec; m: Sample }> = [];

  for (const spec of ROUTES) {
    // 预热（消除冷 chunk 编译；冷启动单列）
    await page.goto(spec.path, { waitUntil: 'commit' }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});

    const samples: Sample[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      await page.goto(spec.path, { waitUntil: 'commit' });
      const metrics = await collectMetrics(page);
      const first = await probeInPage(page, spec.first, spec.firstBudget ?? 800);
      const interactive = await probeInPage(page, spec.interactive, spec.interactiveBudget ?? 1200);
      samples.push({ ...metrics, first, interactive });
    }
    const m: Sample = {
      first: p50(samples.map((s) => s.first)),
      interactive: p50(samples.map((s) => s.interactive)),
      fcp: p50(samples.map((s) => s.fcp)),
      docKb: p50(samples.map((s) => s.docKb)),
      resKb: p50(samples.map((s) => s.resKb)),
      reqCount: p50(samples.map((s) => s.reqCount)),
      jsKb: p50(samples.map((s) => s.jsKb)),
      parseMs: p50(samples.map((s) => s.parseMs)),
    };
    rows.push({ spec, m });

    const budget = (v: number | null) => (v === null ? 'derived' : String(v));
    const over = (v: number, b: number | null) => (b !== null && v > b ? ' ⚠OVER' : '');
    console.log(
      `[19p] ${spec.path.padEnd(24)} 传输 doc=${m.docKb.toFixed(0)}KB res=${m.resKb.toFixed(0)}KB js=${m.jsKb.toFixed(0)}KB req=${m.reqCount}` +
        ` | 解析 ${m.parseMs.toFixed(0)}ms | 渲染 first=${m.first}ms/${budget(spec.firstBudget)}${over(m.first, spec.firstBudget)}` +
        ` inter=${m.interactive}ms/${budget(spec.interactiveBudget)}${over(m.interactive, spec.interactiveBudget)} fcp=${m.fcp.toFixed(0)}ms` +
        ` | KB预算=${budget(spec.kbBudget)}${spec.kbBudget !== null && m.resKb > spec.kbBudget ? ' ⚠OVER' : ''}`,
    );
  }

  // 汇总：超预算项（仅对已定预算的 7 页硬判；推定档只列数）
  const hardOver = rows.filter(
    (r) => r.spec.firstBudget !== null && (r.m.first > r.spec.firstBudget || (r.m.interactiveBudget !== null && r.m.interactive > r.spec.interactiveBudget)),
  );
  console.log(`[19p] 汇总 rows=${rows.length} 定预算页=${rows.filter((r) => r.spec.firstBudget !== null).length} 超线=${hardOver.length}`);
  for (const r of hardOver) console.log(`[19p] OVER ${r.spec.path} first=${r.m.first} inter=${r.m.interactive}`);

  await testInfo.attach('perf-19pages.json', { body: JSON.stringify(rows, null, 1), contentType: 'application/json' });

  if (STRICT) {
    expect(hardOver, `超预算页：${hardOver.map((r) => r.spec.path).join(', ')}`).toHaveLength(0);
  }
});
