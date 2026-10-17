import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@fmby/v2-shared/query';
import { useTaskCenterMutations, useTaskCenterQueries } from './task-center/hooks';
import { useTaskCenterRealtime } from './task-center/hooks/useTaskCenterRealtime';
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

  // ★E3 端到端转正（后端 edc81510c8 推 task.center.batch）：WS 分批消费接线。
  // ② 每批合并进当前列表缓存（DOM 立即可见：行状态更新 / 新行头部插入）；
  // ④ seqGapped ⇒ 全量重拉；3s 无数据 ⇒ 降级条（仍在后台执行 + 重试）。
  type TaskCenterRow = NonNullable<typeof listQuery.data>['items'][number];

  // wire.status 是后端枚举的 7 值集合（TaskCenterStatus）；显式白名单收窄，
  // 未知值保守回落 Queued（不谎报具体状态；summary 已注明实时新任务）。
  const TASK_CENTER_STATUSES: TaskCenterStatus[] = [
    'Queued',
    'Running',
    'RetryWaiting',
    'Failed',
    'Succeeded',
    'NeedsReview',
    'Cancelled',
    'Skipped',
  ];
  const narrowStatus = (raw: string): TaskCenterStatus =>
    TASK_CENTER_STATUSES.includes(raw as TaskCenterStatus)
      ? (raw as TaskCenterStatus)
      : 'Queued';
  const queryClient = useQueryClient();
  const [batchCounters, setBatchCounters] = useState({ batches: 0, appended: 0, updated: 0 });
  const [stalled, setStalled] = useState(false);
  const realtime = useTaskCenterRealtime(true);

  const lastBatch = realtime.lastBatch;
  useEffect(() => {
    if (!lastBatch) return;
    const key = queryKeys.manage.taskCenter.list(listQueryInput as Record<string, unknown>);
    const current = queryClient.getQueryData(key) as
      | { items?: TaskCenterRow[]; total?: number }
      | undefined;
    if (!current?.items) return; // 无缓存列表（未加载/已卸载）不凭空造数据
    const next = [...current.items];
    let appended = 0;
    let updated = 0;
    for (const wire of lastBatch.items) {
      const idx = next.findIndex(
        (row) => row.category === wire.category && row.id === wire.id,
      );
      if (idx >= 0) {
        // ②b 原地更新：状态 + 更新时间（其余字段保留，不丢富形状）。
        next[idx] = {
          ...next[idx],
          status: narrowStatus(wire.status),
          updatedAt: wire.updated_at ?? next[idx].updatedAt,
        };
        updated += 1;
      } else {
        // ②a 头部插入新行（wire 只有最小字段，诚实兜底，不伪造 mediaTitle）。
        next.unshift({
          category: wire.category as TaskCenterCategory,
          id: wire.id,
          status: narrowStatus(wire.status),
          createdAt: wire.updated_at ?? new Date().toISOString(),
          updatedAt: wire.updated_at ?? new Date().toISOString(),
          retryCount: 0,
          summary: wire.title ?? '（实时推送的新任务）',
        });
        appended += 1;
      }
    }
    queryClient.setQueryData(key, {
      ...current,
      items: next,
      total: current.total ?? next.length,
    });
    setBatchCounters((p) => ({
      batches: p.batches + 1,
      appended: p.appended + appended,
      updated: p.updated + updated,
    }));
  }, [lastBatch, listQueryInput, queryClient]);

  // ④a 丢帧 ⇒ 全量重拉（降级轮询兜底）。
  useEffect(() => {
    if (realtime.seqGapped) {
      void listQuery.refetch();
    }
  }, [realtime.seqGapped, listQuery]);

  // ④b 3s 无数据（首屏 pending/拉取中且无缓存）⇒ 降级条。
  const noData = (listQuery.isPending || listQuery.isFetching) && !listQuery.data;
  useEffect(() => {
    if (!noData) {
      setStalled(false);
      return;
    }
    const timer = window.setTimeout(() => setStalled(true), 3_000);
    return () => window.clearTimeout(timer);
  }, [noData]);

  const retryStalled = useCallback(() => {
    setStalled(false);
    void overviewQuery.refetch();
    void listQuery.refetch();
  }, [listQuery, overviewQuery]);

  if ((overviewQuery.isPending && !overviewQuery.data) || (listQuery.isPending && !listQuery.data)) {
    // ★E3 ④b：首屏无数据时的 3s 降级面挂在这里（早 return 分支）——
    // 用户卡在 loading 时唯一可见的就是这屏，降级条必须长在这儿。
    return (
      <div className={styles.page}>
        <ManagePageHeader
          title="任务中心"
          description="把扫描、识别、刮削、AI、审核和墓碑任务统一拎出来，先看系统在干什么，再定位卡在哪。"
        />
        {stalled ? (
          <div className={styles.emptyInlineState} role="status" data-testid="task-center-stall">
            响应较慢：任务数据仍在后台执行，已降级为本页轮询，可点重试或稍候自动恢复。
            <button className={styles.smallButton} type="button" onClick={retryStalled}>
              重试
            </button>
          </div>
        ) : (
          <FeedbackState
            variant="loading"
            title="正在装配任务中心"
            description="正在汇总流水线、异常与审核任务，请稍等。"
          />
        )}
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
            {/* ② 每批 append/更新计数的 DOM 可观测面（E3 转正断言对象） */}
            {batchCounters.batches > 0 ? (
              <span className={styles.metaText} data-testid="realtime-batch-counters">
                实时推送：{batchCounters.batches} 批 · 追加 {batchCounters.appended} · 更新 {batchCounters.updated}
              </span>
            ) : null}
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

      {/* ④b 3s 无数据降级条：文案 + 重试（E3 转正断言对象；仍在后台执行 = 诚实降级） */}
      {stalled ? (
        <div className={styles.emptyInlineState} role="status" data-testid="task-center-stall">
          响应较慢：任务数据仍在后台执行，已降级为本页轮询，可点重试或稍候自动恢复。
          <button className={styles.smallButton} type="button" onClick={retryStalled}>
            重试
          </button>
        </div>
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

        <TaskCenterList
          items={items}
          total={total}
          page={page}
          totalPages={totalPages}
          isFetching={listQuery.isFetching}
          hasActiveFilters={
            categoryFilter !== 'all' ||
            statusFilter !== 'all' ||
            rangePreset !== 'today'
          }
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
