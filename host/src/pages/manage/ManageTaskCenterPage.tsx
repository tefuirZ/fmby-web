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
  TaskCenterStreamBanner,
} from './task-center/components';
import { AsyncJobsSection } from './task-center/components/AsyncJobsSection';
import { PAGE_SIZE } from './task-center/constants';
import { useTaskCenterMutations, useTaskCenterQueries, useTaskCenterStream } from './task-center/hooks';
import { SKELETON_ROWS } from './task-center/hooks/useTaskCenterStream';
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

  // W15-TASK-CENTER-STREAM：流式状态（WS 分批推送 + 轮询降级 + 三态）。
  // 用户红线「可以慢不能空」：首屏骨架/首块 ≤300ms 出，卡死 3s 出降级+重试。
  const stream = useTaskCenterStream({
    query: {
      category: listQueryInput.category,
      status: listQueryInput.status,
      from: listQueryInput.from,
      to: listQueryInput.to,
    },
  });

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

  // W15-TASK-CENTER-STREAM（卡面⑤）：**不再整页转圈**。首屏 overview/list 未就绪时
  // 渲染骨架页（指标骨架 + 列表骨架行），保证 ≤300ms 有内容可看——用户点开什么也
  // 看不到 = 必被骂。终态（error）仍整页给错误态（那是真的没内容可给）。
  const firstPaintReady = Boolean(overviewQuery.data) && Boolean(listQuery.data);
  if (!firstPaintReady && !overviewQuery.isError && !listQuery.isError) {
    return (
      <div className={styles.page}>
        <ManagePageHeader
          title="任务中心"
          description="把扫描、识别、刮削、AI、审核和墓碑任务统一拎出来，先看系统在干什么，再定位卡在哪。"
        />
        <ManageSectionCard title="流水线概览">
          <TaskCenterStreamBanner stream={stream} />
        </ManageSectionCard>
        <ManageSectionCard title="任务列表">
          <table className={`${styles.table} ${styles.desktopOnly}`}>
            <tbody>
              {Array.from({ length: SKELETON_ROWS }, (_, i) => (
                <tr key={`skeleton-${i}`}>
                  <td colSpan={8}>正在加载…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ManageSectionCard>
      </div>
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
      <TaskCenterStreamBanner stream={stream} />
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

      {/* ★FE-ASYNC-FEEDBACK ②：用户发起的后台操作在此可见（本会话聚合；E1 契约对齐后接全量）。 */}
      <AsyncJobsSection />

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
