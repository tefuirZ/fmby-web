/**
 * `useHome()` —— 首页（放映厅）视图模型（WEB-B1）。
 *
 * 上移自 `apps/host/src/pages/browse/HomePage.tsx` 的取数与派生逻辑：
 * - 主查询 `getHomeData()`（hero / 热播 / 最近加入 / 继续观看）；
 * - 视口触发 + 延迟触发的**门控**媒体库查询（原页面内 shouldLoadLibraries 编排）；
 * - hero 轮播派生（原页面私有 `buildHomeHeroSlides` 一并上移，主题只消费 `heroSlides`）。
 *
 * 返回**视图模型** `{ data, state, actions }`，`data` 已是展示形态（heroSlides、
 * 分组数组、统计数），不再暴露 raw DTO 给页面/主题。
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { browseApi } from '@fmby/v2-shared/contracts/browse';
import { manageApi } from '@fmby/v2-shared/contracts/manage';
import { queryKeys } from '@fmby/v2-shared/query';
import { useDelayedTrigger, useViewportTrigger } from '@fmby/v2-shared/hooks';
import { buildMediaMeta } from './mediaMeta';

import { useLayoutHint } from './useLayoutHint';
import { deriveViewState, type LayoutHint, type ViewModel, type ViewState } from './types';
import type { BrowseHero, LibrarySummary, MediaCardSummary } from '@fmby/v2-shared/contracts/browse';

/** 首页视图数据（展示形态，主题可直接渲染）。 */
export interface HomeViewData {
  /** 主视觉轮播（已按 artwork 兜底筛选，最多 6 条）。 */
  heroSlides: BrowseHero[];
  /** 继续观看。 */
  continueItems: MediaCardSummary[];
  /** 最近加入。 */
  addedItems: MediaCardSummary[];
  /** 热播。 */
  hotItems: MediaCardSummary[];
  /** 媒体库（门控加载，未触发时为空数组）。 */
  libraries: LibrarySummary[];
  /** 是否有可展示的主内容（hero 或任一行）。 */
  hasHomeContent: boolean;
  /** 管理端概览（仅管理员且触发后可用）。 */
  overview: unknown | undefined;
  /** 管理提醒状态：非管理员或未触发为 hidden。 */
  adminReminder: AdminReminderState;
  /** 主查询是否失败（用于页内横幅，不打断其余内容渲染）。 */
  hasPrimaryError: boolean;
  /** 媒体库区块的独立状态（门控加载，未触发时为 loading）。 */
  librariesState: ViewState;
  /** 媒体库区块的错误（仅 error/forbidden 态可用）。 */
  librariesError: unknown;
}

/** 管理提醒的视图状态（首页首屏右上角的运营提示）。 */
export type AdminReminderState = 'hidden' | 'pending' | 'error' | 'ready' | 'empty';

export interface HomeActions {
  /** 重试全部查询。 */
  retry: () => void;
  /** 刷新首页数据。 */
  refresh: () => void;
  /** 重试管理提醒查询。 */
  retryOverview: () => void;
  /** 媒体库分区是否应渲染（供页面绑定 ref）。 */
  shouldRenderLibrariesSection: boolean;
}

export type HomeViewModel = ViewModel<HomeViewData, HomeActions> & {
  /** 媒体库分区的视口触发 ref（页面需绑定到 DOM 上）。 */
  librariesSectionRef: (node: HTMLDivElement | null) => void;
};

/** hero 派生（原 HomePage 私有实现，上移至 viewmodel 层）。 */
function buildHomeHeroSlides(
  primaryHero: BrowseHero | null,
  hotItems: MediaCardSummary[],
  addedItems: MediaCardSummary[],
  continueItems: MediaCardSummary[],
): BrowseHero[] {
  const slides: BrowseHero[] = [];
  const seen = new Set<string>();

  const pushHero = (hero: BrowseHero | null) => {
    if (!hero || seen.has(hero.item.id)) {
      return;
    }
    seen.add(hero.item.id);
    slides.push(hero);
  };

  const pushItem = (item: MediaCardSummary, source: 'resume' | 'hot') => {
    if (seen.has(item.id)) {
      return;
    }
    seen.add(item.id);
    slides.push(buildHomeHeroFromItem(item, source));
  };

  hotItems.forEach((item) => pushItem(item, 'hot'));
  pushHero(primaryHero);
  addedItems.forEach((item) => pushItem(item, 'hot'));
  continueItems.slice(0, 2).forEach((item) => pushItem(item, 'resume'));

  const limitedSlides = slides.slice(0, 6);
  const visualSlides = limitedSlides.filter((slide) => hasHeroArtwork(slide.item));
  return visualSlides.length > 0 ? visualSlides : limitedSlides;
}

function hasHeroArtwork(item: MediaCardSummary): boolean {
  return Boolean(
    item.artwork.bannerUrl ??
      item.artwork.backdropUrl ??
      item.artwork.thumbUrl ??
      item.artwork.posterUrl,
  );
}

/** 卡片 → hero（原 HomePage 私有实现，逐字上移）。 */
function buildHomeHeroFromItem(item: MediaCardSummary, source: 'resume' | 'hot'): BrowseHero {
  const primaryPlaybackTargetId = item.availabilityNotice
    ? undefined
    : item.playbackTargetId ?? (item.hasPlayableSource ? item.id : undefined);

  return {
    item,
    description:
      item.description ??
      (source === 'resume'
        ? '上次看到这里，打开就能继续接上。'
        : '最近大家都在看，先放进热播轮播里占个好位置。'),
    meta: buildMediaMeta(item),
    primaryActionLabel: primaryPlaybackTargetId
      ? item.progress
        ? '继续播放'
        : '立即播放'
      : '查看详情',
    primaryActionTo: primaryPlaybackTargetId
      ? `/play/${primaryPlaybackTargetId}`
      : `/item/${item.id}`,
    secondaryActionLabel: primaryPlaybackTargetId ? '查看详情' : undefined,
    secondaryActionTo: primaryPlaybackTargetId ? `/item/${item.id}` : undefined,
  };
}

