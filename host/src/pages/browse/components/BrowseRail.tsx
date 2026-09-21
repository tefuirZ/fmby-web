import { Children, useRef } from 'react';
import type { ReactNode } from 'react';
import { useGridRovingFocus } from '@/features/a11y/useGridRovingFocus';
import { HoverScrollArea } from '@fmby/v2-shared/ui';
import styles from '../styles/shared.module.css';

/**
 * 横向卡片轨道（横滚 + scroll-snap）。
 *
 * FE-LIST-KEYNAV：接入方向键漫游（**roving tabindex**）。轨道是**一维列表**
 * （columns=1），故 ←/→ 在卡片间移动焦点、↑/↓ 停住；容器成为 Tab 的单一停靠点。
 * 焦点移动由浏览器原生的 focus 滚动（scrollIntoView）带出横滚。
 */
export function BrowseRail({
  children,
  itemClassName,
}: {
  children: ReactNode;
  itemClassName: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const count = Children.count(children);

  useGridRovingFocus({
    containerRef,
    itemCount: count,
    columns: 1,
    // 横滚轨道是**一次性全量渲染**（无服务端分页），故 hasMore=false：
    // 走到末尾即停住，不触发加载。
    hasMore: false,
    // 一维轨道的 stride 仅用于把目标项滚进视口；取一个保守行高即可。
    stride: 240,
  });

  return (
    <div ref={containerRef} data-browse-rail>
      <HoverScrollArea className={styles.mediaRail} delayMs={100}>
        {Children.toArray(children).map((child, index) => (
          <div key={index} className={itemClassName} data-grid-item-index={index}>
            {child}
          </div>
        ))}
      </HoverScrollArea>
    </div>
  );
}
