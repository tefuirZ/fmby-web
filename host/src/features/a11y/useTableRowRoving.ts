/**
 * 表格行键盘漫游（FE-LIST-KEYNAV-2）——管理面一维行列表。
 *
 * ## 为什么复用 `nextGridIndex` 而不新造一套算法
 *
 * 表格就是 **columns=1 的一维网格**（每行一行、行内没有「左右邻项」概念），
 * 方向键/边界/Home-End 语义与既有 `useGridRovingFocus` 的纯函数完全一致。
 * 故这里只写**行级**的 React 接入层，索引运算全部复用 `nextGridIndex`。
 *
 * ## 「行内可聚焦单元」语义（原报告 §六 要求另定的那条）
 *
 * 管理面每行有 5+ 个按钮（详情/编辑/删除/上移/下移…）。两种做法：
 *
 * - **roving 到行、把行内按钮设 tabindex=-1**：标准 grid 做法，但会让「删除」
 *   这类操作**键盘不可达**，属回归 ⇒ 不采用。
 * - **（本卡采用）行是漫游单位、行内按钮 tabIndex 一律不动**：↑↓/Home/End
 *   把焦点送到目标行的**首个可聚焦控件**（该行无控件时聚焦 `<tr>` 本身）。
 *   Tab 顺序零变化 ⇒ 无回归；方向键只负责「在行间移动焦点」。
 *
 * ## Enter 打开
 *
 * 仅当焦点落在 `<tr>` 本身时才触发 `onActivate(index)`；焦点在按钮上时
 * Enter 由浏览器原生触发该按钮 —— 两者不冲突，也不抢行内按钮的语义。
 */

import { useEffect, type RefObject } from 'react';

import { gridDirectionForKey, nextGridIndex } from './useGridRovingFocus';

export interface UseTableRowRovingOptions {
  /** `<tbody>` 容器。 */
  tbodyRef: RefObject<HTMLElement | null>;
  /** 行数（应为**当前已渲染/已筛选**的行数，与 DOM 一致）。 */
  rowCount: number;
  /** Enter 打开当前行（焦点在 `<tr>` 本身时触发）。 */
  onActivate?: (index: number) => void;
}

const ROW_ATTR = 'data-row-index';
const ROW_SELECTOR = `[${ROW_ATTR}]`;
/** 第 index 行的选择器（属性选择器须写成 [attr="v"]，不能拼 [attr][attr="v"]）。 */
const rowSelector = (index: number) => `[${ROW_ATTR}="${index}"]`;

/** 行内可聚焦控件的取法：沿用网格 hook 的既有口径。 */
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function rowAt(container: HTMLElement, index: number): HTMLElement | null {
  return container.querySelector<HTMLElement>(rowSelector(index));
}

/**
 * 在 `<tbody>` 上挂 keydown：↑↓ / Home / End 在行间移动焦点，Enter 打开当前行。
 *
 * 调用方只需给每行加 `data-row-index={i}`（唯一 DOM 约定）。
 */
export function useTableRowRoving({ tbodyRef, rowCount, onActivate }: UseTableRowRovingOptions) {
  useEffect(() => {
    const tbody = tbodyRef.current;
    if (!tbody || rowCount <= 0) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // 焦点不在表体内时不劫持 —— 避免影响页面滚动与表头筛选控件
      const active = document.activeElement as HTMLElement | null;
      if (!active || !tbody.contains(active)) return;
      // 输入控件内不劫持（方向键用于光标移动）
      const tag = active.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (event.key === 'Enter') {
        // 只在焦点落在行本身时接管；行内按钮由浏览器原生处理 Enter。
        if (active.matches(ROW_SELECTOR)) {
          const index = Number(active.getAttribute(ROW_ATTR));
          if (Number.isFinite(index) && index >= 0) {
            event.preventDefault();
            onActivate?.(index);
          }
        }
        return;
      }

      const direction = gridDirectionForKey(event.key);
      if (!direction) return;

      // 当前行索引：以 activeElement 所在行为准（点击/程序化聚焦后仍正确，
      // 这是网格 hook 曾踩过的 B-2：只信内部 ref 会导致「点第 5 行后按方向键回首行」）。
      const currentIndex = Number(
        active.closest(ROW_SELECTOR)?.getAttribute(ROW_ATTR) ?? -1,
      );

      const target = nextGridIndex(
        { activeIndex: currentIndex, itemCount: rowCount, columns: 1, hasMore: false },
        direction,
      );
      if (target < 0) return;
      event.preventDefault();
      if (target === currentIndex) return;

      const row = rowAt(tbody, target);
      if (!row) return;
      const control = row.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      if (control) {
        control.focus();
        return;
      }
      // 该行没有可聚焦控件（如「当前设备不可移除」行）：聚焦行本身，
      // 保证焦点不丢（否则 ↑↓ 经过这种行时焦点会掉到 <body>）。
      row.tabIndex = -1;
      row.focus();
    };

    tbody.addEventListener('keydown', handleKeyDown);
    return () => tbody.removeEventListener('keydown', handleKeyDown);
  }, [tbodyRef, rowCount, onActivate]);
}
