/**
 * 网格方向键漫游（FE-LIST-KEYNAV）——**roving tabindex** 实现。
 *
 * ## 为什么选 roving tabindex 而不是 grid role
 *
 * - 卡片本身是**链接**（`<Link>` → `<a href>`）。roving 保留其原生语义与
 *   Enter 打开能力；`role="grid"` 需把 DOM 改成 row/gridcell 包裹，与现有
 *   **虚拟化按行渲染**的结构冲突，且读屏器下 grid 语义会盖掉「链接」可听性。
 * - roving 让容器成为 Tab 的**单一停靠点**：容器内只有活动项 `tabindex=0`，
 *   其余 `-1`；Tab 进入只停一次，方向键在内部移动 —— 正是本卡目标。
 *
 * ## 虚拟化约束
 *
 * 未渲染的行**没有 DOM**，故移动焦点前须先把目标项滚动进视口（触发挂载），
 * 再聚焦。本 hook 只负责「算出目标索引 + 分派」，滚动/挂载由调用方的
 * 虚拟化器响应。
 *
 * ## 边界语义（明确，可断言）
 *
 * - 走到首/尾项：焦点**停在边界**（不环绕、不跳到不存在项）；
 * - 走到**已加载末尾**且还有更多：调用 `onReachTail()` 请求加载更多，
 *   但焦点仍停在边界（不假造"下一项"）。
 */

export type GridKeyNavDirection = 'left' | 'right' | 'up' | 'down' | 'home' | 'end';

export interface GridKeyNavRequest {
  /** 当前活动索引（-1 = 尚无活动项）。 */
  activeIndex: number;
  /** 已加载项总数（虚拟化下是**已加载**而非总数）。 */
  itemCount: number;
  /** 当前列数（虚拟化下动态）。 */
  columns: number;
  /** 是否还有更多可加载（服务端分页）。 */
  hasMore: boolean;
}

/** 纯函数：按方向算目标索引（返回 -1 表示不动）。 */
export function nextGridIndex(
  request: GridKeyNavRequest,
  direction: GridKeyNavDirection,
): number {
  const { activeIndex, itemCount, columns } = request;
  if (itemCount <= 0) return -1;

  const cols = Math.max(1, columns);
  const last = itemCount - 1;

  // 尚无活动项：任何方向都落到首项
  if (activeIndex < 0) return 0;
  // 防御：活动索引可能已过期（虚拟化下项数减少/重新筛选），先钳制到合法范围，
  // 否则后续运算会返回越界索引（单测「组合不变量」抓到）。
  const current = Math.min(activeIndex, last);

  const row = Math.floor(current / cols);
  const col = current % cols;
  const rowCount = Math.ceil(itemCount / cols);

  switch (direction) {
    case 'left':
      return col > 0 ? current - 1 : current;
    case 'right': {
      if (col < cols - 1) {
        const target = current + 1;
        return target <= last ? target : current;
      }
      return current;
    }
    case 'up': {
      if (row > 0) return current - cols;
      return current;
    }
    case 'down': {
      const target = current + cols;
      if (target <= last) return target;
      // 末行不满时，落到本列最后存在的项（即末项）——不越界
      if (row < rowCount - 1) return last;
      return current;
    }
    case 'home':
      return row * cols;
    case 'end': {
      const rowEnd = Math.min(last, row * cols + cols - 1);
      return rowEnd;
    }
  }
}

/** 是否应因「走到已加载末尾」而请求加载更多（仅向下/End 且确实到底）。 */
export function shouldRequestMore(
  request: GridKeyNavRequest,
  direction: GridKeyNavDirection,
): boolean {
  if (!request.hasMore) return false;
  if (direction !== 'down' && direction !== 'end' && direction !== 'right') return false;
  const { activeIndex, itemCount } = request;
  if (itemCount <= 0) return false;
  return activeIndex >= itemCount - 1;
}

/** 把 KeyboardEvent.key 映射为方向（不识别返回 null）。 */
export function gridDirectionForKey(key: string): GridKeyNavDirection | null {
  switch (key) {
    case 'ArrowLeft':
      return 'left';
    case 'ArrowRight':
      return 'right';
    case 'ArrowUp':
      return 'up';
    case 'ArrowDown':
      return 'down';
    case 'Home':
      return 'home';
    case 'End':
      return 'end';
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* React 接入层                                                        */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useRef } from 'react';

export interface UseGridRovingFocusOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  itemCount: number;
  columns: number;
  hasMore: boolean;
  /** 走到已加载末尾时请求加载更多（分页边界）。 */
  onReachTail?: () => void;
  /** 行高（含间距），用于把目标项滚进视口以触发虚拟化挂载。 */
  stride: number;
}

