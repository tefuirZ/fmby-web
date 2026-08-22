import type { RegistrationCodeBatchRecord } from '@/domains/manage';
import styles from '../../longtail-shared/ManageShared.module.css';

export interface RegistrationCodeBatchActionsBarProps {
  selectedBatches: RegistrationCodeBatchRecord[];
  onClearSelection: () => void;
  onCopyAll: () => void;
  onCopyAvailable: () => void;
  onBatchDelete: () => void;
}

export function RegistrationCodeBatchActionsBar({
  selectedBatches,
  onClearSelection,
  onCopyAll,
  onCopyAvailable,
  onBatchDelete,
}: RegistrationCodeBatchActionsBarProps) {
  if (selectedBatches.length === 0) {
    return null;
  }

  return (
    <div className={styles.stickyBar}>
      <div className={styles.stackText}>
        <strong>已选择 {selectedBatches.length} 个批次</strong>
        <span className={styles.mutedText}>
          仅整批删除：批次内只要有已使用注册码，就会整批跳过，不做半截删库这种破事。
        </span>
      </div>
      <div className={styles.rowActions}>
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={onClearSelection}
        >
          清空选择
        </button>
        <button className={styles.secondaryButton} type="button" onClick={onCopyAll}>
          复制所选全部
        </button>
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={onCopyAvailable}
        >
          复制所选可用
        </button>
        <button className={styles.dangerButton} type="button" onClick={onBatchDelete}>
          批量删除
        </button>
      </div>
    </div>
  );
}
