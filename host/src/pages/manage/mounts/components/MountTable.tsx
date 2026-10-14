import type { ManageMountProviderType, ManageMountRecord } from '@fmby/v2-shared/contracts/manage';
import { StatusBadge } from '@fmby/v2-shared/ui';
import { formatDateTime } from '@fmby/v2-shared/time';
import styles from '../../ManagePages.module.css';
import { ManageSectionCard, getManageStatusVariant } from '../../components';
import type { MountHealthStatus } from '../types';
import {
  canValidateMountType,
  formatMountReferenceSummary,
  getMountStatusLabel,
  hasHiddenMountReferences,
} from '../formUtils';
import { CredentialBadgeCell } from './CredentialBadgeCell';
import { MountTableToolbar } from './MountTableToolbar';
import { MountTableDesktopTable } from './MountTableDesktopTable';

interface ValidateMutationShape {
  isPending: boolean;
  variables: string | undefined;
  mutate: (mountId: string) => void;
}

interface MountTableProps {
  mounts: ManageMountRecord[];
  filteredMounts: ManageMountRecord[];
  keyword: string;
  statusFilter: 'all' | MountHealthStatus;
  typeFilter: 'all' | ManageMountProviderType;
  onKeywordChange: (value: string) => void;
  onStatusFilterChange: (value: 'all' | MountHealthStatus) => void;
  onTypeFilterChange: (value: 'all' | ManageMountProviderType) => void;
  onOpenView: (mountId: string) => void;
  onOpenEdit: (mountId: string) => void;
  onRequestDelete: (mount: ManageMountRecord) => void;
  onCreateClick: () => void;
  validateMutation: ValidateMutationShape;
  /** FE-OPT-04 多选：已选 id。 */
  selectedIds: readonly string[];
  /** FE-OPT-04 多选：表头三态。 */
  headerState: 'checked' | 'indeterminate' | 'unchecked';
  /** FE-OPT-04 多选：勾选（shift 为范围选）。 */
  onToggleRow: (id: string, checked: boolean, opts?: { shiftKey?: boolean }) => void;
  /** FE-OPT-04 多选：全选当前页。 */
  onSelectAll: () => void;
  /** FE-OPT-04 多选：清空当前页选择。 */
  onClearVisible: () => void;
  /** FE-OPT-04 多选：反选当前页。 */
  onInvertVisible: () => void;

  /**
   * 观察面（MountHealthDto.last_fault_kind）按挂载 id 给的处置建议文案。
   * ★只作补充：**不**重复告警（徽标权威来源仍是 credentialStatus）。
   */
  healthFaultActionById?: Record<string, string | null>;
  /** W5-B：打开既有编辑抽屉（复用既有绑定区，不新写 UI）。 */
  onRebindMount?: (mountId: string) => void;
}

export function MountTable({
  mounts,
  filteredMounts,
  keyword,
  statusFilter,
  typeFilter,
  onKeywordChange,
  onStatusFilterChange,
  onTypeFilterChange,
  onOpenView,
  onOpenEdit,
  onRequestDelete,
  onCreateClick,
  validateMutation,
  selectedIds,
  headerState,
  onToggleRow,
  onSelectAll,
  onClearVisible,
  onInvertVisible,
  healthFaultActionById = {},
  onRebindMount,
}: MountTableProps) {
  const renderEmptyState = (
    <div className={styles.emptyInlineState}>
      <div className={styles.stackText}>
        <strong>还没有配置媒体来源</strong>
        <span className={styles.mutedText}>先接入本地磁盘或远端来源，媒体库才能开始同步内容。</span>
      </div>
      <div className={styles.rowActions}>
        <button className={styles.primaryButton} type="button" onClick={onCreateClick}>
          添加媒体来源
        </button>
      </div>
    </div>
  );

  return (
    <ManageSectionCard title="来源列表" description="支持搜索、筛选、详情抽屉、校验连接和删除操作。">
      <MountTableToolbar
        keyword={keyword}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        onKeywordChange={onKeywordChange}
        onStatusFilterChange={onStatusFilterChange}
        onTypeFilterChange={onTypeFilterChange}
        onSelectAll={onSelectAll}
        onClearVisible={onClearVisible}
        onInvertVisible={onInvertVisible}
        resultCount={filteredMounts.length}
      />

      {mounts.length === 0 ? (
        renderEmptyState
      ) : (
        <>
          <MountTableDesktopTable
            mounts={filteredMounts}
            selectedIds={selectedIds}
            headerState={headerState}
            onToggleRow={onToggleRow}
            onSelectAll={onSelectAll}
            onClearVisible={onClearVisible}
            onOpenView={onOpenView}
            onOpenEdit={onOpenEdit}
            onRequestDelete={onRequestDelete}
            validateMutation={validateMutation}
            healthFaultActionById={healthFaultActionById}
            onRebindMount={onRebindMount}
          />

          <div className={styles.mobileOnly}>
            {filteredMounts.length === 0 ? (
              <div className={styles.emptyInlineState}>
                <div className={styles.stackText}>
                  <strong>没有匹配的来源</strong>
                  <span className={styles.mutedText}>试试更换关键词、状态或类型筛选。</span>
                </div>
              </div>
            ) : (
              <div className={styles.entityGrid}>
                {filteredMounts.map((mount) => (
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
        </>
      )}
    </ManageSectionCard>
  );
}
