import type { ManageMountDetailRecord } from '@/domains/manage';
import { ManageSectionCard } from '../../../../components';
import { maskSensitiveConfig } from '../../../formUtils';
import styles from '../../../../ManagePages.module.css';

interface MountConnectionConfigSectionProps {
  currentDetail: ManageMountDetailRecord;
}

export function MountConnectionConfigSection({
  currentDetail,
}: MountConnectionConfigSectionProps) {
  return (
    <ManageSectionCard title="连接配置" description="默认对敏感字段做掩码展示。">
      <pre className={styles.jsonBlock}>{JSON.stringify(maskSensitiveConfig(currentDetail.configJson), null, 2)}</pre>
    </ManageSectionCard>
  );
}
