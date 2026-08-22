import type { ManageMountProviderType, ManageMountRecord } from '@/domains/manage';
import { StatusBadge } from '@/shared/ui';
import { formatDateTime } from '@/shared/utils/date';
import styles from '../../ManagePages.module.css';
import { EmptyTableRow, ManageSectionCard, getManageStatusVariant } from '../../components';
import { PROVIDER_OPTIONS, type MountHealthStatus } from '../types';
import {
  canValidateMountType,
  formatMountReferenceSummary,
  getMountStatusLabel,
  hasHiddenMountReferences,
} from '../formUtils';

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
      <div className={styles.toolbar}>
        <div className={styles.filterGroup}>
          <label className={styles.label}>
            搜索来源
            <input
              className={styles.searchInput}
              placeholder="名称 / 根路径 / 类型 / 关联媒体库"
              value={keyword}
              onChange={(event) => onKeywordChange(event.target.value)}
            />
          </label>
          <label className={styles.label}>
            状态
            <select
              className={styles.select}
              value={statusFilter}
              onChange={(event) => onStatusFilterChange(event.target.value as 'all' | MountHealthStatus)}
            >
              <option value="all">全部状态</option>
              <option value="healthy">正常</option>
              <option value="attention">需关注</option>
              <option value="critical">异常</option>
            </select>
          </label>
          <label className={styles.label}>
            类型
            <select
              className={styles.select}
              value={typeFilter}
              onChange={(event) => onTypeFilterChange(event.target.value as 'all' | ManageMountProviderType)}
            >
              <option value="all">全部类型</option>
              {PROVIDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <span className={styles.tableHint}>当前结果：{filteredMounts.length} 条</span>
      </div>

      {mounts.length === 0 ? (
        renderEmptyState
      ) : (
        <>
          <div className={styles.desktopOnly}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>数据源</th>
                    <th>类型</th>
                    <th>状态</th>
                    <th>根路径 / 地址</th>
                    <th>能力</th>
                    <th>引用情况</th>
                    <th>最近校验</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMounts.length === 0 ? (
                    <EmptyTableRow
                      colSpan={8}
                      title="没有匹配的来源"
                      description="试试更换关键词、状态或类型筛选。"
                    />
                  ) : (
                    filteredMounts.map((mount) => (
                      <tr key={mount.id}>
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
