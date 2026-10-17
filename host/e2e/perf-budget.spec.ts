import { test, expect } from '@playwright/test';
import { login, resetBackend, E2E_ENABLED, E2E_SKIP_REASON } from './fixtures/helpers';

test.skip(!E2E_ENABLED, E2E_SKIP_REASON);

/**
 * 前端性能预算硬闸（FE-PERF-BUDGET）——主要页面「首内容 / 可交互」双口径。
 *
 * 双口径（承 E3 卡 `E3_STRICT_TIMING` 同款裁决，见 task-center-e3-realtime.spec.ts）：
 *   - `FMBY_PERF_STRICT=1` ⇒ **硬闸**（独占机/CI：预算超一分即红）；
 *   - 默认 ⇒ 只测量并打印（**共享农场机**负载噪声实测 223–620ms 波动，硬闸会 flaky
 *     ⇒ 共享机跑成测量通道，硬闸权在独占口径）。
 *
 * 测量口径（与 E3 计时断言逐条同源，保证可比）：
 *   1. 先预热一次（cold start JS 解析单列，本闸量**稳态**——SPA 内再次进入/二次访问）；
 *   2. `waitUntil:'commit'`（不等 load：load 会等被延的 API，测的就不是内容出现）；
 *   3. **浏览器内 DOM 探测**（`querySelector` 轮询，禁 innerText——强制 layout 会把
 *      探测自身开销 50–100ms 记进预算，负载下自伤）；
 *   4. 首内容 = 页面主内容选择器首次出现；可交互 = 首个可用交互控件出现。
 *
 * 预算表见 docs/perf-budget.md（每行带推导依据：E3/FE-OPT 实测基线 + 余量）；
 * 本文件只放闸，不放数字推导。
 */

/** 每页预算（ms）——独占机口径。数字出处与推导见 docs/perf-budget.md §2。 */
const BUDGETS = {
  '/': { first: 600, interactive: 1000 },
  '/libraries': { first: 500, interactive: 800 },
  '/libraries/1': { first: 600, interactive: 900 },
  '/item/101': { first: 700, interactive: 1000 },
  '/manage': { first: 500, interactive: 800 },
  '/manage/task-center': { first: 400, interactive: 700 },
  '/manage/users': { first: 600, interactive: 900 },
} as const;

type Route = keyof typeof BUDGETS;

/** 每页的「首内容」探针选择器（内容真实出现，非骨架占位）。 */
const FIRST_SELECTORS: Record<Route, string> = {
  '/': 'h1, h2, [class*="HeroSpotlight"], [class*="BrowseHome"]',
  '/libraries': 'h1, a[href^="/libraries/"]',
  '/libraries/1': 'h1, [class*="LibraryDetail"], a[href^="/item/"]',
  '/item/101': 'h1, [class*="ItemDetail"], [class*="dossier"]',
  '/manage': 'h1, table, nav a[href^="/manage/"]',
  '/manage/task-center': 'h1, table, [class*="FeedbackState"]',
  '/manage/users': 'h1, table',
};

/** 每页的「可交互」探针选择器（首个可用交互控件）。 */
const INTERACTIVE_SELECTORS: Record<Route, string> = {
  '/': 'a[href^="/libraries/"], button:not([disabled])',
  '/libraries': 'a[href^="/libraries/"], button:not([disabled])',
  '/libraries/1': 'a[href^="/item/"], button:not([disabled])',
  '/item/101': 'button:not([disabled]), a[href^="/play/"]',
  '/manage': 'nav a[href^="/manage/"], button:not([disabled])',
  '/manage/task-center': 'button:not([disabled]), a[href^="/manage/"]',
  '/manage/users': 'button:not([disabled]), input',
};

const ROUTES = Object.keys(BUDGETS) as Route[];

/**
 * 页面内探测：轮询等待选择器命中，返回耗时（ms）；超时返回 -1。
 * 轮询用 setInterval(16ms) + querySelector——与 E3 同款，禁 innerText/layout 自伤。
 */
