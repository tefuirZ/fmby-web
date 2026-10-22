import { useMemo, useState } from 'react';
import {
  taskCenterApi,
  type TaskCenterCategory,
  type TaskCenterListQuery,
  type TaskCenterStatus,
} from '@fmby/v2-shared/contracts/manage/task-center';
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
  TaskCenterStreamBoard,
} from './task-center/components';
import { PAGE_SIZE } from './task-center/constants';
import {
  useTaskCenterMutations,
  useTaskCenterQueries,
  useTaskCenterStream,
  createPollingStream,
} from './task-center/hooks';
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

  // E3「可以慢，不能空」：第 1 页走**流式装配**（首批尽快出 + 逐批 append + 3s 降级），
  // 分页 REST 只在用户手动翻页（page>1）时才启用 ⇒ 同一份数据不被两条路径各拉一次。
  const isStreamingFirstPage = page === 1;
  const { overviewQuery, listQuery, detailQuery } = useTaskCenterQueries(
    listQueryInput,
    selectedTask,
    !isStreamingFirstPage,
  );
  const pollingStream = useMemo(
    () =>
      createPollingStream({
        fetchPage: (targetPage) =>
          taskCenterApi.getItems({ ...listQueryInput, page: targetPage }),
      }),
    // listQueryInput 变了（筛选/排序口径）⇒ 重开一条流
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listQueryInput],
  );
  const stream = useTaskCenterStream({
    loadFirstBatch: pollingStream.loadFirstBatch,
    subscribeBatches: pollingStream.subscribeBatches,
    enabled: isStreamingFirstPage,
    resetKey: JSON.stringify(listQueryInput),
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

  // ★数据源按「第 1 页 = 流式、翻页 = 分页 REST」二选一（同一页不重复取）。
  //   改前 `items = listQuery.data?.items ?? []` 只有整页一条路径 ⇒ 首屏必须等整页到货。
  const streamItems = isStreamingFirstPage ? stream.items : (listQuery.data?.items ?? []);
  const streamTotal = isStreamingFirstPage
    ? (stream.total || (listQuery.data?.total ?? 0))
    : (listQuery.data?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(streamTotal / PAGE_SIZE));
  const categoryKpiMap = useMemo(() => {
    return new Map((overviewQuery.data?.categories ?? []).map((item) => [item.category, item]));
  }, [overviewQuery.data?.categories]);

  // ★E3 §5：这里**不再有**「整页 loading 早退」。改前 `isPending` 会把整页换成
  //   一个 FeedbackState 转圈（= 卡面明令禁止的「纯转圈」，用户点开什么都看不到）。
  //   现在首帧即渲染页面外壳 + 骨架行，KPI 区在总览到货前不渲染（不用 0 冒充「没有任务」，
  //   同 FE-HONESTY-P2 的「假 0 会话」口径）。
  const overviewReady = Boolean(overviewQuery.data);

  // ★两条取数路径各自的失败都要有明确态（卡面 §3「绝不允许空壳=未知」）：
  //   第 1 页 = 流式（stream.error 由 board 内联呈现）；第 2 页起 = 分页 REST，
  //   它的失败必须在这里兜住——否则翻页失败只剩一张空表。
  const pagedQueryFailed = !isStreamingFirstPage && listQuery.isError && !listQuery.data;
  if ((overviewQuery.isError && !overviewQuery.data) || pagedQueryFailed) {
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

      {overviewReady ? (
        <TaskCenterMetrics
          total={overviewQuery.data?.total ?? 0}
          running={overviewQuery.data?.running ?? 0}
          failed={overviewQuery.data?.failed ?? 0}
          todaySucceeded={overviewQuery.data?.todaySucceeded ?? 0}
        />
      ) : null}

      {overviewReady ? (
        <TaskCenterCategoryGroups
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          setPage={setPage}
          categoryKpiMap={categoryKpiMap}
        />
      ) : null}

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

        {/* ★第 1 页 = 流式壳（骨架/逐批/降级/空态四态可见）；
            第 2 页起 = 既有分页 REST（翻页语义不变，不再流式重灌首页）。 */}
        {isStreamingFirstPage ? (
          <TaskCenterStreamBoard
            status={stream.status}
            items={streamItems}
            loadedCount={streamItems.length}
            total={streamTotal}
            errorMessage={stream.errorMessage}
            onRetry={stream.retry}
          >
            <TaskCenterList
              items={streamItems}
              total={streamTotal}
              page={page}
              totalPages={totalPages}
              isFetching={stream.status === 'streaming'}
              setSelectedTask={setSelectedTask}
              setPage={setPage}
            />
          </TaskCenterStreamBoard>
        ) : (
          <TaskCenterList
            items={streamItems}
            total={streamTotal}
            page={page}
            totalPages={totalPages}
            isFetching={listQuery.isFetching}
            setSelectedTask={setSelectedTask}
            setPage={setPage}
          />
        )}
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
