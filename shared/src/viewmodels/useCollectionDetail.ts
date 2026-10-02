/**
 * `useCollectionDetail()` —— 用户面合集详情页视图模型（FE-USER-COLLECTIONS-BROWSE）。
 *
 * 取数：`GET /api/collections/{id}`（session + BROWSE；Active 可见性闸，Hidden ⇒ 404）。
 * 页面只消费 `{ data, state, actions, layout }`，不直接 `useQuery`（WEB-B1 分层纪律）。
 */

import { useQuery } from '@tanstack/react-query';

import { collectionsBrowseApi } from '@fmby/v2-shared/contracts/browse';
import type { ManagedCollectionDetailRecord } from '@fmby/v2-shared/contracts/browse';
import { queryKeys } from '@fmby/v2-shared/query';

import { useLayoutHint } from './useLayoutHint';
import { deriveViewState, type LayoutHint, type ViewModel, type ViewState } from './types';

export interface CollectionDetailViewData {
  /** 合集本体（未就绪时 undefined）。 */
  collection: ManagedCollectionDetailRecord['collection'] | undefined;
  /** 成员快照行（未就绪为空数组）。 */
  members: ManagedCollectionDetailRecord['members'];
  /** 成员总数。 */
  totalMembers: number;
}

export interface CollectionDetailActions {
  /** 重试/刷新。 */
  refresh: () => void;
}

export type CollectionDetailViewModel = ViewModel<CollectionDetailViewData, CollectionDetailActions>;

export interface UseCollectionDetailOptions {
  /** 合集 id（路由参数；空/未定义表示无效 → 不发请求，停在 loading）。 */
  collectionId: string | undefined;
  /** 强制布局（测试/主题）。 */
  layout?: LayoutHint;
}

/**
 * 用户面合集详情视图模型。
 *
 * 空判定恒 false：详情页的「空」语义是 404/错误（由 state 表达），不是空列表；
 * 合集本身存在即 ready（成员可为 0，页面自行给诚实空态）。
 */
export function useCollectionDetail(
  options: UseCollectionDetailOptions,
): CollectionDetailViewModel {
  const { collectionId, layout: layoutOverride } = options;
  const layout = useLayoutHint(layoutOverride);

  const query = useQuery({
    queryKey: queryKeys.browse.collection(collectionId ?? ''),
    queryFn: () => collectionsBrowseApi.getCollection(collectionId ?? ''),
    enabled: Boolean(collectionId),
  });

  const detail = query.data;
  const members = detail?.members ?? [];

  const state: ViewState = deriveViewState(
    {
      data: detail,
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      isLoading: query.isLoading,
    },
    false,
  );

  return {
    data: {
      collection: detail?.collection,
      members,
      totalMembers: members.length,
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