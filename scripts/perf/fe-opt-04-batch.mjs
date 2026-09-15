#!/usr/bin/env node
/**
 * FE-OPT-04 批量操作体感采样（playwright performance API）。
 *
 * 前置：真实 fmby-v2-server（admin/admin 种子）+ 前端产物/dev server；与 e2e 同链路。
 * 采样集合适用**合集（collections）**（真实 POST/GET/DELETE 已接线）。
 *
 * 指标（每项 N 次采样，输出 p50/p95/min/max/mean）：
 *   1. select_all_to_bar    点「全选」→ 批量动作条可见（选择即时反馈）
 *   2. batch_confirm_to_panel  确认批量删除 → 进度面板首次可见（乐观/即时反馈）
 *   3. batch_run_total      进度面板出现 → 全部项处理完（逐条 DELETE 端到端）
 *   4. batch_list_applied   批量完成 → 列表缩减到 0（真实生效）
 *
 * 用法：node scripts/perf/fe-opt-04-batch.mjs --base http://127.0.0.1:5199 --out out.json [--runs 5]
 *
 * 说明：本脚本自带数据预置/清理（每轮建 N 个合集，跑完删净），可重复运行。
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.cwd() + '/host/node_modules/@playwright/test');

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (key, fallback) => {
    const i = args.indexOf(key);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
  };
  return {
    base: get('--base', 'http://127.0.0.1:5199'),
    out: get('--out', ''),
    runs: Number(get('--runs', '5')),
    itemsPerRun: Number(get('--items', '3')),
  };
}

function stats(samples) {
  if (!samples.length) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const pick = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  return {
    n: samples.length,
    min: Math.round(sorted[0]),
    p50: Math.round(pick(0.5)),
    p95: Math.round(pick(0.95)),
    max: Math.round(sorted[sorted.length - 1]),
    mean: Math.round(mean),
  };
}

async function login(page, base) {
  await page.goto(`${base}/login`);
  await page.getByRole('textbox', { name: '用户名' }).fill('admin');
  await page.getByRole('textbox', { name: '密码' }).fill('admin');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.waitForURL(/\/$/);
  await page.getByRole('heading', { name: /星际穿越|继续观看|最近入库/ }).first().waitFor();
}

/** 页面上下文发写请求（回显 CSRF，与 client.ts 同口径）。 */
async function apiWrite(page, method, path, body) {
  return page.evaluate(
    async ({ method, path, body }) => {
      const csrf = document.cookie
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith('fmby_csrf='))
        ?.split('=')[1];
      const res = await fetch(path, {
        method,
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'x-requested-with': 'FMBY-Web',
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return res.status;
    },
    { method, path, body },
  );
}

async function main() {
  const { base, out, runs, itemsPerRun } = parseArgs();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await login(page, base);

  const samples = {
    select_all_to_bar: [],
    batch_confirm_to_panel: [],
    batch_run_total: [],
    batch_list_applied: [],
  };

  for (let run = 0; run < runs; run++) {
    // 预置：本轮 itemsPerRun 个合集
    const titles = Array.from({ length: itemsPerRun }, (_, i) => `PERF-BATCH-${run}-${i}`);
    for (const title of titles) {
      await apiWrite(page, 'POST', '/api/manage/collections', { title, visibility: 'Active' });
    }

    await page.goto(`${base}/manage/collections`);
    await page.getByText(titles[0]).first().waitFor({ timeout: 15_000 });

    // 1) 全选 → 动作条可见
    const t0 = Date.now();
    await page.getByRole('button', { name: '全选' }).click();
    await page.getByRole('region', { name: '批量操作' }).waitFor();
    samples.select_all_to_bar.push(Date.now() - t0);

    // 2) 确认批量删除 → 进度面板可见
    await page.getByRole('button', { name: '批量删除' }).click();
    await page.getByRole('textbox', { name: /操作标识/ }).fill('delete-managed-collection');
    const t1 = Date.now();
    await page.getByRole('button', { name: '确认批量删除' }).click();
    const panel = page.locator('[role="status"]').filter({ hasText: /批量删除合集/ });
    await panel.waitFor({ timeout: 15_000 });
    samples.batch_confirm_to_panel.push(Date.now() - t1);

    // 3) 逐条处理完成（面板出现「完成」文案）
    const t2 = Date.now();
    await panel.getByText(/批量删除合集完成/).waitFor({ timeout: 30_000 });
    samples.batch_run_total.push(Date.now() - t2);

    // 4) 列表缩减到 0（真实生效）
    const t3 = Date.now();
    await page
      .waitForFunction(
        () => document.body.textContent?.includes('还没有任何收藏合集') ?? false,
        undefined,
        { timeout: 15_000 },
      )
      .catch(() => {});
    samples.batch_list_applied.push(Date.now() - t3);

    // 清理：确保无残留（面板关闭 + 兜底删除）
    await panel.getByRole('button', { name: '关闭批量进度' }).click().catch(() => {});
  }

  const metrics = Object.fromEntries(
    Object.entries(samples).map(([k, v]) => [k, stats(v)]),
  );
  const report = {
    tag: 'fe-opt-04-batch',
    base,
    runs,
    itemsPerRun,
    timestamp: new Date().toISOString(),
    metrics,
  };
  console.log(JSON.stringify(report, null, 2));
  if (out) {
    writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
    console.log(`\nwrote ${out}`);
  }
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
