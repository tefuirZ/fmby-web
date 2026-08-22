import type { ManageLibraryDetailRecord } from '@/domains/manage';
import { StatusBadge } from '@/shared/ui';
import { formatDateTime } from '@/shared/utils/date';
import { ManageSectionCard, getManageStatusVariant } from '../../../../components';
import styles from '../../../../ManagePages.module.css';

interface LibraryDrawerViewScanTasksSectionProps {
  currentDetail: ManageLibraryDetailRecord;
}

export function LibraryDrawerViewScanTasksSection({ currentDetail }: LibraryDrawerViewScanTasksSectionProps) {
  return (
    <ManageSectionCard title="最近扫描任务" description="展示最近发起的扫描任务与状态。">
      {currentDetail.recentScanTasks.length === 0 ? (
        <div className={styles.emptyInlineState}>当前还没有扫描任务记录。</div>
      ) : (
        <div className={styles.list}>
          {currentDetail.recentScanTasks.map((task) => (
            <div key={task.id} className={styles.listItem}>
              <div className={styles.inlineMeta}>
                <span className={styles.primaryText}>{task.mountName}</span>
                <StatusBadge label={task.status} variant={getManageStatusVariant(task.status)} />
                <span className={styles.metaText}>{task.taskType}</span>
              </div>
              <div className={styles.stackText}>
                <span className={styles.mutedText}>{task.sourcePath}</span>
                <span className={styles.mutedText}>
                  新发现 {task.itemsFound} 项，更新 {task.itemsUpdated} 项
                </span>
                {task.errorMessage ? <span className={styles.fieldErrorText}>错误：{task.errorMessage}</span> : null}
                <span className={styles.mutedText}>创建时间：{formatDateTime(task.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </ManageSectionCard>
  );
}
