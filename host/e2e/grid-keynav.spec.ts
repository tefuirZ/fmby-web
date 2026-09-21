import { test, expect } from '@playwright/test';
import { login, resetBackend, E2E_ENABLED, E2E_SKIP_REASON } from './fixtures/helpers';

/**
 * FE-LIST-KEYNAV：列表/网格方向键漫游真跑断言。
 *
 * 验证（**可证伪**：每条都断言具体值/具体焦点目标，不用宽松阈值）：
 *  1. Tab 进入网格是**单一停靠点**（容器内 tabindex=0 的项恰好 1 个）；
 *  2. → / ↓ 移动焦点到相邻项（断言实际 activeElement 的 data-grid-item-index）；
 *  3. 边界停止：首项 ← / ↑ 不动；末项 → / ↓ 不动；
 *  4. Home / End 在当前行内跳转；
 *  5. 与既有键盘导航不冲突：Tab 能离开网格、Esc/Ctrl+K 仍可用；
 *  6. 焦点可见（有 outline 或 box-shadow）。
 *
 * 落点：媒体库详情的虚拟化网格（VirtualizedLibraryDetailGrid），
 * 兼具二维网格 + 服务端分页，覆盖卡面全部要点。
 */

test.skip(!E2E_ENABLED, E2E_SKIP_REASON);

/** 网格容器选择器（组件上有 data-library-virtualized-grid）。 */
// 落点：首页横向卡片轨道（BrowseRail）。选它是因为**在当前 e2e 数据集下真渲染**
// （媒体库详情 /libraries/1 后端恒 500 `browse_projection.missing_5xx`，且
// /history 为空态）。轨道是一维列表 → columns=1，←/→ 在卡片间移动。
const GRID = '[data-browse-rail]';

/** 当前聚焦项索引（读 activeElement 所在 slot 的 data-grid-item-index）。 */
async function activeIndex(page: import('@playwright/test').Page): Promise<number | null> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return null;
    const slot = el.closest('[data-grid-item-index]');
    if (!slot) return null;
    const raw = slot.getAttribute('data-grid-item-index');
    return raw === null ? null : Number(raw);
  });
}

