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
  /**
   * 重绑/绑定入口（W5-B）：由宿主打开**既有**编辑抽屉，不新写绑定 UI。
   * 未提供时（或状态不需要动作）不渲染按钮，不假造入口。
   */
  onRebind?: () => void;
  /**
   * 便捷形态：直接给 mountId + 宿主回调，由本组件拼装入口，
   * 使桌面列与移动卡片共用同一段 JSX（少一处重复，也少一处口径漂移）。
   */
  mountId?: string;
  onRebindMount?: (mountId: string) => void;
}

export function CredentialBadgeCell({
  credentialStatus,
  lastFaultAction,
  onRebind,
  mountId,
  onRebindMount,
}: CredentialBadgeCellProps) {
  const badge = resolveCredentialBadge(credentialStatus, lastFaultAction);
  const rebind =
    onRebind ?? (mountId && onRebindMount ? () => onRebindMount(mountId) : undefined);
  if (!badge.visible) {
    return null;
  }
  const showEntry = badge.needsAction && typeof rebind === 'function';
  return (
    <div className={styles.stackText}>
      <StatusBadge label={badge.label} variant={badge.variant} />
      {badge.needsAction ? (
        showEntry ? (
          <button
            className={styles.smallButton}
            type="button"
            onClick={rebind}
            aria-label={badge.actionLabel ?? '凭据操作'}
          >
            {badge.actionLabel}
          </button>
        ) : (
          <span className={styles.fieldErrorText}>{badge.actionLabel}</span>
        )
      ) : null}
      {badge.hint ? <span className={styles.mutedText}>{badge.hint}</span> : null}
    </div>
  );
}