export interface UseHomeOptions {
  /** 当前用户是否为管理员（决定是否启用管理概览查询）。 */
  isAdmin?: boolean;
  /** 强制布局（测试/主题）。 */
  layout?: LayoutHint;
}

/**
 * 首页视图模型。
 */
export function useHome(options: UseHomeOptions = {}): HomeViewModel {
  const { isAdmin = false, layout: layoutOverride } = options;
  const layout = useLayoutHint(layoutOverride);

  const homeDataQuery = useQuery({
    queryKey: queryKeys.browse.home(),
    queryFn: () => browseApi.getHomeData({ hot: 8, recentlyAdded: 14, continueWatching: 12 }),
    staleTime: 60_000,
  });

  const hotItems = homeDataQuery.data?.hotItems ?? [];
  const continueItems = homeDataQuery.data?.continueWatching ?? [];
  const addedItems = homeDataQuery.data?.recentlyAdded ?? [];
  const hasPrimaryRows =
    continueItems.length > 0 || addedItems.length > 0 || Boolean(homeDataQuery.data?.hero);

  // 门控：主内容为空时延迟 1.2s 兜底加载媒体库（原页面编排）。
  const shouldDelayLibraries = !homeDataQuery.isPending && !hasPrimaryRows;
  const shouldEnableAdminReminder = isAdmin && !homeDataQuery.isPending;
  const delayedLibrariesTrigger = useDelayedTrigger({
    delayMs: 1_200,
    enabled: shouldDelayLibraries,
  });
  const delayedAdminReminderTrigger = useDelayedTrigger({
    delayMs: 900,
    enabled: shouldEnableAdminReminder,
  });
  const { ref: librariesSectionRef, isTriggered: librariesSectionVisible } =
    useViewportTrigger<HTMLDivElement>({
      rootMargin: '320px 0px',
      threshold: 0.15,
    });
  const shouldLoadLibraries = librariesSectionVisible || delayedLibrariesTrigger;

  const librariesQuery = useQuery({
    queryKey: queryKeys.browse.librariesHome(),
    queryFn: () => browseApi.getLibraries(),
    enabled: shouldLoadLibraries,
    staleTime: 5 * 60_000,
  });

  const overviewQuery = useQuery({
    queryKey: queryKeys.manage.overviewHome(),
    queryFn: () => manageApi.getOverview(),
    enabled: delayedAdminReminderTrigger,
    staleTime: 60_000,
  });

  const heroSlides = useMemo(
    () => buildHomeHeroSlides(homeDataQuery.data?.hero ?? null, hotItems, addedItems, continueItems),
    [addedItems, continueItems, homeDataQuery.data?.hero, hotItems],
  );

  const libraries = librariesQuery.data ?? [];
  const hasHomeContent = heroSlides.length > 0 || continueItems.length > 0 || addedItems.length > 0;

  // 主查询失败且媒体库查询也已失败 → error/forbidden；否则以主查询为准。
  const primaryFailed = homeDataQuery.isError;
  const bothFailed = primaryFailed && shouldLoadLibraries && librariesQuery.isError;
  const effective = bothFailed
    ? {
        data: homeDataQuery.data,
        isPending: homeDataQuery.isPending,
        isError: true,
        error: homeDataQuery.error ?? librariesQuery.error,
        isLoading: homeDataQuery.isLoading,
      }
    : {
        data: homeDataQuery.data,
        isPending: homeDataQuery.isPending,
        isError: homeDataQuery.isError,
        error: homeDataQuery.error,
        isLoading: homeDataQuery.isLoading,
      };

  const isEmpty =
    !hasHomeContent && libraries.length === 0 && !homeDataQuery.isError && librariesQuery.isSuccess;

  const state: ViewState = deriveViewState(effective, isEmpty);

  // 管理提醒状态机：非管理员 / 未到触发时机 → hidden；随后 pending → ready/empty/error。
  const adminReminder: AdminReminderState = !isAdmin
    ? 'hidden'
    : !delayedAdminReminderTrigger
      ? 'hidden'
      : overviewQuery.isPending
        ? 'pending'
        : overviewQuery.isError
          ? 'error'
          : overviewQuery.data
            ? 'ready'
            : 'empty';

  const data: HomeViewData = {
    heroSlides,
    continueItems,
    addedItems,
    hotItems,
    libraries,
    hasHomeContent,
    overview: overviewQuery.data,
    adminReminder,
    hasPrimaryError: homeDataQuery.isError,
    librariesState: deriveViewState(
      {
        data: librariesQuery.data,
        isPending: librariesQuery.isPending,
        isError: librariesQuery.isError,
        error: librariesQuery.error,
        isLoading: librariesQuery.isLoading,
      },
      libraries.length === 0,
    ),
    librariesError: librariesQuery.error,
  };

  const actions: HomeActions = {
    retry: () => {
      void homeDataQuery.refetch();
      void librariesQuery.refetch();
    },
    refresh: () => {
      void homeDataQuery.refetch();
    },
    retryOverview: () => {
      void overviewQuery.refetch();
    },
    shouldRenderLibrariesSection: shouldLoadLibraries,
  };

  return {
    data,
    state,
    actions,
    layout,
    error: effective.error,
    librariesSectionRef: librariesSectionRef as unknown as (node: HTMLDivElement | null) => void,
  };
}
