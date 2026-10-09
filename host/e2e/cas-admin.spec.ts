import { test, expect } from '@playwright/test';
import {
  login,
  resetBackend,
  E2E_ENABLED,
  E2E_SKIP_REASON,
} from './fixtures/helpers';

// fmby-web#8 判据 2：e2e 覆盖「发布 → CAS-only → 播放」。
//
// ## 本轮（w04）实测校正：上一版 3 条「任何环境都能真跑」的用例其实一条都没跑
//
// 上一版把凭据门写在 **describe 体内**，Playwright 把它挂到整个 describe ⇒ ①②③ 连同
// ④ 一起恒 `skipped`（真跑实测本文件 `4 skipped`，同环境 `playback.spec.ts` 2 passed
// ⇒ E2E_ENABLED 为真，被吞是门控作用域之过）。「本该真跑的用例静默不跑」正是卡面最怕
// 的假绿 ⇒ 门控收进独立 describe。
// 另修 ③ 的恒真空分支：原写 `if (fanout === 200) {…}`，而真实栈里扇出请求根本不发
// ⇒ 分支永不进入、用例恒绿等于没验。
//
// ## 判据 2 的可观测段 vs 阻塞段（逐条真跑实测，非推断）
//
// 真跑段（①–④，无需云盘凭据）：编排面接真后端、fail-closed 语义、未启用时扇出不得
// 发问、「入库 → 播放」两腿真实出流。
//
// 真实栈实测：`GET /api/admin/cas/drives` 返 **500**（桥接已装配，但 `bridges/cas_admin.rs`
// 的 `list_drive_configs` 显式 `Err(Internal)` —— 无 priority/enabled 真值源）⇒ 页面走
// 「未启用」分支、扇出被闸停。故 ②/③ 的 5xx 分支是**当前唯一活分支**，200 分支等后端补出
// 真值源后自动接管（两条分支都是真断言，不是空转的 if）。
//
// 阻塞段（「CAS-only」这一腿）——**不是凭据问题，是后端能力缺口**：
//   1. 无发布入口：`grep CasPublish crates/fmby-v2-http/src/` = 0；真跑实测
//      `POST /api/admin/cas/{publish,fanout,ingest,restore}`、`/api/manage/cas/publish`
//      一律 404；二进制路由表里 CAS 只有 drives GET/PUT、fanout GET、reconcile GET。
//      ⇒ 前端没有任何请求可发去触发扇出，有凭据也一样。
//   2. 扇出只认云盘：`adapter_for`（`cas_publish_assembly.rs:75-81`）对非 yun139/yun189pc
//      返 `None`，`providers::local` 未实现 `RapidUploadPort`。
//   3. 播放不咨询 CAS：`CasRestore::resolve_for_playback` 生产调用者为 0，装配时还原端口
//      传 `Vec::new()`；`/api/playback/*` 全链不读 `cas_content`。④ 把这条现状钉成回归锁：
//      播放序列里出现 `/api/admin/cas` 请求即变红 ⇒ 届时改写为「副本确实来自 CAS」的真断言。
//
// 徽章矩阵（copy_state 四态 + 未知兜底、size/时间 null 不伪造）由
// `host/tests/cas-admin-page.contract.test.ts` 以行为断言覆盖：真实栈造不出 drive 行（同上
// 三条），浏览器层无从渲染 ⇒ 不在 e2e 里重复写恒不成立的字符串检查。
//
// ⇒ 「CAS-only」腿要成真断言，前置是后端先给发布入口 + 还原取流接线（fmby-v2 侧），
//   前端无法单侧补出。本卡以 `Refs #8` 交付，卡点如上。

/** 盘配置读取的可接受状态：200 正常 / 500 端口已装配但未实现 / 503 端口未装配。
 *  ★不含 404、401 —— 那是路由接错/鉴权失效，一起放过会让真缺陷长期隐身。 */
const DRIVES_ACCEPTABLE = [200, 500, 503];

test.skip(!E2E_ENABLED, E2E_SKIP_REASON);

