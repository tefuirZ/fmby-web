import type { ManageMountDetailRecord } from '@fmby/v2-shared/contracts/manage';
import { formatMountReferenceSummary, hasHiddenMountReferences } from '../../../formUtils';
import styles from '../../../../ManagePages.module.css';

interface MountDeletePanelProps {
  currentDetail: ManageMountDetailRecord;
  isDeleting: boolean;
  onDelete: () => void;
}

export function MountDeletePanel({
  currentDetail,
  isDeleting,
  onDelete,
}: MountDeletePanelProps) {
  const deleteHint = hasHiddenMountReferences(currentDetail)
    ? '当前虽然没有媒体库绑定，但底层媒体源或旁路资源还在引用它，直接删会被后端拒绝。'
    : '如果数据源仍被引用，后端会拒绝删除并返回明确原因。';

  return (
    <div className={styles.dangerPanel}>
      <div className={styles.stackText}>
        <strong>删除数据源</strong>
        <span className={styles.mutedText}>{deleteHint}</span>
        <span className={styles.mutedText}>{formatMountReferenceSummary(currentDetail)}</span>
      </div>
      <div className={styles.rowActions}>
        <button
          className={styles.dangerButton}
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
        >
          删除来源
        </button>
      </div>
    </div>
  );
}
