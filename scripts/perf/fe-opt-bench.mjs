#!/usr/bin/env node
/**
 * FE-OPT-01 性能基线/对比采样（playwright performance API）。
 *
 * 前置：真实 fmby-v2-server（admin/admin 种子）已在 :18099 或指定 base；
 * 采样对 vite dev server（:5180）——与 e2e 同链路。
 *
 * 指标（每项 N 次采样，输出 p50/p95/min/max/mean）：
 *   1. fcp_home        首次登录后导航 / 的 First Contentful Paint
 *   2. nav_home_to_manage   首页→管理中心 点击到 DOM ready（chunk 拉取体感）
 *   3. nav_home_to_libraries 首页→媒体库
 *   4. nav_manage_to_audit   管理面→操作日志（长列表渲染）
 *   5. form_click_to_applied 管理面表单提交点击 → UI 生效（banner/列表更新）
 *   6. theme_switch_flicker 主题切换：切换期间背景色采样，检测闪白/闪非主题色帧
 *   7. chunk_prefetch_hits   hover 预取命中：hover 后点击的 chunk 是否已缓存
 *
 * 用法：node scripts/perf/fe-opt-bench.mjs --base http://127.0.0.1:5180 --out out.json [--runs 5]
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.cwd() + '/host/node_modules/@playwright/test');
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d);
  return {
    base: get('base', 'http://127.0.0.1:5180'),
    api: get('api', 'http://127.0.0.1:18099'),
    runs: Number(get('runs', '5')),
    out: get('out', 'docs/fe-opt-bench.json'),
    tag: get('tag', 'run'),
  };
}

function stats(samples) {
  if (!samples.length) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  return {
    n: samples.length,
    min: +sorted[0].toFixed(1),
    p50: +sorted[Math.floor(sorted.length / 2)].toFixed(1),
    p95: +sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)].toFixed(1),
    max: +sorted[sorted.length - 1].toFixed(1),
    mean: +mean.toFixed(1),
  };
}

async function login(page) {
  await page.goto(`${base}/login`);
  await page.getByRole('textbox', { name: '用户名' }).fill('admin');
  await page.getByRole('textbox', { name: '密码' }).fill('admin');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.waitForURL(/\/$/);
  await page.getByRole('heading', { name: /星际穿越|继续观看|最近入库/ }).first().waitFor();
}

/** 导航采样：点击链接 → 等目标内容可见。返回 click→visible 的墙钟 ms。 */
async function sampleNav(page, linkSelector, waitSelector, apiCalls = 1) {
  const started = Date.now();
  await page.click(linkSelector);
  // 等 URL 变化 + 主内容区出现任意标题级文本（不假设具体 h1 文案）
  await page.waitForURL(/\/(manage|libraries|history|item|play)/, { timeout: 20_000 });
  await page.locator('main, [class*=page]').first().waitFor({ state: 'visible', timeout: 20_000 });
  return Date.now() - started;
}

const { base, runs, out, tag } = parseArgs();
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

const results = { tag, base, runs, timestamp: new Date().toISOString(), metrics: {} };

// ---------- 登录 + 回首页 ----------
await login(page);

// ---------- 1. FCP（重新加载首页）----------
const fcps = [];
for (let i = 0; i < runs; i += 1) {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.clearBrowserCache');
  await cdp.detach();
  const perf = [];
  page.on('paint', (e) => perf.push({ name: e.name(), startTime: e.startTime }));
  const t0 = Date.now();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /星际穿越|继续观看|最近入库/ }).first().waitFor();
  fcps.push(Date.now() - t0);
  // eslint-disable-next-line no-restricted-globals
  const fcp = await page.evaluate(() => {
    const entries = performance.getEntriesByName('first-contentful-paint');
    return entries.length ? entries[0].startTime : null;
  });
  results.metrics[`fcp_paint_${i}`] = fcp;
  results.metrics[`nav_visible_home_${i}`] = Date.now() - t0;
  page.removeAllListeners('paint');
}
results.metrics.fcp_home = stats(fcps);

// ---------- 2/3. 路由导航采样（home → manage / home → libraries / manage → audit）----------
const navSamples = { homeToManage: [], homeToLibraries: [], manageToAudit: [] };
for (let i = 0; i < runs; i += 1) {
  await page.goto(`${base}/`);
  await page.getByRole('heading', { name: /继续观看|最近入库|星际穿越/ }).first().waitFor();
  navSamples.homeToManage.push(
    await sampleNav(page, 'nav a[href="/manage"]', 'h1'),
  );
  await page.goto(`${base}/`);
  await page.getByRole('heading', { name: /继续观看|最近入库|星际穿越/ }).first().waitFor();
  navSamples.homeToLibraries.push(
    await sampleNav(page, 'nav a[href="/libraries"]', 'h1'),
  );
  await page.goto(`${base}/manage`);
  await page.locator('main, [class*=page]').first().waitFor({ state: 'visible' });
  navSamples.manageToAudit.push(
    await sampleNav(page, 'a[href="/manage/site/security/audit-logs"]', 'table'),
  );
}
results.metrics.nav_home_to_manage = stats(navSamples.homeToManage);
results.metrics.nav_home_to_libraries = stats(navSamples.homeToLibraries);
results.metrics.nav_manage_to_audit = stats(navSamples.manageToAudit);

