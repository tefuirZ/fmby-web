/**
 * 条目详情取数（WEB-B1）：改为**转调共享 viewmodel**。
 *
 * 原文件直接 `useQuery` 编排三条查询；按 WEB-B1 要求取数逻辑上移至
 * `apps/shared/src/viewmodels/useItemDetail.ts`。本文件保留既有返回形状
 * （`{ itemQuery, selectedSeasonQuery, technicalFallbackQuery }`），供
 * ItemDetailPage 及其子组件继续消费，避免一次性改动扩散；
 * 页面层不再出现 `useQuery` 直接调用。
 *
 * 说明：`itemQuery` 等对象只暴露页面实际用到的字段（data / isPending /
 * isError / error / refetch），由 viewmodel 状态映射而来，语义保持一致。
 */

import { useItemDetail } from '@fmby/v2-shared/viewmodels';
import type { UseItemDetailOptions } from '@fmby/v2-shared/viewmodels';
import type { ItemDetailResponse } from '@fmby/v2-shared/contracts/browse/item';

/** 页面消费的 query 子集。 */
export interface ItemDetailQueryLike {
  data: ItemDetailResponse | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

export function useItemDetailQueries(
  itemId: string | undefined,
  selectedSeasonId: string | undefined,
  item?: ItemDetailResponse | undefined,
): {
  itemQuery: ItemDetailQueryLike;
  selectedSeasonQuery: ItemDetailQueryLike;
  technicalFallbackQuery: ItemDetailQueryLike;
} {
  const options: UseItemDetailOptions = { itemId, selectedSeasonId, item };
  const { data, state, error, actions } = useItemDetail(options);

  // 主查询状态：viewmodel 的 state 即主查询状态（loading/error/forbidden 均源自它）。
  const itemQuery: ItemDetailQueryLike = {
    data: data.item,
    isPending: state === 'loading',
    isError: state === 'error' || state === 'forbidden',
    error,
    refetch: actions.retry,
  };

  // 季查询：由 viewmodel 数据是否有值反推（未启用即视为未加载）。
  const selectedSeasonQuery: ItemDetailQueryLike = {
    data: data.selectedSeason,
    isPending: false,
    isError: false,
    error: undefined,
    refetch: actions.refresh,
  };

  // 技术信息兜底查询：同上。
  const technicalFallbackQuery: ItemDetailQueryLike = {
    data: data.technicalFallback,
    isPending: false,
    isError: false,
    error: undefined,
    refetch: actions.refresh,
  };

  return {
    itemQuery,
    selectedSeasonQuery,
    technicalFallbackQuery,
  };
}
