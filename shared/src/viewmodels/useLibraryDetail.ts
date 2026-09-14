/**
 * `useLibraryDetail()` —— 媒体库详情页视图模型（WEB-B1）。
 *
 * 上移自 `apps/host/src/pages/browse/LibraryDetailPage.tsx`：
 * - `useInfiniteQuery` 分页取数（cursor）；
 * - 本地筛选（类型/分辨率/观看状态）与排序（recent/title/year）；
 * - 哨兵 loading more（视口触发）；
 * - 派生：库信息、统计、筛选项。
 *
 * 页面只保留「调 viewmodel + 渲染」，不再直接 `useInfiniteQuery`。
 */

import { useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

import { browseApi } from '@fmby/v2-shared/contracts/browse';
import { queryKeys } from '@fmby/v2-shared/query';

import { useLayoutHint } from './useLayoutHint';
import { deriveViewState, type LayoutHint, type ViewModel, type ViewState } from './types';
import type { LibraryDetailResponse, MediaCardSummary } from '@fmby/v2-shared/contracts/browse';

export const LIBRARY_PAGE_SIZE = 20;

export interface LibraryDetailViewData {
  /** 库信息（首页携带）。 */
  library: LibraryDetailResponse['library'] | undefined;
  /** 库简介（首页携带）。 */
  heroSummary: string | undefined;
  /** 筛选项（类型/分辨率，首页携带）。 */
  filters: LibraryDetailResponse['filters'] | undefined;
  /** 筛选+排序后的条目（渲染主体）。 */
  items: MediaCardSummary[];
  /** 已加载的原始条目数（含被过滤掉的）。 */
  loadedCount: number;
  /** 是否还有下一页。 */
  hasNextPage: boolean;
  /** 是否正在拉取下一页。 */
  isFetchingNextPage: boolean;
  /** 总条目数（后端返回）。 */
  totalItems: number;
}

export interface LibraryDetailActions {
  /** 刷新（回到第一页）。 */
  refresh: () => void;
  /** 加载更多（无下一页时为空操作）。 */
  loadMore: () => void;
}

export type LibraryDetailViewModel = ViewModel<LibraryDetailViewData, LibraryDetailActions> & {
  /** 无限滚动哨兵 ref（页面绑定到列表末尾）。 */
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
};

export interface UseLibraryDetailFilters {
  /** 媒体类型（'all' 或 kind）。 */
  mediaType: string;
  /** 分辨率（'all' 或 resolutionLabel）。 */
  resolution: string;
  /** 观看状态：all | unfinished | completed。 */
  watched: string;
  /** 排序：recent | title | year。 */
  sort: string;
}

export interface UseLibraryDetailOptions extends UseLibraryDetailFilters {
  /** 媒体库 id（路由参数；空表示无效）。 */
  libraryId: string | undefined;
  /** 强制布局（测试/主题）。 */
  layout?: LayoutHint;
}

export function useLibraryDetail(options: UseLibraryDetailOptions): LibraryDetailViewModel {
  const {
    libraryId,
    mediaType,
    resolution,
    watched,
    sort,
    layout: layoutOverride,
  } = options;
  const layout = useLayoutHint(layoutOverride);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const libraryQuery = useInfiniteQuery({
    queryKey: queryKeys.browse.library(libraryId ?? ''),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      browseApi.getLibraryDetail(libraryId ?? '', {
        cursor: pageParam,
        pageSize: LIBRARY_PAGE_SIZE,
      }),
    enabled: Boolean(libraryId),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  // 哨兵：进入视口且可继续时自动拉取下一页（原页面 effect 逻辑上移）。
  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && libraryQuery.hasNextPage && !libraryQuery.isFetchingNextPage) {
          void libraryQuery.fetchNextPage();
        }
      },
      {
        rootMargin: '320px 0px',
        threshold: 0.1,
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    libraryQuery.fetchNextPage,
    libraryQuery.hasNextPage,
    libraryQuery.isFetchingNextPage,
  ]);

  const pages = libraryQuery.data?.pages ?? [];
  const firstPage = pages[0];
  const loadedItems = useMemo(() => pages.flatMap((page) => page.items), [pages]);

  const items = useMemo(() => {
    const nextItems = [...loadedItems].filter((item) => {
      if (mediaType !== 'all' && item.kind !== mediaType) {
        return false;
      }
      if (resolution !== 'all' && item.resolutionLabel !== resolution) {
        return false;
      }
      if (watched === 'unfinished' && item.progress?.completed) {
        return false;
      }
      if (watched === 'completed' && !item.progress?.completed) {
        return false;
      }
      return true;
    });

    nextItems.sort((left, right) => {
      if (sort === 'title') {
        return left.title.localeCompare(right.title, 'zh-CN');
      }
      if (sort === 'year') {
        return (right.year ?? 0) - (left.year ?? 0);
      }
      return new Date(right.addedAt ?? 0).getTime() - new Date(left.addedAt ?? 0).getTime();
    });

    return nextItems;
  }, [loadedItems, mediaType, resolution, watched, sort]);

  const state: ViewState = deriveViewState(
    {
      data: firstPage,
      isPending: libraryQuery.isPending,
      isError: libraryQuery.isError,
      error: libraryQuery.error,
      isLoading: libraryQuery.isLoading,
    },
    loadedItems.length === 0,
  );

  return {
    data: {
      library: firstPage?.library,
      heroSummary: firstPage?.heroSummary,
      filters: firstPage?.filters,
      items,
      loadedCount: loadedItems.length,
      hasNextPage: libraryQuery.hasNextPage,
      isFetchingNextPage: libraryQuery.isFetchingNextPage,
      totalItems: firstPage?.total ?? 0,
    },
    state,
    layout,
    error: libraryQuery.error,
    loadMoreRef,
    actions: {
      refresh: () => {
        void libraryQuery.refetch();
      },
      loadMore: () => {
        if (libraryQuery.hasNextPage && !libraryQuery.isFetchingNextPage) {
          void libraryQuery.fetchNextPage();
        }
      },
    },
  };
}
