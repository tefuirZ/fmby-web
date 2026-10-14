import type { ManageMountRecord } from '@fmby/v2-shared/contracts/manage';
import { StatusBadge } from '@fmby/v2-shared/ui';
import { formatDateTime } from '@fmby/v2-shared/time';
import styles from '../../ManagePages.module.css';
import { getManageStatusVariant } from '../../components';
import {
  canValidateMountType,
  formatMountReferenceSummary,
  getMountStatusLabel,
  hasHiddenMountReferences,
} from '../formUtils';
import { CredentialBadgeCell } from './CredentialBadgeCell';

interface ValidateMutationShape {
  isPending: boolean;
  variables: string | undefined;
  mutate: (mountId: string) => void;
}

interface MountTableMobileGridProps {
  /** 已筛选行（移动端卡片列表）。 */
  mounts: ManageMountRecord[];
  onOpenView: (mountId: string) => void;
  onOpenEdit: (mountId: string) => void;
  onRequestDelete: (mount: ManageMountRecord) => void;
  validateMutation: ValidateMutationShape;
  healthFaultActionById?: Record<string, string | null>;
  onRebindMount?: (mountId: string) => void;
}

export function MountTableMobileGrid({
  mounts,
  onOpenView,
  onOpenEdit,
  onRequestDelete,
  validateMutation,
  healthFaultActionById = {},
  onRebindMount,
}: MountTableMobileGridProps) {
  return (
    <div className={styles.mobileOnly}>
      {mounts.length === 0 ? (
        <div className={styles.emptyInlineState}>
          <div className={styles.stackText}>
            <strong>没有匹配的来源</strong>
            <span className={styles.mutedText}>试试更换关键词、状态或类型筛选。</span>
          </div>
        </div>
      ) : (
        <div className={styles.entityGrid}>
          {mounts.map((mount) => (
            <div key={mount.id} className={styles.entityCard}>
              <div className={styles.inlineMeta}>
                <StatusBadge
                  label={getMountStatusLabel(mount.healthStatus)}
                  variant={getManageStatusVariant(mount.healthStatus)}
                />
                <span className={styles.metaText}>{mount.typeLabel}</span>
                <CredentialBadgeCell credentialStatus={mount.credentialStatus} lastFaultAction={healthFaultActionById[mount.id] ?? null} mountId={mount.id} onRebindMount={onRebindMount} />
              </div>
              <div className={styles.primaryText}>{mount.name}</div>
              <div className={styles.mutedText}>{mount.pathLabel}</div>
              <div className={styles.stackText}>
                <span className={styles.mutedText}>{mount.description || '暂无说明'}</span>
                <span className={styles.mutedText}>最近校验：{formatDateTime(mount.lastCheckedAt)}</span>
                <span className={styles.mutedText}>引用：{formatMountReferenceSummary(mount)}</span>
                {mount.unavailableBindingCount > 0 ? (
                  <span className={styles.fieldErrorText}>已隐藏 {mount.unavailableBindingCount} 个绑定</span>
                ) : null}
                <span className={styles.mutedText}>
                  {mount.linkedLibraries.length > 0
                    ? `媒体库：${mount.linkedLibraries.map((library) => library.name).join('、')}`
                    : hasHiddenMountReferences(mount)
                    ? '当前没有媒体库绑定，但底层媒体源/旁路资源仍在引用它'
                    : '当前没有关联媒体库'}
                </span>
                {mount.statusMessage ? (
                  <span className={styles.fieldErrorText}>{mount.statusMessage}</span>
                ) : null}
              </div>
              <div className={styles.chipRow}>
                {mount.capabilities.map((capability) => (
                  <span key={`${mount.id}-${capability}`} className={styles.chip}>
                    {capability}
                  </span>
                ))}
              </div>
              <div className={styles.rowActions}>
                <button
                  className={styles.smallButton}
                  type="button"
                  onClick={() => onOpenView(mount.id)}
                >
                  详情
                </button>
                <button
                  className={styles.smallButton}
                  type="button"
                  onClick={() => onOpenEdit(mount.id)}
                >
                  编辑
                </button>
                <button
                  className={styles.smallButton}
                  type="button"
                  disabled={!canValidateMountType(mount.mountType) || validateMutation.isPending}
                  onClick={() => validateMutation.mutate(mount.id)}
                >
                  {validateMutation.isPending && validateMutation.variables === mount.id
                    ? '校验中…'
                    : '校验'}
                </button>
                <button
                  className={styles.dangerButton}
                  type="button"
                  onClick={() => onRequestDelete(mount)}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
