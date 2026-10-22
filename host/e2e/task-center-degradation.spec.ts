/**
 * ★W15-ASYNC-LINK ④⑤：任务中心**降级路径**真实栈断言。
 *
 * 卡面红线：「可以慢，不能空」——后端慢/WS 不可用时，前端**绝不允许整页空白**。
 *
 * 本 spec 只补既有 `async-feedback.spec.ts` **未覆盖**的两条：
 *   ① 人为把数据源延迟调到 5s ⇒ 点开任务中心仍 ≤300ms 出内容（骨架/banner，非纯白屏）
 *   ② WS 通道不可用（abort 全部 realtime/ws）⇒ 依然出内容；且超过 3s 无数据时
 *      出现**明确降级文案 + 重试按钮**（不是 spinner 到永远）
 *
 * 手段：`page.route` 给 `/api/manage/task-center/items` 注入 5s 延迟后
 * **`route.continue()` 透传真后端响应**（不伪造 body ⇒ 零响应形态风险）。
 *
 * ★诚实边界（见 docs/evidence 报告）：
 *   农场二进制（/data/fmby-e2e-bin/fmby-v2-server，2026-10-16 09:38 构建）
 *   **早于**本席后端 WS 端点 commit（10-17 17:17），且 `strings` 探得
 *   其中 `task_center` WS 符号 = 0 ⇒ **服务端分批推送端点不在此二进制里**。
 *   因此本 spec 断言的是「**WS 不可用时的降级正确性**」——这恰好是卡面④/⑦要的
 *   那条路径；「WS 真的推来分批数据」需新二进制，标**测不出**。
 */

import { test, expect, type Page } from '@playwright/test';
import { login, E2E_ENABLED, E2E_SKIP_REASON,
  openManageNav } from './fixtures/helpers';

test.skip(!E2E_ENABLED, E2E_SKIP_REASON);

/**
 * 给任务中心数据源注入固定延迟，然后**透传**真后端（不伪造 body）。
 *
 * 用 `route.continue()` 而不是 `route.fetch()+fulfill()`：后者会把真响应
 * 握在回调里，测试结束时若仍未返回 ⇒ Playwright 报
 * `route.fetch: Test ended`（实测 ② 就是这么红的，与被测行为无关的噪音）。
 * `continue()` 立即交还控制权，pending 请求归浏览器管。
 */
function delayTaskCenterItems(page: Page, ms: number): void {
  void page.route('**/api/manage/task-center/items*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    await route.continue();
  });
}

/** 打掉 WS 通道（abort 全部 realtime/ws）⇒ 模拟「WS 不可用」。 */
function blockWebsocket(page: Page): void {
  void page.route('**/api/playback/realtime/ws*', async (route) => {
    await route.abort();
  });
}

/**
 * SPA 导航进任务中心（不用 goto：整页刷新会重置内存态）。
 *
 * ★必须限定在「管理中心导航」内：/manage 首页的 `ActiveTaskQueueWidget` 空态里
 * 也有一个「任务中心 ➔」链接（`to="/manage/task-center"`）⇒ 裸 `getByRole('link',
 * { name: '任务中心' })` 命中 2 个元素，Playwright strict mode 直接报错
 * （真栈实测踩到）。侧栏那个才是用户点开的入口。
 */
async function openTaskCenter(page: Page): Promise<void> {
  // ★mobile-chrome：rail 在 ≤1023px 收进抽屉 ⇒ 先开抽屉再点（桌面空操作）
  await openManageNav(page);
  await page
    .getByRole('navigation', { name: '管理中心导航' })
    .getByRole('link', { name: '任务中心' })
    .click();
}

