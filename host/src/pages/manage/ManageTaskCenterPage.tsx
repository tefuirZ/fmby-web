import { useMemo, useState } from 'react';
import type { TaskCenterCategory, TaskCenterListQuery, TaskCenterStatus } from '@fmby/v2-shared/contracts/manage/task-center';
import { FeedbackState } from '@fmby/v2-shared/ui';
import { formatDateTime } from '@fmby/v2-shared/time';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from './ManagePages.module.css';
import { ManagePageHeader, ManageSectionCard } from './components';
import {
  TaskCenterCategoryGroups,
  TaskCenterDetailDrawer,
  TaskCenterFilters,
  TaskCenterFlash,
  TaskCenterList,
  TaskCenterMetrics,
} from './task-center/components';
import { PAGE_SIZE } from './task-center/constants';
import { useTaskCenterMutations, useTaskCenterQueries } from './task-center/hooks';
import type { FlashState, RangePreset, SelectedTaskRef } from './task-center/types';
import { buildRangePreset, showFlash } from './task-center/utils';

export function ManageTaskCenterPage() {
  const [categoryFilter, setCategoryFilter] = useState<'all' | TaskCenterCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | TaskCenterStatus>('all');
  const [rangePreset, setRangePreset] = useState<RangePreset>('today');
  const [page, setPage] = useState(1);
  const [selectedTask, setSelectedTask] = useState<SelectedTaskRef | null>(null);
  const [flash, setFlash] = useState<FlashState | null>(null);

  const timeRange = useMemo(() => buildRangePreset(rangePreset), [rangePreset]);
  const listQueryInput = useMemo<TaskCenterListQuery>(
    () => ({
      category: categoryFilter === 'all' ? undefined : categoryFilter,
      status: statusFilter === 'all' ? undefined : statusFilter,
      from: timeRange.from,
      to: timeRange.to,
      page,
      size: PAGE_SIZE,
    }),
    [categoryFilter, page, statusFilter, timeRange.from, timeRange.to],
  );

  const { overviewQuery, listQuery, detailQuery } = useTaskCenterQueries(
    listQueryInput,
    selectedTask,
  );

  const { actionMutation } = useTaskCenterMutations({
    onSettledSuccess: (message, redirectHint) => {
      if (detailQuery.data) {
        setSelectedTask({
          category: detailQuery.data.category,
          id: detailQuery.data.id,
        });
      }
      showFlash(setFlash, message, redirectHint ?? '');
    },
    onError: (errorMessage) => {
      showFlash(setFlash, '操作执行失败', errorMessage);
    },
  });

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const categoryKpiMap = useMemo(() => {
    return new Map((overviewQuery.data?.categories ?? []).map((item) => [item.category, item]));
  }, [overviewQuery.data?.categories]);

  if ((overviewQuery.isPending && !overviewQuery.data) || (listQuery.isPending && !listQuery.data)) {
    return (
      <FeedbackState
        variant="loading"
        title="正在装配任务中心"
        description="正在汇总流水线、异常与审核任务，请稍等。"
      />
    );
  }

  if ((overviewQuery.isError && !overviewQuery.data) || (listQuery.isError && !listQuery.data)) {
    return (
      <FeedbackState
        variant="error"
        title="任务中心加载失败"
        description={getErrorMessage(overviewQuery.error ?? listQuery.error)}
        action={
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => {
              void overviewQuery.refetch();
              void listQuery.refetch();
            }}
          >
            重试
          </button>
        }
      />
    );
  }

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="任务中心"
        description="把扫描、识别、刮削、AI、审核和墓碑任务统一拎出来，先看系统在干什么，再定位卡在哪。"
        meta={
          <>
            <span className={styles.metaText}>
              今日起点：{formatDateTime(overviewQuery.data?.todayStartUtc)}
            </span>
            <span className={styles.metaText}>
              当前页：{page} / {totalPages}
            </span>
          </>
        }
        actions={
          <div className={styles.buttonRow}>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => {
                void overviewQuery.refetch();
                void listQuery.refetch();
              }}
            >
              刷新总览
            </button>
          </div>
        }
      />

      <TaskCenterMetrics
        total={overviewQuery.data?.total ?? 0}
        running={overviewQuery.data?.running ?? 0}
        failed={overviewQuery.data?.failed ?? 0}
        todaySucceeded={overviewQuery.data?.todaySucceeded ?? 0}
      />

      <TaskCenterCategoryGroups
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        setPage={setPage}
        categoryKpiMap={categoryKpiMap}
      />

      <ManageSectionCard
        title="筛选与列表"
        description="按类别、状态和时间窗口缩小范围，点击详情看原始载荷与错误上下文。"
      >
        <TaskCenterFilters
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          rangePreset={rangePreset}
          setRangePreset={setRangePreset}
          setPage={setPage}
        />

        <TaskCenterList
          items={items}
          total={total}
          page={page}
          totalPages={totalPages}
          isFetching={listQuery.isFetching}
          setSelectedTask={setSelectedTask}
          setPage={setPage}
        />
      </ManageSectionCard>

      <TaskCenterDetailDrawer
        selectedTask={selectedTask}
        setSelectedTask={setSelectedTask}
        detailQuery={detailQuery}
        actionMutation={actionMutation}
      />

      <TaskCenterFlash flash={flash} />
    </div>
  );
}

export default ManageTaskCenterPage;
