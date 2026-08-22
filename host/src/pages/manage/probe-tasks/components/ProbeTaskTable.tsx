import type { ManageProbeTaskRecord } from '@/domains/manage';
import { StatusBadge } from '@/shared/ui';
import { formatDateTime } from '@/shared/utils/date';
import styles from '../../ManagePages.module.css';
import { EmptyTableRow, ManageSectionCard, getManageStatusVariant } from '../../components';
import type { ProbeStatusFilter } from '../types';
import {
  buildCompactTechnicalSummary,
  buildTriggerHint,
  buildTitleLine,
  canTriggerProbe,
  formatAvailabilityStateLabel,
  formatMountStatusLabel,
  formatProbeProviderLabel,
  formatProbeReason,
  formatProbeTaskStatusLabel,
  formatSourceStatusLabel,
  getProbeTaskRecentAt,
} from '../utils';

interface ProbeTaskTableProps {
  tasks: ManageProbeTaskRecord[];
  filteredTasks: ManageProbeTaskRecord[];
  keyword: string;
  statusFilter: ProbeStatusFilter;
  scopedLibraryId?: string;
  scopedMountId?: string;
  onKeywordChange: (value: string) => void;
  onStatusFilterChange: (value: ProbeStatusFilter) => void;
  onClearScope: () => void;
  onSelectSource: (sourceId: string) => void;
}

export function ProbeTaskTable({
  tasks,
  filteredTasks,
  keyword,
  statusFilter,
  scopedLibraryId,
  scopedMountId,
  onKeywordChange,
  onStatusFilterChange,
  onClearScope,
  onSelectSource,
}: ProbeTaskTableProps) {
  return (
    <ManageSectionCard
      title="任务列表"
      description="列表按当前任务活跃度排序，优先展示正在执行或等待重试的来源。"
      actions={
        <div className={styles.filterGroup}>
          <label className={styles.label}>
            搜索
            <input
              className={styles.searchInput}
              type="search"
              placeholder="片名 / 媒体库 / 来源路径"
              value={keyword}
              onChange={(event) => onKeywordChange(event.target.value)}
            />
          </label>
          <label className={styles.label}>
            状态筛选
            <select
              className={styles.select}
              value={statusFilter}
              onChange={(event) => onStatusFilterChange(event.target.value as ProbeStatusFilter)}
            >
              <option value="all">全部</option>
              <option value="running">运行中</option>
              <option value="queued">排队中</option>
              <option value="retry-waiting">等待重试</option>
              <option value="succeeded">已完成</option>
              <option value="failed">失败</option>
              <option value="idle">未入队</option>
            </select>
          </label>
          {(scopedLibraryId || scopedMountId) ? (
            <div className={styles.label}>
              范围过滤
              <button className={styles.secondaryButton} type="button" onClick={onClearScope}>
                清除范围
              </button>
            </div>
          ) : null}
        </div>
      }
    >
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>影片</th>
              <th>媒体库</th>
              <th>来源</th>
              <th>任务状态</th>
              <th>技术摘要</th>
              <th>最近时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.length === 0 ? (
              <EmptyTableRow
                colSpan={7}
                title={tasks.length === 0 ? '暂无探测来源' : '没有匹配的探测记录'}
                description={
                  tasks.length === 0 ? '当前还没有可管理的远端技术参数探测来源。' : '换个关键词或状态筛选再看看。'
                }
              />
            ) : (
              filteredTasks.map((task) => {
                const summary = buildCompactTechnicalSummary(task.technicalSummary);
                const blocked = !canTriggerProbe(task);
                return (
                  <tr key={task.sourceId}>
                    <td>
                      <div className={styles.stackText}>
                        <span className={styles.primaryText}>{buildTitleLine(task)}</span>
                        <span className={styles.mutedText}>
                          {task.mountName} · {formatSourceStatusLabel(task.sourceStatus)}
                        </span>
                        {blocked ? (
                          <span className={styles.mutedText}>
                            已暂停探测 · {formatAvailabilityStateLabel(task.availabilityState)} / {formatMountStatusLabel(task.mountStatus)}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div className={styles.stackText}>
                        <span>{task.libraryName}</span>
                        <span className={styles.mutedText}>{formatProbeProviderLabel(task.providerType)}</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.stackText}>
                        <span className={styles.mono}>{task.sourcePath}</span>
                        <span className={styles.mutedText}>{formatProbeReason(task.requestReason)}</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.stackText}>
                        <StatusBadge label={formatProbeTaskStatusLabel(task.status)} variant={getManageStatusVariant(task.status)} />
                        <span className={styles.mutedText}>已尝试 {task.attemptCount} 次</span>
                      </div>
                    </td>
                    <td>
                      {summary
                        ? <span>{summary}</span>
                        : <span className={styles.mutedText}>暂无快照</span>
                      }
                    </td>
                    <td>{formatDateTime(getProbeTaskRecentAt(task))}</td>
                    <td>
                      <button
                        className={styles.secondaryButton}
                        type="button"
                        title={blocked ? buildTriggerHint(task) : undefined}
                        onClick={() => onSelectSource(task.sourceId)}
                      >
                        查看详情
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </ManageSectionCard>
  );
}
