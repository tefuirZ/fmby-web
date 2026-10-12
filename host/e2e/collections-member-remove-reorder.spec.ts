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
// 成员行必须是**成员面板内真正的成员 tr**。注意：展开容器 `<tr><td colSpan=7>`
// 也 `has()` 后代的成员按钮 ⇒ 用 tr 计数会虚高 1（实测：1 个成员时数出 2）。
// 改用「成员数 = 移除按钮数」——每个成员行恰好一个「移除成员「X」」按钮。
const MEMBER_REMOVE = 'button[aria-label^="移除成员「"]';
const KEYWORDS = ['星际', '苍穹', 'e2e'];

/** 当前成员数（= 移除按钮数，不受合集列表与展开容器干扰）。 */
async function memberRowCount(page: import('@playwright/test').Page): Promise<number> {
  return page.locator(MEMBER_REMOVE).count();
}

async function ensureCollectionWithMembers(
  page: import('@playwright/test').Page,
): Promise<number> {
  await resetBackend();
  await login(page);
  await page.goto('/manage/collections', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  // fe01：完整跑（全 spec 串行）时，前面的 spec（batch-operations 删合集 /
  // collections-member-add 加成员）会留下**脏合集**，复用 first() 会读到
  // 不可控的成员数（实测：读到只有 1 个成员的合集 ⇒ 「下移」恒 disabled）。
  // 改为**每次新建一个专属合集**（标题带时间戳），把用例隔离到自己的数据上。
  const title = `E2E 移除重排 ${Date.now()}`;
  await page.getByRole('button', { name: '新建合集' }).click();
  await page.getByPlaceholder('例如：科幻经典补完计划').fill(title);
  await page.getByRole('button', { name: /^保存|创建/ }).click();
  // 等创建真实落库（列表 invalidate 重取有往返），再 reload 取干净的服务端状态。
  // rv01 Minor 1：原写法 `expect(...).catch(() => undefined)` 会把失败吞掉，
  // 与后面「按标题定位行」的真判据混成同一种形状（后人照抄会变成零断言假绿）。
  // 改 `expect.soft(...)`：toast 时机抖动只记录不误杀，但仍计入失败。
  await expect
    .soft(page.getByText('合集已创建。'), '创建合集应给出成功提示（软断言）')
    .toBeVisible({ timeout: 15_000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const row = page.locator('tbody tr', { hasText: title }).first();
  await row.waitFor({ state: 'visible', timeout: 15_000 });
  const expandButton = row.getByRole('button', { name: '成员' }).first();
  await expandButton.waitFor({ state: 'visible', timeout: 15_000 });
  await expandButton.click();
  // 成员明细是展开后异步取数（GET /collections/{id}）：等面板真正就绪再计数，
  // 否则会把「正在加载成员明细…」当成 0 行，误判为「成员不足」。
  await page.waitForTimeout(600);

  const input = page.getByPlaceholder('至少 2 个字符');
  // 候选下拉必须**精确定位**：展开的合集行下方同时存在「预设模板」下拉
  // （CollectionPresetCreate，首项「请选择模板…」），用 `select.first()` 会随
  // 渲染时机在两者间跳变（实测：第二次循环选中了模板下拉 ⇒ 加入的是空值）。
  // 用包裹式 <label> 的可访问名定位「候选条目」下拉。
  const select = page.getByLabel('候选条目');
  let added = await memberRowCount(page);
  for (const keyword of KEYWORDS) {
    if (added >= 2) break;
    await input.fill(keyword);
    // 等候选下拉真正带上该关键词的结果（debounce + 请求往返）。
    await page.waitForTimeout(1800);
    if ((await select.count()) === 0) continue;
    const options = await select.locator('option').count();
    for (let i = 1; i < options && added < 2; i += 1) {
      const value = await select.locator('option').nth(i).getAttribute('value');
      if (!value) continue;
      await select.selectOption(value);
      await page.getByRole('button', { name: '加入合集' }).click();
      // 加入后列表 invalidate 重取：按「成员行数不再变化」收敛后重取计数。
      // 不依赖「行数必须变了」——若该候选已在合集内（后端 409），行数本就不变，
      // 这时换下一个候选即可，不该把「没变化」当成失败。
      // 加入后列表 invalidate 重取：轮询到成员数稳定（最多 6s）。
      let last = -1;
      let now = added;
      for (let t = 0; t < 12; t += 1) {
        await page.waitForTimeout(500);
        now = await memberRowCount(page);
        if (now === last) break;
        last = now;
      }
      if (now > added) added = now;
    }
  }
  return added;
}

test.describe('FE-COLLECTIONS-CONSUME-B2 — 成员移除 + 重排', () => {
  test('重排：首行「下移」后顺序发生交换', async ({ page }) => {
    const added = await ensureCollectionWithMembers(page);
    // rv01 Minor 2：原写法是「成员数不足 ⇒ skip ⇒ 绿」，等于给了
    // 「加入成员的功能坏了 ⇒ added=0 ⇒ 绿」一条通道 —— 与本卡「不要静默 skip」
    // 的主题相悖。改为**显式断言**：不够 2 个成员就是数据布置或功能坏了，置红。
    expect(
      added,
      `数据布置失败：合集内仅 ${added} 个成员（需 ≥2 才能验证重排）——` +
        '可能是候选端点无数据，也可能是加入成员功能坏了，二者都必须暴露',
    ).toBeGreaterThanOrEqual(2);

    // 重排按钮在成员表内（首行「下移」aria-label 含标题）
    const firstDown = page.getByRole('button', { name: /^将「.*」下移$/ }).first();
    await expect(firstDown).toBeEnabled({ timeout: 10_000 });
    // 记录首行标题，交换后应不再是首行（真顺序变化，不只是「点到了」）
    const firstTitleBefore = await page
      .locator(MEMBER_REMOVE)
      .first()
      .getAttribute('aria-label');
    await firstDown.click();
    // 重排成功提示出现 = 真实写回
    await expect(page.getByText('成员顺序已更新。')).toBeVisible({ timeout: 12_000 });
    await page.waitForTimeout(800);
    const firstTitleAfter = await page
      .locator(MEMBER_REMOVE)
      .first()
      .getAttribute('aria-label');
    expect(firstTitleAfter, '下移后首行成员必须发生交换').not.toBe(firstTitleBefore);
  });

  test('移除：点「移除」→ 确认「确认移除」→ 成员行数 -1', async ({ page }) => {
    await ensureCollectionWithMembers(page);
    const before = await memberRowCount(page);
    // 同上（rv01 Minor 2）：无成员 ⇒ 置红，不 skip。
    expect(
      before,
      '数据布置失败：合集内没有任何成员，无法验证移除',
    ).toBeGreaterThanOrEqual(1);

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
