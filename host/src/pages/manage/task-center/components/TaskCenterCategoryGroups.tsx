import type { Dispatch, SetStateAction } from 'react';
import type {
  TaskCenterCategory,
  TaskCenterOverviewRecord,
} from '@fmby/v2-shared/contracts/manage/task-center';
import styles from '../../ManagePages.module.css';
import { ManageSectionCard } from '../../components';
import { CATEGORY_GROUPS } from '../constants';
import { getCategoryLabel } from '../utils';

interface TaskCenterCategoryGroupsProps {
  categoryFilter: 'all' | TaskCenterCategory;
  setCategoryFilter: Dispatch<SetStateAction<'all' | TaskCenterCategory>>;
  setPage: Dispatch<SetStateAction<number>>;
  categoryKpiMap: Map<TaskCenterCategory, TaskCenterOverviewRecord['categories'][number]>;
}

export function TaskCenterCategoryGroups({
  categoryFilter,
  setCategoryFilter,
  setPage,
  categoryKpiMap,
}: TaskCenterCategoryGroupsProps) {
  return (
    <ManageSectionCard
      title="分类总览"
      description="先按业务区块看大盘，再钻进具体任务。"
    >
      <div className={styles.entityGrid}>
        {CATEGORY_GROUPS.map((group) => (
          <article key={group.title} className={styles.entityCard}>
            <div className={styles.stackText}>
              <strong>{group.title}</strong>
              <span className={styles.mutedText}>{group.description}</span>
            </div>
            <div className={styles.stackText}>
              {group.categories.map((category) => {
                const kpi = categoryKpiMap.get(category);
                return (
                  <button
                    key={category}
                    className={
                      categoryFilter === category ? styles.secondaryButton : styles.ghostButton
                    }
                    type="button"
                    onClick={() => {
                      setCategoryFilter(category);
                      setPage(1);
                    }}
                  >
                    {getCategoryLabel(category)} · {kpi?.total ?? 0}
                  </button>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </ManageSectionCard>
  );
}