test.describe('W15-ASYNC-LINK 任务中心降级路径', () => {
  test('① 数据源 5s 延迟 ⇒ 点开后 ≤300ms 仍出内容（非白屏/非纯转圈）', async ({ page }) => {
    await login(page);
    delayTaskCenterItems(page, 5_000);
    blockWebsocket(page);

    // 先进任意管理页，保证侧栏已渲染（点「任务中心」才是 SPA 导航）。
    await page.goto('/manage');
    // ★mobile-chrome：rail 在 ≤1023px 收进抽屉 ⇒ 先开抽屉（桌面空操作）
    await openManageNav(page);
    // ★同样要限定导航域：/manage 首页的队列 widget 有个「任务中心 ➔」链接，
    //   裸 getByRole('link', {name:'任务中心'}) 会命中 2 个元素触发 strict violation。
    await expect(
      page
        .getByRole('navigation', { name: '管理中心导航' })
        .getByRole('link', { name: '任务中心' }),
    ).toBeVisible({ timeout: 15_000 });

    // 计时目标 = 任务中心页的 h1（骨架分支也渲染它 ⇒ 证明「非白屏」）。
    // ★不能用泛匹配文本：/manage 首页自身含「任务中心」字样（侧栏 + 队列 widget 链接），
    //   会在点击前就命中 ⇒ 测出来的是假快。先断言此刻不可见，再点击计时。
    const pageTitle = page.getByRole('heading', { name: '任务中心', level: 1 });
    await expect(pageTitle).toBeHidden();

    // ★计时口径：**先解析好侧栏链接句柄**，再从 click 起表。
    //   首版把 `getByRole(navigation).getByRole(link)` 的 locator 解析也算进「点开→出内容」，
    //   实测 454/361ms 全红——那是**测试自身开销**，不是用户感知的「点下」。
    //   分段耗时一并打印，便于核对到底是哪一段。
    const navLink = page
      .getByRole('navigation', { name: '管理中心导航' })
      .getByRole('link', { name: '任务中心' });
    await expect(navLink).toBeVisible();

    const t0 = Date.now();
    await navLink.click();
    const tClick = Date.now() - t0;
    await expect(pageTitle).toBeVisible({ timeout: 300 });
    const tPaint = Date.now() - t0;

    console.log(`[①] click=${tClick}ms  click→h1可见=${tPaint}ms  (预算 ≤300ms)`);
    // 断言**用户感知段**：click 之后到内容出现 ≤300ms。
    expect(
      tPaint - tClick,
      `点下→出内容 ${tPaint - tClick}ms 必须 ≤300ms（click 段 ${tClick}ms 为 Playwright 可操作性等待，不计入）`,
    ).toBeLessThanOrEqual(300);

    // 且**不是**整页空白：body 有可见文本节点。
    const textLen = await page.evaluate(() => document.body.innerText.trim().length);
    expect(textLen, '页面不得整页空白').toBeGreaterThan(20);
  });

  test('② 数据源 >3s 且 WS 不可用 ⇒ 出现降级文案 + 重试按钮（不是转圈到永远）', async ({
    page,
  }) => {
    await login(page);
    delayTaskCenterItems(page, 6_000);
    blockWebsocket(page);

    await page.goto('/manage');
    await openTaskCenter(page);

    // STALL_MS = 3s ⇒ 3s 后必须出降级条 + 重试（给 4.5s 容忍调度抖动）。
    await expect(page.getByText('任务列表加载缓慢')).toBeVisible({ timeout: 4_500 });
    await expect(
      page.getByText(/任务仍在后台执行，此处不会无限转圈/),
    ).toBeVisible({ timeout: 1_000 });
    await expect(page.getByRole('button', { name: '重试' })).toBeVisible();
  });

  test('③ WS 不可用但数据最终到达 ⇒ 降级态被真实数据取代（不卡死在降级）', async ({ page }) => {
    await login(page);
    // 4s：越过 stalled 阈值，但 6s 内后端会返回 ⇒ 先降级、后出内容
    delayTaskCenterItems(page, 4_000);
    blockWebsocket(page);

    await page.goto('/manage');
    await openTaskCenter(page);

    await expect(page.getByText('任务列表加载缓慢')).toBeVisible({ timeout: 4_500 });
    // 数据到达后必须换成条数文案（「共 N 条」/「已加载 N 条」），且重试条消失。
    await expect(page.getByText(/共 \d+ 条|已加载 \d+ 条|当前没有运行中的任务/).first()).toBeVisible(
      { timeout: 10_000 },
    );
    await expect(page.getByText('任务列表加载缓慢')).toHaveCount(0);
  });

  test('④ 点重试 ⇒ 重新拉取并出内容（降级不是死路）', async ({ page }) => {
    await login(page);
    delayTaskCenterItems(page, 4_000);
    blockWebsocket(page);

    await page.goto('/manage');
    await openTaskCenter(page);
    const retry = page.getByRole('button', { name: '重试' });
    await expect(retry).toBeVisible({ timeout: 4_500 });
    await retry.click();
    await expect(page.getByText(/共 \d+ 条|已加载 \d+ 条|当前没有运行中的任务/).first()).toBeVisible(
      { timeout: 15_000 },
    );
  });
});
