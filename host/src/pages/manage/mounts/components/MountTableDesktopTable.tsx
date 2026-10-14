import { useRef } from 'react';
import type { ManageMountRecord } from '@fmby/v2-shared/contracts/manage';
import { Checkbox, StatusBadge } from '@fmby/v2-shared/ui';
import { formatDateTime } from '@fmby/v2-shared/time';
import styles from '../../ManagePages.module.css';
import { EmptyTableRow, getManageStatusVariant } from '../../components';
import {
  canValidateMountType,
  formatMountReferenceSummary,
  getMountStatusLabel,
  hasHiddenMountReferences,
} from '../formUtils';
import { useTableRowRoving } from '../../../../features/a11y/useTableRowRoving';
import { CredentialBadgeCell } from './CredentialBadgeCell';

interface ValidateMutationShape {
  isPending: boolean;
  variables: string | undefined;
  mutate: (mountId: string) => void;
}

interface MountTableDesktopTableProps {
  /** 已筛选行（与 tbody 实际渲染一一对应）。 */
  mounts: ManageMountRecord[];
  /** FE-OPT-04 多选：已选 id。 */
  selectedIds: readonly string[];
  /** FE-OPT-04 多选：表头三态。 */
  headerState: 'checked' | 'indeterminate' | 'unchecked';
  onToggleRow: (id: string, checked: boolean, opts?: { shiftKey?: boolean }) => void;
  onSelectAll: () => void;
  onClearVisible: () => void;
  onOpenView: (mountId: string) => void;
  onOpenEdit: (mountId: string) => void;
  onRequestDelete: (mount: ManageMountRecord) => void;
  validateMutation: ValidateMutationShape;
  healthFaultActionById?: Record<string, string | null>;
  onRebindMount?: (mountId: string) => void;
}

export function MountTableDesktopTable({
  mounts,
  selectedIds,
  headerState,
  onToggleRow,
  onSelectAll,
  onClearVisible,
  onOpenView,
  onOpenEdit,
  onRequestDelete,
  validateMutation,
  healthFaultActionById = {},
  onRebindMount,
}: MountTableDesktopTableProps) {
  const selectedSet = new Set(selectedIds);
  // FE-LIST-KEYNAV-4：表格行键盘漫游（↑↓/Home/End 移动行，Enter 打开该挂载详情）。
  // rowCount 取已筛选行数，与 tbody 内实际渲染行一一对应。
  // 行首 checkbox 的 tabIndex 不动，Enter/Space 仍走原生选中语义。
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  useTableRowRoving({
    tbodyRef,
    rowCount: mounts.length,
    onActivate: (index) => {
      const mount = mounts[index];
      if (mount) onOpenView(mount.id);
    },
  });
  return (
    <div className={styles.desktopOnly}>
      <div className={styles.tableWrap} role="region" aria-label="挂载点列表（可横向滚动）">
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <Checkbox
                  checked={headerState === 'checked' ? true : headerState === 'indeterminate' ? 'indeterminate' : false}
                  onCheckedChange={() => {
                    if (headerState === 'checked') onClearVisible();
                    else onSelectAll();
                  }}
                  aria-label="全选当前页数据源"
                />
              </th>
              <th>数据源</th>
              <th>类型</th>
              <th>状态</th>
              <th>凭据</th>
              <th>根路径 / 地址</th>
              <th>能力</th>
              <th>引用情况</th>
              <th>最近校验</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody ref={tbodyRef}>
            {mounts.length === 0 ? (
              <EmptyTableRow
                colSpan={10}
                title="没有匹配的来源"
                description="试试更换关键词、状态或类型筛选。"
              />
            ) : (
              mounts.map((mount, rowIndex) => (
                <tr key={mount.id} data-row-index={rowIndex} data-selected={selectedSet.has(mount.id) || undefined}>
                  <td>
                    <Checkbox
                      checked={selectedSet.has(mount.id)}
                      onClick={(event) => {
                        if (event.shiftKey) {
                          event.preventDefault();
                          onToggleRow(mount.id, !selectedSet.has(mount.id), { shiftKey: true });
                        }
                      }}
                      onCheckedChange={(checked) => onToggleRow(mount.id, checked === true)}
                      aria-label={`选择数据源 ${mount.name}`}
                    />
                  </td>
                  <td>
                    <div className={styles.stackText}>
                      <span className={styles.primaryText}>{mount.name}</span>
                      <span className={styles.mutedText}>{mount.description || '暂无说明'}</span>
                    </div>
                  </td>
                  <td>{mount.typeLabel}</td>
                  <td>
                    <div className={styles.stackText}>
                      <StatusBadge
                        label={getMountStatusLabel(mount.healthStatus)}
                        variant={getManageStatusVariant(mount.healthStatus)}
                      />
                      {mount.unavailableBindingCount > 0 ? (
                        <span className={styles.mutedText}>
                          已隐藏 {mount.unavailableBindingCount} 个绑定
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <CredentialBadgeCell credentialStatus={mount.credentialStatus} lastFaultAction={healthFaultActionById[mount.id] ?? null} mountId={mount.id} onRebindMount={onRebindMount} />
                  </td>
                  <td>{mount.pathLabel}</td>
                  <td>
                    <div className={styles.chipRow}>
                      {mount.capabilities.length === 0 ? (
                        <span className={styles.mutedText}>未声明能力</span>
                      ) : (
                        mount.capabilities.map((capability) => (
                          <span key={`${mount.id}-${capability}`} className={styles.chip}>
                            {capability}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td>
                    <div className={styles.stackText}>
                      <span className={styles.primaryText}>{formatMountReferenceSummary(mount)}</span>
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
                  </td>
                  <td>{formatDateTime(mount.lastCheckedAt)}</td>
                  <td>
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
                        title={
                          canValidateMountType(mount.mountType)
                            ? '校验来源健康状态'
                            : '当前来源类型暂不支持真实校验'
                        }
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
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
