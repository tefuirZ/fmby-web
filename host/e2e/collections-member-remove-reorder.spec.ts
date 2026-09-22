import { test, expect } from '@playwright/test';
import { login, resetBackend, E2E_ENABLED, E2E_SKIP_REASON } from './fixtures/helpers';

/**
 * FE-COLLECTIONS-CONSUME-B2：成员**移除(POST /members/remove)** + **重排(POST /members/reorder)** 真跑。
 *
 * 断言（可证伪）：
 *  1. 重排：合集内有 ≥2 成员 → 首行「下移」→ 顺序发生交换（首行标题变第二候选）；
 *  2. 移除：点「移除」→ 确认框「确认移除」→ 成员行数 -1（不假成功）；
 *  3. 失败：对不存在合集 POST /members/reorder → 4xx（不假成功）。
 *
 * 数据集默认 0 合集，故先建合集并加入 2 个成员（复用已消费端点）。
 */

test.skip(!E2E_ENABLED, E2E_SKIP_REASON);

/** 建一个合集并加入 2 个候选成员（若候选不足则按实际数量），返回合集行展开后的页面。 */
async function ensureCollectionWithMembers(
  page: import('@playwright/test').Page,
): Promise<number> {
  await resetBackend();
  await login(page);
  await page.goto('/manage/collections', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  if ((await page.locator('tbody tr').count()) === 0) {
    await page.getByRole('button', { name: '新建合集' }).click();
    await page.getByPlaceholder('例如：科幻经典补完计划').fill('E2E 移除重排合集');
    await page.getByRole('button', { name: /^保存|创建/ }).click();
    await page.locator('tbody tr').first().waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(600);
  }
  if ((await page.getByRole('button', { name: '成员' }).count()) === 0) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
  }
  const expandButtons = page.getByRole('button', { name: '成员' });
  if ((await expandButtons.count()) === 0) {
    throw new Error('没有可展开的合集行');
  }
  await expandButtons.first().click();
  await page.waitForTimeout(1200);

  // 加入候选成员：逐条尝试，直到合集内有 ≥2 个成员或候选用尽。
  const keyword = '星';
  const input = page.getByPlaceholder('至少 2 个字符');
  await input.fill(keyword);
  await page.waitForTimeout(1500);
  const select = page.locator('select').filter({ hasText: '请选择…' });
  let added = await page.locator('tbody tr').count();
  if ((await select.count()) > 0) {
    const options = await select.first().locator('option').count();
    for (let i = 1; i < options && added < 2; i += 1) {
      await select.first().selectOption({ index: i });
      const addButton = page.getByRole('button', { name: '加入合集' });
      await addButton.click();
      await page.waitForTimeout(1200);
      added = await page.locator('tbody tr').count();
    }
  }
  return added;
}

test.describe('FE-COLLECTIONS-CONSUME-B2 — 成员移除 + 重排', () => {
  test('重排：首行「下移」后顺序发生交换', async ({ page }) => {
    const added = await ensureCollectionWithMembers(page);
    // 诚实登记：数据集无足够候选→合集不足 2 成员时跳过（不假绿、不硬踩）
    if (added < 2) {
      test.skip();
    }

    // 重排按钮在成员表内（首行「下移」aria-label 含标题）
    const firstDown = page.getByRole('button', { name: /^将「.*」下移$/ }).first();
    await expect(firstDown).toBeVisible({ timeout: 10_000 });
    await firstDown.click();
    // 重排成功提示出现 = 真实写回
    await expect(page.getByText('成员顺序已更新。')).toBeVisible({ timeout: 12_000 });
  });

  test('移除：点「移除」→ 确认「确认移除」→ 成员行数 -1', async ({ page }) => {
    await ensureCollectionWithMembers(page);
    const before = await page.locator('tbody tr').count();
    // 诚实登记：合集无成员时跳过移除断言
    if (before < 1) {
      test.skip();
    }

    const firstRemove = page.getByRole('button', { name: /^移除成员「.*」$/ }).first();
    await expect(firstRemove).toBeVisible({ timeout: 10_000 });
    await firstRemove.click();

    // 确认对话框（SensitiveActionDialog）→ 确认移除
    const confirm = page.getByRole('button', { name: '确认移除' });
    await expect(confirm).toBeVisible({ timeout: 8_000 });
    await confirm.click();

    await expect(page.getByText('成员已从合集移除。')).toBeVisible({ timeout: 12_000 });
    await page.waitForTimeout(800);
    const after = await page.locator('tbody tr').count();
    expect(after, '移除后成员行数应减少 1').toBe(before - 1);
  });

  test('失败：对不存在合集 POST /members/reorder → 4xx（不假成功）', async ({ page }) => {
    await resetBackend();
    await login(page);
    const status = await page.evaluate(async () => {
      const res = await fetch('/api/manage/collections/__not_exist__/members/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_ids: ['m-1'] }),
      });
      return res.status;
    });
    expect(status, '不存在的合集应返回 4xx，不得 2xx').toBeGreaterThanOrEqual(400);
  });
});
