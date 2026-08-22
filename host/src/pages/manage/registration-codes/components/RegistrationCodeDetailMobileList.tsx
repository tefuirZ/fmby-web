import type { RegistrationCodeRecord } from '@fmby/v2-shared/contracts/manage';
import { StatusBadge } from '@fmby/v2-shared/ui';
import { formatDateTime } from '@fmby/v2-shared/time';
import { getManageStatusVariant } from '../../longtail-shared/components';
import styles from '../../longtail-shared/ManageShared.module.css';
import {
  getRegistrationCodeStatusLabel,
  getCodeStatusAction,
  getUsageLabel,
} from '../formUtils';

export interface RegistrationCodeDetailMobileListProps {
  records: RegistrationCodeRecord[];
  libraryNameMap: Map<string, string>;
  onStatusAction: (record: RegistrationCodeRecord) => void;
  onDelete: (record: RegistrationCodeRecord) => void;
}

export function RegistrationCodeDetailMobileList({
  records,
  libraryNameMap,
  onStatusAction,
  onDelete,
}: RegistrationCodeDetailMobileListProps) {
  return (
    <div className={styles.mobileOnly}>
      <div className={styles.mobileCardList}>
        {records.map((record) => {
          const statusAction = getCodeStatusAction(record);
          const libraryNames = record.defaultLibraries.map(
            (libraryId) => libraryNameMap.get(libraryId) ?? libraryId,
          );

          return (
            <article key={record.id} className={styles.entityCard}>
              <div className={styles.inlineMeta}>
                <div className={styles.stackText}>
                  <strong className={styles.mono}>{record.code}</strong>
                  <span className={styles.mutedText}>
                    系统角色：{record.roleTemplateLabel}
                  </span>
                </div>
                <StatusBadge
                  label={getRegistrationCodeStatusLabel(record.status)}
                  variant={getManageStatusVariant(record.status)}
                />
              </div>

              <div className={styles.detailSummaryGrid}>
                <div className={styles.detailCard}>
                  <span className={styles.detailCardLabel}>使用情况</span>
                  <span className={styles.detailCardValue}>
                    {getUsageLabel(record)}
                  </span>
                </div>
                <div className={styles.detailCard}>
                  <span className={styles.detailCardLabel}>过期时间</span>
                  <span className={styles.detailCardValue}>
                    {formatDateTime(record.expiresAt)}
                  </span>
                </div>
              </div>

              <div className={styles.chipRow}>
                {libraryNames.length === 0 ? (
                  <span className={styles.chip}>不限制媒体库</span>
                ) : (
                  libraryNames.map((libraryName) => (
                    <span key={`${record.id}-${libraryName}`} className={styles.chip}>
                      {libraryName}
                    </span>
                  ))
                )}
              </div>

              <div className={styles.rowActions}>
                {statusAction ? (
                  <button
                    className={
                      record.status === 'paused'
                        ? styles.secondaryButton
                        : styles.ghostButton
                    }
                    type="button"
                    onClick={() => onStatusAction(record)}
                  >
                    {statusAction.label}
                  </button>
                ) : null}
                <button
                  className={styles.dangerButton}
                  type="button"
                  disabled={record.usageCount > 0}
                  onClick={() => onDelete(record)}
                >
                  删除记录
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
