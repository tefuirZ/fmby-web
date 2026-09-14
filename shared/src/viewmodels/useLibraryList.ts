/**
 * `useLibraryList()` —— 媒体库列表页视图模型（WEB-B1）。
 *
 * 上移自 `apps/host/src/pages/browse/LibrariesPage.tsx` 的取数与派生（类型选项、
 * 统计数、最近更新库）。页面只负责「调 viewmodel + 渲染」，不再直接 `useQuery`。
 */

import { useDeferredValue, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { browseApi } from '@fmby/v2-shared/contracts/browse';
import { queryKeys } from '@fmby/v2-shared/query';

import { useLayoutHint } from './useLayoutHint';
import { deriveViewState, type LayoutHint, type ViewModel, type ViewState } from './types';
import type { LibrarySummary } from '@fmby/v2-shared/contracts/browse';

export interface LibraryListViewData {
  /** 全量媒体库（未过滤）。 */
  libraries: LibrarySummary[];
  /** 类型下拉选项（含 'all'）。 */
  typeOptions: string[];
  /** 内容总数。 */
  totalItems: number;
  /** 库类型数。 */
  typeCount: number;
  /** 最近更新的库（无则 undefined）。 */
  latestLibrary: LibrarySummary | undefined;
}

export interface LibraryListActions {
  /** 刷新。 */
  refresh: () => void;
}

export type LibraryListViewModel = ViewModel<LibraryListViewData, LibraryListActions>;

export interface UseLibraryListOptions {
  /** 搜索关键词（外部受控；内部做 deferred）。 */
  keyword: string;
  /** 类型过滤（'all' 表示不过滤）。 */
  typeFilter: string;
  /** 强制布局（测试/主题）。 */
  layout?: LayoutHint;
}

/**
 * 媒体库列表视图模型。
 *
 * 注意：`state` 只表达**取数状态**；筛选后的空结果属于页面局部（页面已在
 * 渲染层用 FeedbackState 表达"没有找到匹配"），不改全局 state（避免筛选
 * 把整页打成 empty 而丢失工具栏）。
 */
export function useLibraryList(options: UseLibraryListOptions): LibraryListViewModel {
  const { keyword, typeFilter, layout: layoutOverride } = options;
  const layout = useLayoutHint(layoutOverride);
  const deferredKeyword = useDeferredValue(keyword.trim());

  const librariesQuery = useQuery({
    queryKey: queryKeys.browse.libraries(),
    queryFn: () => browseApi.getLibraries(),
  });

  const libraries = useMemo(() => librariesQuery.data ?? [], [librariesQuery.data]);

  const typeOptions = useMemo(
    () => ['all', ...new Set(libraries.map((item) => item.typeLabel))],
    [libraries],
  );

  const totalItems = useMemo(
    () => libraries.reduce((sum, library) => sum + library.itemCount, 0),
    [libraries],
  );

  const typeCount = useMemo(
    () => new Set(libraries.map((library) => library.typeLabel)).size,
    [libraries],
  );

  const latestLibrary = useMemo(
    () =>
      [...libraries]
        .filter((library) => Boolean(library.updatedAt))
        .sort(
          (left, right) =>
            new Date(right.updatedAt ?? 0).getTime() - new Date(left.updatedAt ?? 0).getTime(),
        )[0],
    [libraries],
  );

  // 供页面做本地过滤（保持原页面的 useMemo 语义与依赖口径）。
  const filteredLibraries = useMemo(() => {
    const needle = deferredKeyword.toLowerCase();
    return libraries.filter((library) => {
      const matchesKeyword =
        needle.length === 0 ||
        [library.name, library.description, library.typeLabel]
          .filter((field): field is string => Boolean(field))
          .some((field) => field.toLowerCase().includes(needle));
      const matchesType = typeFilter === 'all' || library.typeLabel === typeFilter;
      return matchesKeyword && matchesType;
    });
  }, [deferredKeyword, libraries, typeFilter]);

  const state: ViewState = deriveViewState(
    {
      data: librariesQuery.data,
      isPending: librariesQuery.isPending,
      isError: librariesQuery.isError,
      error: librariesQuery.error,
      isLoading: librariesQuery.isLoading,
    },
    libraries.length === 0,
  );

  return {
    data: {
      libraries,
      typeOptions,
      totalItems,
      typeCount,
      latestLibrary,
      filteredLibraries,
    } as LibraryListViewData,
    state,
    layout,
    error: librariesQuery.error,
    actions: {
      refresh: () => {
        void librariesQuery.refetch();
      },
    },
  };
}
