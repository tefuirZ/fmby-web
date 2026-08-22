import type { Dispatch, SetStateAction } from 'react';
import type { TaskCenterCategory, TaskCenterStatus } from '@fmby/v2-shared/contracts/manage/task-center';
import styles from '../../ManagePages.module.css';
import { CATEGORY_ORDER, STATUS_OPTIONS, RANGE_OPTIONS } from '../constants';
import { getCategoryLabel } from '../utils';
import type { RangePreset } from '../types';

interface TaskCenterFiltersProps {
  categoryFilter: 'all' | TaskCenterCategory;
  setCategoryFilter: Dispatch<SetStateAction<'all' | TaskCenterCategory>>;
  statusFilter: 'all' | TaskCenterStatus;
  setStatusFilter: Dispatch<SetStateAction<'all' | TaskCenterStatus>>;
  rangePreset: RangePreset;
  setRangePreset: Dispatch<SetStateAction<RangePreset>>;
  setPage: Dispatch<SetStateAction<number>>;
}

export function TaskCenterFilters({
  categoryFilter,
  setCategoryFilter,
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
          类别
          <select
            className={styles.select}
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value as 'all' | TaskCenterCategory);
              setPage(1);
            }}
          >
            <option value="all">全部类别</option>
            {CATEGORY_ORDER.map((category) => (
              <option key={category} value={category}>
                {getCategoryLabel(category)}
              </option>
            ))}
          </select>
        </label>

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
