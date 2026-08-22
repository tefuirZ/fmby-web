import type { RegistrationCodeRecord } from '@/domains/manage';
import { StatusBadge } from '@/shared/ui';
import { formatDateTime } from '@/shared/utils/date';
import { getManageStatusVariant } from '../../longtail-shared/components';
import styles from '../../longtail-shared/ManageShared.module.css';
import {
  getRegistrationCodeStatusLabel,
  getCodeStatusAction,
  getUsageLabel,
} from '../formUtils';

export interface RegistrationCodeDetailTableProps {
  records: RegistrationCodeRecord[];
  libraryNameMap: Map<string, string>;
  onStatusAction: (record: RegistrationCodeRecord) => void;
  onDelete: (record: RegistrationCodeRecord) => void;
}

export function RegistrationCodeDetailTable({
  records,
  libraryNameMap,
  onStatusAction,
  onDelete,
}: RegistrationCodeDetailTableProps) {
  return (
    <div className={styles.desktopOnly}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>注册码</th>
              <th>状态</th>
              <th>使用情况</th>
              <th>会话 / 有效期</th>
              <th>默认媒体库</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const statusAction = getCodeStatusAction(record);
              const libraryNames = record.defaultLibraries.map(
                (libraryId) => libraryNameMap.get(libraryId) ?? libraryId,
              );

              return (
                <tr key={record.id}>
                  <td>
                    <div className={styles.stackText}>
                      <strong className={styles.mono}>{record.code}</strong>
                      <span className={styles.mutedText}>
                        系统角色：{record.roleTemplateLabel}
                      </span>
                    </div>
                  </td>
                  <td>
                    <StatusBadge
                      label={getRegistrationCodeStatusLabel(record.status)}
                      variant={getManageStatusVariant(record.status)}
                    />
                  </td>
                  <td>
                    <div className={styles.stackText}>
                      <span>{getUsageLabel(record)}</span>
                      <span className={styles.mutedText}>
                        创建于 {formatDateTime(record.createdAt)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.stackText}>
                      <span>会话数：{record.maxSessions ?? '不覆盖'}</span>
                      <span>有效天数：{record.validDays ?? '不覆盖'}</span>
                      <span className={styles.mutedText}>
                        过期：{formatDateTime(record.expiresAt)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.chipRow}>
                      {libraryNames.length === 0 ? (
                        <span className={styles.chip}>不限制</span>
                      ) : (
                        libraryNames.map((libraryName) => (
                          <span
                            key={`${record.id}-${libraryName}`}
                            className={styles.chip}
                          >
                            {libraryName}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td>
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
                        title={
                          record.usageCount > 0
                            ? '已使用注册码不能真删除'
                            : '真删除这条注册码记录'
                        }
                        onClick={() => onDelete(record)}
                      >
                        删除记录
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
