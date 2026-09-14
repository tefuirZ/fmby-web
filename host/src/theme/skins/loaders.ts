/**
 * 域皮肤数据源（WEB-C1 ② + WEB-C2 升级：host 侧 view-model 桥）。
 *
 * 职责边界（ADR-001 §3）：
 * - 数据由 **host** 算好后注入主题组件（主题禁取数）；
 * - WEB-B1 落地后，装配组件内部调 `shared/viewmodels`（本卡完成）——
 *   注册表形状与主题契约零感知；
 * - React 规则约束：viewmodel hook 只能在组件体内调用，因此"数据源装配器"
 *   是**组件形态**（DomainSkinDataProvider）：渲染 children 前把视图模型
 *   经 context 下发，由 DomainSkinOutlet 汇聚成 SkinProps。
 */

import { createContext, createElement, useContext, type ReactNode } from 'react';

import { useItemDetail, useLibraryDetail } from '@fmby/v2-shared/viewmodels';
import type { LayoutHint, ViewState } from '@fmby/v2-shared/viewmodels';
import type { SkinProps } from '@fmby/v2-shared/theme';

/** 域数据装配结果（SkinProps 的 data/state/actions 切面）。 */
export interface DomainSkinData {
  data: SkinProps['data'];
  state: ViewState;
  /** viewmodel actions（host 侧动作面；WEB-B1 后真实下发） */
  actions: SkinProps['actions'];
  /** 布局提示（移动端/桌面端；WEB-B1 交付物 3） */
  layout: LayoutHint;
  /** 归一化错误（error/forbidden 态可用） */
  error?: unknown;
}

const DomainSkinDataContext = createContext<DomainSkinData>({
  data: null,
  state: 'loading',
  actions: {},
  layout: 'desktop',
});

/** 路由参数桥：DomainSkinOutlet 经 props 注入（loader 组件直接消费）。 */
export interface DomainSkinParamsProps {
  params: Readonly<Record<string, string | undefined>>;
}

/**
 * browse.library 装配组件：`useLibraryDetail` viewmodel 桥。
 *
 * viewmodel 内部自带筛选排序默认值；主题筛选动作经 actions 下发
 * （键语义：`setFilter:<name>`，值域与 host 默认页一致）。
 */
function BrowseLibrarySkinDataProvider({
  params,
  children,
}: DomainSkinParamsProps & { children: ReactNode }) {
  const libraryId = params.libraryId ?? '';
  const vm = useLibraryDetail({
    libraryId: libraryId || undefined,
    mediaType: 'all',
    resolution: 'all',
    watched: 'all',
    sort: 'recent',
  });

  const value: DomainSkinData = {
    data: vm.data,
    state: vm.state,
    error: vm.error,
    layout: vm.layout,
    actions: {
      refresh: vm.actions.refresh,
      loadMore: vm.actions.loadMore,
    },
  };

  return createElement(DomainSkinDataContext.Provider, { value }, children);
}

/**
 * browse.item 装配组件：`useItemDetail` viewmodel 桥（WEB-C3 第二域）。
 */
function BrowseItemSkinDataProvider({
  params,
  children,
}: DomainSkinParamsProps & { children: ReactNode }) {
  const itemId = params.itemId ?? '';
  const vm = useItemDetail({
    itemId: itemId || undefined,
    selectedSeasonId: undefined,
  });

  const value: DomainSkinData = {
    data: vm.data,
    state: vm.state,
    error: vm.error,
    layout: vm.layout,
    actions: {
      retry: vm.actions.retry,
      refresh: vm.actions.refresh,
    },
  };

  return createElement(DomainSkinDataContext.Provider, { value }, children);
}

/**
 * 域 → 数据源装配组件注册表（键与 shared PageDomain 值一一对应）。
 *
 * 未注册（undefined）的 domain：即使主题声明了 skin 也拿不到 data ——
 * 调度器按「功能永不缺失」回落 host 默认页面（不渲染拿不到数据的半成品）。
 */
export const DOMAIN_SKIN_DATA_REGISTRY: {
  [K in import('@fmby/v2-shared/theme').PageDomain]?:
    | undefined
    | React.ComponentType<DomainSkinParamsProps & { children: ReactNode }>;
} = {
  'browse.home': undefined,
  'browse.library': BrowseLibrarySkinDataProvider,
  'browse.item': BrowseItemSkinDataProvider,
  'browse.play': undefined,
  manage: undefined,
  settings: undefined,
  observability: undefined,
};

export function useDomainSkinData(): DomainSkinData {
  return useContext(DomainSkinDataContext);
}
