/**
 * `useItemDetail()` —— 条目详情视图模型（WEB-B1）。
 *
 * 上移自 `apps/host/src/pages/browse/item-detail/hooks/useItemDetailQueries.ts`
 * 与 `ItemDetailPage.tsx` 的派生（技术信息合并、剧集选项、来源状态兜底）。
 *
 * 三查询编排（保持原语义）：
 * - 主详情 `itemApi.getDetail(itemId)`；
 * - 选中季 `getDetail(selectedSeasonId)`（仅 series 且选中季时启用）；
 * - 技术信息兜底 `getDetail(playbackTargetId)`（仅当季/剧信息不足时启用）。
 */

import { useQuery } from '@tanstack/react-query';

import { itemApi } from '@fmby/v2-shared/contracts/browse/item';
import { queryKeys } from '@fmby/v2-shared/query';

import { useLayoutHint } from './useLayoutHint';
import { deriveViewState, type LayoutHint, type ViewModel, type ViewState } from './types';
import type { ItemDetailResponse } from '@fmby/v2-shared/contracts/browse/item';
import type { MediaCardSummary } from '@fmby/v2-shared/contracts/browse';

/** 视图数据：已合并技术信息、剧集选项等展示形态。 */
export interface ItemDetailViewData {
  /** 条目详情（主查询）。 */
  item: ItemDetailResponse | undefined;
  /** 选中季详情（未启用/未选中时 undefined）。 */
  selectedSeason: ItemDetailResponse | undefined;
  /** 技术信息兜底详情。 */
  technicalFallback: ItemDetailResponse | undefined;
  /** 合并后的技术信息（主 + 兜底）。 */
  technical: ItemDetailResponse['technical'] | undefined;
  /** 来源状态文案（主优先，兜底其次）。 */
  sourceStatusLabel: string | undefined;
  /** 剧集选项（选中季子项中的 episode，或主详情的 children）。 */
  episodeOptions: MediaCardSummary[];
}

export interface ItemDetailActions {
  /** 重试主查询。 */
  retry: () => void;
  /** 刷新。 */
  refresh: () => void;
}

export type ItemDetailViewModel = ViewModel<ItemDetailViewData, ItemDetailActions>;

export interface UseItemDetailOptions {
  /** 条目 id（路由参数）。 */
  itemId: string | undefined;
  /** 选中季 id。 */
  selectedSeasonId: string | undefined;
  /** 主详情（用于启用兜底查询判定；由上一次查询数据回灌）。 */
  item?: ItemDetailResponse | undefined;
  /** 强制布局（测试/主题）。 */
  layout?: LayoutHint;
}

/** 是否需要加载技术信息兜底（原 formUtils 实现，上移以便单测）。 */
export function shouldLoadTechnicalFallback(item: ItemDetailResponse | undefined): boolean {
  if (!item) {
    return false;
  }
  if (
    (item.kind !== 'series' && item.kind !== 'season') ||
    !item.playbackTargetId ||
    item.playbackTargetId === item.id
  ) {
    return false;
  }

  return !hasRichTechnicalInfo(item.technical);
}

function hasRichTechnicalInfo(technical: ItemDetailResponse['technical']): boolean {
  if (!technical) {
    return false;
  }
  const entries = Object.entries(technical as unknown as Record<string, unknown>);
  return entries.some(([, value]) => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return value !== undefined && value !== null && value !== '';
  });
}

/** 合并技术信息（兜底补充主缺失）。 */
export function mergeTechnicalInfo(
  primary: ItemDetailResponse['technical'] | undefined,
  fallback: ItemDetailResponse['technical'] | undefined,
): ItemDetailResponse['technical'] | undefined {
  if (!primary) {
    return fallback;
  }
  if (!fallback) {
    return primary;
  }
  return { ...fallback, ...primary };
}

export function useItemDetail(options: UseItemDetailOptions): ItemDetailViewModel {
  const { itemId, selectedSeasonId, item: knownItem, layout: layoutOverride } = options;
  const layout = useLayoutHint(layoutOverride);

  const itemQuery = useQuery({
    queryKey: queryKeys.item.detail(itemId ?? ''),
    queryFn: () => itemApi.getDetail(itemId ?? ''),
    enabled: Boolean(itemId),
  });

  const item = itemQuery.data ?? knownItem;

  const selectedSeasonQuery = useQuery({
    queryKey: queryKeys.item.seasonEpisodes(selectedSeasonId ?? ''),
    queryFn: () => itemApi.getDetail(selectedSeasonId ?? ''),
    enabled: item?.kind === 'series' && Boolean(selectedSeasonId),
  });

  const technicalFallbackQuery = useQuery({
    queryKey: queryKeys.item.technicalFallback(item?.playbackTargetId),
    queryFn: () => itemApi.getDetail(item?.playbackTargetId ?? ''),
    enabled: shouldLoadTechnicalFallback(item),
    staleTime: 60_000,
  });

  const selectedSeason = selectedSeasonQuery.data;
  const technicalFallback = technicalFallbackQuery.data;

  const episodeOptions =
    selectedSeason?.children.filter((child) => child.kind === 'episode') ?? item?.children ?? [];

  const state: ViewState = deriveViewState(
    {
      data: itemQuery.data,
      isPending: itemQuery.isPending,
      isError: itemQuery.isError,
      error: itemQuery.error,
      isLoading: itemQuery.isLoading,
    },
    false,
  );

  return {
    data: {
      item,
      selectedSeason,
      technicalFallback,
      technical: mergeTechnicalInfo(item?.technical, technicalFallback?.technical),
      sourceStatusLabel: item?.sourceStatusLabel ?? technicalFallback?.sourceStatusLabel,
      episodeOptions,
    },
    state,
    layout,
    error: itemQuery.error,
    actions: {
      retry: () => {
        void itemQuery.refetch();
      },
      refresh: () => {
        void itemQuery.refetch();
        if (selectedSeasonId) {
          void selectedSeasonQuery.refetch();
        }
      },
    },
  };
}
