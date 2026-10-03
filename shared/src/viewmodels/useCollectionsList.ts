/**
 * `useCollectionsList()` —— 用户面合集列表页视图模型（FE-USER-COLLECTIONS-LIST-PAGE-2）。
 *
 * 取数：`GET /api/collections`（session + BROWSE；Hidden 由后端过滤）。
 * 页面只消费 `{ data, state, actions, layout }`，不直接 `useQuery`（WEB-B1 分层纪律）。
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query';

import { collectionsBrowseApi } from '@fmby/v2-shared/contracts/browse';
import type { CollectionsListPageRecord } from '@fmby/v2-shared/contracts/browse/collections';
import { queryKeys } from '@fmby/v2-shared/query';

import { useLayoutHint } from './useLayoutHint';
import { deriveViewState, type LayoutHint, type ViewModel, type ViewState } from './types';

export interface CollectionsListViewData {
  /** 当页合集（未就绪为空数组）。 */
  items: CollectionsListPageRecord['items'];
  /** 全量可见合集总数。 */
  total: number;
  /** 当前页（1-based）。 */
  page: number;
  /** 页大小（后端 clamp[1,200] 后回显）。 */
  pageSize: number;
  /** 是否还有下一页。 */
  hasMore: boolean;
}

export interface CollectionsListActions {
  /** 刷新当页。 */
  refresh: () => void;
}

export type CollectionsListViewModel = ViewModel<CollectionsListViewData, CollectionsListActions>;

export interface UseCollectionsListOptions {
  /** 页码（1-based；默认 1）。 */
  page?: number;
  /** 页大小（默认 20；后端 clamp[1,200]）。 */
  pageSize?: number;
  /** 标题子串检索（trim 后传；空白=全量。COLLECTIONS-LIST-SEARCH 前后端已接线）。 */
  search?: string;
  /** 强制布局（测试/主题）。 */
  layout?: LayoutHint;
}

/**
 * 用户面合集列表视图模型。
 *
 * state 只表达**取数状态**；翻页时 `placeholderData: keepPreviousData` 保持上一页
 * 内容（不闪空），此时 `isPlaceholderData` 下仍视为 ready。
 */
export function useCollectionsList(
  options: UseCollectionsListOptions = {},
): CollectionsListViewModel {
  const { page = 1, pageSize = 20, search = '', layout: layoutOverride } = options;
  const layout = useLayoutHint(layoutOverride);

  // trim 归一：空白视作全量（与后端「空白=全量」口径一致，避免 '' 与 ' x ' 产生不同 cache key）。
  const trimmedSearch = search.trim();
  const query = useQuery({
    queryKey: queryKeys.browse.collections(page, pageSize, trimmedSearch),
    queryFn: () => collectionsBrowseApi.listCollections({ page, pageSize, search: trimmedSearch }),
    placeholderData: keepPreviousData,
  });

  const data = query.data;
  const items = data?.items ?? [];

  const state: ViewState = deriveViewState(
    {
      data,
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      isLoading: query.isLoading,
    },
    items.length === 0,
  );

  return {
    data: {
      items,
      total: data?.total ?? 0,
      page: data?.page ?? page,
      pageSize: data?.pageSize ?? pageSize,
      hasMore: data?.hasMore ?? false,
    },
    state,
    layout,
    error: query.error,
    actions: {
      refresh: () => {
        void query.refetch();
      },
    },
  };
}