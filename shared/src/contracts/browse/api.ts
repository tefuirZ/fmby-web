import { httpClient } from '@fmby/v2-shared/api/client';
import {
  asRecord,
  clampProgress,
  readArray,
  readBoolean,
  readNumber,
  readString,
  readStringArray,
  ticksToSeconds,
} from '@fmby/v2-shared/api/mapping';
import { mapArtwork } from '@fmby/v2-shared/contracts/assets';
import type {
  BrowseHomeData,
  BrowseHero,
  BrowseFilterOption,
  LibraryDetailResponse,
  LibrarySummary,
  MediaCardSummary,
  MediaKind,
  MediaProgressSummary,
} from './types';

interface RawListResponse<T> {
  items?: T[];
  total?: number;
}

interface LibraryDetailParams {
  page?: number;
  pageSize?: number;
  mediaType?: string;
  resolution?: string;
  watched?: string;
  sort?: string;
}

export const browseApi = {
  /** 单次请求获取首页首屏核心区块（hero + 最近添加 + 继续观看） */
  async getHomeData(
    limits: { hot?: number; recentlyAdded?: number; continueWatching?: number } = {},
  ): Promise<BrowseHomeData> {
    const raw = await httpClient.get<unknown>('/api/browse/home/bootstrap');
    const record = asRecord(raw);
    const sections = readArray(record.sections, mapHomeSection);

    const heroSection =
      sections.find((item) => item.id === 'resume' && item.items.length > 0) ??
      sections.find((item) => item.items.length > 0);
    const heroItem = heroSection?.items[0];

    const hotSection =
      sections.find((item) => ['hot', 'popular', 'trending'].includes(item.id)) ??
      sections.find((item) => item.id === 'latest') ??
      sections[0];
    const latestSection = sections.find((item) => item.id === 'latest') ?? sections[0];
    const resumeSection = sections.find((item) => item.id === 'resume') ?? sections[0];

    const hero: BrowseHero | null = heroItem
      ? (() => {
          const action = buildHeroActions(heroItem);
          return {
            item: heroItem,
            description:
              readString(
                record.hero_summary,
                record.heroSummary,
                record.description,
                heroItem.description,
              ) ?? (heroItem.progress ? '从上次停下来的地方继续。' : '从这里继续进入今天的观影。'),
            meta: buildMeta(heroItem),
            primaryActionLabel: action.primaryActionLabel,
            primaryActionTo: action.primaryActionTo,
            secondaryActionLabel: action.secondaryActionLabel,
            secondaryActionTo: action.secondaryActionTo,
          };
        })()
      : null;

    return {
      hero,
      hotItems: hotSection
        ? hotSection.items.slice(0, limits.hot ?? 8)
        : [],
      recentlyAdded: latestSection
        ? latestSection.items.slice(0, limits.recentlyAdded ?? 12)
        : [],
      continueWatching: resumeSection
        ? resumeSection.items.slice(0, limits.continueWatching ?? 12)
        : [],
    };
  },

  /** @deprecated 请使用 getHomeData() */
  async getHomeHero(): Promise<BrowseHero | null> {
    return (await browseApi.getHomeData()).hero;
  },

  /** @deprecated 请使用 getHomeData() */
  async getRecentlyAdded(limit = 12): Promise<MediaCardSummary[]> {
    return (await browseApi.getHomeData({ recentlyAdded: limit })).recentlyAdded;
  },

  /** @deprecated 请使用 getHomeData() */
  async getContinueWatchingHome(limit = 12): Promise<MediaCardSummary[]> {
    return (await browseApi.getHomeData({ continueWatching: limit })).continueWatching;
  },

  async getLibraries(): Promise<LibrarySummary[]> {
    const raw = await httpClient.get<RawListResponse<unknown>>('/api/browse/libraries');
    return readArray(raw.items, mapLibrary);
  },

  async getLibraryDetail(
    libraryId: string,
    params: LibraryDetailParams = {},
  ): Promise<LibraryDetailResponse> {
    const raw = await httpClient.get<unknown>(`/api/browse/libraries/${libraryId}`, {
      params: {
        page: params.page,
        pageSize: params.pageSize,
        mediaType: params.mediaType,
        resolution: params.resolution,
        watched: params.watched,
        sort: params.sort,
      },
    });
    const record = asRecord(raw);
    const items = readArray(record.items, mapMediaCard);

    return {
      library:
        mapLibrary(record.library) ?? {
          id: libraryId,
          name: '未命名媒体库',
          typeLabel: '媒体库',
          description: undefined,
          itemCount: readNumber(record.total_items, record.totalItems) ?? 0,
          updatedAt: readString(record.updated_at, record.updatedAt),
          artwork: mapArtwork(record.artwork),
        },
      heroSummary: readString(record.hero_summary, record.heroSummary, record.summary),
      items,
      filters: mapFilterSet(record.filters, items),
      total: readNumber(record.total, record.item_count, record.itemCount, record.total_items, record.totalItems) ?? items.length,
    };
  },
};

