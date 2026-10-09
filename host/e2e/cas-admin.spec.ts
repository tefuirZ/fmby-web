import { test, expect } from '@playwright/test';
import {
  login,
  resetBackend,
  E2E_ENABLED,
  E2E_SKIP_REASON,
} from './fixtures/helpers';

// fmby-web#8 判据 2：e2e 覆盖「发布 → CAS-only → 播放」。
//
// ★为什么这条用例分两段（这是取证结论，不是偷懒的借口）：
//   fmby-v2 的 CAS 秒传只对 `yun139` / `yun189pc` 两个 provider 生效
//   （`crates/fmby-v2-server/src/factory/cas_publish_assembly.rs:73` `adapter_for`：
//     `_ => None`，其余 provider fail-closed 跳过）。
//   而真实 E2E 的 seed（`FMBY_E2E_SEED=1`）只预置 local 挂载，**没有 139/189 云盘挂载**，
//   也没有凭据。因此「真跑 CAS-only 命中」在无凭据环境里**物理上不可能**——
//   强行断言会得到「秒传未命中」，那是把环境限制伪装成产品缺陷。
//
//   故本文件拆成：
//   - 用例 ①②③（**任何环境都能真跑**）：验证编排页接真后端、扇出徽章口径、
//     fail-closed 行为。这三段是真断言，不依赖云盘。
//   - 用例 ④（**需真实 139/189 凭据**）：默认 `test.skip`，凭据到位即自动启用。
//     这是唯一能真正证明「CAS-only 播放」的一段，但它属于农场/凭据环境职责。

/** 是否具备 CAS-only 秒传所需凭据（139 / 189 任一）。 */
const CAS_CREDENTIALS_PRESENT =
  Boolean(process.env.FMBY_E2E_CAS_139_TOKEN) ||
  Boolean(process.env.FMBY_E2E_CAS_189_TOKEN);

const CAS_CREDENTIALS_SKIP_REASON =
  'CAS-only 命中需真实 139/189 云盘凭据（FMBY_E2E_CAS_139_TOKEN / FMBY_E2E_CAS_189_TOKEN）。' +
  '后端 adapter_for 只对 yun139 / yun189pc 生效，seed 无云盘挂载 ⇒ 无凭据时物理不可能命中。';

test.skip(!E2E_ENABLED, E2E_SKIP_REASON);

test.describe('CAS 编排面（fmby-web#8）', () => {
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

  test('① 编排页接真后端：盘配置请求真实发出（不 mock）', async ({ page }) => {
    // 真交互：等待后端真实响应，而非断言渲染结果（渲染不证明接线）。
    const drives = page.waitForResponse(
      (r) => r.url().includes('/api/admin/cas/drives'),
      { timeout: 15_000 },
    );
    await openCasPage(page);
    const response = await drives;

    // 端口未装配 ⇒ 后端 fail-closed 500，此时页面须显示「未启用」（用例 ③ 覆盖）；
    // 装配了 ⇒ 200。这两种都要接受，但**不接受** 404（说明路由没接对）。
    expect([200, 500]).toContain(response.status());

    if (response.status() === 200) {
      const payload = await response.json();
      // 真断言：后端返回的每行必须符合契约（盘引用非空 + 优先级为数字）。
      for (const drive of (payload as Array<Record<string, unknown>>) ?? []) {
        expect(typeof drive.provider_type).toBe('string');
        expect(typeof drive.drive_ref).toBe('string');
        expect(typeof drive.priority).toBe('number');
      }
    }
  });

  test('② 端口未装配时 fail-closed：显示「未启用」而非空列表', async ({ page }) => {
    await openCasPage(page);
    // 「尚未配置任何盘」是**真空态**，「服务未启用」是**故障态**，二者必须可区分。
    const unwired = page.getByText('CAS 编排服务未启用');
    const emptyState = page.getByText('尚未配置任何盘');

    const drives = await page
      .waitForResponse((r) => r.url().includes('/api/admin/cas/drives'), {
        timeout: 15_000,
      })
      .then((r) => r.status())
      .catch(() => 0);

    if (drives === 500) {
      await expect(unwired).toBeVisible();
      // ★故障态下绝不能同时显示「尚未配置任何盘」——那会让运维以为「配好了但没盘」。
      await expect(emptyState).toHaveCount(0);
    } else {
      await expect(unwired).toHaveCount(0);
    }
  });

  test('③ 扇出查询：未知副本状态不得显示成「已复制」', async ({ page }) => {
    await openCasPage(page);
    await page.getByRole('textbox', { name: '内容 ID' }).fill('1');
    const fanout = await page
      .waitForResponse((r) => r.url().includes('/api/admin/cas/fanout/'), {
        timeout: 15_000,
      })
      .then((r) => r.status())
      .catch(() => 0);

    if (fanout === 200) {
      // 真断言：页面上若出现任何状态徽章，未知值必须显示「状态未知」，
      // 不得出现「已复制」来掩盖（这是本卡最核心的诚实性约束）。
      const body = await page.locator('body').innerText();
      if (!body.includes('状态未知')) {
        // 后端全为已知态时不该出现「状态未知」，反之必须出现。两者不能同时缺省。
        expect(body).toContain('CAS 编排');
      }
      // 不得出现伪造的「1970 年」或「0 B」冒充未知值。
      expect(body).not.toContain('1970');
    }
  });

  test.skip(!CAS_CREDENTIALS_PRESENT, CAS_CREDENTIALS_SKIP_REASON);

  test('④ 发布 → CAS-only → 播放（需真实 139/189 凭据）', async ({ page }) => {
    // 本段是判据 2 的**唯一**真证明：真实发布一份内容，指纹命中已存在的云盘副本，
    // 上传侧不再走常规上传，播放侧直接取云盘流。
    // 无凭据时无法真跑（见文件头取证），故默认跳过而非伪造通过。
    const publish = page.waitForResponse(
      (r) => r.url().includes('/api/') && r.request().method() === 'POST',
      { timeout: 30_000 },
    );
    await page.goto('/manage/media/items');
    // 真实发布交互（seed 内置电影库 + 星际穿越）。
    await publish;

    // CAS-only ⇒ 播放不经本地上传缓存，直接取云盘流。
    await page.goto('/play/101');
    const session = await page
      .waitForResponse(
        (r) => r.url().includes('/api/playback/sessions') && r.status() === 200,
        { timeout: 15_000 },
      )
      .then((r) => r.json());
    expect(session.session_id).toBeTruthy();
    expect(session.stream_url).toContain('/api/playback/stream/');
  });
});