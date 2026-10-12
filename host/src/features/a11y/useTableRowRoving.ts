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
 *   把焦点送到**目标行本身**（`<tr>` 设 `tabindex="-1"` ⇒ 程序化可聚焦、
 *   **不进 Tab 序**）。Tab 顺序零变化 ⇒ 无回归，且 Enter 语义可预期。
 *
 * ## Enter 打开
 *
 * 方向键把焦点落在 `<tr>` 本身 ⇒ Enter 触发 `onActivate(index)`。
 * 焦点在行内控件上时 Enter/Space 由该控件原生处理（checkbox 仍切换选中、
 * 按钮仍触发点击）—— 不抢行内控件语义。
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

function rowAt(container: HTMLElement, index: number): HTMLElement | null {
  return container.querySelector<HTMLElement>(rowSelector(index));
}

/** 文本录入类控件：方向键有原生光标语义，本 hook 不劫持。 */
function isTextEntry(el: HTMLElement): boolean {
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'SELECT') return true;
  if (el.tagName !== 'INPUT') return false;
  // checkbox / radio / button / file 等：方向键无原生光标语义 ⇒ 归漫游
  const type = (el as HTMLInputElement).type;
  return !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'image'].includes(type);
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
      // 仅**文本输入类**控件内不劫持（方向键要用于光标移动）。
      // FE-LIST-KEYNAV-4：不能写成 `tag === 'INPUT'` 一刀切 —— 行首常是
      // `<input type="checkbox">`（如 UserTable），那样会把整行的方向键漫游
      // 全部跳过 ⇒ 漫游在该表上完全失效（实测焦点不动/掉 body）。
      // checkbox / radio / button 上方向键无原生语义，应交由本 hook 漫游。
      if (isTextEntry(active)) return;

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
      // 主代理裁定（FE-LIST-KEYNAV-3）：↑↓/Home/End 一律把焦点落到**行本身**，
      // 而不是行内首个控件。
      // 原因：若落到行内首控件，Enter 的语义就由该控件决定 —— LibraryTable 首控件
      // 恰好是「详情」所以看着对，但 UserTable 行首是 **checkbox**，Enter 会变成
      // 「切换选中」；37 表铺开后 `onActivate` 会整体退化成死分支。
      // 行本身设 tabindex=-1 ⇒ **程序化可聚焦、不进 Tab 序**（Tab 仍逐一可达行内
      // 控件，零回归原则不变），Enter 在行焦点上才可预期地触发 onActivate。
      row.tabIndex = -1;
      row.focus();
    };

    tbody.addEventListener('keydown', handleKeyDown);
    return () => tbody.removeEventListener('keydown', handleKeyDown);
  }, [tbodyRef, rowCount, onActivate]);
}
