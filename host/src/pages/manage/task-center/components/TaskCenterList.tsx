import { useRef, type Dispatch, type SetStateAction } from 'react';
import type { TaskCenterItemRecord } from '@fmby/v2-shared/contracts/manage/task-center';
import { StatusBadge } from '@fmby/v2-shared/ui';
import { formatDateTime, formatRelativeTime } from '@fmby/v2-shared/time';
import styles from '../../ManagePages.module.css';
import { EmptyTableRow, getManageStatusVariant } from '../../components';
import { getCategoryLabel, getStatusLabel, mapStatusVariant } from '../utils';
import type { SelectedTaskRef } from '../types';
import { useTableRowRoving } from '../../../../features/a11y/useTableRowRoving';

interface TaskCenterListProps {
  items: TaskCenterItemRecord[];
  total: number;
  page: number;
  totalPages: number;
  isFetching: boolean;
  /** E3 裁决：空态两态分开 —— true = 有筛选（筛空），false = 真·无任务。 */
  hasActiveFilters: boolean;
  setSelectedTask: Dispatch<SetStateAction<SelectedTaskRef | null>>;
  setPage: Dispatch<SetStateAction<number>>;
}

export function TaskCenterList({
  items,
  total,
  page,
  totalPages,
  isFetching,
  hasActiveFilters,
  setSelectedTask,
  setPage,
}: TaskCenterListProps) {
  // FE-LIST-KEYNAV-5：表格行键盘漫游（↑↓/Home/End 移动行，Enter 打开该任务详情）。
  // rowCount = 当前页 items.length（服务端分页 ⇒ 漫游域 = 当前页）。
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  useTableRowRoving({
    tbodyRef,
    rowCount: items.length,
    onActivate: (index) => {
      const item = items[index];
      if (item) setSelectedTask({ category: item.category, id: item.id });
    },
  });

  return (
    <>
      <div className={styles.tableHint}>
        当前结果 {items.length} / {total} 条
        {isFetching ? ' · 正在刷新' : ''}
      </div>

      <div className={`${styles.tableWrap} ${styles.desktopOnly}`} role="region" aria-label="任务列表（可横向滚动）">
        <table className={styles.table}>
          <thead>
            <tr>
              <th>时间</th>
              <th>类别</th>
              <th>媒体</th>
              <th>状态</th>
              <th>重试</th>
              <th>错误</th>
              <th>摘要</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody ref={tbodyRef}>
            {items.length === 0 ? (
              hasActiveFilters ? (
                // 筛空：用户主动收窄了范围 ⇒ 指引放宽筛选。
                <EmptyTableRow
                  colSpan={8}
                  title="当前筛选下没有任务"
                  description="换个时间窗口或状态试试，别把自己筛成真空了。"
                />
              ) : (
                // 真·无任务：系统当前没有任何运行中的任务（产品裁决措辞）。
                <EmptyTableRow
                  colSpan={8}
                  title="当前没有运行中的任务"
                  description="系统当前空闲；任务启动后会自动出现在这里。"
                />
              )
            ) : (
              items.map((item, rowIndex) => (
                <tr key={`${item.category}:${item.id}`} data-row-index={rowIndex}>
                  <td>
                    <div className={styles.stackText}>
                      <span>{formatDateTime(item.updatedAt)}</span>
                      <span className={styles.mutedText}>{formatRelativeTime(item.updatedAt)}</span>
                    </div>
                  </td>
                  <td>{getCategoryLabel(item.category)}</td>
                  <td>
                    <div className={styles.stackText}>
                      <strong className={styles.primaryText}>
                        {item.mediaTitle ?? '系统级任务'}
                      </strong>
                      <span className={styles.mutedText}>{item.mediaItemId ?? '—'}</span>
                    </div>
                  </td>
                  <td>
                    <StatusBadge
                      label={getStatusLabel(item.status)}
                      variant={getManageStatusVariant(mapStatusVariant(item.status))}
                    />
                  </td>
                  <td>{item.retryCount}</td>
                  <td>{item.lastErrorCode ?? item.lastErrorMessage ?? '—'}</td>
                  <td>{item.summary}</td>
                  <td className={styles.actionsCell}>
                    <button
                      className={styles.smallButton}
                      type="button"
                      onClick={() =>
                        setSelectedTask({
                          category: item.category,
                          id: item.id,
                        })
                      }
                    >
                      详情
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={`${styles.mobileOnly} ${styles.mobileCardList}`}>
        {items.length === 0 ? (
          <div className={styles.emptyInlineState}>当前筛选下没有任务。</div>
        ) : (
          items.map((item) => (
            <article key={`${item.category}:${item.id}`} className={styles.mobileRecordCard}>
              <div className={styles.mobileRecordHeader}>
                <div className={styles.stackText}>
                  <strong className={styles.mobileRecordTitle}>
                    {item.mediaTitle ?? getCategoryLabel(item.category)}
                  </strong>
                  <span className={styles.mobileRecordMeta}>{formatDateTime(item.updatedAt)}</span>
                </div>
                <StatusBadge
                  label={getStatusLabel(item.status)}
                  variant={getManageStatusVariant(mapStatusVariant(item.status))}
                />
              </div>
              <p className={styles.mobileRecordBody}>{item.summary}</p>
              <div className={styles.mobileRecordGrid}>
                <span>类别</span>
                <strong>{getCategoryLabel(item.category)}</strong>
                <span>错误</span>
                <strong>{item.lastErrorCode ?? item.lastErrorMessage ?? '—'}</strong>
                <span>重试</span>
                <strong>{item.retryCount}</strong>
              </div>
              <div className={styles.mobileRecordActions}>
                <button
                  className={styles.smallButton}
                  type="button"
                  onClick={() =>
                    setSelectedTask({
                      category: item.category,
                      id: item.id,
                    })
                  }
                >
                  查看详情
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      <div className={styles.runtimeLogFilterActions}>
        <button
          className={styles.ghostButton}
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
        >
          上一页
        </button>
        <span className={styles.metaText}>
          第 {page} / {totalPages} 页
        </span>
        <button
          className={styles.ghostButton}
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
        >
          下一页
        </button>
      </div>
    </>
  );
}
