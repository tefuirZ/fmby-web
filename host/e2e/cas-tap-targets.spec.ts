import { test, expect } from '@playwright/test';
import { E2E_ENABLED, E2E_SKIP_REASON } from './fixtures/helpers';

test.skip(!E2E_ENABLED, E2E_SKIP_REASON);

/**
 * FE-CAS-DENSE-TAP-TARGETS（REVIEW-69 rework）：CAS 密集表格控件触屏扩热区 + **不跨行**。
 *
 * rv02 近阻断风险：原 .casHitBtn::after 是 left:0;right:0 通栏 44px 高热带 ⇒ 在 30-38px
 * 行高内垂直溢出 ~22px ⇒ 相邻行热区重叠 8-10px ⇒ 点行 A 按钮正下方会命中行 B。
 * 修法（REVIEW-69 a）：密集单元格内控件（保存按钮/checkbox）热区**填满单元格**
 * （.casHitCell position:relative + ::after inset:0）⇒ 被单元格边界兜住，**绝不跨行**；
 * 独立按钮（触发对账/发起扇出，不在密集行内）保留 44px 热带。
 *
 * 本 spec 补上此前漏测的形态：
 *  - 跨行安全：行 A 保存按钮盒下方近边界点 ⇒ 命中行 A（其 ::after=本格），**绝不命中行 B**；
 *  - 机械证明：热区高度 ≤ 行高（::after inset:0 填格，高度=格高）；
 *  - checkbox（.casHitCheck）同样证伪；
 *  - 红侧自动化：注入无 casHit class 的裸按钮 ⇒ 探测器辨出「无扩热区」（断言非 vacuous）。
 */

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: '用户名' }).fill('admin');
  await page.getByRole('textbox', { name: '密码' }).fill('admin');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.waitForURL(/\/$/);
}

