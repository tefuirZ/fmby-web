/**
 * ★FE-ASYNC-FEEDBACK 验收（真实栈）：异步反馈三件套 + 幂等 + 高负载文案。
 *
 * 断言口径（卡面第 4 条）：
 *   - 点下 ≤200ms 内出现「已提交，正在后台执行（任务 #id）」反馈；
 *   - 抽屉/按钮不被锁（提交后抽屉立即关闭）；
 *   - 任务中心「后台任务」区能看到该任务（任务名/状态/开始时间/耗时）；
 *   - 完成后状态变「已完成」（真实 PATCH 200 驱动）；
 *   - 幂等：进行中重复提交 ⇒ 「已在执行」toast + 不产生第二行（不重复发请求）；
 *   - 高负载（429）：「系统繁忙，已转后台执行，完成后通知你」+ 自动重试后完成。
 *
 * 手段：page.route 对 `PATCH /api/manage/users/{id}` 注入延迟/429，让
 * 「进行中/完成/忙」三态可确定性驱动；被测链路 = 用户编辑保存（权限变更），
 * 与任务中心动作按钮走同一反馈层（AsyncJobsProvider）。
 */

import { test, expect, type Page } from '@playwright/test';
import {
  login,
  E2E_ENABLED,
  E2E_SKIP_REASON,
  openManageNav,
} from './fixtures/helpers';

test.skip(!E2E_ENABLED, E2E_SKIP_REASON);

const USERNAME = 'e2e-async-job';
const PASSWORD = 'e2e-Async-Job-1!';
const SUBMIT_TOAST = /已提交，正在后台执行（任务 #job_\d+）/;

/** 在页面上下文里发写请求（回显 CSRF 双匹配，与 batch-operations 同口径）。 */
async function apiWrite(
  page: Page,
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<number> {
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

async function createTargetUser(page: Page): Promise<void> {
  const body = {
    username: USERNAME,
    display_name: '异步验收甲',
    email: 'e2e-async-job@example.com',
    password: PASSWORD,
    role: 'user',
    status: 'active',
    account_kind: 'human',
  };
  const res = await page.evaluate(
    async ({ body }) => {
      const csrf = document.cookie
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith('fmby_csrf='))
        ?.split('=')[1];
      const resp = await fetch('/api/manage/users', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'x-requested-with': 'FMBY-Web',
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
        },
        body: JSON.stringify(body),
      });
      return { status: resp.status, body: await resp.text() };
    },
    { body },
  );
  // 重复跑（同名残留）容错：201/200 通过，409 视为已存在可继续
  if (![200, 201, 409].includes(res.status)) {
    throw new Error(`create user → ${res.status}: ${res.body.slice(0, 400)}`);
  }
}

/** 延迟所有 PATCH /api/manage/users/{id}（让「执行中」窗口可确定性断言）。 */
function delayUserPatch(page: Page, ms: number): void {
  void page.route('**/api/manage/users/*', async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.continue();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, ms));
    const resp = await route.fetch();
    if (resp.status() >= 400) {
      console.log('[spec] PATCH →', resp.status(), (await resp.text()).slice(0, 400));
    }
    await route.fulfill({ response: resp });
  });
}

/** 429 一次后放行（高负载语义：受理但忙；本层退避重试应成功）。 */
function busyThenPassUserPatch(page: Page): void {
  let busyFired = false;
  void page.route('**/api/manage/users/*', async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.continue();
      return;
    }
    if (!busyFired) {
      busyFired = true;
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: '{"error":"busy"}',
      });
      return;
    }
    await route.continue();
  });
}

async function openEditAndRename(page: Page, newName: string): Promise<void> {
  const row = page.getByRole('row', { name: new RegExp(USERNAME) });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole('button', { name: '编辑' }).click();
  const nameInput = page.getByLabel('显示名');
  await expect(nameInput).toBeVisible({ timeout: 10_000 });
  await nameInput.fill(newName);
  await page.getByRole('button', { name: '保存修改' }).click();
}

