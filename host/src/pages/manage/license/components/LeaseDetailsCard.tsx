/**
 * SignedLease 摘要卡（照 V1 `LeaseDetailsCard.tsx` 对位）：只展示客户端已验证持久化的关键字段。
 */

import type { LicenseStatusRecord } from '@fmby/v2-shared/contracts/manage/license';
import { formatEpochMs } from '../licenseFormat';
import styles from '../../longtail-shared/ManageShared.module.css';

interface LeaseDetailsCardProps {
  status: LicenseStatusRecord;
}

export function LeaseDetailsCard({ status }: LeaseDetailsCardProps) {
  const fields = [
    ['Product', status.productCode],
    ['Activation ID', status.activationId],
    ['License ID', status.licenseId],
    ['Lease ID', status.leaseId],
    ['Instance ID', status.instanceId],
    ['签发时间', formatEpochMs(status.issuedAt)],
    ['生效时间', formatEpochMs(status.notBefore)],
    ['正常到期', formatEpochMs(status.expiresAt)],
    ['宽限截止', formatEpochMs(status.graceExpiresAt)],
  ] as const;

  return (
    <div className={styles.detailFieldGrid}>
      {fields.map(([label, value]) => (
        <div key={label} className={styles.detailCard}>
          <span className={styles.detailCardLabel}>{label}</span>
          <strong className={label.endsWith('ID') ? styles.mono : undefined}>
            {value || '—'}
          </strong>
        </div>
      ))}
      <div className={styles.detailCard}>
        <span className={styles.detailCardLabel}>实例公钥</span>
        <strong className={styles.mono}>{status.instancePublicKey || '—'}</strong>
      </div>
    </div>
  );
}
