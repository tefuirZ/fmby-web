import type { RefObject } from 'react';
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

/** 桌面端「运行日志」表（7 列，roving 行）。tbodyRef 由父组件 useLogViewsRoving 传入（hook 须在 early return 前）。 */
export function RuntimeLogsDesktopTable({
  logViews,
  hasItems,
  tbodyRef,
  onDetail,
}: RuntimeLogsDesktopTableProps) {
  return (
    <div className={`${styles.tableWrap} ${styles.desktopOnly}`} role="region" aria-label="运行日志（可横向滚动）">
      <table className={styles.table}>
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
            logViews.map((view, index) => (
              <tr key={view.record.id} data-row-index={index}>
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
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
