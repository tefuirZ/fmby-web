import type { ManageMountProviderType, ManageMountRecord } from '@fmby/v2-shared/contracts/manage';
import styles from '../../ManagePages.module.css';
import { ManageSectionCard } from '../../components';
import type { MountHealthStatus } from '../types';
import { MountTableToolbar } from './MountTableToolbar';
import { MountTableDesktopTable } from './MountTableDesktopTable';
import { MountTableMobileGrid } from './MountTableMobileGrid';

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

          <MountTableMobileGrid
            mounts={filteredMounts}
            onOpenView={onOpenView}
            onOpenEdit={onOpenEdit}
            onRequestDelete={onRequestDelete}
            validateMutation={validateMutation}
            healthFaultActionById={healthFaultActionById}
            onRebindMount={onRebindMount}
          />
        </>
      )}
    </ManageSectionCard>
  );
}