// ---------- 4. 管理面表单提交点击→UI 生效 ----------
const formApply = [];
for (let i = 0; i < Math.max(2, Math.floor(runs / 2)); i += 1) {
  await page.goto(`${base}/settings/playback`);
  await page.locator('main, [class*=page]').first().waitFor({ state: 'visible' });
  await page.waitForTimeout(1200);
  // 改动任一开关/选项触发 StickySaveBar → 点击保存 → 等"设置已保存"反馈
  const toggles = page.getByRole('switch');
  if ((await toggles.count()) > 0) {
    await toggles.first().click();
  } else {
    const select = page.getByRole('combobox').first();
    await select.click();
    await page.getByRole('option').nth(1).click();
  }
  const t0 = Date.now();
  await page.getByRole('button', { name: '保存设置' }).first().click();
  await page.locator('text=设置已保存').first().waitFor({ timeout: 15_000 });
  formApply.push(Date.now() - t0);
  await page.waitForTimeout(800);
}
results.metrics.form_click_to_applied = stats(formApply);

// ---------- 5. 主题切换零闪烁（FOUC 检测）----------
// 切换期间以 requestAnimationFrame 采样 documentElement 背景色，
// 非 darkroom(#000000)/template(#14161c) 的帧即 FOUC 候选。
const flickerFrames = [];
for (let i = 0; i < Math.max(2, Math.floor(runs / 2)); i += 1) {
  await page.goto(`${base}/settings/appearance`);
  await page.locator('h1').first().waitFor();
  await page.evaluate(() => {
    window.__flicker = [];
    window.__flickerOn = true;
    const allowed = new Set(['rgb(0, 0, 0)', 'rgb(20, 22, 28)', 'rgba(0, 0, 0, 0)']);
    const tick = () => {
      if (!window.__flickerOn) return;
      const bg = getComputedStyle(document.documentElement).backgroundColor;
      if (!allowed.has(bg)) window.__flicker.push(bg);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const target = i % 2 === 0 ? '模板主题' : '暗房主题';
  await page.getByRole('combobox', { name: '界面皮肤' }).click();
  await page.getByRole('option', { name: target }).click();
  await page.waitForTimeout(1500);
  flickerFrames.push(
    await page.evaluate(() => {
      // eslint-disable-next-line no-underscore-dangle
      window.__flickerOn = false;
      // eslint-disable-next-line no-underscore-dangle
      return window.__flicker.length;
    }),
  );
}
results.metrics.theme_switch_flicker_frames = stats(flickerFrames);

// ---------- 6. hover 预取命中（若启用；未启用时测 chunk 请求时序作为 before 基线）----------
const prefetchHits = [];
const prefetchRequests = [];
page.on('request', (req) => {
  // dev 模式模块请求是 /src/**/*.ts(x)（vite 按需转换）；生产是 /assets/*.js。
  const u = req.url();
  if (u.includes('/src/pages/') || (u.includes('/assets/') && u.endsWith('.js'))) {
    prefetchRequests.push({ url: u, ts: Date.now(), type: req.resourceType() });
  }
});
for (let i = 0; i < runs; i += 1) {
  await page.goto(`${base}/`);
  await page.getByRole('heading', { name: /继续观看|最近入库|星际穿越/ }).first().waitFor();
  const before = prefetchRequests.length;
  await page.hover('nav a[href="/manage"]');
  await page.waitForTimeout(600);
  const hovered = prefetchRequests.length - before;
  const t0 = Date.now();
  await page.click('nav a[href="/manage"]');
  await page.locator('h1').first().waitFor();
  prefetchHits.push({ hoverPrefetchedChunks: hovered, navMs: Date.now() - t0 });
}
results.metrics.hover_prefetch = {
  avgHoverPrefetchedChunks:
    prefetchHits.reduce((a, b) => a + b.hoverPrefetchedChunks, 0) / prefetchHits.length,
  navWithHover: stats(prefetchHits.map((h) => h.navMs)),
};

await browser.close();
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(results, null, 2)}\n`);
console.log(`written: ${out}`);
console.log(JSON.stringify(results.metrics, null, 2));