export function mapMediaCard(raw: unknown): MediaCardSummary | null {
  const record = asRecord(raw);
  const id = readString(record.id, record.item_id, record.itemId);
  if (!id) {
    return null;
  }

  const kind = mapKind(readString(record.kind, record.media_type, record.mediaType, record.type));
  const seasonNumber = readNumber(
    record.season_number,
    record.seasonNumber,
    record.parent_index_number,
    record.parentIndexNumber,
    record.index_number,
    record.indexNumber,
  );
  const episodeNumber = readNumber(record.episode_number, record.episodeNumber, record.index_number, record.indexNumber);
  const title = normalizeCardTitle(kind, readString(record.title, record.name), seasonNumber);
  const year = readNumber(record.year, record.production_year, record.productionYear);
  const durationSeconds = readDurationSeconds(record);
  const progress = mapProgress(record.progress ?? record.user_data ?? record.userData, durationSeconds);
  const seriesName = readString(record.series_name, record.seriesName);
  const seasonName = normalizeSeasonLabel(
    readString(record.season_name, record.seasonName),
    seasonNumber,
  );
  const subtitle = normalizeCardContextLabel(
    buildCardSubtitle(kind, record, seriesName, seasonName),
  );
  const communityRating =
    readNumber(record.community_rating, record.communityRating) ??
    readNumber(record.series_community_rating, record.seriesCommunityRating);

  return {
    id,
    playbackTargetId:
      readString(record.playback_target_id, record.playbackTargetId, record.resume_target_id, record.resumeTargetId) ??
      undefined,
    title,
    subtitle,
    description: readString(record.description, record.summary, record.overview),
    availabilityNotice:
      readString(record.availability_notice, record.availabilityNotice) ?? undefined,
    kind,
    kindLabel: mapKindLabel(readString(record.kind, record.media_type, record.mediaType, record.type)),
    year,
    durationSeconds,
    itemCount: readNumber(record.episode_count, record.episodeCount, record.child_count, record.childCount),
    resolutionLabel:
      readString(record.resolution_label, record.resolution, record.display_resolution) ??
      buildResolutionLabelFromDimensions(
        readNumber(record.width, record.video_width, record.videoWidth),
        readNumber(record.height, record.video_height, record.videoHeight),
      ),
    ratingLabel:
      communityRating?.toFixed(1) ??
      readString(record.rating_label, record.ratingLabel, record.official_rating),
    addedAt: readString(record.added_at, record.addedAt, record.created_at, record.createdAt),
    lastPlayedAt: readString(record.last_played_at, record.lastPlayedAt, record.played_at, record.playedAt),
    libraryId: readString(record.library_id, record.libraryId),
    libraryName: readString(record.library_name, record.libraryName),
    seriesId: readString(record.series_id, record.seriesId),
    seriesName,
    seasonId: readString(record.season_id, record.seasonId),
    seasonName,
    seasonNumber: seasonNumber ?? undefined,
    episodeNumber: episodeNumber ?? undefined,
    tags: readStringArray(record.tags),
    artwork: mapArtwork(record.artwork ?? record.images ?? record, { itemId: id }),
    progress: progress ?? undefined,
    badge: readString(
      record.badge,
      record.dynamic_range_label,
      record.dynamicRangeLabel,
      record.status_label,
      record.statusLabel,
    ),
    hasPlayableSource: readBoolean(record.has_playable_source, record.hasPlayableSource) ?? false,
  };
}

function mapLibrary(raw: unknown): LibrarySummary | null {
  const record = asRecord(raw);
  const id = readString(record.id, record.library_id, record.libraryId);
  if (!id) {
    return null;
  }

  return {
    id,
    name: readString(record.name, record.title) ?? '未命名媒体库',
    typeLabel:
      readString(record.type_label, record.typeLabel, record.kind_label, record.kindLabel) ??
      mapLibraryTypeLabel(readString(record.library_type, record.libraryType)),
    description: readString(record.description, record.summary, record.overview),
    itemCount: readNumber(record.item_count, record.itemCount, record.total_items, record.totalItems) ?? 0,
    updatedAt: readString(record.updated_at, record.updatedAt, record.last_indexed_at, record.lastIndexedAt),
    accentLabel:
      readString(record.accent_label, record.accentLabel) ??
      buildLibraryAccentLabel(readNumber(record.source_count, record.sourceCount)),
    artwork: mapArtwork(record.artwork ?? record.images ?? record),
  };
}