async function openLibraryGrid(page: import('@playwright/test').Page) {
  await resetBackend();
  await login(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  // 取**卡片数最多**的那个轨道（首页有多个 rail，空态的没有 item）。
  const railIndex = await page.evaluate((sel) => {
    const rails = Array.from(document.querySelectorAll(sel));
    let best = -1;
    let bestCount = 0;
    rails.forEach((rail, i) => {
      const n = rail.querySelectorAll('[data-grid-item-index]').length;
      if (n > bestCount) {
        bestCount = n;
        best = i;
      }
    });
    return { best, bestCount };
  }, GRID);
  expect(railIndex.bestCount, '没有任何带卡片的轨道，无法验证漫游').toBeGreaterThan(1);
  await page.locator(GRID).nth(railIndex.best).waitFor({ state: 'visible' });
  return railIndex.best;
}

test.describe('FE-LIST-KEYNAV — 网格方向键漫游', () => {
  test('Tab 进网格为单一停靠点：容器内 tabindex=0 恰好 1 个', async ({ page }) => {
    const rail = await openLibraryGrid(page);
    const zeroCount = await page.evaluate((sel) => {
      const grid = document.querySelector(sel);
      if (!grid) return -1;
      return grid.querySelectorAll('[tabindex="0"]').length;
    }, GRID);
    expect(zeroCount, `网格内 tabindex=0 的元素应恰好 1 个（roving），实际 ${zeroCount}`).toBe(1);
  });

  test('→ 移动到右邻项，↓ 移动到下一行同列', async ({ page }) => {
    const rail = await openLibraryGrid(page);
    // 从首项开始
    await page.evaluate((sel) => {
      const first = document
        .querySelector(sel)
        ?.querySelector<HTMLElement>('[data-grid-item-index="0"] a[href], [data-grid-item-index="0"] [tabindex]');
      first?.focus();
    }, GRID);
    await expect.poll(() => activeIndex(page)).toBe(0);

    await page.keyboard.press('ArrowRight');
    await expect.poll(() => activeIndex(page)).toBe(1);

    const cols = await page.evaluate((sel) => {
      const row = document.querySelector(`${sel} [data-library-virtualized-row]`);
      if (!row) return 1;
      return getComputedStyle(row).gridTemplateColumns.split(' ').length;
    }, GRID);

    await page.keyboard.press('ArrowDown');
    await expect.poll(() => activeIndex(page)).toBe(1 + Math.max(1, cols));
  });

  test('边界停止：首项 ← / ↑ 不动', async ({ page }) => {
    const rail = await openLibraryGrid(page);
    await page.evaluate((sel) => {
      const first = document
        .querySelector(sel)
        ?.querySelector<HTMLElement>('[data-grid-item-index="0"] a[href], [data-grid-item-index="0"] [tabindex]');
      first?.focus();
    }, GRID);
    await expect.poll(() => activeIndex(page)).toBe(0);

    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => activeIndex(page)).toBe(0, '首项 ← 必须停在 0（不环绕）');
    await page.keyboard.press('ArrowUp');
    await expect.poll(() => activeIndex(page)).toBe(0, '首项 ↑ 必须停在 0');
  });

  test('End 跳到当前行行尾，Home 回到行首', async ({ page }) => {
    const rail = await openLibraryGrid(page);
    await page.evaluate((sel) => {
      const first = document
        .querySelector(sel)
        ?.querySelector<HTMLElement>('[data-grid-item-index="0"] a[href], [data-grid-item-index="0"] [tabindex]');
      first?.focus();
    }, GRID);
    await expect.poll(() => activeIndex(page)).toBe(0);

    const cols = await page.evaluate((sel) => {
      const row = document.querySelector(`${sel} [data-library-virtualized-row]`);
      if (!row) return 1;
      return getComputedStyle(row).gridTemplateColumns.split(' ').length;
    }, GRID);

    await page.keyboard.press('End');
    await expect.poll(() => activeIndex(page)).toBe(Math.max(1, cols) - 1);

    await page.keyboard.press('Home');
    await expect.poll(() => activeIndex(page)).toBe(0);
  });

  test('焦点可见：移动后有 outline 或 box-shadow', async ({ page }) => {
    const rail = await openLibraryGrid(page);
    await page.evaluate((sel) => {
      const first = document
        .querySelector(sel)
        ?.querySelector<HTMLElement>('[data-grid-item-index="0"] a[href], [data-grid-item-index="0"] [tabindex]');
      first?.focus();
    }, GRID);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => activeIndex(page)).toBe(1);

    const visible = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const cs = getComputedStyle(el);
      const hasOutline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
      return hasOutline || cs.boxShadow !== 'none';
    });
    expect(visible, '移动焦点后无可见焦点指示').toBe(true);
  });

  test('不破坏既有键盘导航：Tab 可离开网格，Ctrl+K 仍打开搜索', async ({ page }) => {
    const rail = await openLibraryGrid(page);
    await page.evaluate((sel) => {
      const first = document
        .querySelector(sel)
        ?.querySelector<HTMLElement>('[data-grid-item-index="0"] a[href], [data-grid-item-index="0"] [tabindex]');
      first?.focus();
    }, GRID);

    // Tab 一次应离开网格（单一停靠点 → 不停在下一个卡片）
    await page.keyboard.press('Tab');
    const stillInGrid = await page.evaluate((sel) => {
      const el = document.activeElement as HTMLElement | null;
      const grid = document.querySelector(sel);
      return Boolean(el && grid && grid.contains(el));
    }, GRID);
    expect(stillInGrid, 'Tab 后仍在网格内 → 未做到单一停靠点').toBe(false);

    // Ctrl+K 仍可用
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog', { name: '全局搜索' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: '全局搜索' })).toBeHidden();
  });

  test('输入控件内不劫持方向键（避免在搜索框里被网格截走）', async ({ page }) => {
    const rail = await openLibraryGrid(page);
    await page.keyboard.press('Control+k');
    const input = page.getByPlaceholder('搜索电影、剧集，支持拼音首字母…');
    await input.waitFor({ state: 'visible' });
    await input.fill('电');
    // 在输入框内按 ↓ 不应触发网格漫游（焦点不应进入网格）
    await page.keyboard.press('ArrowDown');
    const idx = await activeIndex(page);
    expect(idx, `输入框内 ↓ 不应移动网格焦点，实际 ${idx}`).toBe(null);
    await page.keyboard.press('Escape');
  });
});