test.describe('CAS 密集表格控件触屏扩热区（不跨行）', () => {
  test('保存按钮：触屏热区填本格（格顶/格底都命中自身·被格兜住不跨行）；桌面零变化', async ({
    page,
  }, testInfo) => {
    await login(page);
    await page.goto('/manage/site/cas');
    await page.waitForTimeout(2500);
    // CAS 配置表移动端横向可滚动，保存按钮在末列 ⇒ 先滚入视口（否则 elementFromPoint 的 x 越界返回 null）
    const saveBtn = page.locator('button', { hasText: '保存' }).first();
    await saveBtn.waitFor();
    await saveBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    const probe = await page.evaluate(() => {
      const a = [...document.querySelectorAll('button')].find(
        (b) => (b.textContent || '').trim() === '保存',
      ) as HTMLButtonElement | undefined;
      if (!a) return { found: false, reason: '无保存按钮' };
      const cell = a.closest('td');
      if (!cell) return { found: false, reason: '保存按钮不在 td 内' };
      const ra = a.getBoundingClientRect();
      const rc = cell.getBoundingClientRect();
      const cx = ra.left + ra.width / 2;
      const hitAt = (dy: number) => {
        const cy = dy;
        if (cy < 0) return null;
        const h = document.elementFromPoint(cx, cy);
        return !!h && (h === a || a.contains(h));
      };
      return {
        found: true,
        cellPos: getComputedStyle(cell).position,
        cellH: Math.round(rc.height),
        boxH: Math.round(ra.height),
        hitTop: hitAt(rc.top + 2), // 格顶内侧
        hitBottom: hitAt(rc.bottom - 2), // 格底内侧（贴近行边界）
      };
    });
    expect(probe.found, '保存按钮应存在').toBe(true);

    if (testInfo.project.name === 'mobile-chrome') {
      const p = probe as { cellPos: string; cellH: number; boxH: number; hitTop: boolean; hitBottom: boolean };
      // 定位上下文是单元格（.casHitCell position:relative）⇒ ::after inset:0 被格兜住，绝不跨行
      expect(p.cellPos, '保存单元格应 position:relative（热区定位上下文）').toBe('relative');
      expect(p.cellH, `格高应 ≥24（触达下限），实测 ${p.cellH}`).toBeGreaterThanOrEqual(24);
      // 热区填满本格：格顶 + 格底都命中保存自身（证明热区=整格、被行边界兜住 ⇒ 不溢到相邻行）
      expect(p.hitTop, '触屏格顶点应命中保存自身（热区填本格）').toBe(true);
      expect(p.hitBottom, '触屏格底点应命中保存自身（热区填本格·不跨行）').toBe(true);
      expect(p.boxH!, `保存视觉盒高应保持 ~22，实测 ${p.boxH}`).toBeLessThan(44);
    } else {
      const p = probe as { hitTop: boolean; hitBottom: boolean };
      expect(p.hitTop && p.hitBottom, '桌面格顶/格底不应命中保存（无热区）').toBe(false);
    }
  });

  test('checkbox（纳入扇出）：触屏热区填本格（点格内即切换）、桌面零变化', async ({ page }, testInfo) => {
    await login(page);
    await page.goto('/manage/site/cas');
    await page.waitForTimeout(2500);
    const sel = 'input[type="checkbox"][aria-label$="纳入扇出"]';
    const probe = await page.evaluate((s) => {
      const el = document.querySelector(s) as HTMLElement | null;
      if (!el) return { found: false, isSelf: false, boxH: null, cellH: null };
      const cell = el.closest('td');
      const r = el.getBoundingClientRect();
      const rc = cell ? cell.getBoundingClientRect() : r;
      // 格内、checkbox 视觉盒外的一点（靠格底部）——cell-fill 热区应命中
      const cx = rc.left + rc.width / 2;
      const cy = rc.bottom - 2;
      if (cy < 0) return { found: true, isSelf: false, boxH: Math.round(r.height), cellH: Math.round(rc.height) };
      const hit = document.elementFromPoint(cx, cy);
      const owner = el.closest('label') ?? el;
      const isSelf = !!hit && (hit === el || hit === owner || owner.contains(hit) || el.contains(hit));
      return { found: true, isSelf, boxH: Math.round(r.height), cellH: Math.round(rc.height) };
    }, sel);
    expect(probe.found, 'checkbox 应存在').toBe(true);
    if (testInfo.project.name === 'mobile-chrome') {
      expect(probe.isSelf, '触屏 checkbox 格内盒外点应命中（热区填本格）').toBe(true);
      expect(probe.boxH!, `checkbox 视觉盒高应保持 ~13，实测 ${probe.boxH}`).toBeLessThan(24);
      expect(probe.cellH!, `格高应 ≥24，实测 ${probe.cellH}`).toBeGreaterThanOrEqual(24);
    } else {
      expect(probe.isSelf, '桌面 checkbox 格内盒外点不应命中（无热区）').toBe(false);
    }
  });

  test('红侧自动化：注入无 casHit class 的裸保存按钮 ⇒ 探测器辨出「无扩热区」（断言非 vacuous）', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', '红侧自检只在触屏项目跑（热区仅在触屏生效）');
    await login(page);
    await page.goto('/manage/site/cas');
    await page.waitForTimeout(2500);
    const probe = await page.evaluate(() => {
      // 造一个不带 casHitCellBtn 的裸按钮塞进某格（模拟“漏接热区”）
      const cell = document.querySelector('table tbody tr td');
      if (!cell) return { ok: false };
      const bare = document.createElement('button');
      bare.textContent = 'red-side-bare';
      bare.style.width = '60px';
      bare.style.height = '22px';
      cell.appendChild(bare);
      const r = bare.getBoundingClientRect();
      const rc = cell.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = rc.bottom - 2;
      const hit = cy >= 0 ? document.elementFromPoint(cx, cy) : null;
      const extended = !!hit && (hit === bare || bare.contains(hit));
      return { ok: true, extended };
    });
    expect(probe.ok, '应能注入裸按钮').toBe(true);
    // 裸按钮（无 ::after 热区）在格内盒外点**不**命中自身 ⇒ 证明「命中」确实由 casHit 热区带来
    expect(probe.extended, '裸按钮无扩热区 ⇒ 格内盒外点不应命中自身（证明断言非 vacuous）').toBe(false);
  });
});
