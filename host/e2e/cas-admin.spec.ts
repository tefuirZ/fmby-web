import { test, expect } from '@playwright/test';
import {
  login,
  resetBackend,
  E2E_ENABLED,
  E2E_SKIP_REASON,
} from './fixtures/helpers';

// fmby-web#8 判据 2：e2e 覆盖「发布 → CAS-only → 播放」。
//
// ## 本轮（w04 · 2026-10-10）：两处「现状锁」到期，回写为真断言
//
// 后端两卡已落地（主代理 2026-10-10 10:36 裁决；下列行号系本席在 FMBY-V2 main=6c2789ed4
// 当次核对，非转述）：
//
// · #467 `GET /api/admin/cas/drives` 由恒 500 转 **200**，真值源 = 挂载注册表
//   （`bridges/cas_admin.rs:154-173`：provider_type ← `mount.provider`、drive_ref ←
//   `mount.config_key`、enabled ← `!MountStatus::is_abnormal()`、priority ← 注册表下标；
//   **不过滤 provider**，local 挂载照投影成一行）。⇒ ① 的
//   `DRIVES_ACCEPTABLE=[200,500,503]` 逃逸与「形状断言藏在 `if (200)` 里」作废：
//   改为**必须 200 + 无条件逐字段形状断言 + 矩阵非空**。
// · #373 播放链装上 CAS 还原钩（`bridges/playback_cas_restore.rs:79`
//   `cas_restore_if_cas_only`，逐条资格闸全过才介入）。
//
// ## ④ 的「CAS-only 正腿」（播放字节确实来自 CAS 副本）在无云盘凭据时物理不可证
//
// 三条当次源码证据（不是推断，也不以「上次测过」代替）：
//   1. **副本盘行零生产写点**：`cas_content_drive` 的 `present` 行只由
//      `CasPublish::publish_one` 内 `record_present` 写（`codegraph callers record_present`
//      全仓 = 1，`cas_ingest.rs:475`），而 `CasPublish::publish` 的调用点只落在
//      `factory/cas_publish_assembly.rs` 的测试段（:679/:814）；HTTP 面对 CAS 仅
//      `drives GET/PUT` + `fanout/{content_id} GET` + `reconcile GET`
//      （`routes/router_manage.rs:638-646`）⇒ 前端没有任何请求可发去造 present 行，
//      给了凭据也一样（扇出触发点仍是 #344 那句「N1 只装配不触发」）。
//   2. **`.cas` 旁路识别只写内容、不写副本**：`bridges/cas_scan.rs:67` 经
//      `CasSidecarIngest::ingest_batch` 落 `cas_content`，`record_present` 不在其调用图内
//      ⇒ 扫描跑通扇出仍是 0 行，徽章无「已复制」可画。
//   3. **唯一还原端口要真 139 凭据**：`impl RestorePort for` 全仓生产实现只有
//      `Yun139RestorePort`（`factory/cas_restore_assembly.rs:77`），凭据取自 139 owned
//      挂载的 `config_json.provider_secret.sealed_credentials`（:25-28），`yun189pc`
//      取流面未解被显式排除（:12-18）。零 139 挂载 ⇒ 端口表为空 ⇒ 逐盘 `port_for`
//      返 `None`（`cas_restore.rs:353`）⇒ 撤租约回落正常取流，观众面响应与「非 CAS
//      条目」逐字节相同（钩子命中的旁证也不外显：`restore_lease` 行无任何读面，
//      全miss 路径零日志，仅「有盘但上游故障」才 warn）⇒ 浏览器侧无从区分，
//      写死「字节来自 CAS 副本」只会得到一条恒真或恒假的断言。
//
// ⇒ ④ 据裁决口径钉**阴性对照**：真实栈（无 CAS 行）下播放照常出流，且观众播放页
//   不得触碰 CAS 管理面。可证伪性由单变量变异对照证明（在播放页注入一次
//   `/api/admin/cas/drives` 请求 ⇒ ④ 变红），不是静默 skip。
//   正腿解锁条件 = Yun139 测试凭据 **+** `CasPublish` 的 HTTP/worker 触发点（均 fmby-v2 侧，
//   见 fmby-v2 #467 验收评论与 #373 N4）。届时把 ④ 尾部改写为真链路（扇出出现 present 行
//   ⇒ 徽章「已复制」⇒ 播放取该副本字节），数据布置走 e2e seed 现成能力，不新增凭据门控。
//
// 徽章矩阵（copy_state 四态 + 未知兜底、size/时间 null 不伪造）由
// `host/tests/cas-admin-page.contract.test.ts` 以行为断言覆盖：真实栈造不出 drive 行
// （同上 1/2 条），浏览器层无从渲染 ⇒ 不在 e2e 里重复写恒不成立的字符串检查。

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

  test('① 编排页接真后端：盘配置必须 200，逐行符合契约且矩阵非空', async ({ page }) => {
    const response = await openAndReadDrives(page);

    // #467 后不再有 500/503 的合法态：端口恒装配、真值源是挂载注册表 ⇒ 只放过 200。
    // ★不含 404/401 —— 那是路由接错/鉴权失效；连同旧的 5xx 逃逸一起放开会让真缺陷长期隐身。
    expect(response.status()).toBe(200);

    // 形状断言**无条件**执行（此前藏在 `if (200)` 分支里 = 500 时一条不跑，等于没验）。
    const payload = (await response.json()) as Array<Record<string, unknown>>;
    expect(Array.isArray(payload)).toBe(true);
    // e2e seed 的 local 挂载（`source_mount` id=1）必须投影成一行 —— 零行会让「真实启用态」
    // 重新变成不可观测。
    expect(payload.length).toBeGreaterThanOrEqual(1);
    for (const drive of payload) {
      expect(typeof drive.provider_type).toBe('string');
      expect((drive.provider_type as string).length).toBeGreaterThan(0);
      expect(typeof drive.drive_ref).toBe('string');
      expect((drive.drive_ref as string).length).toBeGreaterThan(0);
      expect(typeof drive.enabled).toBe('boolean');
      expect(typeof drive.priority).toBe('number');
      expect(Number.isFinite(drive.priority)).toBe(true);
    }
  });

  test('② 「未启用」与「真空态」互斥（fail-closed 语义不得伪装）', async ({ page }) => {
    // 活分支自 #467 起换面：e2e 真栈 drives=200 ⇒ 走 else（不得显示「未启用」，
    // 有行就不许画空态）；5xx 分支保留给「端口未装配 ⇒ 503」的部署态。
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

  test('③ 扇出请求不得越过服务状态；徽章数恒等于后端真实副本数', async ({ page }) => {
    // 卡面最核心的诚实性约束在浏览器层的表达：服务未启用时，UI 既不能去问一个问不出
    // 结果的扇出端点，更不能凭空画出副本徽章。
    // ★变异对照（#467 后的活分支）：把 ManageCasPage 的 `enabled={!unwired}` 闸反接成
    //   `enabled={unwired}` ⇒ 200 态下扇出不再发问 ⇒ 本用例 `requests.length > 0` 变红
    //   （原文随 PR 正文）。旧注释里「摘闸 ⇒ requests 非空变红」那条变异只在 drives
    //   恒 500 的旧栈成立，现已随活分支换面失效，不再当作证据。
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

  test('④ 入库 → 播放真跑（阴性对照：无 CAS 行时播放照常出流且不触碰 CAS 管理面）', async ({ page }) => {
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

    // 阴性对照钉的是「不误触发」：真实栈里没有 `cas_content` 行（seed 不种、且没有任何
    // HTTP 写点可造，见文件头证据 1），#373 的还原钩必须一条不沾地把流放出去。
    // ★可证伪性经单变量变异对照证实：在播放页注入一次 `/api/admin/cas/drives` 请求
    //   ⇒ 本断言变红（原文随 PR 正文）。
    // ★这不是「CAS-only 正腿」：正腿（播放字节取自 CAS 副本）在无 139 凭据时物理不可证，
    //   依据见文件头。解锁后此处改写为真链路断言，不留静默 skip。
    expect(casCalls).toHaveLength(0);
  });
});
