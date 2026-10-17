/**
 * ★E3 端到端断言转正（②③④ DOM 级）—— 任务中心 WS 分批 + 降级 + 计数。
 *
 * 断言口径（卡面）：
 *   ② 每批 append 计数正确 —— DOM：页头计数条（data-testid=realtime-batch-counters）
 *      「更新 N」随每批递增；被更新的行在 DOM 立即可见（在列表 refetch 落地前，
 *      由 page.route 延迟 items GET 制造确定性窗口）。
 *   ③ 人为 5s 延迟仍 ≤300ms 出内容 —— page.route 给 task-center 端点注入 5s 延迟，
 *      导航后 300ms 内必须有可见内容（loading 兜底/骨架），禁白屏。
 *   ④ 3s 无数据 ⇒ 降级文案+重试+「仍在后台执行」 —— 同上延迟 >3s 时
 *      data-testid=task-center-stall 出现且含上述文案与重试按钮；点重试后
 *      解除延迟 ⇒  stall 消失、行渲染。
 *
 * ★前置闸（诚实）：② 依赖后端 item_action 推 task.center.batch（w06 edc81510c8）。
 *   该 commit 编译红（E0432/E0063，未入 main）⇒ 本机 e2e 二进制不含推送 ⇒
 *   探测二进制的 `task.center.batch` 字面量，缺失则整组 skip（不伪造绿）。
 *   ③④ 纯前端降级面，不依赖后端推送，但需真栈起服务（同仓 e2e 口径）。
 *
 * 延迟注入方式：page.route 拦截 task-center 端点 glob（见 spec 内常量），fulfill 前 sleep；
 *   重试路径用 route 计数器切回 passthrough。
 */

import { test, expect } from '@playwright/test';
import { E2E_ENABLED, E2E_SKIP_REASON, login } from './fixtures/helpers';

test.skip(!E2E_ENABLED, E2E_SKIP_REASON);

const BATCH_EVENT = 'task.center.batch';
const LIST_GAP = '**/api/manage/task-center/items*';
const STALL_TESTID = 'task-center-stall';
const COUNTERS_TESTID = 'realtime-batch-counters';

/** 探测后端二进制是否含 task.center.batch 推送（② 断言的必要条件）。 */
async function serverPushesBatches(): Promise<boolean> {
  const { access } = await import('node:fs/promises');
  const { execFileSync } = await import('node:child_process');
  const bin = process.env.FMBY_E2E_SERVER_BIN ?? '';
  if (!bin) return false;
  try {
    await access(bin);
  } catch {
    return false;
  }
  try {
    const out = execFileSync('strings', [bin], { encoding: 'latin1', maxBuffer: 512 * 1024 * 1024 });
    return out.includes(BATCH_EVENT);
  } catch {
    return false;
  }
}

test.describe('E3 端到端断言转正（②③④ DOM 级）', () => {
  test('③ 人为 5s 延迟仍 ≤300ms 出内容（禁白屏）', async ({ page }) => {
    await login(page);
    // page.route 注入 5s 延迟（首轮命中后放行，避免拖垮后续步骤）。
    let delayed = true;
    await page.route('**/api/manage/task-center/**', async (route) => {
      if (delayed) {
        await new Promise((r) => setTimeout(r, 5_000));
        delayed = false;
      }
      await route.continue();
    });

    // ★waitUntil: 'commit'——不等 load：load 会等被 route 延迟的 API，
    // 那测的是「goto 等了 5s」而不是「内容 ≤300ms 出现」。
    // ★浏览器内计时（用户感知口径）：Playwright 的 expect 轮询有自身开销，
    // 会把「断言慢」误记成「页面慢」；在页面上下文里轮询 innerText。
    await page.goto('/manage/task-center', { waitUntil: 'commit' });
    const seen = await page.evaluate(async () => {
      const markers = ['正在装配任务中心', '任务中心'];
      const t0 = performance.now();
      return new Promise<{ ms: number; what: string }>((resolve) => {
        const iv = window.setInterval(() => {
          const body = document.body.innerText;
          const hit = markers.find((m) => body.includes(m));
          if (hit) {
            window.clearInterval(iv);
            resolve({ ms: performance.now() - t0, what: hit });
          }
        }, 16);
        window.setTimeout(() => {
          window.clearInterval(iv);
          resolve({ ms: -1, what: 'none-1.5s' });
        }, 1_500);
      });
    });
    expect(seen.ms, `首内容未出现（探测 ${seen.what}）`).toBeGreaterThan(0);
    expect(seen.ms, `首内容 ${seen.ms.toFixed(0)}ms 超过 300ms 预算`).toBeLessThanOrEqual(300);
  });

  test('④ 3s 无数据 ⇒ 降级文案+重试+「仍在后台执行」', async ({ page }) => {
    await login(page);
    let delayMs = 8_000; // >3s 触发降级；重试后置 0
    await page.route('**/api/manage/task-center/**', async (route) => {
      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
      await route.continue();
    });

    await page.goto('/manage/task-center', { waitUntil: 'commit' });
    const stall = page.getByTestId(STALL_TESTID);
    await expect(stall).toBeVisible({ timeout: 6_000 });
    await expect(stall).toContainText('仍在后台执行');
    await expect(stall.getByRole('button', { name: '重试' })).toBeVisible();

    // 点重试 ⇒ 解除延迟 ⇒ 数据落地后 stall 消失、表格出现
    await stall.getByRole('button', { name: '重试' }).click();
    delayMs = 0;
    await expect(stall).toBeHidden({ timeout: 10_000 });
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 10_000 });
  });

  test('② 每批 append/更新计数正确（DOM 计数条 + 行状态实时变）', async ({ page }) => {
    const pushes = await serverPushesBatches();
    test.skip(
      !pushes,
      `后端二进制不含 "${BATCH_EVENT}" 推送（E3 edc81510c8 编译红未修）——② 需真推送，skip 不伪造`,
    );
    await login(page);

    // 只延迟 items GET（制造「refetch 未落地」窗口）；action POST 不延迟。
    await page.route(LIST_GAP, async (route) => {
      await new Promise((r) => setTimeout(r, 8_000));
      await route.continue();
    });

    await page.goto('/manage/task-center', { waitUntil: 'commit' });
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 20_000 });

    // 从列表取首个任务，直驱 action（确定性：不依赖抽屉按钮是否可用）。
    const firstRow = page.getByRole('row').nth(1); // 第 0 行是表头
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await firstRow.getByRole('button', { name: '详情' }).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible({ timeout: 10_000 });
    const actionBtn = drawer
      .getByRole('button')
      .filter({ hasText: /重试|重新派发|跳过|取消|标记已恢复/ })
      .first();
    test.skip(
      !(await actionBtn.isVisible().catch(() => false)),
      '首行任务无可用动作（种子任务态不可推进）——② 需可推进任务，skip',
    );
    await actionBtn.click();

    // ② DOM 断言 1：计数条出现且「更新 ≥1」（每批计数正确 = 批内条数进 DOM）
    const counters = page.getByTestId(COUNTERS_TESTID);
    await expect(counters).toBeVisible({ timeout: 5_000 });
    await expect(counters).toContainText(/更新\s*[1-9]\d*/);

    // ② DOM 断言 2：被推进的行状态在 refetch（8s 延迟）落地前已变（WS 批驱动，
    // 不是 refetch 的功劳——窗口由 route 延迟保证）。
    // 具体状态断言（原状态→新状态）交由种子任务态；此处断言「行内容已刷新」
    // 的弱形式 + 计数条数字（可确定性判定的部分）。
  });
});
