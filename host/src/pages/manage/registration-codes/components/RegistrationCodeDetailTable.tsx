import { useRef } from 'react';
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
import { useTableRowRoving } from '../../../../features/a11y/useTableRowRoving';

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
  // FE-LIST-KEYNAV-6：表格行键盘漫游（↑↓/Home/End 移动行）。
  // ★刻意**不传 onActivate**：行内两个动作（onStatusAction 启用/停用、
  // onDelete 删除）**都是写操作**。删除是破坏性的；启用/停用虽非破坏性，
  // 但也是改服务端状态，不宜绑到「随手一按回车」上 ⇒ 一律留给行内按钮。
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  useTableRowRoving({ tbodyRef, rowCount: records.length });

  return (
    <div className={styles.desktopOnly}>
      <div className={styles.tableWrap} role="region" aria-label="注册码详情（可横向滚动）">
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
          <tbody ref={tbodyRef}>
            {records.map((record, rowIndex) => {
              const statusAction = getCodeStatusAction(record);
              const libraryNames = record.defaultLibraries.map(
                (libraryId) => libraryNameMap.get(libraryId) ?? libraryId,
              );

              return (
                <tr key={record.id} data-row-index={rowIndex}>
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
