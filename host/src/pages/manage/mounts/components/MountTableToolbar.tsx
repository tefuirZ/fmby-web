import type { ManageMountProviderType } from '@fmby/v2-shared/contracts/manage';
import styles from '../../ManagePages.module.css';
import { PROVIDER_OPTIONS, type MountHealthStatus } from '../types';

interface MountTableToolbarProps {
  keyword: string;
  statusFilter: 'all' | MountHealthStatus;
  typeFilter: 'all' | ManageMountProviderType;
  onKeywordChange: (value: string) => void;
  onStatusFilterChange: (value: 'all' | MountHealthStatus) => void;
  onTypeFilterChange: (value: 'all' | ManageMountProviderType) => void;
  /** FE-OPT-04 多选：全选当前页。 */
  onSelectAll: () => void;
  /** FE-OPT-04 多选：清空当前页选择。 */
  onClearVisible: () => void;
  /** FE-OPT-04 多选：反选当前页。 */
  onInvertVisible: () => void;
  /** 已筛选结果条数（「当前结果：N 条」）。 */
  resultCount: number;
}

export function MountTableToolbar({
  keyword,
  statusFilter,
  typeFilter,
  onKeywordChange,
  onStatusFilterChange,
  onTypeFilterChange,
  onSelectAll,
  onClearVisible,
  onInvertVisible,
  resultCount,
}: MountTableToolbarProps) {
  return (
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
      <div className={styles.rowActions}>
        <button className={styles.smallButton} type="button" onClick={onSelectAll}>
          全选本页
        </button>
        <button className={styles.smallButton} type="button" onClick={onInvertVisible}>
          反选
        </button>
        <button className={styles.smallButton} type="button" onClick={onClearVisible}>
          清空本页
        </button>
        <span className={styles.tableHint}>当前结果：{resultCount} 条</span>
      </div>
    </div>
  );
}
