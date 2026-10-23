import { useEffect, useRef, useState, type RefObject } from 'react';
import type { RuntimeLogRecord } from '@fmby/v2-shared/contracts/manage';
import { StatusBadge } from '@fmby/v2-shared/ui';
import styles from '../longtail-shared/ManageShared.module.css';
import { EmptyTableRow, getManageStatusVariant } from '../longtail-shared/components';
import type { RuntimeLogView } from '../runtimeLogPresentation';
import { formatDateTime } from '@fmby/v2-shared/time';
import { formatLevelLabel, lookupFieldValue } from './components';

interface RuntimeLogsDesktopTableProps {
  logViews: RuntimeLogView[];
  hasItems: boolean;
  tbodyRef: RefObject<HTMLTableSectionElement | null>;
  onDetail: (record: RuntimeLogRecord) => void;
}

/**
 * 表体行窗口化的阈值与形状参数。
 *
 * 审计 F4：本表 `PAGE_SIZE_OPTIONS` 含 `'全部'`（无上限）且页面 5s refetch ——
 * N=3000 实测冷挂载 ~570ms / 重渲染 ~740ms（探针 scripts/perf/f4-list-render-probe.mjs）。
 * 窗口化后只渲染视口附近 ~30 行；小于阈值（普通分页档 50/100/200 行）的列表
 * 走原路径全量渲染（不白付窗口化的复杂度）。
 *
 * ponytail: 手写窗口化（复用 VirtualizedLibraryDetailGrid 的量测思路，行级形状），
 * 不引 react-window/virtuoso——单表需求，引库 = 新依赖 + 表格行高/键盘漫游适配面。
 * 天花板：行高为估算值（首次渲染后实测校准一次）；若将来行高变化剧烈（多行折行），
 * 升级为 ResizeObserver 逐行校准。
 */
const WINDOW_THRESHOLD = 150;
const ROW_HEIGHT_ESTIMATE_PX = 56;
const OVERSCAN_ROWS = 10;
const MIN_WINDOW_ROWS = 40;

/**
 * 行窗口范围（页面级滚动：`.tableWrap` 只横向滚动，纵向随文档流）。
 *
 * 量测与 `VirtualizedLibraryDetailGrid` 同思路：容器 rect 随页面滚动平移，
 * `scrollTopWithin = max(0, -rect.top)` ⇒ 可见行区间 = 视口覆盖的行带 ± overscan。
 */
