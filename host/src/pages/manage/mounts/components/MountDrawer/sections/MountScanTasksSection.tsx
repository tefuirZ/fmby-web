import type { ManageMountDetailRecord } from '@fmby/v2-shared/contracts/manage';
import { StatusBadge } from '@fmby/v2-shared/ui';
import { formatDateTime } from '@fmby/v2-shared/time';
import { ManageSectionCard, getManageStatusVariant } from '../../../../components';
import styles from '../../../../ManagePages.module.css';

interface MountScanTasksSectionProps {
  currentDetail: ManageMountDetailRecord;
}

export function MountScanTasksSection({
  currentDetail,
}: MountScanTasksSectionProps) {
  return (
    <ManageSectionCard title="最近扫描任务" description="展示最近与当前来源相关的扫描任务。">
      {currentDetail.recentScanTasks.length === 0 ? (
        <div className={styles.emptyInlineState}>当前还没有扫描任务记录。</div>
      ) : (
        <div className={styles.list}>
          {currentDetail.recentScanTasks.map((task) => (
            <div key={task.id} className={styles.listItem}>
              <div className={styles.inlineMeta}>
                <span className={styles.primaryText}>{task.libraryName}</span>
                <StatusBadge label={task.status} variant={getManageStatusVariant(task.status)} />
                <span className={styles.metaText}>{task.taskType}</span>
              </div>
              <div className={styles.stackText}>
                <span className={styles.mutedText}>{task.sourcePath}</span>
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
