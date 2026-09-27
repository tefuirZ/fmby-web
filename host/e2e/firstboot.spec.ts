/**
 * 空库首启（安装向导）端到端 spec —— E2E-FIRSTBOOT-1
 *
 * 与其余 12 个 spec 的差别：它们跑在**预置 seed 的完成安装栈**上；本 spec 跑在
 * **全新空数据目录、无 seed** 的真实后端上（启动器 `FMBY_E2E_NO_SEED=1`）。
 * `evidence/web-e2e-full.md` §3.4 登记的就是这条缺口（`/install` 从未被端到端跑过）。
 *
 * 默认**跳过**：`pnpm e2e` 用 seed 栈，本 spec 的 A/B 断言在 seed 栈上必然不成立，
 * 不能让它把既有 12 spec 拖红。显式开启（幂等，两条命令互不干扰）：
 *
 *   空库态（期望全绿）：
 *     FMBY_E2E_FIRSTBOOT=1 FMBY_E2E_NO_SEED=1 pnpm exec playwright test firstboot.spec.ts
 *   反事实（期望 A/B 真红，证明它真在测空库首启、不是搭便车假绿）：
 *     FMBY_E2E_FIRSTBOOT=1                    pnpm exec playwright test firstboot.spec.ts
 *
 * 已知缺陷（C/D **断言的是期望的正确行为**，用 `test.fail()` 显式登记；缺陷修复后
 * 用例会「意外通过」而转红，自动提醒摘除标注 —— 形态对齐 §4 PRODUCT-DEFECT-01）：
 *  - E1/E2 → 后端卡 `INSTALL-WIZARD-APPLY-1`（`database_configured` 改由真实事实派生 +
 *    新增 apply 落盘）。现状：生产装配 `InstallRuntime::new(true)`
 *    （`crates/fmby-v2-server/src/factory/interfaces.rs:464`）恒等于「已配置」⇒
 *    `GET /api/install/status` 恒 `{"state":"configured"}`、`POST /api/install/probe/database`
 *    恒 404（`crates/fmby-v2-http/src/routes/install.rs:303-306` 已装下线）⇒ 成功横幅不可达。
 *  - E3 → 后端卡「空库无默认角色」（实测 `access_role` count=0；迁移不种角色 ⇒
 *    `POST /api/auth/setup` 返回 400 `USER_ROLE_NOT_FOUND`）⇒ 向导建不了管理员。
 */
import { test, expect } from '@playwright/test';

const FIRSTBOOT = process.env.FMBY_E2E_FIRSTBOOT === '1';

test.skip(
  !FIRSTBOOT,
  '空库首启 spec 需显式开启：FMBY_E2E_FIRSTBOOT=1（空库态再加 FMBY_E2E_NO_SEED=1）',
);

test.describe('空库首启（安装向导）', () => {
  // ---- A/B：首启判据（这两条是「空库 vs 已装」的真实判别器）----
  // 注：`/api/install/status` **不是**判别器 —— 生产装配下空库与已 seed 都返回
  // `state:"configured"`（E1），故本 spec 的判据取自 `/api/auth/entry/status`。

  test('A. 首启判据：/api/auth/entry/status 报 needs_setup=true', async ({ request }) => {
    // 轮询而非单发：preview 代理的**首个** /api 请求可能撞启动竞态
    // （实测 `[vite] http proxy error`，紧随其后后端 200）——页面类用例天然容忍，
    // 纯 API 请求需自行重试。
    await expect
      .poll(
        async () => {
          const resp = await request.get('/api/auth/entry/status');
          return resp.ok() ? ((await resp.json()) as { needs_setup: boolean }).needs_setup : null;
        },
        { message: '空库首启：/api/auth/entry/status 应报 needs_setup=true', timeout: 15_000 },
      )
      .toBe(true);
  });

  test('B. /login 进入 needs_setup 分支：渲染「创建管理员」表单而非登录表单', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('创建管理员账户以开始使用')).toBeVisible();
    await expect(page.getByRole('button', { name: '创建管理员' })).toBeVisible();
    // 分离性：needs_setup 分支下常规登录按钮不应出现
    await expect(page.getByRole('button', { name: '登录', exact: true })).toHaveCount(0);
  });

  // ---- C/D：据实登记的两条后端缺口（断言正确行为 + test.fail）----

  test('C. /install 向导：选 SQLite → 检查数据库连接 → 出现成功提示', async ({ page }) => {
    test.fail(
      true,
      'E1/E2（INSTALL-WIZARD-APPLY-1）：装配恒 configured ⇒ probe 端点 404，成功横幅不可达',
    );
    await page.goto('/install');
    await expect(page.getByRole('radio', { name: 'SQLite' })).toBeVisible();
    await page.getByLabel('数据库文件路径').fill('./data/fmby.db');
    await page.getByRole('button', { name: '检查数据库连接' }).click();
    // 期望的正确行为（当前 404 ⇒ 出错误横幅，故此处失败）
    await expect(page.getByText('数据库连接检查通过')).toBeVisible();
  });

  test('D. /login needs_setup 分支：建管理员成功 → 可用新账号登录', async ({ page }) => {
    test.fail(true, 'E3（空库无默认角色）：POST /api/auth/setup 400 USER_ROLE_NOT_FOUND');
    await page.goto('/login');
    // 前置：needs_setup 分支才有的「创建管理员」表单（非空库态快速失败，不靠 30s 超时）
    await expect(page.getByPlaceholder('管理员用户名')).toBeVisible({ timeout: 5_000 });
    await page.getByPlaceholder('管理员用户名').fill('e2e-firstboot-admin');
    await page.getByPlaceholder('至少 8 个字符').fill('e2e-firstboot-pass');
    await page.getByPlaceholder('再次输入密码').fill('e2e-firstboot-pass');
    await page.getByRole('button', { name: '创建管理员' }).click();
    // 期望的正确行为 1：成功提示（当前为错误横幅，故此处失败）
    await expect(page.getByText('管理员 e2e-firstboot-admin 创建成功，请登录')).toBeVisible();
    // 期望的正确行为 2：V2 setup 不自动登录 ⇒ 刷新后回登录表单，用新账号真登录
    await page.reload();
    await page.getByRole('textbox', { name: '用户名' }).fill('e2e-firstboot-admin');
    await page.getByRole('textbox', { name: '密码' }).fill('e2e-firstboot-pass');
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await page.waitForURL(/\/$/);
    const me = await page.evaluate(async () => {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      return res.status;
    });
    expect(me).toBe(200);
  });
});
