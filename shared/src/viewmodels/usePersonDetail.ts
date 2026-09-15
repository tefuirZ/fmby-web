/**
 * `usePersonDetail()` —— 人物详情页视图模型（V1F-10）。
 *
 * 沿用 WEB-B1 的 viewmodel 模式：页面只「调 viewmodel + 渲染」，不直接
 * `useQuery`。返回 `{ data, state, actions, layout }`，`state` 五态由
 * `deriveViewState` 统一判定（loading/ready/empty/error/forbidden）。
 *
 * ★ 分页诚实边界：后端人物关联端口无 keyset 游标，作品列表为**单页硬上限**。
 * 本 viewmodel **不提供 loadMore/分页动作**（不伪造翻页能力）；作品为空时
 * 归 `empty` 态（人物存在但无关联作品是合法空，不是错误）。
 */

import { useQuery } from '@tanstack/react-query';

import { personApi } from '@fmby/v2-shared/contracts/browse/person';
import { queryKeys } from '@fmby/v2-shared/query';

import { useLayoutHint } from './useLayoutHint';
import { deriveViewState, type LayoutHint, type ViewModel, type ViewState } from './types';
import type { MediaCardSummary } from '@fmby/v2-shared/contracts/browse';
import type { PersonDetail } from '@fmby/v2-shared/contracts/browse/person';

export interface PersonDetailViewData {
  /** 人物详情（主查询）。 */
  person: PersonDetail | undefined;
  /** 关联作品（单页硬上限）。 */
  items: MediaCardSummary[];
  /** 作品总数（真值）。 */
  total: number;
}

export interface PersonDetailActions {
  /** 重试（人物 + 作品双查询）。 */
  retry: () => void;
  /** 刷新。 */
  refresh: () => void;
}

export type PersonDetailViewModel = ViewModel<PersonDetailViewData, PersonDetailActions>;

export interface UsePersonDetailOptions {
  /** 人物 id（路由参数；空表示无效）。 */
  personId: string | undefined;
  /** 强制布局（测试/主题）。 */
  layout?: LayoutHint;
}

export function usePersonDetail(options: UsePersonDetailOptions): PersonDetailViewModel {
  const { personId, layout: layoutOverride } = options;
  const layout = useLayoutHint(layoutOverride);

  const personQuery = useQuery({
    queryKey: queryKeys.item.person(personId ?? ''),
    queryFn: () => personApi.getPerson(personId ?? ''),
    enabled: Boolean(personId),
  });

  const itemsQuery = useQuery({
    queryKey: queryKeys.item.personItems(personId ?? ''),
    queryFn: () => personApi.getPersonItems(personId ?? ''),
    enabled: Boolean(personId),
  });

  const person = personQuery.data;
  const items = itemsQuery.data?.items ?? [];

  // 状态判定：人物与作品任一失败即失败态；人物到位后按「是否有作品」判
  // empty/ready（人物存在但零作品 = 合法空）。
  const state: ViewState = deriveViewState(
    {
      data: person,
      isPending: personQuery.isPending || itemsQuery.isPending,
      isError: personQuery.isError || itemsQuery.isError,
      error: personQuery.error ?? itemsQuery.error,
      isLoading: personQuery.isLoading || itemsQuery.isLoading,
    },
    false,
  );

  const resolvedState: ViewState =
    state === 'ready' && items.length === 0 ? 'empty' : state;

  return {
    data: {
      person,
      items,
      total: itemsQuery.data?.total ?? person?.itemCount ?? 0,
    },
    state: resolvedState,
    layout,
    error: personQuery.error ?? itemsQuery.error,
    actions: {
      retry: () => {
        void personQuery.refetch();
        void itemsQuery.refetch();
      },
      refresh: () => {
        void personQuery.refetch();
        void itemsQuery.refetch();
      },
    },
  };
}
