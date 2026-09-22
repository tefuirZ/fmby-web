/**
 * 详情面凭据状态卡（W5-A：CRED-EXPIRY-WIRE 前端消费）。
 *
 * 权威来源 = `currentDetail.credentialStatus`（与列表面 `mount.credentialStatus`
 * **同值同源派生**，后端 `read_health.rs:85`）。
 *
 * ★去重：观察面 `last_fault_kind == credential_expired` 不再单独告警，
 *   仅由 `resolveCredentialBadge` 在不重复的前提下补一句后端处置建议。
 * ★不回显任何密钥/密封引用：只呈现四态枚举 + 后端文案。
 */

import type { ManageMountDetailRecord } from '@fmby/v2-shared/contracts/manage';
import { InlineBanner, StatusBadge } from '@fmby/v2-shared/ui';
import { resolveCredentialBadge } from '../../../credentialPresentation';
import { ManageSectionCard } from '../../../../components';
import styles from '../../../../ManagePages.module.css';

interface MountCredentialCardProps {
  currentDetail: ManageMountDetailRecord;
  /** 观察面处置建议（可为 null：无观测）。 */
  lastFaultAction?: string | null;
  /** 重绑/绑定入口（由宿主跳既有授权流程；未提供则不假造按钮）。 */
  onRebind?: () => void;
}

export function MountCredentialCard({
  currentDetail,
  lastFaultAction = null,
  onRebind,
}: MountCredentialCardProps) {
  const badge = resolveCredentialBadge(currentDetail.credentialStatus, lastFaultAction);

  // not_required（Local 等）与未知 → 不显示任何凭据 UI
  if (!badge.visible) {
    return null;
  }

  return (
    <ManageSectionCard
      title="凭据状态"
      description="凭据状态由后端派生，仅含四态，不回显任何密钥或密封引用。"
    >
      <div className={styles.fieldRow}>
        <StatusBadge label={badge.label} variant={badge.variant} />
        {badge.needsAction && onRebind ? (
          <button className={styles.primaryButton} type="button" onClick={onRebind}>
            {badge.actionLabel}
          </button>
        ) : null}
      </div>

      {badge.needsAction ? (
        <InlineBanner
          variant={badge.variant === 'danger' ? 'error' : 'warning'}
          title={badge.actionLabel ?? '需要凭据操作'}
          description={badge.hint ?? ''}
        />
      ) : badge.hint ? (
        <div className={styles.fieldHint}>{badge.hint}</div>
      ) : null}
    </ManageSectionCard>
  );
}
