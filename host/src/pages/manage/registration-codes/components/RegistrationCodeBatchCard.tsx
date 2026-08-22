import type { RegistrationCodeBatchRecord } from '@/domains/manage';
import { formatDateTime } from '@/shared/utils/date';
import { StatusBadge } from '@/shared/ui';
import styles from '../../longtail-shared/ManageShared.module.css';
import { getBatchModeLabel } from '../formUtils';
import type { RegistrationCodeBatchSummary } from '../types';

export interface RegistrationCodeBatchCardProps {
  batchSummary: RegistrationCodeBatchSummary;
  expanded: boolean;
  selected: boolean;
  onToggleExpanded: (batchId: string) => void;
  onToggleSelected: (batchId: string) => void;
  onCopyAll: (batch: RegistrationCodeBatchRecord) => void;
  onCopyAvailable: (batch: RegistrationCodeBatchRecord) => void;
  onEdit: (batch: RegistrationCodeBatchRecord) => void;
  children?: React.ReactNode;
}

export function RegistrationCodeBatchCard({
  batchSummary,
  expanded,
  selected,
  onToggleExpanded,
  onToggleSelected,
  onCopyAll,
  onCopyAvailable,
  onEdit,
  children,
}: RegistrationCodeBatchCardProps) {
  const { batch, roleLabels, libraryLabels } = batchSummary;

  return (
    <article className={styles.entityCard}>
      <div className={styles.batchHeaderRow}>
        <div className={styles.batchTitleRow}>
          <input
            className={styles.batchCheckbox}
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelected(batch.id)}
          />
          <div className={styles.stackText}>
            <div className={styles.inlineMeta}>
              <strong className={styles.primaryText}>{batch.name}</strong>
              <StatusBadge
                label={getBatchModeLabel(batch.mode)}
                variant={batch.mode === 'shared-code' ? 'info' : 'success'}
              />
            </div>
            <span className={styles.mutedText}>
              {batch.createdByName ?? '未知创建人'} · {formatDateTime(batch.createdAt)}
            </span>
          </div>
        </div>

        <div className={styles.batchActions}>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => onEdit(batch)}
          >
            编辑批次
          </button>
          <button
            className={styles.smallButton}
            type="button"
            onClick={() => onCopyAll(batch)}
          >
            复制全部
          </button>
          <button
            className={styles.smallButton}
            type="button"
            onClick={() => onCopyAvailable(batch)}
          >
            复制可用
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => onToggleExpanded(batch.id)}
          >
            {expanded ? '收起明细' : '展开明细'}
          </button>
        </div>
      </div>

      <div className={styles.detailSummaryGrid}>
        <div className={styles.detailCard}>
          <span className={styles.detailCardLabel}>批次规模</span>
          <span className={styles.detailCardValue}>{batch.totalCodes} 条注册码</span>
        </div>
        <div className={styles.detailCard}>
          <span className={styles.detailCardLabel}>仍可继续使用</span>
          <span className={styles.detailCardValue}>{batch.availableCodes} 条</span>
        </div>
        <div className={styles.detailCard}>
          <span className={styles.detailCardLabel}>已产生使用记录</span>
          <span className={styles.detailCardValue}>
            {batch.usedCodes} 条 / 共 {batch.totalUsedCount} 次
          </span>
        </div>
        <div className={styles.detailCard}>
          <span className={styles.detailCardLabel}>受限状态</span>
          <span className={styles.detailCardValue}>
            停用 {batch.disabledCodes} · 过期/用尽 {batch.expiredCodes}
          </span>
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.stackText}>
          <strong>系统角色范围</strong>
          <div className={styles.chipRow}>
            {roleLabels.map((roleLabel) => (
              <span key={`${batch.id}-${roleLabel}`} className={styles.chip}>
                {roleLabel}
              </span>
            ))}
          </div>
        </div>

        <div className={styles.stackText}>
          <strong>默认媒体库</strong>
          <div className={styles.chipRow}>
            {libraryLabels.length === 0 ? (
              <span className={styles.chip}>不限制</span>
            ) : (
              libraryLabels.map((libraryLabel) => (
                <span key={`${batch.id}-${libraryLabel}`} className={styles.chip}>
                  {libraryLabel}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {expanded && children}
    </article>
  );
}