function mapFilterSet(raw: unknown, items: MediaCardSummary[]) {
  const record = asRecord(raw);
  const defaultMediaTypes = [
    { value: 'all', label: '全部类型' },
    ...collectUniqueOptions(
      items.map((item) => [item.kind, item.kindLabel] as const),
    ),
  ];
  const defaultResolutions = [
    { value: 'all', label: '全部清晰度' },
    ...collectUniqueOptions(
      items
        .filter((item) => Boolean(item.resolutionLabel))
        .map((item) => [item.resolutionLabel ?? '', item.resolutionLabel ?? ''] as const),
    ),
  ];

  return {
    mediaTypes: mapFilterOptions(record.media_types ?? record.mediaTypes, defaultMediaTypes),
    resolutions: mapFilterOptions(record.resolutions, defaultResolutions),
    watchedStates: mapFilterOptions(record.watched_states ?? record.watchedStates, [
      { value: 'all', label: '全部状态' },
      { value: 'unfinished', label: '未看完' },
      { value: 'completed', label: '已看完' },
    ]),
    sortOptions: mapFilterOptions(record.sort_options ?? record.sortOptions, [
      { value: 'recent', label: '最近更新' },
      { value: 'title', label: '按标题' },
    ]),
  };
}

function mapHomeSection(raw: unknown) {
  const record = asRecord(raw);
  const id = readString(record.id);
  if (!id) {
    return null;
  }

  return {
    id,
    items: readArray(record.items, mapMediaCard),
  };
}

function buildResolutionLabelFromDimensions(width?: number, height?: number) {
  if (!width || !height) {
    return undefined;
  }

  const maxDimension = Math.max(width, height);
  const minDimension = Math.min(width, height);

  if (maxDimension >= 7680) {
    return '8K';
  }
  if (maxDimension >= 3840 || minDimension >= 2160) {
    return '4K';
  }
  if (maxDimension >= 2560 || minDimension >= 1440) {
    return '2K';
  }
  if (maxDimension >= 1920 || minDimension >= 1080) {
    return '1080P';
  }
  if (maxDimension >= 1280 || minDimension >= 720) {
    return '720P';
  }
  if (maxDimension >= 1024 || minDimension >= 576) {
    return '576P';
  }
  if (maxDimension >= 854 || minDimension >= 480) {
    return '480P';
  }

  return `${width}×${height}`;
}

function mapFilterOptions(raw: unknown, fallback: BrowseFilterOption[]): BrowseFilterOption[] {
  const items = readArray(raw, (item) => {
    const record = asRecord(item);
    const value = readString(record.value, record.id);
    if (!value) {
      return null;
    }
    return {
      value,
      label: readString(record.label, record.name, value) ?? value,
      count: readNumber(record.count),
    };
  });

  return items.length > 0 ? items : fallback;
}

function mapProgress(raw: unknown, durationSeconds?: number): MediaProgressSummary | null {
  const record = asRecord(raw);
  const totalDuration =
    durationSeconds ??
    readDurationSeconds(record) ??
    ticksToSeconds(record.duration_ticks ?? record.durationTicks ?? record.run_time_ticks ?? record.runTimeTicks);

  const positionSeconds =
    readNumber(record.position_seconds, record.positionSeconds, record.playback_position_seconds, record.playbackPositionSeconds) ??
    ticksToSeconds(record.position_ticks ?? record.positionTicks ?? record.playback_position_ticks ?? record.playbackPositionTicks) ??
    0;

  const explicitPercent = readNumber(record.progress_percent, record.progressPercent, record.played_percentage);
  const progressPercent =
    explicitPercent !== undefined
      ? clampProgress(explicitPercent)
      : totalDuration && totalDuration > 0
        ? clampProgress((positionSeconds / totalDuration) * 100)
        : 0;

  const completed =
    readBoolean(
      record.completed,
      record.is_completed,
      record.isCompleted,
      record.is_played,
      record.isPlayed,
      record.played,
    ) ?? progressPercent >= 95;

  if (positionSeconds <= 0 && !completed) {
    return null;
  }

  return {
    positionSeconds,
    durationSeconds: totalDuration ?? 0,
    progressPercent,
    completed,
    remainingLabel: readString(record.remaining_label, record.remainingLabel),
    lastPlayedAt: readString(record.last_played_at, record.lastPlayedAt, record.updated_at, record.updatedAt),
  };
}

function readDurationSeconds(record: Record<string, unknown>) {
  return (
    readNumber(record.duration_seconds, record.durationSeconds, record.runtime_seconds, record.runtimeSeconds) ??
    ticksToSeconds(
      record.duration_ticks ??
        record.durationTicks ??
        record.run_time_ticks ??
        record.runTimeTicks,
    )
  );
}

