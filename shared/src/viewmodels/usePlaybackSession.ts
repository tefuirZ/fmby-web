/**
 * `usePlaybackSession()` —— 播放页视图模型（WEB-B1）。
 *
 * 上移自 `apps/host/src/pages/browse/PlayPage.tsx` 的播放会话编排：
 * 1. `playbackApi.createSession(itemId)` 建会话（retry:false，失败即终态）；
 * 2. 会话成功后拉条目详情 `itemApi.getDetail`；
 * 3. 剧集（episode）时追加：季详情 → 系列根 → 系列全季集；
 * 4. 播放设置 `settingsApi.getUserPlayback()`（会话成功后）。
 *
 * 播放页失败语义特殊：**不重试**（`retry:false`）——会话创建失败通常意味着
 * 不可播放/无权限，重试只会放大延迟。故 viewmodel 显式反映 error/forbidden。
 */

import { useQuery } from '@tanstack/react-query';

import { playbackApi } from '@fmby/v2-shared/contracts/playback';
import { itemApi } from '@fmby/v2-shared/contracts/browse/item';
import { settingsApi } from '@fmby/v2-shared/contracts/settings';
import { queryKeys } from '@fmby/v2-shared/query';

import { useLayoutHint } from './useLayoutHint';
import { deriveViewState, type LayoutHint, type ViewModel, type ViewState } from './types';
import type { PlaybackSession } from '@fmby/v2-shared/contracts/playback';
import type { ItemDetailResponse } from '@fmby/v2-shared/contracts/browse/item';
import type { MediaCardSummary } from '@fmby/v2-shared/contracts/browse';

export interface PlaybackSessionViewData {
  /** 播放会话（失败则 undefined）。 */
  session: PlaybackSession | undefined;
  /** 当前条目详情。 */
  detail: ItemDetailResponse | undefined;
  /** 剧集场景：季详情。 */
  season: ItemDetailResponse | undefined;
  /** 剧集场景：系列根详情。 */
  series: ItemDetailResponse | undefined;
  /** 剧集场景：系列全季集。 */
  seriesEpisodes: MediaCardSummary[];
  /** 播放设置。 */
  playbackSettings: unknown | undefined;
  /** 是否剧集视图。 */
  isEpisodeView: boolean;
  /** 是否仍在解析系列根（剧集场景的中间态）。 */
  isResolvingSeriesRoot: boolean;
  /** 系列季集是否加载中。 */
  isSeriesEpisodesLoading: boolean;
  /** 会话是否已建立成功（详情/设置查询的前置闸门）。 */
  isSessionReady: boolean;
  /** 详情查询是否仍在拉取（含后台刷新）。 */
  isDetailFetching: boolean;
  /** 自动连播设置（缺省 true，与页面原语义一致）。 */
  autoplayNextEpisode: boolean;
}

export interface PlaybackSessionActions {
  /** 重建会话（重试）。 */
  retry: () => void;
}

export type PlaybackSessionViewModel = ViewModel<PlaybackSessionViewData, PlaybackSessionActions>;

export interface UsePlaybackSessionOptions {
  /** 条目 id（路由参数）。 */
  itemId: string | undefined;
  /** 强制布局（测试/主题；播放页通常全屏，但提示仍供主题分支）。 */
  layout?: LayoutHint;
}

export function usePlaybackSession(
  options: UsePlaybackSessionOptions,
): PlaybackSessionViewModel {
  const { itemId, layout: layoutOverride } = options;
  const layout = useLayoutHint(layoutOverride);

  const sessionQuery = useQuery({
    queryKey: queryKeys.playback.info(itemId ?? ''),
    queryFn: () => playbackApi.createSession(itemId ?? ''),
    enabled: Boolean(itemId),
    retry: false,
  });

  const itemQuery = useQuery({
    queryKey: queryKeys.playback.item(itemId ?? ''),
    queryFn: () => itemApi.getDetail(itemId ?? ''),
    enabled: Boolean(itemId) && sessionQuery.isSuccess,
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const seasonQuery = useQuery({
    queryKey: queryKeys.playback.season(itemQuery.data?.season?.id),
    queryFn: () => itemApi.getDetail(itemQuery.data?.season?.id ?? ''),
    enabled:
      itemQuery.data?.kind === 'episode' &&
      Boolean(itemQuery.data?.season?.id) &&
      !itemQuery.data?.series?.id,
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const seriesRootId = itemQuery.data?.series?.id || seasonQuery.data?.series?.id;

  const seriesQuery = useQuery({
    queryKey: queryKeys.playback.series(seriesRootId),
    queryFn: () => itemApi.getDetail(seriesRootId ?? ''),
    enabled: itemQuery.data?.kind === 'episode' && Boolean(seriesRootId),
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const seriesEpisodesQuery = useQuery({
    queryKey: queryKeys.playback.seriesEpisodes(seriesRootId),
    queryFn: () => itemApi.getDescendants(seriesRootId ?? '', 2000),
    enabled: itemQuery.data?.kind === 'episode' && Boolean(seriesRootId),
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const playbackSettingsQuery = useQuery({
    queryKey: queryKeys.settings.playback(),
    queryFn: () => settingsApi.getUserPlayback(),
    enabled: sessionQuery.isSuccess,
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const detail = itemQuery.data;
  const isEpisodeView = detail?.kind === 'episode' || Boolean(itemId?.startsWith('episode-'));
  const isResolvingSeriesRoot =
    isEpisodeView && Boolean(detail?.season?.id) && !seriesRootId && seasonQuery.isPending;
  const isSeriesEpisodesLoading =
    isEpisodeView &&
    Boolean(seriesRootId) &&
    (seriesEpisodesQuery.isPending || seriesEpisodesQuery.isFetching);

  // 会话创建失败优先（它是播放的前置闸门）：会话错误 → error/forbidden。
  const sessionFailed = sessionQuery.isError;
  const gate = sessionFailed
    ? {
        data: undefined,
        isPending: false,
        isError: true,
        error: sessionQuery.error,
        isLoading: false,
      }
    : {
        data: itemQuery.data,
        isPending: sessionQuery.isPending || itemQuery.isPending,
        isError: itemQuery.isError,
        error: itemQuery.error,
        isLoading: sessionQuery.isLoading || itemQuery.isLoading,
      };

  const state: ViewState = deriveViewState(gate, false);

  return {
    data: {
      session: sessionQuery.data,
      detail,
      season: seasonQuery.data,
      series: seriesQuery.data,
      seriesEpisodes: seriesEpisodesQuery.data ?? [],
      playbackSettings: playbackSettingsQuery.data,
      isEpisodeView,
      isResolvingSeriesRoot,
      isSeriesEpisodesLoading,
      isSessionReady: sessionQuery.isSuccess,
      isDetailFetching: itemQuery.isPending || itemQuery.isFetching,
      autoplayNextEpisode:
        (playbackSettingsQuery.data as { autoplayNextEpisode?: boolean } | undefined)
          ?.autoplayNextEpisode ?? true,
    },
    state,
    layout,
    error: sessionQuery.error ?? itemQuery.error,
    actions: {
      retry: () => {
        void sessionQuery.refetch();
        void itemQuery.refetch();
      },
    },
  };
}
