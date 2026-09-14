/**
 * `useSearchOverlay()` —— 全局搜索覆盖层视图模型（WEB-B1）。
 *
 * 上移自 `apps/host/src/pages/browse/SearchOverlay.tsx` 的取数逻辑：
 * 防抖关键词 → `searchApi.search()`（≥2 字符才启用）。
 *
 * 返回 `{ data, state, actions, layout }`：搜索态不套用 empty/error 的整页语义
 * （覆盖层是增量浮层，空结果与加载中都由浮层自身文案表达），故 `state` 用
 * loading/error 反映取数，ready 表示有结果可渲染。
 */

import { useQuery } from '@tanstack/react-query';

import { searchApi } from '@fmby/v2-shared/contracts/browse/search';
import { queryKeys } from '@fmby/v2-shared/query';

import { useLayoutHint } from './useLayoutHint';
import { deriveViewState, type LayoutHint, type ViewModel, type ViewState } from './types';
import type { SearchResultItem } from '@fmby/v2-shared/contracts/browse/search';

export interface SearchOverlayViewData {
  /** 搜索结果。 */
  results: SearchResultItem[];
  /** 是否正在拉取（含后台刷新）。 */
  isSearching: boolean;
  /** 当前生效的关键词（已防抖）。 */
  keyword: string;
  /** 是否已达启用阈值（≥2 字符）。 */
  enabled: boolean;
}

export interface SearchOverlayActions {
  /** 重新搜索。 */
  retry: () => void;
}

export type SearchOverlayViewModel = ViewModel<SearchOverlayViewData, SearchOverlayActions>;

export interface UseSearchOverlayOptions {
  /** 已防抖的关键词。 */
  keyword: string;
  /** 强制布局（测试/主题）。 */
  layout?: LayoutHint;
}

export function useSearchOverlay(options: UseSearchOverlayOptions): SearchOverlayViewModel {
  const { keyword, layout: layoutOverride } = options;
  const layout = useLayoutHint(layoutOverride);
  const enabled = keyword.length >= 2;

  const searchQuery = useQuery({
    queryKey: queryKeys.search.results(keyword),
    queryFn: () => searchApi.search(keyword),
    enabled,
    staleTime: 30_000,
  });

  const results = searchQuery.data ?? [];

  // 未启用（关键词太短）不进入 loading：浮层此时显示引导文案。
  const state: ViewState = !enabled
    ? 'ready'
    : deriveViewState(
        {
          data: searchQuery.data,
          isPending: searchQuery.isPending,
          isError: searchQuery.isError,
          error: searchQuery.error,
          isLoading: searchQuery.isLoading,
        },
        results.length === 0,
      );

  return {
    data: {
      results,
      isSearching: searchQuery.isFetching,
      keyword,
      enabled,
    },
    state,
    layout,
    error: searchQuery.error,
    actions: {
      retry: () => {
        void searchQuery.refetch();
      },
    },
  };
}