async function probeInPage(page: import('@playwright/test').Page, selector: string, budgetMs: number) {
  return page.evaluate(
    async ([sel, limit]) => {
      const t0 = performance.now();
      return new Promise<{ ms: number; what: string }>((resolve) => {
        const iv = window.setInterval(() => {
          const hit = document.querySelector(sel as string);
          if (hit) {
            window.clearInterval(iv);
            resolve({ ms: performance.now() - t0, what: hit.tagName.toLowerCase() });
          }
        }, 16);
        window.setTimeout(
          () => {
            window.clearInterval(iv);
            resolve({ ms: -1, what: 'none' });
          },
          Math.max(limit * 3, 3_000),
        );
      });
    },
    [selector, budgetMs] as const,
  );
}

/** 采集一页两项指标（预热一次后测 N 次，返回 p50 与全部样本）。 */
async function measureRoute(page: import('@playwright/test').Page, route: Route) {
  const b = BUDGETS[route];
  // 预热：消除冷启动 JS 解析噪声（本闸量稳态；cold start 单列，不混预算）。
  await page.goto(route, { waitUntil: 'commit' });
  await page.waitForLoadState('networkidle').catch(() => {});

  const firstSamples: number[] = [];
  const interactiveSamples: number[] = [];
  for (let i = 0; i < 3; i++) {
    await page.goto(route, { waitUntil: 'commit' });
    const first = await probeInPage(page, FIRST_SELECTORS[route], b.first);
    expect(first.ms, `${route} 首内容未出现（探测 ${first.what}）`).toBeGreaterThan(0);
    firstSamples.push(first.ms);

    await page.goto(route, { waitUntil: 'commit' });
    const inter = await probeInPage(page, INTERACTIVE_SELECTORS[route], b.interactive);
    expect(inter.ms, `${route} 可交互控件未出现（探测 ${inter.what}）`).toBeGreaterThan(0);
    interactiveSamples.push(inter.ms);
  }
  const p50 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  return { first: p50(firstSamples), interactive: p50(interactiveSamples), firstSamples, interactiveSamples };
}

test.describe('性能预算硬闸（首内容/可交互，双口径）', () => {
  // ★全局预热（E3 同款纪律）：vite dev 按路由懒编译 chunk——**每个路由的第一次
  // goto 都含该路由的冷编译**（实测首页首次 662ms vs 稳态 126ms，5 倍差）。
  // 本闸量「稳态首内容」，故在 beforeEach 前先把全部路由各访问一次，
  // 把冷编译移出测量窗（cold start 属另一指标，不混预算）。
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await resetBackend();
    await login(page);
    for (const route of ROUTES) {
      await page.goto(route, { waitUntil: 'commit' }).catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
    }
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await resetBackend();
    await login(page);
  });

  for (const route of ROUTES) {
    test(`预算：${route}`, async ({ page }) => {
      const { first, interactive, firstSamples, interactiveSamples } = await measureRoute(page, route);
      const b = BUDGETS[route];
      const strict = process.env.FMBY_PERF_STRICT === '1';
      const line =
        `[perf-budget] ${route} 首内容 ${first.toFixed(0)}ms/${b.first}ms ` +
        `可交互 ${interactive.toFixed(0)}ms/${b.interactive}ms ` +
        `(strict=${strict ? '1' : '0'}; 样本 first=${firstSamples.map((x) => x.toFixed(0)).join(',')} ` +
        `interactive=${interactiveSamples.map((x) => x.toFixed(0)).join(',')})`;
      if (strict) {
        expect(first, `${route} 首内容 ${first.toFixed(0)}ms 超预算 ${b.first}ms`).toBeLessThanOrEqual(b.first);
        expect(
          interactive,
          `${route} 可交互 ${interactive.toFixed(0)}ms 超预算 ${b.interactive}ms`,
        ).toBeLessThanOrEqual(b.interactive);
        console.log(line);
      } else {
        // 共享机口径：只记录不闸（负载噪声见文档 §3；硬闸权在 FMBY_PERF_STRICT=1）。
        console.log(line);
      }
    });
  }
});
