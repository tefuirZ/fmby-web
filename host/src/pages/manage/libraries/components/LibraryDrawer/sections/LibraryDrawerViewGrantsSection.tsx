import type { ManageLibraryDetailRecord } from '@/domains/manage';
import { formatDateTime } from '@/shared/utils/date';
import { ManageSectionCard } from '../../../../components';
import styles from '../../../../ManagePages.module.css';

interface LibraryDrawerViewGrantsSectionProps {
  currentDetail: ManageLibraryDetailRecord;
}

export function LibraryDrawerViewGrantsSection({ currentDetail }: LibraryDrawerViewGrantsSectionProps) {
  return (
    <ManageSectionCard title="访问授权" description="列出已被显式授予访问权限的用户。">
      {currentDetail.accessGrants.length === 0 ? (
        <div className={styles.emptyInlineState}>当前没有显式授权用户。</div>
      ) : (
        <div className={styles.selectionGrid}>
          {currentDetail.accessGrants.map((grant) => (
            <div key={grant.userId} className={styles.selectionCard}>
              <span className={styles.selectionCardBody}>
                <span className={styles.primaryText}>{grant.displayName || grant.username}</span>
                <span className={styles.mutedText}>@{grant.username}</span>
                <span className={styles.mutedText}>授权时间：{formatDateTime(grant.grantedAt)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </ManageSectionCard>
  );
}
