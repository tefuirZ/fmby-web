import type { ManageMountDetailRecord } from '@fmby/v2-shared/contracts/manage';
import { StatusBadge } from '@fmby/v2-shared/ui';
import { formatDateTime } from '@fmby/v2-shared/time';
import { ManageSectionCard, getManageStatusVariant } from '../../../../components';
import { getMountStatusLabel } from '../../../formUtils';
import styles from '../../../../ManagePages.module.css';

interface MountLinkedSourcesSectionProps {
  currentDetail: ManageMountDetailRecord;
}

export function MountLinkedSourcesSection({
  currentDetail,
}: MountLinkedSourcesSectionProps) {
  return (
    <ManageSectionCard title="关联来源绑定" description="展示当前 mount 被哪些媒体库绑定，以及各自的子路径和优先级。">
      {currentDetail.linkedSources.length === 0 ? (
        <div className={styles.emptyInlineState}>当前还没有媒体库绑定这个来源。</div>
      ) : (
        <div className={styles.list}>
          {currentDetail.linkedSources.map((source) => (
            <div key={source.id} className={styles.listItem}>
              <div className={styles.inlineMeta}>
                <span className={styles.primaryText}>{source.libraryName}</span>
                <StatusBadge
                  label={getMountStatusLabel(source.availabilityStatus)}
                  variant={getManageStatusVariant(source.availabilityStatus)}
                />
                {source.hiddenAt ? (
                  <span className={styles.metaText}>已隐藏</span>
                ) : null}
              </div>
              <div className={styles.stackText}>
                <span className={styles.mutedText}>子路径：{source.subPath || '根目录'} · 扫描优先级：{source.scanPriority}</span>
                <span className={styles.mutedText}>绑定时间：{formatDateTime(source.createdAt)}</span>
                {source.lastScanTaskStatus ? (
                  <span className={styles.mutedText}>最近扫描：{source.lastScanTaskStatus}</span>
                ) : null}
                {source.hiddenAt ? (
                  <span className={styles.fieldErrorText}>
                    连续失败 {source.consecutiveUnavailableFailures} 次，隐藏时间：{formatDateTime(source.hiddenAt)}
                  </span>
                ) : null}
                {source.availabilityMessage ? (
                  <span className={source.availabilityStatus === 'critical' ? styles.fieldErrorText : styles.mutedText}>
                    {source.availabilityMessage}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </ManageSectionCard>
  );
}
