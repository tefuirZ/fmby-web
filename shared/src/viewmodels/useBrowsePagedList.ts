/**
 * `useBrowsePagedList()` —— 继续观看 / 最近添加通用列表视图模型
 * （FE-CONTINUE-WATCHING；keyset cursor 分页，照 useLibraryDetail 范式）。
 *
 * `kind = 'resume' | 'recently-added'`：二端点同形 wire，一个 viewmodel 复用。
 */

import { useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

import { browseApi } from '@fmby/v2-shared/contracts/browse';
import type { BrowsePagedPage, MediaCardSummary } from '@fmby/v2-shared/contracts/browse';
import { queryKeys } from '@fmby/v2-shared/query';

import { useLayoutHint } from './useLayoutHint';
import { deriveViewState, type LayoutHint, type ViewModel, type ViewState } from './types';

export const BROWSE_PAGE_SIZE = 50;

export type BrowsePagedListKind = 'resume' | 'recently-added';

export interface BrowsePagedListViewData {
  /** 当页已加载条目（跨页累计）。 */
  items: MediaCardSummary[];
  /** 是否还有下一页。 */
  hasMore: boolean;
  /** 已加载原始条目数。 */
  loadedCount: number;
}

export interface BrowsePagedListActions {
  refresh: () => void;
  loadMore: () => void;
}

export type BrowsePagedListViewModel = ViewModel<
  BrowsePagedListListViewData,
  BrowsePagedListActions
> & {
  /** 哨兵 ref（页面绑定到列表末尾）。 */
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
};

export interface UseBrowsePagedListOptions {
  kind: BrowsePagedListKind;
  /** 仅 recently-added：库作用域。 */
  libraryId?: string;
  layout?: LayoutHint;
}

export function useBrowsePagedList(
  options: UseBrowsePagedListOptions,
): BrowsePagedListViewModel {
  const { kind, libraryId, layout: layoutOverride } = options;
  const layout = useLayoutHint(layoutOverride);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const query = useInfiniteQuery({
    queryKey:
      kind === 'resume'
        ? ['browse', 'resume', 'paged']
        : ['browse', 'recently-added', 'paged', libraryId ?? ''],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      kind === 'resume'
        ? browseApi.getContinueWatching({ cursor: pageParam, pageSize: BROWSE_PAGE_SIZE })
        : browseApi.getRecentlyAdded({
            cursor: pageParam,
            pageSize: BROWSE_PAGE_SIZE,
            libraryId,
          }),
    enabled: kind === 'resume' || Boolean(libraryId),
    getNextPageParam: (lastPage: BrowsePagedPage) => (lastPage.hasMore ? lastPage.nextCursor ?? undefined : undefined),
  });

  // 哨兵：进入视口且可继续时自动拉取下一页（照 useLibraryDetail）。
  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && query.hasNextPage && !query.isFetchingNextPage) {
          void query.fetchNextPage();
        }
      },
      { rootMargin: '320px 0px', threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [query.fetchNextPage, query.hasNextPage, query.isFetchingNextPage]);

  const pages = query.data?.pages ?? [];
  const items = useMemo(() => pages.flatMap((page) => page.items), [pages]);
  const firstPage = pages[0];

  const state: ViewState = deriveViewState(
    {
      data: query.data,
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
      hasMore: query.hasNextPage,
      loadedCount: items.length,
    },
    state,
    layout,
    error: query.error,
    loadMoreRef,
    actions: {
      refresh: () => {
        void query.refetch();
      },
      loadMore: () => {
        if (query.hasNextPage && !query.isFetchingNextPage) {
          void query.fetchNextPage();
        }
      },
    },
  };
}