function useWindowedRowRange(
  itemCount: number,
  measureRef: RefObject<HTMLElement | null>,
  windowed: boolean,
): { start: number; end: number; rowHeight: number } {
  const [state, setState] = useState({ start: 0, end: 0, rowHeight: ROW_HEIGHT_ESTIMATE_PX });

  useEffect(() => {
    if (!windowed) {
      return;
    }
    const container = measureRef.current;
    if (!container) {
      return;
    }

    let frame = 0;
    const measure = () => {
      frame = 0;
      const rect = container.getBoundingClientRect();
      const scrollTopWithin = Math.max(0, -rect.top);
      const viewportHeight = Math.max(window.innerHeight, state.rowHeight);
      const first = Math.floor(scrollTopWithin / state.rowHeight);
      const last = Math.floor((scrollTopWithin + viewportHeight) / state.rowHeight);
      setState((current) => {
        const start = Math.max(0, first - OVERSCAN_ROWS);
        const end = Math.min(itemCount - 1, last + OVERSCAN_ROWS);
        if (current.start === start && current.end === end) {
          return current;
        }
        return { ...current, start, end };
      });
    };
    const schedule = () => {
      if (!frame) {
        frame = requestAnimationFrame(measure);
      }
    };

    measure();
    // 纵向滚动发生在文档上；横向滚动/resize 影响容器几何，一并监听。
    window.addEventListener('scroll', schedule, { passive: true });
    container.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
      window.removeEventListener('scroll', schedule);
      container.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [itemCount, measureRef, windowed, state.rowHeight]);

  // 首次渲染后实测定标：估算行高偏差大时校准一次（滚动定位精度依赖它）。
  useEffect(() => {
    if (!windowed) {
      return;
    }
    const container = measureRef.current;
    if (!container) {
      return;
    }
    const id = requestAnimationFrame(() => {
      const row = container.querySelector<HTMLElement>('tr[data-row-index]');
      const measured = row?.offsetHeight ?? 0;
      if (measured >= 20 && Math.abs(measured - state.rowHeight) > 4) {
        setState((current) => ({ ...current, rowHeight: measured }));
      }
    });
    return () => cancelAnimationFrame(id);
  }, [measureRef, windowed, state.rowHeight, itemCount]);

  if (!windowed) {
    return { start: 0, end: itemCount - 1, rowHeight: ROW_HEIGHT_ESTIMATE_PX };
  }
  return state;
}

/** 桌面端「运行日志」表（7 列，roving 行）。tbodyRef 由父组件 useLogViewsRoving 传入（hook 须在 early return 前）。 */
export function RuntimeLogsDesktopTable({
  logViews,
  hasItems,
  tbodyRef,
  onDetail,
}: RuntimeLogsDesktopTableProps) {
  const tableRef = useRef<HTMLTableElement | null>(null);
  const windowed = hasItems && logViews.length > WINDOW_THRESHOLD;
  // hook 顺序稳定：windowed=false 时返回恒定全量区间（不触发条件 hook）。
  const range = useWindowedRowRange(logViews.length, tableRef, windowed);

  const renderRows = () => {
    if (!windowed) {
      return logViews.map((view, index) => (
        <RuntimeLogRow key={view.record.id} view={view} index={index} onDetail={onDetail} />
      ));
    }
    const start = Math.min(range.start, Math.max(0, logViews.length - MIN_WINDOW_ROWS));
    const end = Math.max(range.end, start + MIN_WINDOW_ROWS - 1);
    const padTop = start * range.rowHeight;
    const padBottom = Math.max(0, (logViews.length - end - 1) * range.rowHeight);
    return (
      <>
        {padTop > 0 ? (
          <tr aria-hidden="true" style={{ height: padTop }}>
            <td colSpan={7} />
          </tr>
        ) : null}
        {logViews.slice(start, end + 1).map((view, i) => (
          <RuntimeLogRow key={view.record.id} view={view} index={start + i} onDetail={onDetail} />
        ))}
        {padBottom > 0 ? (
          <tr aria-hidden="true" style={{ height: padBottom }}>
            <td colSpan={7} />
          </tr>
        ) : null}
      </>
    );
  };

  return (
    <div className={`${styles.tableWrap} ${styles.desktopOnly}`} role="region" aria-label="运行日志（可横向滚动）">
      <table className={styles.table} ref={tableRef}>
        <thead>
          <tr>
            <th>时间</th>
            <th>级别</th>
            <th>类别</th>
            <th>概览</th>
            <th>结果</th>
            <th>客户端 / 用户</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody ref={tbodyRef}>
          {!hasItems ? (
            <EmptyTableRow
              colSpan={7}
              title="没有匹配的运行日志"
              description="如果刚启动服务还没打出文件日志，先操作几次再回来刷。"
            />
          ) : (
            renderRows()
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 单行渲染（F4：从内联 map 提出独立函数——与 EpisodeRow 同口径；本表窗口化后
 * 同时渲染的行 ≤ ~60，暂不需要 React.memo；若将来去掉窗口化再补 memo）。
 */
function RuntimeLogRow({
  view,
  index,
  onDetail,
}: {
  view: RuntimeLogView;
  index: number;
  onDetail: (record: RuntimeLogRecord) => void;
}) {
  return (
    <tr data-row-index={index}>
      <td>{formatDateTime(view.record.timestamp)}</td>
      <td>
        <StatusBadge
          label={formatLevelLabel(view.record.level)}
          variant={getManageStatusVariant(view.record.level)}
        />
      </td>
      <td>
        <div className={styles.stackText}>
          <span className={styles.primaryText}>{view.targetLabel}</span>
          <span className={styles.mutedText}>{view.record.target ?? '—'}</span>
        </div>
      </td>
      <td>
        <div className={styles.logOverviewCell}>
          <span className={styles.logHeadline}>{view.headline}</span>
          <span className={styles.logSubline}>{view.eventLabel}</span>
        </div>
      </td>
      <td>
        <div className={styles.stackText}>
          <span className={styles.primaryText}>{view.resultLabel}</span>
          <span className={styles.mutedText}>
            {lookupFieldValue(view, 'request_id') ?? '无请求 ID'}
          </span>
        </div>
      </td>
      <td>
        <div className={styles.stackText}>
          <span className={styles.primaryText}>{view.actorLabel}</span>
          <span className={styles.mutedText}>{view.requestLabel}</span>
        </div>
      </td>
      <td>
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={() => onDetail(view.record)}
        >
          查看详情
        </button>
      </td>
    </tr>
  );
}
