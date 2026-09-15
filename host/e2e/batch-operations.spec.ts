import { test, expect } from '@playwright/test';
import { login, resetBackend, E2E_ENABLED, E2E_SKIP_REASON } from './fixtures/helpers';

test.skip(!E2E_ENABLED, E2E_SKIP_REASON);

/** 在页面上下文里按 client.ts 同口径发写请求（回显 CSRF 双匹配）。 */
async function apiWrite(
  page: import('@playwright/test').Page,
  method: 'POST' | 'DELETE',
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

/**
 * FE-OPT-04：管理面批量操作体感（真实栈 e2e）。
 *
 * 选用 **合集（collections）** 作为真实批量链路：`POST/GET/DELETE /api/manage/collections`
 * 均已接线（实测 create→list→delete 200），可完整跑通
 * 「多选 → 批量删除 → 逐条进度 → 列表缩减」。
 *
 * 挂载页批量亦已接线，但 `DELETE /api/manage/mounts/{id}` 后端要求
 * **`?confirmed=true`** 而前端 `deleteMount` 只发 body `confirm_action`（契约仓
 * 已登记 **G-06**：危险操作确认口径不一致）→ 单删/批删在 UI 上恒 400（前置
 * blocker，见 handoff/evidence，不在本卡范围）。故 e2e 用合集验证批量内核。
 */
test.describe('FE-OPT-04 批量操作体感', () => {
  test.beforeEach(async ({ page }) => {
    await resetBackend();
    await login(page);
  });

  test('合集列表：全选 → 批量删除 → 逐条进度 + 列表缩减', async ({ page }) => {
    // 1) 预置 3 个合集（真实 POST /api/manage/collections）。
    const statuses: number[] = [];
    for (const title of ['E2E 批量-甲', 'E2E 批量-乙', 'E2E 批量-丙']) {
      statuses.push(
        await apiWrite(page, 'POST', '/api/manage/collections', {
          title,
          visibility: 'Active',
        }),
      );
    }
    expect(statuses.every((s) => s === 200 || s === 201)).toBe(true);

    // 2) 进入合集页（真实 GET 返回 3 条）。
    const listResp = page.waitForResponse(
      (r) => r.url().includes('/api/manage/collections') && r.status() === 200,
    );
    await page.goto('/manage/collections');
    await listResp;
    await expect(page.getByText('E2E 批量-甲').first()).toBeVisible();

    // 3) 全选 → 批量动作条出现。
    await page.getByRole('button', { name: '全选' }).click();
    const bar = page.getByRole('region', { name: '批量操作' });
    await expect(bar).toBeVisible();
    await expect(bar).toContainText('已选择 3 项');

    // 4) 触发批量删除 → 确认。
    await page.getByRole('button', { name: '批量删除' }).click();
    await expect(page.getByText(/批量删除 3 个合集/)).toBeVisible();
    // 危险操作为会话级二次确认：必须完整输入操作标识才放行。
    await page.getByRole('textbox', { name: /操作标识/ }).fill('delete-managed-collection');
    await page.getByRole('button', { name: '确认批量删除' }).click();

    // 5) 逐条进度面板出现（进度条 + 计数）。
    const panel = page.locator('[role="status"]').filter({ hasText: /批量删除合集/ });
    await expect(panel).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByRole('progressbar')).toBeVisible();

    // 6) 列表缩减为 0（真实 DELETE 逐条成功）。
    await expect
      .poll(
        async () => {
          const r = await page.request.get('/api/manage/collections', {
            headers: { 'x-requested-with': 'FMBY-Web' },
          });
          const body = await r.json();
          return Array.isArray(body) ? body.length : -1;
        },
        { timeout: 15_000 },
      )
      .toBe(0);
    await expect(panel).toContainText(/成功 3/);
  });

  test('合集列表：范围选（shift）与反选/清空交互', async ({ page }) => {
    const statuses: number[] = [];
    for (const title of ['E2E 范围-甲', 'E2E 范围-乙', 'E2E 范围-丙']) {
      statuses.push(
        await apiWrite(page, 'POST', '/api/manage/collections', {
          title,
          visibility: 'Hidden',
        }),
      );
    }
    expect(statuses.every((s) => s === 200 || s === 201)).toBe(true);

    const listResp = page.waitForResponse(
      (r) => r.url().includes('/api/manage/collections') && r.status() === 200,
    );
    await page.goto('/manage/collections');
    await listResp;

    const checkboxes = page.getByRole('checkbox', { name: /选择合集/ });
    const count = await checkboxes.count();
    expect(count).toBeGreaterThanOrEqual(3);

    // 首项点击 + 末项 shift 点击 → 范围选（含中间项）。
    await checkboxes.nth(0).click();
    await checkboxes.nth(count - 1).click({ modifiers: ['Shift'] });
    const bar = page.getByRole('region', { name: '批量操作' });
    await expect(bar).toContainText(`已选择 ${count} 项`);

    // 反选（全选 → 全不选）→ 动作条消失。
    await page.getByRole('button', { name: '反选' }).click();
    await expect(bar).toBeHidden();

    // 全选 → 清空本页 → 再次消失。
    await page.getByRole('button', { name: '全选' }).click();
    await expect(bar).toBeVisible();
    await page.getByRole('button', { name: '清空本页' }).click();
    await expect(bar).toBeHidden();
  });
});