test.describe('CAS 编排面 —— 真实后端（fmby-web#8 判据 2 可观测段）', () => {
  test.beforeEach(async ({ page }) => {
    await resetBackend();
    await login(page);
  });

  /** 通用：进入 CAS 编排页 + 断言页头真实渲染。 */
  async function openCasPage(page: import('@playwright/test').Page) {
    await page.goto('/manage/site/cas');
    await expect(
      page.getByRole('heading', { name: 'CAS 编排' }).first(),
    ).toBeVisible({ timeout: 15_000 });
  }

  /** 挂监听 → 进页 → 返回盘配置响应（waitForResponse 必须先建 promise 再导航）。 */
  async function openAndReadDrives(page: import('@playwright/test').Page) {
    const pending = page.waitForResponse(
      (r) => r.url().includes('/api/admin/cas/drives'),
      { timeout: 15_000 },
    );
    await openCasPage(page);
    return pending;
  }

  test('① 编排页接真后端：盘配置请求真实发出且路由接对', async ({ page }) => {
    const response = await openAndReadDrives(page);

    expect(DRIVES_ACCEPTABLE).toContain(response.status());

    if (response.status() === 200) {
      // 真断言：后端返回的每行必须符合契约（盘引用非空 + 优先级为数字）。
      const payload = await response.json();
      for (const drive of (payload as Array<Record<string, unknown>>) ?? []) {
        expect(typeof drive.provider_type).toBe('string');
        expect(typeof drive.drive_ref).toBe('string');
        expect(typeof drive.priority).toBe('number');
      }
    }
  });

  test('② fail-closed：5xx 显示「未启用」，且不得伪装成真空态', async ({ page }) => {
    const drivesStatus = (await openAndReadDrives(page)).status();
    const unwired = page.getByText('CAS 编排服务未启用');
    const emptyState = page.getByText('尚未配置任何盘');

    if (drivesStatus >= 500) {
      await expect(unwired).toBeVisible();
      // ★故障态下绝不能同时显示「尚未配置任何盘」——那会让运维以为「配好了但没盘」。
      await expect(emptyState).toHaveCount(0);
    } else {
      // 装配正常 ⇒ 不得显示「未启用」；「有盘」与「真空态」互斥且必居其一。
      await expect(unwired).toHaveCount(0);
      const rows = await page.locator('table tbody tr').count();
      await expect(emptyState).toHaveCount(rows === 0 ? 1 : 0);
    }
  });

  test('③ 服务未启用 ⇒ 扇出一问不发；徽章数恒等于后端真实副本数', async ({ page }) => {
    // 卡面最核心的诚实性约束在浏览器层的表达：服务未启用时，UI 既不能去问一个问不出
    // 结果的扇出端点，更不能凭空画出副本徽章。
    // ★变异对照：摘掉 ManageCasPage 的 `enabled={!unwired}` 闸 ⇒ 本用例因 requests 非空
    //   变红（上一版走 `if (fanout === 200)` 的空分支，这个变异会存活）。
    const requests: string[] = [];
    let reportedDrives: number | undefined;
    page.on('request', (req) => {
      if (req.url().includes('/api/admin/cas/fanout')) requests.push(req.url());
    });
    page.on('response', (res) => {
      if (!res.url().includes('/api/admin/cas/fanout')) return;
      void res
        .json()
        .then((body: { drives?: unknown[] }) => {
          reportedDrives = (body?.drives ?? []).length;
        })
        .catch(() => {});
    });

    const drivesStatus = (await openAndReadDrives(page)).status();
    await page.getByRole('textbox', { name: '内容 ID' }).fill('1');
    // 给可能发生的请求一个观察窗（扇出由 react-query 在 enabled 时自动触发）。
    await page.waitForTimeout(1_500);

    if (drivesStatus >= 500) {
      expect(requests).toHaveLength(0);
    } else {
      expect(requests.length).toBeGreaterThan(0);
      await expect.poll(() => reportedDrives).not.toBeUndefined();
    }

    // 两种环境都成立的不变量：徽章数 == 后端真实给出的副本数。
    // 没问到（未启用）⇒ 一个都不许画；问到 N 条 ⇒ 恰好画 N 个。
    await expect(
      page.getByText(/已复制|待落位|实体丢失|上游已删|状态未知/),
    ).toHaveCount(reportedDrives ?? 0);
  });

  test('④ 入库 → 播放真跑，且播放链当前不咨询 CAS（钉住后端边界）', async ({ page }) => {
    const casCalls: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/admin/cas')) casCalls.push(req.url());
    });

    const sessionPromise = page.waitForResponse(
      (r) => r.url().includes('/api/playback/sessions') && r.status() === 200,
      { timeout: 15_000 },
    );
    await page.goto('/play/101');
    const session = await (await sessionPromise).json();
    expect(session.item_id).toBe('101');
    expect(session.stream_url).toContain('/api/playback/stream/');

    const stream = await page.evaluate(async (url: string) => {
      const res = await fetch(url, { credentials: 'include' });
      return { status: res.status, bytes: (await res.arrayBuffer()).byteLength };
    }, session.stream_url);
    expect(stream.status).toBe(200);
    expect(stream.bytes).toBeGreaterThan(0);

    // 「CAS-only」腿的现状：出流完全不经过 CAS 面。后端把还原接进播放链那天本断言变红
    // ⇒ 提醒把判据 2 补成真链路，而不是悄悄放过。
    expect(casCalls).toHaveLength(0);
  });
});
