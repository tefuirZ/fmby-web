/**
 * `useHistory()` —— 播放历史视图模型（WEB-B1）。
 *
 * 上移自 `apps/host/src/pages/browse/HistoryPage.tsx`：
 * - `historyApi.getOverview()` 取数；
 * - 三组（继续观看 / 最近播放 / 已看完）的**本地筛选**（类型 / 状态 / 时间窗）。
 *
 * 返回展示形态：三组各自已过滤的数组 + 类型选项 + 是否有内容。
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { historyApi } from '@fmby/v2-shared/contracts/browse/history';
import { queryKeys } from '@fmby/v2-shared/query';

import { useLayoutHint } from './useLayoutHint';
import { deriveViewState, type LayoutHint, type ViewModel, type ViewState } from './types';
import type {
  HistoryEntry,
  HistoryOverviewResponse,
} from '@fmby/v2-shared/contracts/browse/history';

/** 时间窗（与 HistoryPage 口径一致：7d / 30d / 365d / all）。 */
export type HistoryTimeRange = 'all' | '7d' | '30d' | '365d';

/** 观看状态过滤。 */
export type HistoryStateFilter = 'all' | 'unfinished' | 'completed';

export interface HistoryViewData {
  /** 继续观看（已过滤）。 */
  continueWatching: HistoryEntry[];
  /** 最近播放（已过滤）。 */
  recentlyPlayed: HistoryEntry[];
  /** 已看完（已过滤）。 */
  completed: HistoryEntry[];
  /** 类型选项（含 'all'）。 */
  typeOptions: string[];
  /** 三组合计是否有内容（用于 empty 判定）。 */
  hasAny: boolean;
}

export interface HistoryActions {
  /** 重试。 */
  retry: () => void;
  /** 刷新。 */
  refresh: () => void;
}

export type HistoryViewModel = ViewModel<HistoryViewData, HistoryActions>;

export interface UseHistoryOptions {
  /** 类型过滤（'all' 或 kind）。 */
  typeFilter: string;
  /** 状态过滤。 */
  stateFilter: HistoryStateFilter;
  /** 时间窗。 */
  timeRange: HistoryTimeRange;
  /** 强制布局（测试/主题）。 */
  layout?: LayoutHint;
}

/** 时间窗 → 毫秒跨度（'all' 返回 undefined 表示不过滤）。 */
export function timeRangeToMs(range: HistoryTimeRange): number | undefined {
  const day = 24 * 60 * 60 * 1000;
  switch (range) {
    case '7d':
      return 7 * day;
    case '30d':
      return 30 * day;
    case '365d':
      return 365 * day;
    case 'all':
    default:
      return undefined;
  }
}

/**
 * 纯函数：按类型/状态/时间窗过滤一条历史记录。
 * 抽成纯函数便于单测与主题复用（原页面内联闭包）。
 */
export function matchesHistoryFilters(
  item: Pick<HistoryEntry, 'kind' | 'progress'> & {
    lastPlayedAt?: string;
    playedAt?: string;
    completedAt?: string;
  },
  filters: { typeFilter: string; stateFilter: HistoryStateFilter; timeRange: HistoryTimeRange },
  now: number,
): boolean {
  const { typeFilter, stateFilter, timeRange } = filters;

  if (typeFilter !== 'all' && item.kind !== typeFilter) {
    return false;
  }

  if (stateFilter === 'unfinished' && item.progress?.completed) {
    return false;
  }

  if (stateFilter === 'completed' && !item.progress?.completed) {
    return false;
  }

  const span = timeRangeToMs(timeRange);
  if (span === undefined) {
    return true;
  }

  const target = item.completedAt ?? item.playedAt ?? item.lastPlayedAt;
  // 与原页面一致：缺时间戳不做排除（避免因字段缺失误杀记录）。
  if (!target) {
    return true;
  }
  const targetTime = new Date(target).getTime();
  if (Number.isNaN(targetTime)) {
    return false;
  }
  return now - targetTime <= span;
}

export function useHistory(options: UseHistoryOptions): HistoryViewModel {
  const { typeFilter, stateFilter, timeRange, layout: layoutOverride } = options;
  const layout = useLayoutHint(layoutOverride);

  const historyQuery = useQuery({
    queryKey: queryKeys.history.overview(),
    queryFn: () => historyApi.getOverview(),
  });

  const raw: HistoryOverviewResponse = historyQuery.data ?? {
    continueWatching: [],
    recentlyPlayed: [],
    completed: [],
  };

  const filtered = useMemo(() => {
    // now 在同一轮派生内固定，避免三条数组因时间推进判定不一致。
    const now = Date.now();
    const apply = (items: HistoryEntry[]) =>
      items.filter((item) => matchesHistoryFilters(item, { typeFilter, stateFilter, timeRange }, now));

    return {
      continueWatching: apply(raw.continueWatching),
      recentlyPlayed: apply(raw.recentlyPlayed),
      completed: apply(raw.completed),
    };
  }, [raw, typeFilter, stateFilter, timeRange]);

  const typeOptions = useMemo(() => {
    const all = [
      ...raw.continueWatching,
      ...raw.recentlyPlayed,
      ...raw.completed,
    ];
    return ['all', ...new Set(all.map((item) => item.kind))];
  }, [raw]);

  const hasAny =
    filtered.continueWatching.length > 0 ||
    filtered.recentlyPlayed.length > 0 ||
    filtered.completed.length > 0;

  const state: ViewState = deriveViewState(
    {
      data: historyQuery.data,
      isPending: historyQuery.isPending,
      isError: historyQuery.isError,
      error: historyQuery.error,
      isLoading: historyQuery.isLoading,
    },
    // empty 判定：取数成功但三组全空（未过滤的原始也为空）。
    raw.continueWatching.length === 0 &&
      raw.recentlyPlayed.length === 0 &&
      raw.completed.length === 0,
  );

  return {
    data: {
      ...filtered,
      typeOptions,
      hasAny,
    },
    state,
    layout,
    error: historyQuery.error,
    actions: {
      retry: () => {
        void historyQuery.refetch();
      },
      refresh: () => {
        void historyQuery.refetch();
      },
    },
  };
}
