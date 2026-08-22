import type { Dispatch, SetStateAction } from 'react';
import type { RegistrationCodeStatus } from '@fmby/v2-shared/contracts/manage';
import styles from '../../longtail-shared/ManageShared.module.css';

export interface RegistrationCodeFiltersProps {
  searchKeyword: string;
  setSearchKeyword: Dispatch<SetStateAction<string>>;
  statusFilter: 'all' | RegistrationCodeStatus;
  setStatusFilter: Dispatch<SetStateAction<'all' | RegistrationCodeStatus>>;
}

export function RegistrationCodeFilters({
  searchKeyword,
  setSearchKeyword,
  statusFilter,
  setStatusFilter,
}: RegistrationCodeFiltersProps) {
  return (
    <div className={styles.filterGroup}>
      <label className={styles.label}>
        搜索
        <input
          className={styles.searchInput}
          value={searchKeyword}
          onChange={(event) => setSearchKeyword(event.target.value)}
          placeholder="搜索批次名、注册码、系统角色或媒体库"
        />
      </label>
      <label className={styles.label}>
        状态
        <select
          className={styles.select}
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as 'all' | RegistrationCodeStatus)
          }
        >
          <option value="all">全部状态</option>
          <option value="active">可用</option>
          <option value="paused">已停用</option>
          <option value="expired">已过期</option>
          <option value="used-up">已用尽</option>
        </select>
      </label>
    </div>
  );
}