/**
 * 在容器上挂 keydown，实现方向键漫游 + roving tabindex。
 *
 * 返回：
 * - `activeIndex`：当前活动项（用于给对应项设 tabIndex=0）
 * - `focusIndex(i)`：程序化移动焦点（供点击/外部同步）
 */
export function useGridRovingFocus({
  containerRef,
  itemCount,
  columns,
  hasMore,
  onReachTail,
  stride,
}: UseGridRovingFocusOptions) {
  const activeRef = useRef(-1);

  /** 找到第 index 项的可聚焦元素（虚拟化下可能尚未挂载 → 返回 null）。 */
  const findFocusable = useCallback(
    (index: number): HTMLElement | null => {
      const container = containerRef.current;
      if (!container) return null;
      const slot = container.querySelector<HTMLElement>(
        `[data-grid-item-index="${index}"]`,
      );
      if (!slot) return null;
      return (
        slot.querySelector<HTMLElement>('a[href], button, [tabindex]:not([tabindex="-1"])') ??
        slot
      );
    },
    [containerRef],
  );

  const focusIndex = useCallback(
    (index: number) => {
      const container = containerRef.current;
      if (!container || index < 0) return;
      // 虚拟化：先把目标行滚进视口，触发该行挂载，再聚焦。
      const cols = Math.max(1, columns);
      const row = Math.floor(index / cols);
      const containerTop =
        container.getBoundingClientRect().top + window.scrollY;
      const targetTop = containerTop + row * stride;
      const currentScroll = window.scrollY;
      const viewportBottom = currentScroll + window.innerHeight;
      if (targetTop < currentScroll || targetTop > viewportBottom - stride) {
        window.scrollTo({ top: Math.max(0, targetTop - window.innerHeight / 3) });
      }
      // 等一帧让虚拟化渲染出该行
      requestAnimationFrame(() => {
        const el = findFocusable(index);
        if (el) {
          el.focus();
          activeRef.current = index;
        }
      });
    },
    [columns, containerRef, findFocusable, stride],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const direction = gridDirectionForKey(event.key);
      if (!direction) return;
      // 焦点不在容器内（或容器自身）时不劫持方向键——避免与页面滚动/输入冲突
      const active = document.activeElement as HTMLElement | null;
      if (!active || !container.contains(active)) return;
      // 输入控件内不劫持（方向键用于光标移动）
      const tag = active.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const request: GridKeyNavRequest = {
        activeIndex: activeRef.current,
        itemCount,
        columns,
        hasMore,
      };
      const target = nextGridIndex(request, direction);
      if (target < 0) return;
      event.preventDefault();
      if (shouldRequestMore(request, direction)) {
        onReachTail?.();
        return; // 焦点停在边界，不假造下一项
      }
      if (target === activeRef.current) return;
      focusIndex(target);
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [columns, containerRef, focusIndex, hasMore, itemCount, onReachTail]);

  /**
   * FE-LIST-KEYNAV：roving tabindex —— 容器内只有**一个**可 Tab 停靠点。
   * 初始把首项设为 0、其余 -1；焦点移动后同步（否则 Tab 会遍历所有卡片，
   * 长列表下 Tab 次数爆炸）。
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container || itemCount <= 0) return;
    const applyRoving = () => {
      const active = activeRef.current < 0 ? 0 : activeRef.current;
      const slots = container.querySelectorAll<HTMLElement>('[data-grid-item-index]');
      slots.forEach((slot) => {
        const index = Number(slot.getAttribute('data-grid-item-index'));
        const focusable =
          slot.querySelector<HTMLElement>('a[href], button, [tabindex]') ?? slot;
        focusable.setAttribute('tabindex', index === active ? '0' : '-1');
      });
    };
    applyRoving();
    // 虚拟化行会随滚动挂载/卸载，故用 MutationObserver 保持 roving 状态
    const observer =
      typeof MutationObserver === 'undefined'
        ? undefined
        : new MutationObserver(applyRoving);
    observer?.observe(container, { childList: true, subtree: true });
    return () => observer?.disconnect();
  }, [containerRef, itemCount, columns]);

  return { focusIndex };
}
