/**
 * 凭据徽标单元格（数据源列表：桌面列 + 移动卡片共用）。
 *
 * ★not_required（Local 等）与未知 → 不渲染任何凭据 UI（返回 null），
 *   避免给无需凭据的数据源加噪音。
 */

import type { ManageMountRecord } from '@fmby/v2-shared/contracts/manage';
import { StatusBadge } from '@fmby/v2-shared/ui';
import { resolveCredentialBadge } from '../credentialPresentation';
import styles from '../../ManagePages.module.css';

interface CredentialBadgeCellProps {
  credentialStatus: ManageMountRecord['credentialStatus'];
  /** 观察面处置建议（可为 null：无观测）；只作补充，不重复告警。 */
  lastFaultAction: string | null;
}

export function CredentialBadgeCell({
  credentialStatus,
  lastFaultAction,
}: CredentialBadgeCellProps) {
  const badge = resolveCredentialBadge(credentialStatus, lastFaultAction);
  if (!badge.visible) {
    return null;
  }
  return (
    <div className={styles.stackText}>
      <StatusBadge label={badge.label} variant={badge.variant} />
      {badge.needsAction ? (
        <span className={styles.fieldErrorText}>{badge.actionLabel}</span>
      ) : null}
      {badge.hint ? <span className={styles.mutedText}>{badge.hint}</span> : null}
    </div>
  );
}
