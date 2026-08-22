import type { ManageMountDetailRecord } from '@/domains/manage';
import { StatusBadge } from '@/shared/ui';
import { ManageSectionCard } from '../../../../components';
import { CAPABILITY_OPTIONS } from '../../../types';
import styles from '../../../../ManagePages.module.css';

interface MountCapabilitiesViewSectionProps {
  currentDetail: ManageMountDetailRecord;
}

export function MountCapabilitiesViewSection({
  currentDetail,
}: MountCapabilitiesViewSectionProps) {
  return (
    <ManageSectionCard title="能力状态" description="展示当前来源宣告支持的能力集合。">
      <div className={styles.selectionGrid}>
        {CAPABILITY_OPTIONS.map((capability) => (
          <div key={capability.key} className={styles.selectionCard}>
            <span className={styles.selectionCardBody}>
              <span className={styles.primaryText}>{capability.label}</span>
              <span className={styles.mutedText}>{capability.description}</span>
            </span>
            <StatusBadge
              label={currentDetail.capabilityState[capability.key] ? '已启用' : '未启用'}
              variant={currentDetail.capabilityState[capability.key] ? 'success' : 'neutral'}
            />
          </div>
        ))}
      </div>
    </ManageSectionCard>
  );
}
