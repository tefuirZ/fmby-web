import { Link } from 'react-router';
import type { ManageLibraryRecord, ManageLibraryType } from '@fmby/v2-shared/contracts/manage';
import { StatusBadge } from '@fmby/v2-shared/ui';
import { formatDateTime } from '@fmby/v2-shared/time';
import styles from '../../ManagePages.module.css';
import { EmptyTableRow, ManageSectionCard, getManageStatusVariant } from '../../components';
import { LIBRARY_TYPE_OPTIONS, type LibraryHealthStatus } from '../types';
import {
  buildLibraryBindingHint,
  buildLibraryBindingSummary,
  getLibraryStatusLabel,
} from '../formUtils';

interface LibraryTableProps {
  libraries: ManageLibraryRecord[];
  filteredLibraries: ManageLibraryRecord[];
  keyword: string;
  statusFilter: 'all' | LibraryHealthStatus;
  typeFilter: 'all' | ManageLibraryType;
  onKeywordChange: (value: string) => void;
  onStatusFilterChange: (value: 'all' | LibraryHealthStatus) => void;
  onTypeFilterChange: (value: 'all' | ManageLibraryType) => void;
  onOpenView: (libraryId: string) => void;
  onOpenEdit: (libraryId: string) => void;
  onRequestDelete: (library: ManageLibraryRecord) => void;
  onCreateClick: () => void;
  onMoveLibrary: (libraryId: string, step: -1 | 1) => void;
  reorderPending: boolean;
}

