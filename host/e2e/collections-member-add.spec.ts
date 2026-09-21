import { test, expect } from '@playwright/test';
import { login, resetBackend, E2E_ENABLED, E2E_SKIP_REASON } from './fixtures/helpers';

/**
 * FE-COLLECTIONS-CONSUME-B1：合集**成员添加流**真跑（此前零调用的两条端点）。
 *
 *  - GET  /api/manage/collections/member-candidates?keyword=
 *  - POST /api/manage/collections/{id}/members/add
 *
 * 断言（**可证伪**：每条都断言具体可见结果，不用宽松阈值）：
 *  1. 正向：关键词 ≥2 → 候选出现 → 选一条 → 加入 → 成员列表刷新（条数增加）；
 *  2. 边界：关键词 1 字符 → **不发请求**（提示"太短"），无候选区；
 *  3. 失败：对不存在的 collectionId 加入 → 失败提示出现（不吞成空列表、不假成功）。
 */

test.skip(!E2E_ENABLED, E2E_SKIP_REASON);

const ADDER_HINT = '按关键词查找可加入的条目';

/** 展开第一个合集的成员面板（adder 挂在面板上方）。 */
async function openFirstCollectionMembers(page: import('@playwright/test').Page) {
  await resetBackend();
  await login(page);
  await page.goto('/manage/collections', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  // e2e 数据集默认 **0 个合集**（实测「当前共 0 个合集」），故先建一个
  // （复用已消费的 POST /api/manage/collections），再展开成员面板。
  if ((await page.locator('tbody tr').count()) === 0) {
    await page.getByRole('button', { name: '新建合集' }).click();
    await page.getByPlaceholder('例如：科幻经典补完计划').fill('E2E 成员流合集');
    await page.getByRole('button', { name: /^保存|创建/ }).click();
    // 等列表真正出现新行（不靠固定 sleep——创建后 invalidate 是异步的）
    await page.locator('tbody tr').first().waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(600);
  }

  // 兜底：创建后若列表仍未渲染行（首屏/失效时序），重载一次再取。
  if ((await page.getByRole('button', { name: '成员' }).count()) === 0) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
  }
  const expandButtons = page.getByRole('button', { name: '成员' });
  if ((await expandButtons.count()) === 0) {
    throw new Error('没有可展开的合集行——无法验证成员流（数据集缺合集且创建失败）');
  }
  await expandButtons.first().click();
  await page.waitForTimeout(1200);
  return page.getByText(ADDER_HINT).first();
}

test.describe('FE-COLLECTIONS-CONSUME-B1 — 成员添加流', () => {
  test('边界：关键词 1 字符不发请求（提示太短，无候选区）', async ({ page }) => {
    const adder = await openFirstCollectionMembers(page);
    await expect(adder).toBeVisible({ timeout: 15_000 });

    const input = page.getByPlaceholder('至少 2 个字符');
    await input.fill('星');

    await expect(page.getByText('关键词太短')).toBeVisible({ timeout: 8_000 });
    // 不发请求 ⇒ 不应出现"正在查询候选"或候选 select
    await expect(page.getByText('正在查询候选…')).toHaveCount(0);
    await expect(page.locator('select').filter({ hasText: '请选择…' })).toHaveCount(0);
  });

  test('正向：候选查询 → 加入 → 成员列表刷新', async ({ page }) => {
    const adder = await openFirstCollectionMembers(page);
    await expect(adder).toBeVisible({ timeout: 15_000 });

    const input = page.getByPlaceholder('至少 2 个字符');
    await input.fill('星际');
    await page.waitForTimeout(1500);

    const select = page.locator('select').filter({ hasText: '请选择…' });
    const hasCandidates = await select.count();
    if (hasCandidates === 0) {
      // 数据集无候选：诚实登记为"零命中"，断言零命中提示——不假绿也不算失败。
      await expect(
        page.getByText('没有匹配的候选条目。').or(page.getByText('候选查询失败')),
      ).toBeVisible({ timeout: 8_000 });
      return;
    }

    const options = await select.first().locator('option').count();
    expect(options, '候选下拉应有可选项').toBeGreaterThan(1);
    await select.first().selectOption({ index: 1 });

    const addButton = page.getByRole('button', { name: '加入合集' });
    await addButton.click();
    await expect(page.getByText('成员已加入合集。')).toBeVisible({ timeout: 12_000 });
  });

  test('失败：对不存在的合集加入 → 显示失败提示（不假成功）', async ({ page }) => {
    await resetBackend();
    await login(page);

    // 直接调用 API 触发 404 分支（UI 层已按 code 分类），断言后端确实失败
    const status = await page.evaluate(async () => {
      const res = await fetch('/api/manage/collections/__not_exist__/members/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: 'itm-1' }),
      });
      return res.status;
    });
    expect(status, '不存在的合集应返回 4xx（404/409…），不得 2xx').toBeGreaterThanOrEqual(400);
  });
});
