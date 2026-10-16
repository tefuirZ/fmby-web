import { test, expect } from '@playwright/test';
import { E2E_ENABLED, E2E_SKIP_REASON } from './fixtures/helpers';

test.skip(!E2E_ENABLED, E2E_SKIP_REASON);

/**
 * FE-CAS-DENSE-TAP-TARGETS：CAS 密集表格控件触屏扩热区（回归守卫）。
 *
 * VIS-AUDIT 实测（移动视口）：CAS 表 checkbox 13×13 / 保存 21×22 / 触发对账 42×22 / 发起扇出 324×22。
 * 修法：.casHitBtn（按钮）/ .casHitCheck（包 checkbox 的 label）在触屏下用 position:absolute
 * 的 ::after 隐形热区扩到 --touch-min（44）——视觉尺寸、表格行高/密度零变化（绝对定位不参与布局）。
 *
 * 测量（本席模型看图受限 ⇒ 可编程判据）：
 *  - 热区已扩：elementFromPoint 在视觉盒外、::after 热带内的点 ⇒ 命中该控件或其 casHit 容器；
 *  - 视觉/行高未变：控件自身 boundingBox 高度 mobile 不膨胀（::after 绝对定位）+ 表格行高 ≤ ~60px。
 */

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: '用户名' }).fill('admin');
  await page.getByRole('textbox', { name: '密码' }).fill('admin');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.waitForURL(/\/$/);
}

/**
 * 在控件视觉盒上方 abovePx 处取 elementFromPoint。casHit 的 ::after 挂在热区Owner上：
 * 按钮=button 自身；checkbox=包裹的 label。命中判据 = 命中点是控件、其 casHit 容器、或二者子孙。
 */
async function probeHitAbove(page: import('@playwright/test').Page, findSel: string, abovePx: number) {
  return page.evaluate(
    ({ sel, above }) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) return { found: false, isSelf: false, hitTag: null, boxH: null };
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top - above;
      if (cy < 0) return { found: true, isSelf: false, hitTag: 'off-screen', boxH: Math.round(r.height) };
      const hit = document.elementFromPoint(cx, cy);
      const owner = el.closest('label') ?? el;
      const isSelf = !!hit && (hit === el || hit === owner || owner.contains(hit) || el.contains(hit));
      return { found: true, isSelf, hitTag: hit ? hit.tagName : 'null', boxH: Math.round(r.height) };
    },
    { sel: findSel, above: abovePx },
  );
}

test.describe('CAS 密集表格控件触屏扩热区', () => {
  test('checkbox（纳入扇出）：触屏热区扩到盒外、视觉盒不膨胀；桌面零变化', async ({ page }, testInfo) => {
    await login(page);
    await page.goto('/manage/site/cas');
    await page.waitForTimeout(2500);
    const sel = 'input[type="checkbox"][aria-label$="纳入扇出"]';
    const probe = await probeHitAbove(page, sel, 8); // 13px 盒 + 44 热区 ⇒ 上伸 ~15px，8px 在热带内
    expect(probe.found, 'checkbox 应存在').toBe(true);

    if (testInfo.project.name === 'mobile-chrome') {
      expect(probe.isSelf, `触屏 checkbox 上方 8px 应命中（热区已扩），hit=${probe.hitTag}`).toBe(true);
      expect(probe.boxH!, `触屏 checkbox 视觉盒高应保持 ~13（不膨胀），实测 ${probe.boxH}`).toBeLessThan(24);
    } else {
      expect(probe.isSelf, `桌面 checkbox 上方 8px 不应命中（无热区），hit=${probe.hitTag}`).toBe(false);
    }
  });

  test('按钮（触发对账，启用态）：触屏热区扩到盒外、视觉盒不膨胀；桌面零变化', async ({ page }, testInfo) => {
    await login(page);
    await page.goto('/manage/site/cas');
    await page.waitForTimeout(2500);
    const btn = page.locator('button', { hasText: '触发对账' }).first();
    await btn.waitFor();
    await btn.scrollIntoViewIfNeeded(); // 移入视口中央，避免贴近底部/视口边导致上方落到邻居
    await page.waitForTimeout(300);
    // 测启用态按钮：保存按钮在行未 dirty 时 disabled（elementFromPoint 跳过 disabled 元素），
    // 故用同样挂 .casHitBtn 的「触发对账」（idle 态启用）证明 ::after 热区；保存/发起扇出共用同一 class。
    const probe = await page.evaluate(() => {
      const el = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '触发对账') as HTMLButtonElement | undefined;
      if (!el) return { found: false, isSelf: false, hitTag: null, boxH: null, disabled: null };
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top - 4; // 22px 盒 + 44 热带 ⇒ 上伸 11px，4px 稳妥在热带内
      if (cy < 0) return { found: true, isSelf: false, hitTag: 'off-screen', boxH: Math.round(r.height), disabled: el.disabled };
      const hit = document.elementFromPoint(cx, cy);
      return { found: true, isSelf: !!hit && (hit === el || el.contains(hit)), hitTag: hit?.tagName + ':' + ((hit?.textContent || '').trim().slice(0, 8)), boxH: Math.round(r.height), disabled: el.disabled };
    });
    expect(probe.found, '触发对账 按钮应存在').toBe(true);
    expect(probe.disabled, '触发对账 应为启用态（否则 elementFromPoint 跳过 disabled）').toBe(false);
    if (testInfo.project.name === 'mobile-chrome') {
      expect(probe.isSelf, `触屏 触发对账 上方 4px 应命中（热区已扩），hit=${probe.hitTag}`).toBe(true);
      expect(probe.boxH!, `触屏 触发对账 视觉盒高应保持 ~22（不膨胀），实测 ${probe.boxH}`).toBeLessThan(44);
    } else {
      expect(probe.isSelf, `桌面 触发对账 上方 4px 不应命中（无热区），hit=${probe.hitTag}`).toBe(false);
    }
  });

  test('表格行高不因扩热区膨胀（≤ ~60px，密集密度保持）', async ({ page }) => {
    await login(page);
    await page.goto('/manage/site/cas');
    await page.waitForTimeout(2500);
    const h = await page.evaluate(() => {
      const tr = document.querySelector('table tbody tr');
      return tr ? Math.round(tr.getBoundingClientRect().height) : null;
    });
    expect(h, 'CAS 表应有数据行').not.toBeNull();
    expect(h!, `表格行高应保持密集（≤60px，未被 ::after 撑高），实测 ${h}`).toBeLessThanOrEqual(60);
  });
});