export function LibraryTable({
  libraries,
  filteredLibraries,
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
  onMoveLibrary,
  reorderPending,
}: LibraryTableProps) {
  const fullIndex = new Map(libraries.map((library, index) => [library.id, index]));

  const renderEmptyState = (
    <div className={styles.emptyInlineState}>
      <div className={styles.stackText}>
        <strong>还没有创建媒体库</strong>
        <span className={styles.mutedText}>先接入数据源，再创建媒体库并绑定来源开始扫描。</span>
      </div>
      <div className={styles.rowActions}>
        <button className={styles.primaryButton} type="button" onClick={onCreateClick}>新建媒体库</button>
      </div>
    </div>
  );

  return (
    <ManageSectionCard title="媒体库列表" description="支持搜索、筛选、详情抽屉与写操作闭环。">
      <div className={styles.toolbar}>
        <div className={styles.filterGroup}>
          <label className={styles.label}>
            搜索媒体库
            <input
              className={styles.searchInput}
              placeholder="名称 / 说明 / 类型 / 来源"
              value={keyword}
              onChange={(event) => onKeywordChange(event.target.value)}
            />
          </label>
          <label className={styles.label}>
            状态
            <select
              className={styles.select}
              value={statusFilter}
              onChange={(event) => onStatusFilterChange(event.target.value as 'all' | LibraryHealthStatus)}
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
              onChange={(event) => onTypeFilterChange(event.target.value as 'all' | ManageLibraryType)}
            >
              <option value="all">全部类型</option>
              {LIBRARY_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
        <span className={styles.tableHint}>当前结果：{filteredLibraries.length} 条</span>
      </div>

      {libraries.length === 0 ? (
        renderEmptyState
      ) : (
        <>
          <div className={styles.desktopOnly}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>媒体库</th>
                    <th>类型</th>
                    <th>状态</th>
                    <th>内容数</th>
                    <th>来源</th>
                    <th>授权</th>
                    <th>最近更新</th>
                    <th>操作</th>
                    <th>排序</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLibraries.length === 0 ? (
                    <EmptyTableRow colSpan={9} title="没有匹配的媒体库" description="试试更换关键词、状态或类型筛选。" />
                  ) : (
                    filteredLibraries.map((library) => {
                      const fIndex = fullIndex.get(library.id) ?? -1;
                      const isFirst = fIndex <= 0;
                      const isLast = fIndex === libraries.length - 1;
                      return (
                        <tr key={library.id}>
                          <td>
                            <div className={styles.stackText}>
                              <span className={styles.primaryText}>{library.name}</span>
                              <span className={styles.mutedText}>{library.description || '暂无说明'}</span>
                            </div>
                          </td>
                          <td>{library.typeLabel}</td>
                          <td>
                            <StatusBadge
                              label={getLibraryStatusLabel(library.status)}
                              variant={getManageStatusVariant(library.status)}
                            />
                          </td>
                          <td>{library.itemCount.toLocaleString('zh-CN')}</td>
                          <td>
                            <div className={styles.stackText}>
                              <span className={styles.primaryText}>
                                {buildLibraryBindingSummary(library)}
                              </span>
                              <span className={styles.mutedText}>
                                {buildLibraryBindingHint(library)}
                              </span>
                            </div>
                          </td>
                          <td>{library.visibilityLabel || '未单独授权'}</td>
                          <td>{formatDateTime(library.updatedAt || library.lastScanAt)}</td>
                          <td>
                            <div className={styles.rowActions}>
                              <button className={styles.smallButton} type="button" onClick={() => onOpenView(library.id)}>详情</button>
                              <button className={styles.smallButton} type="button" onClick={() => onOpenEdit(library.id)}>编辑</button>
                              <Link className={styles.smallButton} to={`/libraries/${library.id}`}>查看前台</Link>
                              <button className={styles.dangerButton} type="button" onClick={() => onRequestDelete(library)}>删除</button>
                            </div>
                          </td>
                          <td>
                            <div className={styles.rowActions}>
                              <button
                                className={styles.smallButton}
                                type="button"
                                aria-label={`将媒体库「${library.name}」上移`}
                                disabled={isFirst || reorderPending}
                                onClick={() => onMoveLibrary(library.id, -1)}
                              >↑</button>
                              <button
                                className={styles.smallButton}
                                type="button"
                                aria-label={`将媒体库「${library.name}」下移`}
                                disabled={isLast || reorderPending}
                                onClick={() => onMoveLibrary(library.id, 1)}
                              >↓</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.mobileOnly}>
            {filteredLibraries.length === 0 ? (
              <div className={styles.emptyInlineState}>
                <div className={styles.stackText}>
                  <strong>没有匹配的媒体库</strong>
                  <span className={styles.mutedText}>试试更换关键词、状态或类型筛选。</span>
                </div>
              </div>
            ) : (
              <div className={styles.entityGrid}>
                {filteredLibraries.map((library) => {
                  const fIndex = fullIndex.get(library.id) ?? -1;
                  const isFirst = fIndex <= 0;
                  const isLast = fIndex === libraries.length - 1;
                  return (
                    <div key={library.id} className={styles.entityCard}>
                      <div className={styles.inlineMeta}>
                        <StatusBadge label={getLibraryStatusLabel(library.status)} variant={getManageStatusVariant(library.status)} />
                        <span className={styles.metaText}>{library.typeLabel}</span>
                      </div>
                      <div className={styles.primaryText}>{library.name}</div>
                      <div className={styles.mutedText}>{library.description || '暂无说明'}</div>
                      <div className={styles.stackText}>
                        <span>{library.itemCount.toLocaleString('zh-CN')} 个内容</span>
                        <span className={styles.mutedText}>
                          来源：{buildLibraryBindingSummary(library)}
                        </span>
                        <span className={styles.mutedText}>
                          {buildLibraryBindingHint(library)}
                        </span>
                        <span className={styles.mutedText}>最近更新：{formatDateTime(library.updatedAt || library.lastScanAt)}</span>
                        <span className={styles.mutedText}>授权：{library.visibilityLabel || '未单独授权'}</span>
                      </div>
                      <div className={styles.rowActions}>
                        <button className={styles.smallButton} type="button" onClick={() => onOpenView(library.id)}>详情</button>
                        <button className={styles.smallButton} type="button" onClick={() => onOpenEdit(library.id)}>编辑</button>
                        <Link className={styles.smallButton} to={`/libraries/${library.id}`}>查看前台</Link>
                        <button className={styles.dangerButton} type="button" onClick={() => onRequestDelete(library)}>删除</button>
                        <button
                          className={styles.smallButton}
                          type="button"
                          aria-label={`将媒体库「${library.name}」上移`}
                          disabled={isFirst || reorderPending}
                          onClick={() => onMoveLibrary(library.id, -1)}
                        >↑</button>
                        <button
                          className={styles.smallButton}
                          type="button"
                          aria-label={`将媒体库「${library.name}」下移`}
                          disabled={isLast || reorderPending}
                          onClick={() => onMoveLibrary(library.id, 1)}
                        >↓</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </ManageSectionCard>
  );
}
