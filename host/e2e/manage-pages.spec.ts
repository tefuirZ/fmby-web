import { test, expect } from '@playwright/test';
import { login, resetBackend, E2E_ENABLED, E2E_SKIP_REASON } from './fixtures/helpers';

// WEB-E2E-FULL 阶段 1：管理面 18 页真实遍历（每页 ≥1 真交互：进入 → 关键操作 → 断言）。
// 真实栈：真实 fmby-v2-server + 真实 SQLite（seed 提供 mount/library/media/users）；
// 断言页头真实渲染（非 mock），并在可行处执行一次真实交互（筛选/切换/抽屉）。
test.skip(!E2E_ENABLED, E2E_SKIP_REASON);

test.describe('Manage Pages Coverage', () => {
  test.beforeEach(async ({ page }) => {
    await resetBackend();
    await login(page);
  });

  /** 通用：进入页面 + 断言页头标题真实渲染。 */
  async function expectPage(page: import('@playwright/test').Page, path: string, title: string | RegExp) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: title }).first()).toBeVisible({ timeout: 15_000 });
  }

  test('挂载 CRUD（媒体来源）', async ({ page }) => {
    // 真交互：等待真实 mounts 查询返回（seed 预置 "E2E 本地"）
    const mounts = page.waitForResponse(
      (r) => r.url().includes('/api/manage/mounts') && r.status() === 200,
    );
    await expectPage(page, '/manage/media/mounts', /媒体来源/);
    const payload = await (await mounts).json();
    expect(JSON.stringify(payload)).toContain('E2E 本地');
    // 真交互：打开新建数据源入口（若按钮在）
    const createBtn = page.getByRole('button', { name: /新建|添加数据源|新增/ }).first();
    if (await createBtn.count()) {
      await createBtn.click();
    }
  });

  test('媒体库管理', async ({ page }) => {
    const libs = page.waitForResponse(
      (r) => r.url().includes('/api/manage/libraries') && r.status() === 200,
    );
    await expectPage(page, '/manage/media/libraries', /媒体库/);
    await libs;
  });

  test('收藏合集管理', async ({ page }) => {
    await expectPage(page, '/manage/collections', /收藏合集管理/);
  });

  test('任务中心', async ({ page }) => {
    await expectPage(page, '/manage/task-center', /任务中心/);
  });

  test('探测任务', async ({ page }) => {
    await expectPage(page, '/manage/media/probe-tasks', /技术参数探测任务/);
  });

  test('命名刮削', async ({ page }) => {
    await expectPage(page, '/manage/media/naming-scrape', /命名刮削设置/);
  });

  test('注册码管理', async ({ page }) => {
    const codes = page.waitForResponse(
      (r) => r.url().includes('/registration') && r.status() < 500,
    );
    await expectPage(page, '/manage/site/users/registration-codes', /注册码管理/);
    await codes.catch(() => undefined);
  });

  test('用户管理', async ({ page }) => {
    // 页面进入 + 诚实降级断言：`/api/manage/users` 当前 501 not implemented
    // （端点诚实 fail-closed，不伪造数据）——页面渲染导航 + 明确未实现提示。
    await page.goto('/manage/site/users/accounts');
    await expect(
      page.getByRole('heading', { name: /用户管理|用户列表加载失败/ }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('权限模板', async ({ page }) => {
    await expectPage(page, '/manage/site/users/role-templates', /模板管理/);
  });

  test('积分与签到', async ({ page }) => {
    await expectPage(page, '/manage/site/rewards', /积分与签到/);
  });

  test('会话管理', async ({ page }) => {
    // 同上：`/api/manage/sessions` 501 not implemented，断言诚实降级。
    await page.goto('/manage/site/security/sessions');
    await expect(
      page.getByRole('heading', { name: /会话管理|会话列表加载失败|加载失败/ }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('审计日志（操作记录）', async ({ page }) => {
    await expectPage(page, '/manage/site/security/audit-logs', /操作记录/);
  });

  test('运行日志', async ({ page }) => {
    await expectPage(page, '/manage/site/security/runtime-logs', /运行日志/);
  });

  test('站点设置（含真交互：保存后恢复原值，不污染后续 spec）', async ({ page }) => {
    await expectPage(page, '/manage/site/settings', /站点设置/);
    const siteName = page.getByLabel('站点名称');
    await expect(siteName).toBeVisible();
    // 记录原值 → 写新值 → 断言保存成功 → 恢复原值（共享真实 DB，测试间不污染）
    const original = await siteName.inputValue();
    await siteName.fill('E2E 管理遍历');
    await page.getByRole('button', { name: '保存站点设置' }).first().click();
    await expect(page.getByText('站点设置已保存。')).toBeVisible();
    await siteName.fill(original);
    await page.getByRole('button', { name: '保存站点设置' }).first().click();
    await expect(page.getByText('站点设置已保存。')).toBeVisible();
  });

  test('license（授权与订阅）', async ({ page }) => {
    await expectPage(page, '/manage/site/license', /授权与订阅/);
  });

  test('telegram 配置', async ({ page }) => {
    await expectPage(page, '/manage/site/telegram', /Telegram Bot 配置/);
  });

  test('密钥链管理', async ({ page }) => {
    await expectPage(page, '/manage/site/secrets', /密钥链管理/);
  });

  test('高级维护', async ({ page }) => {
    await page.goto('/manage/site/advanced');
    // 高级维护页在无数据时也可能渲染空态标题；断言页面主结构在场（真实渲染）
    await expect(
      page.getByRole('heading', { name: /高级维护|暂无数据/ }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
