import { useEffect, useMemo, useRef, useState } from 'react';
import type { MediaCardSummary } from '@fmby/v2-shared/contracts/browse';
import { LibraryDetailMediaCard } from '../components';
import styles from '../styles/library.module.css';

const MIN_COLUMN_WIDTH = 150;
const GRID_GAP = 20;
const MOBILE_GAP = 12;
const MIN_ROW_HEIGHT = 340;
const MIN_MOBILE_ROW_HEIGHT = 300;
const OVERSCAN_ROWS = 1;

interface VirtualizedLibraryDetailGridProps {
  items: MediaCardSummary[];
  onNearTail?: () => void;
}

export function VirtualizedLibraryDetailGrid({
  items,
  onNearTail,
}: VirtualizedLibraryDetailGridProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState({
    columns: 1,
    gap: GRID_GAP,
    rowHeight: MIN_ROW_HEIGHT,
    startRow: 0,
    endRow: 0,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let frame = 0;
    const measure = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const isMobile = width <= 640;
      const gap = isMobile ? MOBILE_GAP : GRID_GAP;
      const columns = isMobile
        ? 2
        : Math.max(1, Math.floor((width + gap) / (MIN_COLUMN_WIDTH + gap)));
      const columnWidth = Math.max(1, (width - gap * Math.max(0, columns - 1)) / columns);
      const rowHeight = Math.max(
        Math.round(columnWidth * 1.5 + (isMobile ? 90 : 100)),
        isMobile ? MIN_MOBILE_ROW_HEIGHT : MIN_ROW_HEIGHT,
      );
      const stride = rowHeight + gap;
      const scrollTopWithin = Math.max(0, -rect.top);
      const viewportHeight = Math.max(window.innerHeight, rowHeight);
      const totalRows = Math.max(1, Math.ceil(items.length / columns));
      const startRow = Math.max(0, Math.floor(scrollTopWithin / stride) - OVERSCAN_ROWS);
      const endRow = Math.min(
        totalRows - 1,
        Math.floor((scrollTopWithin + viewportHeight) / stride) + OVERSCAN_ROWS,
      );

      setLayout((current) => {
        if (
          current.columns === columns &&
          current.gap === gap &&
          current.rowHeight === rowHeight &&
          current.startRow === startRow &&
          current.endRow === endRow
        ) {
          return current;
        }
        return { columns, gap, rowHeight, startRow, endRow };
      });
    };
    const schedule = () => {
      if (frame) {
        return;
      }
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };

    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(schedule);
    resizeObserver?.observe(container);

    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      resizeObserver?.disconnect();
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [items.length]);

  const totalRows = Math.max(1, Math.ceil(items.length / layout.columns));
  const stride = layout.rowHeight + layout.gap;
  const totalHeight = totalRows * layout.rowHeight + Math.max(0, totalRows - 1) * layout.gap;
  const visibleRows = useMemo(() => {
    const rows: Array<{ index: number; items: MediaCardSummary[] }> = [];
    for (let index = layout.startRow; index <= layout.endRow; index += 1) {
      const rowItems = items.slice(index * layout.columns, (index + 1) * layout.columns);
      if (rowItems.length > 0) {
        rows.push({ index, items: rowItems });
      }
    }
    return rows;
  }, [items, layout.columns, layout.endRow, layout.startRow]);

  useEffect(() => {
    if (!onNearTail || items.length === 0) {
      return;
    }
    const visibleEndIndex = Math.min(items.length, (layout.endRow + 1) * layout.columns);
    const remaining = items.length - visibleEndIndex;
    if (remaining <= layout.columns * 6) {
      onNearTail();
    }
  }, [items.length, layout.columns, layout.endRow, onNearTail]);

  return (
    <div ref={containerRef} className={styles.libraryVirtualizedGrid} data-library-virtualized-grid>
      <div
        className={styles.libraryVirtualizedCanvas}
        data-library-virtualized-canvas
        style={{ height: totalHeight }}
      >
        {visibleRows.map((row) => (
          <div
            key={row.index}
            className={styles.libraryVirtualizedRow}
            data-library-virtualized-row={row.index}
            style={{
              top: row.index * stride,
              minHeight: layout.rowHeight,
              gap: layout.gap,
              gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
            }}
          >
            {row.items.map((item) => (
              <LibraryDetailMediaCard key={item.id} item={item} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
