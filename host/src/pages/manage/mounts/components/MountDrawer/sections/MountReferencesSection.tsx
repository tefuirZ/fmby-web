import type { ManageMountDetailRecord } from '@fmby/v2-shared/contracts/manage';
import { ManageSectionCard } from '../../../../components';
import { formatMountReferenceSummary } from '../../../formUtils';
import styles from '../../../../ManagePages.module.css';

interface MountReferencesSectionProps {
  currentDetail: ManageMountDetailRecord;
}

export function MountReferencesSection({
  currentDetail,
}: MountReferencesSectionProps) {
  return (
    <ManageSectionCard title="引用情况" description="这里展示的是删除校验真正使用的引用计数，不只看媒体库绑定。">
      <div className={styles.fieldRow}>
        <div className={styles.stackText}>
          <span className={styles.mutedText}>引用摘要</span>
          <span className={styles.primaryText}>{formatMountReferenceSummary(currentDetail)}</span>
        </div>
        <div className={styles.stackText}>
          <span className={styles.mutedText}>媒体库绑定</span>
          <span className={styles.primaryText}>{currentDetail.mount.referenceCounts.librarySourceCount}</span>
        </div>
        <div className={styles.stackText}>
          <span className={styles.mutedText}>媒体源</span>
          <span className={styles.primaryText}>{currentDetail.mount.referenceCounts.mediaSourceCount}</span>
        </div>
        <div className={styles.stackText}>
          <span className={styles.mutedText}>旁路资源</span>
          <span className={styles.primaryText}>{currentDetail.mount.referenceCounts.sidecarAssetCount}</span>
        </div>
      </div>
    </ManageSectionCard>
  );
}
