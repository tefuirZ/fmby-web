import type { Dispatch, SetStateAction } from 'react';
import type { TaskCenterStatus } from '@fmby/v2-shared/contracts/manage/task-center';
import styles from '../../ManagePages.module.css';
import { STATUS_OPTIONS, RANGE_OPTIONS } from '../constants';
import type { RangePreset } from '../types';

// P1-2（FE-UI-DENSITY-AUDIT）：categoryFilter 不再由本区控制——它与
// 「分类总览」卡片组绑同一 state，一屏两个控件改同一个值；二选一保留卡片组。
interface TaskCenterFiltersProps {
  statusFilter: 'all' | TaskCenterStatus;
  setStatusFilter: Dispatch<SetStateAction<'all' | TaskCenterStatus>>;
  rangePreset: RangePreset;
  setRangePreset: Dispatch<SetStateAction<RangePreset>>;
  setPage: Dispatch<SetStateAction<number>>;
}

export function TaskCenterFilters({
  statusFilter,
  setStatusFilter,
  rangePreset,
  setRangePreset,
  setPage,
}: TaskCenterFiltersProps) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.filterGroup}>
        <label className={styles.label}>
          状态
          <select
            className={styles.select}
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as 'all' | TaskCenterStatus);
              setPage(1);
            }}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.buttonRow}>
        {RANGE_OPTIONS.map((option) => (
          <button
            key={option.value}
            className={rangePreset === option.value ? styles.secondaryButton : styles.ghostButton}
            type="button"
            onClick={() => {
              setRangePreset(option.value);
              setPage(1);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
