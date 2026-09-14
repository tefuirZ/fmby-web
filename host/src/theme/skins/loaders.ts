/**
 * 域皮肤数据源（WEB-C1 ②：host 侧 view-model 桥）。
 *
 * 职责边界（ADR-001 §3）：
 * - 数据由 **host** 算好后注入主题组件（主题禁取数）；
 * - loader 复用页面既有的 react-query 缓存（同 queryKey），不新增请求；
 * - WEB-B1（view-model 层抽取，w3 在途）落地后，装配组件内部改为调
 *   shared/viewmodels，注册表形状与主题契约零感知。
 *
 * React 规则约束：取数 hook 只能在组件体内调用，因此"数据源装配器"是
 * **组件形态**（DomainSkinDataProvider）：渲染 children 前把 data/state 经
 * context 下发，由 DomainSkinOutlet 汇聚成 SkinProps。
 */

import { createContext, createElement, useContext, type ReactNode } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { browseApi } from '@fmby/v2-shared/contracts/browse';
import { queryKeys } from '@fmby/v2-shared/query';
import type { PageDomain, SkinState } from '@fmby/v2-shared/theme';

/** 域数据装配结果（SkinProps 的 data/state 切面）。 */
export interface DomainSkinData {
  data: unknown;
  state: SkinState;
}

const PENDING: DomainSkinData = { data: null, state: 'loading' };

const DomainSkinDataContext = createContext<DomainSkinData>(PENDING);


/**
 * browse.library 样板：复用 LibraryDetailPage 同源 query 缓存（同 queryKey，
 * 零新增请求）。WEB-B1 落地后此组件内部改调 shared/viewmodels。
 */
function BrowseLibrarySkinDataProvider({
  params,
  children,
}: DomainSkinParamsProps & { children: ReactNode }) {
  // libraryId 由 DomainSkinOutlet 经 props 注入（与路由参数同源）。
  const libraryId = params.libraryId ?? '';
  const query = useInfiniteQuery({
    queryKey: queryKeys.browse.library(libraryId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      browseApi.getLibraryDetail(libraryId, {
        cursor: pageParam,
        pageSize: 20,
      }),
    enabled: Boolean(libraryId),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  let value: DomainSkinData;
  if (query.isPending) {
    value = PENDING;
  } else if (query.isError) {
    value = { data: null, state: 'error' };
  } else {
    const pages = query.data?.pages ?? [];
    const detail = pages[0];
    if (!detail) {
      value = { data: null, state: 'empty' };
    } else {
      value = {
        data: {
          library: detail.library,
          items: pages.flatMap((page) => page.items),
          total: detail.total,
        },
        state: detail.items.length === 0 ? 'empty' : 'ready',
      };
    }
  }


  return createElement(DomainSkinDataContext.Provider, { value }, children);
}

/**
 * 域 → 数据源装配组件注册表（键与 shared PageDomain 值一一对应）。
 *
 * 未注册（undefined）的 domain：即使主题声明了 skin 也拿不到 data ——
 * 调度器按「功能永不缺失」回落 host 默认页面（不渲染拿不到数据的半成品）。
 */
export const DOMAIN_SKIN_DATA_REGISTRY: DomainSkinDataRegistry = {
  'browse.home': undefined,
  'browse.library': BrowseLibrarySkinDataProvider,
  'browse.item': undefined,
  'browse.play': undefined,
  manage: undefined,
  settings: undefined,
  observability: undefined,
};

export function useDomainSkinData(): DomainSkinData {
  return useContext(DomainSkinDataContext);
}

/** 路由参数桥：DomainSkinOutlet 经 props 注入（loader 组件直接消费）。 */
export interface DomainSkinParamsProps {
  params: Readonly<Record<string, string | undefined>>;
}

/**
 * 域 → 数据源装配组件注册表。
 *
 * 装配组件签名：`(props: DomainSkinParamsProps) => ReactNode`（内部自取
 * context 下发数据）。未注册（undefined）的 domain：即使主题声明了 skin
 * 也拿不到 data —— 调度器按「功能永不缺失」回落 host 默认页面
 * （不渲染拿不到数据的半成品）。
 */
export type DomainSkinDataRegistry = {
  [K in PageDomain]?: React.ComponentType<DomainSkinParamsProps & { children: ReactNode }>;
};
