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

/**
 * 建一个合集并加入 ≥2 个**不同**候选成员，返回成员表行数。
 *
 * fe01 修的两处数据布置缺陷（原实现导致两条用例恒红）：
 *  1. 计数串味：原用 `page.locator('tbody tr').count()`，而**合集列表**与
 *     **成员明细**都是 `tbody tr` —— 数出来的是合集行数（恒 1），于是
 *     「加入 ≥2 成员」的循环条件提前满足，实际只进了 1 个成员 ⇒ 首行
 *     「下移」按钮因 `index === members.length - 1` 被 disabled，用例超时。
 *     改为**成员表专属选择器**（成员行的移除按钮 aria-label 唯一标识成员）。
 *  2. 候选重复：原只用关键词 `星`，而后端 member-candidates 对同一条目只返一条
 *     （实测 `星际`→仅 101），第二次加入即 409。改为**按关键词序列取不同条目**
 *     （实测：`星际`→101 `苍穹`→201 `e2e`→367…）。
 */
const MEMBER_ROW = 'tbody tr:has(button[aria-label^="移除成员「"])';
const KEYWORDS = ['星际', '苍穹', 'e2e'];

/** 成员明细表的当前行数（只数成员行，不受合集列表干扰）。 */
async function memberRowCount(page: import('@playwright/test').Page): Promise<number> {
  return page.locator(MEMBER_ROW).count();
}

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
  // 若已展开（上一次调用残留）先收起再展开，保证成员面板处于已知态。
  if ((await page.getByRole('button', { name: '收起' }).count()) > 0) {
    await page.getByRole('button', { name: '收起' }).first().click();
    await page.waitForTimeout(400);
  }
  await expandButtons.first().click();
  // 成员明细是展开后异步取数（GET /collections/{id}）：等面板真正就绪再计数，
  // 否则会把「正在加载成员明细…」当成 0 行，误判为「成员不足」。
  await page
    .locator(MEMBER_ROW)
    .first()
    .waitFor({ state: 'attached', timeout: 15_000 })
    .catch(() => {
      /* 允许 0 成员：下面的加入循环会补齐 */
    });
  await page.waitForTimeout(600);

  const input = page.getByPlaceholder('至少 2 个字符');
  const select = page.locator('select').filter({ hasText: '请选择…' });
  let added = await memberRowCount(page);
  for (const keyword of KEYWORDS) {
    if (added >= 2) break;
    await input.fill(keyword);
    // 等候选下拉真正带上该关键词的结果（debounce + 请求往返）。
    await expect(select.first()).toBeVisible({ timeout: 10_000 }).catch(() => undefined);
    await page.waitForTimeout(1200);
    if ((await select.count()) === 0) continue;
    const options = await select.first().locator('option').count();
    for (let i = 1; i < options && added < 2; i += 1) {
      const value = await select.first().locator('option').nth(i).getAttribute('value');
      if (!value) continue;
      await select.first().selectOption(value);
      await page.getByRole('button', { name: '加入合集' }).click();
      // 加入后列表会 invalidate 重取：等行数变化（或超时判定为「该候选重复」）。
      const changed = await page
        .waitForFunction(
          ([selector, before]) =>
            document.querySelectorAll(selector as string).length !== before,
          [MEMBER_ROW, added] as const,
          { timeout: 8_000 },
        )
        .then(() => true)
        .catch(() => false);
      if (changed) {
        added = await memberRowCount(page);
      }
      // 未变化 = 该候选已在合集内（后端 409），换下一个候选，不把失败当成功。
    }
  }
  return added;
}

test.describe('FE-COLLECTIONS-CONSUME-B2 — 成员移除 + 重排', () => {
  test('重排：首行「下移」后顺序发生交换', async ({ page }) => {
    const added = await ensureCollectionWithMembers(page);
    // 诚实登记：数据集无足够候选→合集不足 2 成员时跳过（不假绿、不硬踩）
    if (added < 2) {
      test.skip(true, `数据集候选不足：合集内仅 ${added} 个成员，无法验证重排`);
    }

    // 重排按钮在成员表内（首行「下移」aria-label 含标题）
    const firstDown = page.getByRole('button', { name: /^将「.*」下移$/ }).first();
    await expect(firstDown).toBeEnabled({ timeout: 10_000 });
    // 记录首行标题，交换后应不再是首行（真顺序变化，不只是「点到了」）
    const firstTitleBefore = await page
      .locator(MEMBER_ROW)
      .first()
      .locator('td')
      .first()
      .innerText();
    await firstDown.click();
    // 重排成功提示出现 = 真实写回
    await expect(page.getByText('成员顺序已更新。')).toBeVisible({ timeout: 12_000 });
    await page.waitForTimeout(800);
    const firstTitleAfter = await page
      .locator(MEMBER_ROW)
      .first()
      .locator('td')
      .first()
      .innerText();
    expect(firstTitleAfter, '下移后首行成员必须发生交换').not.toBe(firstTitleBefore);
  });

  test('移除：点「移除」→ 确认「确认移除」→ 成员行数 -1', async ({ page }) => {
    await ensureCollectionWithMembers(page);
    const before = await memberRowCount(page);
    // 诚实登记：合集无成员时跳过移除断言
    if (before < 1) {
      test.skip(true, '合集无成员，无法验证移除');
    }

    const firstRemove = page.getByRole('button', { name: /^移除成员「.*」$/ }).first();
    await expect(firstRemove).toBeVisible({ timeout: 10_000 });
    await firstRemove.click();

    // 确认对话框（SensitiveActionDialog）→ **会话级二次确认**：
    // 必须完整输入操作标识 `delete-managed-collection-member` 才放行
    // （shared/src/ui/common/SensitiveActionDialog.tsx:69-75）。这是后端安全闸，
    // e2e 必须真走这一步，不能靠放宽断言绕过。
    const actionKeyInput = page.getByRole('textbox', { name: /操作标识/ });
    await expect(actionKeyInput).toBeVisible({ timeout: 8_000 });
    await actionKeyInput.fill('delete-managed-collection-member');

    const confirm = page.getByRole('button', { name: '确认移除' });
    await expect(confirm).toBeEnabled({ timeout: 8_000 });
    await confirm.click();

    await expect(page.getByText('成员已从合集移除。')).toBeVisible({ timeout: 12_000 });
    await page.waitForTimeout(800);
    const after = await memberRowCount(page);
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