test.describe('FE-ASYNC-FEEDBACK 异步反馈验收', () => {
  test('① 提交即反馈 ≤200ms + 抽屉不锁 + ② 任务中心可见 + ③ 完成状态变', async ({ page }) => {
    await login(page);
    await createTargetUser(page);
    delayUserPatch(page, 2_500);

    await page.goto('/manage/site/users/accounts');
    await openEditAndRename(page, '异步验收乙');

    // ① 提交即反馈 ≤200ms（点击后 toast 同步入队；这里给 200ms 上限口径）
    await expect(page.getByText(SUBMIT_TOAST).first()).toBeVisible({ timeout: 200 });
    // ① 按钮不被锁：抽屉立即关闭（保存按钮消失）
    await expect(page.getByRole('button', { name: '保存修改' })).toBeHidden({ timeout: 2_000 });

    // ② 任务中心「后台任务」区可见该任务（执行中）。
    // ★用 SPA 导航（点侧栏链接），不用 goto——整页刷新会重置内存态
    // （job 状态跨整页刷新持久化属 E1 契约范围，见报告待对齐清单）。
    // ★mobile-chrome：侧栏在 ≤1023px 收进抽屉 ⇒ 先开抽屉（helpers.openManageNav）
    await openManageNav(page);
    await page.getByRole('link', { name: '任务中心' }).click();
    await expect(page.getByRole('heading', { name: '后台任务' })).toBeVisible({ timeout: 15_000 });
    const row = page.getByRole('row', { name: new RegExp(USERNAME) });
    await expect(row).toBeVisible({ timeout: 5_000 });
    await expect(row.getByText('执行中')).toBeVisible();
    await expect(row.getByText(/更新用户「e2e-async-job」/)).toBeVisible();
    await expect(row.getByText(/^\d{2}:\d{2}:\d{2}$/).first()).toBeVisible(); // 开始时间

    // ③ 完成后状态变「已完成」（延迟 2.5s 的真实 PATCH 200 驱动）
    await expect(row.getByText('已完成')).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText('执行中')).toHaveCount(0);

    // 结果落库断言：displayName 真的改了（不是只改了 UI）
    await page.goto('/manage/site/users/accounts');
    await expect(page.getByRole('row', { name: /异步验收乙/ })).toBeVisible({ timeout: 15_000 });
  });

  test('幂等：进行中重复提交 ⇒ 「已在执行」toast + 不产生第二行', async ({ page }) => {
    await login(page);
    await createTargetUser(page);
    // 8s：重开抽屉（row→编辑→detail→fill→save）约 3-5s，窗口必须盖住第二次提交
    delayUserPatch(page, 8_000);

    await page.goto('/manage/site/users/accounts');
    await openEditAndRename(page, '幂等一轮');
    await expect(page.getByText(SUBMIT_TOAST).first()).toBeVisible({ timeout: 200 });

    // 抽屉已关；立即重开再保存 —— 同 key（user-update:{id}）仍在 running ⇒ 幂等拒绝
    await openEditAndRename(page, '幂等二轮');

    await expect(page.getByText(/该操作已在执行中（任务 #job_\d+）/).first()).toBeVisible({
      timeout: 200,
    });
    // 抽屉未被关闭（submit 返回 null ⇒ 调用方不清空/不关闭）
    await expect(page.getByRole('button', { name: '保存修改' })).toBeVisible();

    // 全程只有一行该任务（没有重复提交产生的第二行）（SPA 导航保内存态）。
    // ★先关抽屉（Escape → Radix onOpenChange(false) → onClose）：Radix 模态
    // 会挡住外部点击（侧栏链接点不到）；「取消」只切查看态不关抽屉。
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: '保存修改' })).toBeHidden({ timeout: 5_000 });
    // ★mobile-chrome：侧栏在 ≤1023px 收进抽屉 ⇒ 先开抽屉（helpers.openManageNav）
    await openManageNav(page);
    await page.getByRole('link', { name: '任务中心' }).click();
    await expect(page.getByRole('heading', { name: '后台任务' })).toBeVisible({ timeout: 15_000 });
    const rows = page.getByRole('row', { name: new RegExp(USERNAME) });
    await expect(rows).toHaveCount(1, { timeout: 15_000 });
    await expect(rows.first().getByText('已完成')).toBeVisible({ timeout: 15_000 });
  });

  test('④ 高负载（429）：「系统繁忙，已转后台执行，完成后通知你」+ 自动重试后完成', async ({
    page,
  }) => {
    await login(page);
    await createTargetUser(page);
    busyThenPassUserPatch(page);

    await page.goto('/manage/site/users/accounts');
    await openEditAndRename(page, '高负载验收');

    await expect(page.getByText(SUBMIT_TOAST).first()).toBeVisible({ timeout: 200 });
    // ④ 文案（第一次 429 触发）
    await expect(page.getByText('系统繁忙，已转后台执行，完成后通知你')).toBeVisible({
      timeout: 5_000,
    });

    // 退避重试（3s）后第二次请求放行 ⇒ 完成（SPA 导航保内存态）
    // ★mobile-chrome：侧栏在 ≤1023px 收进抽屉 ⇒ 先开抽屉（helpers.openManageNav）
    await openManageNav(page);
    await page.getByRole('link', { name: '任务中心' }).click();
    const row = page.getByRole('row', { name: new RegExp(USERNAME) });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText('已完成')).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText('失败')).toHaveCount(0);
  });
});
