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

import { createContext, createElement, useCallback, useContext, type ReactNode } from 'react';
import { useNavigate } from 'react-router';

import { useItemDetail, useLibraryDetail } from '@fmby/v2-shared/viewmodels';
import type { LayoutHint, ViewState } from '@fmby/v2-shared/viewmodels';
import type { SkinActions, SkinProps } from '@fmby/v2-shared/theme';

/** 域数据装配结果（SkinProps 的 data/state/actions 切面）。 */
export interface DomainSkinData {
  data: SkinProps['data'];
  state: ViewState;
  /** viewmodel actions（host 侧动作面；WEB-B1 后真实下发，含 openItem 导航键） */
  actions: SkinActions;
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
 * 通用导航动作面（BUG-SKIN-NAV-01）。
 *
 * host 是唯一持有路由知识的一侧；主题不得自建导航（禁 router import）。
 * 此 hook 把「打开条目」编译为语义键 `openItem`，经各 domain 数据源装配器
 * 汇入 `SkinProps.actions`，主题按需取用。
 */
function useSkinNavigationActions(): Pick<SkinActions, 'openItem' | 'itemHref'> {
  const navigate = useNavigate();
  return {
    openItem: useCallback((id: string) => navigate(`/item/${id}`), [navigate]),
    itemHref: useCallback((id: string) => `/item/${id}`, []),
  };
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
  const navigation = useSkinNavigationActions();
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
      ...navigation,
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
  const navigation = useSkinNavigationActions();
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
      ...navigation,
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