function buildMeta(item: MediaCardSummary) {
  const runtimeLabel =
    item.kind === 'series' || item.kind === 'season'
      ? item.itemCount
        ? `${item.itemCount} 集`
        : undefined
      : item.durationSeconds
        ? `${Math.max(1, Math.round(item.durationSeconds / 60))} 分钟`
        : undefined;

  return [
    item.year ? String(item.year) : undefined,
    item.kindLabel,
    runtimeLabel,
    item.resolutionLabel,
  ].filter((entry): entry is string => Boolean(entry));
}

function buildHeroActions(item: MediaCardSummary) {
  const playbackTargetId = resolvePlayableTargetId(item);
  if (playbackTargetId) {
    return {
      primaryActionLabel: item.progress ? '继续播放' : '立即播放',
      primaryActionTo: `/play/${playbackTargetId}`,
      secondaryActionLabel: '查看详情',
      secondaryActionTo: `/item/${item.id}`,
    };
  }

  return {
    primaryActionLabel: '查看详情',
    primaryActionTo: `/item/${item.id}`,
    secondaryActionLabel: undefined,
    secondaryActionTo: undefined,
  };
}

function resolvePlayableTargetId(item: MediaCardSummary) {
  if (item.availabilityNotice) {
    return undefined;
  }

  return item.playbackTargetId ?? (item.hasPlayableSource ? item.id : undefined);
}

function buildLibraryAccentLabel(sourceCount?: number) {
  if (!sourceCount || sourceCount <= 0) {
    return undefined;
  }
  return `${sourceCount} 个数据源`;
}

function collectUniqueOptions(entries: ReadonlyArray<readonly [string, string]>) {
  const seen = new Set<string>();
  const options: BrowseFilterOption[] = [];
  for (const [value, label] of entries) {
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    options.push({ value, label });
  }
  return options;
}

function mapLibraryTypeLabel(raw?: string) {
  const normalized = (raw ?? '').trim().toLowerCase();
  switch (normalized) {
    case 'movie':
      return '电影库';
    case 'series':
      return '剧集库';
    case 'music':
      return '音乐库';
    default:
      return '媒体库';
  }
}

function mapKind(raw?: string): MediaKind {
  const normalized = (raw ?? '').trim().toLowerCase();
  switch (normalized) {
    case 'movie':
      return 'movie';
    case 'series':
      return 'series';
    case 'season':
      return 'season';
    case 'episode':
      return 'episode';
    case 'music':
    case 'audio':
      return 'music';
    case 'collection':
    case 'library':
      return 'collection';
    case 'video':
      return 'video';
    default:
      return 'other';
  }
}

function mapKindLabel(raw?: string) {
  switch (mapKind(raw)) {
    case 'movie':
      return '电影';
    case 'series':
      return '剧集';
    case 'season':
      return '季度';
    case 'episode':
      return '剧集单集';
    case 'music':
      return '音乐';
    case 'collection':
      return '合集';
    case 'video':
      return '视频';
    default:
      return '内容';
  }
}

function normalizeCardTitle(kind: MediaKind, rawTitle: string | undefined, seasonNumber?: number | null) {
  if (kind === 'season') {
    return normalizeSeasonLabel(rawTitle, seasonNumber) ?? rawTitle ?? '未命名内容';
  }
  return rawTitle ?? '未命名内容';
}

function buildCardSubtitle(
  kind: MediaKind,
  record: Record<string, unknown>,
  seriesName?: string,
  seasonName?: string,
) {
  if (kind === 'season') {
    return seriesName ?? readString(record.subtitle, record.tagline);
  }
  if (kind === 'episode') {
    return (
      readString(record.subtitle, record.tagline) ??
      joinParts(seasonName, seriesName)
    );
  }
  return readString(record.subtitle, record.tagline, seriesName);
}

function normalizeCardContextLabel(rawLabel?: string) {
  const normalized = rawLabel
    ?.replace(/^(播放到|更新至)\s*/u, '')
    .replace(/\s+/gu, ' ')
    .trim();

  return normalized || undefined;
}

function normalizeSeasonLabel(rawLabel?: string, seasonNumber?: number | null) {
  if (seasonNumber && seasonNumber > 0) {
    return `第 ${seasonNumber} 季`;
  }
  const normalized = rawLabel?.trim();
  if (!normalized) {
    return undefined;
  }
  const digitMatch = normalized.match(/(?:第\s*)?(\d+)\s*季/u);
  if (digitMatch) {
    return `第 ${digitMatch[1]} 季`;
  }
  return normalized;
}

function joinParts(...values: Array<string | undefined>) {
  const parts = values.filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(' · ') : undefined;
}
