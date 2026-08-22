import { httpClient } from '@fmby/v2-shared/api/client';
import {
  asRecord,
  readArray,
  readBoolean,
  readNumber,
  readString,
  readStringArray,
} from '@fmby/v2-shared/api/mapping';
import { mapArtwork } from '@fmby/v2-shared/contracts/assets';
import { mapMediaCard } from '@fmby/v2-shared/contracts/browse/api';
import type { MediaCardSummary } from '@fmby/v2-shared/contracts/browse';
import type {
  ItemActor,
  ItemDetailResponse,
  ItemStreamInfo,
  ItemTechnicalInfo,
  ItemVersion,
} from './types';

interface RawListResponse<T> {
  items?: T[];
  total?: number;
}

export const itemApi = {
  async getDetail(itemId: string): Promise<ItemDetailResponse> {
    const raw = await httpClient.get<unknown>(`/api/items/${itemId}`);
    return mapItemDetail(raw, itemId);
  },

  async getDescendants(itemId: string, limit = 100): Promise<MediaCardSummary[]> {
    const raw = await httpClient.get<RawListResponse<unknown>>(
      `/api/items/${itemId}/descendants`,
      {
        params: {
          page: 1,
          pageSize: limit,
        },
      },
    );
    return readArray(raw.items, mapMediaCard);
  },
};

function mapItemDetail(raw: unknown, itemId: string): ItemDetailResponse {
  const record = asRecord(raw);
  const itemRecord = asRecord(record.item ?? raw);
  const metadataExtras = asRecord(record.metadata_extras ?? record.metadataExtras);
  const itemWithProgress = {
    ...itemRecord,
    progress: record.playback_progress ?? itemRecord.progress,
  };
  const sources = readArray(record.sources ?? record.media_sources ?? record.mediaSources, (item) =>
    asRecord(item),
  );
  const assets = readArray(record.assets, (item) => asRecord(item));
  const primarySource = sources[0];
  const subtitleCount = assets.filter(
    (asset) => readString(asset.asset_type, asset.assetType) === 'subtitle',
  ).length;
  const baseCard: MediaCardSummary = mapMediaCard(itemWithProgress) ?? {
    id: itemId,
    playbackTargetId: undefined,
    title: readString(itemRecord.title, itemRecord.name) ?? '未命名内容',
    subtitle: undefined,
    description: readString(itemRecord.summary, itemRecord.description, itemRecord.overview),
    kind: 'other' as const,
    kindLabel: '内容',
    year: readNumber(itemRecord.year, itemRecord.production_year, itemRecord.productionYear),
    durationSeconds:
      readNumber(
        itemRecord.duration_seconds,
        itemRecord.durationSeconds,
        itemRecord.runtime_seconds,
        itemRecord.runtimeSeconds,
      ) ??
      undefined,
    resolutionLabel: readString(
      itemRecord.resolution_label,
      itemRecord.resolution,
      itemRecord.display_resolution,
    ),
    ratingLabel: readString(itemRecord.rating_label, itemRecord.ratingLabel, itemRecord.official_rating),
    addedAt: readString(itemRecord.added_at, itemRecord.addedAt, itemRecord.created_at, itemRecord.createdAt),
    lastPlayedAt: readString(
      itemRecord.last_played_at,
      itemRecord.lastPlayedAt,
      itemRecord.played_at,
      itemRecord.playedAt,
    ),
    libraryId: readString(itemRecord.library_id, itemRecord.libraryId),
    libraryName: readString(itemRecord.library_name, itemRecord.libraryName),
    seriesId: readString(itemRecord.series_id, itemRecord.seriesId),
    seriesName: readString(itemRecord.series_name, itemRecord.seriesName),
    seasonId: readString(itemRecord.season_id, itemRecord.seasonId),
    seasonName: readString(itemRecord.season_name, itemRecord.seasonName),
    seasonNumber: readNumber(itemRecord.season_number, itemRecord.seasonNumber) ?? undefined,
    episodeNumber: readNumber(itemRecord.episode_number, itemRecord.episodeNumber) ?? undefined,
    tags: readStringArray(itemRecord.tags),
    artwork: mapArtwork(itemRecord.artwork ?? itemRecord.images, { itemId }),
    progress: undefined,
    badge: undefined,
    itemCount: undefined,
    hasPlayableSource: false,
  };
  const hasPlaybackTarget = Boolean(baseCard.playbackTargetId);
  const hasDirectPlayableSource = sources.some((source) => {
    const status = readString(source.source_status, source.sourceStatus);
    return status === 'Playable' || status === 'PendingValidation';
  });

  const technical = mapTechnicalInfo(
    record.technical ??
      record.media_info ??
      record.mediaInfo ??
      (primarySource
        ? {
            ...primarySource,
            subtitle_count: subtitleCount,
          }
        : itemRecord),
  );
  const genres = readStringArray(itemRecord.genres);
  const directorPeople = readArray(
    metadataExtras.director_people ?? metadataExtras.directorPeople,
    mapActor,
  );
  const directorNames =
    directorPeople.length > 0
      ? directorPeople.map((person) => person.name)
      : readStringArray(metadataExtras.directors ?? itemRecord.directors);
  const adminShortcuts = readArray(record.admin_shortcuts ?? record.adminShortcuts, (item) => {
    const shortcut = asRecord(item);
    const label = readString(shortcut.label, shortcut.title);
    const to = readString(shortcut.to, shortcut.href);
    if (!label || !to) {
      return null;
    }
    return { label, to };
  });

  if (adminShortcuts.length === 0) {
    const libraryId = baseCard.libraryId;
    if (libraryId) {
      adminShortcuts.push(
        { label: '查看媒体库', to: '/manage/media/libraries' },
        { label: '查看媒体来源', to: '/manage/media/mounts' },
      );
    }
  }

  const meta = [
    baseCard.year ? String(baseCard.year) : undefined,
    baseCard.kindLabel,
    baseCard.durationSeconds ? `${Math.max(1, Math.round(baseCard.durationSeconds / 60))} 分钟` : undefined,
    baseCard.resolutionLabel,
    baseCard.ratingLabel,
  ].filter((entry): entry is string => Boolean(entry));

  const versions = readArray(
    record.versions ?? record.sources ?? record.media_sources ?? record.mediaSources,
    mapVersion,
  );
  if (versions.length === 0) {
    if (
      hasPlaybackTarget &&
      (baseCard.kind === 'series' || baseCard.kind === 'season')
    ) {
      versions.push({
        id: `${itemId}-aggregate-playback`,
        label: '自动选择可播放分集',
        summary: '当前条目本身不直接挂媒体源，播放时会自动定位到首个可播放分集。',
        selected: true,
        directPlay: false,
      });
    } else {
      versions.push({
        id: `${itemId}-default`,
        label: '默认版本',
        summary: technical.containerLabel
          ? `${technical.containerLabel} · ${technical.resolutionLabel ?? '自动识别'}`
          : technical.resolutionLabel,
        selected: true,
        directPlay: hasPlaybackTarget,
      });
    }
  }

  return {
    id: baseCard.id,
    playbackTargetId: baseCard.playbackTargetId,
    title: baseCard.title,
    kind: baseCard.kind,
    originalTitle: readString(
      metadataExtras.original_title,
      metadataExtras.originalTitle,
      itemRecord.original_title,
      itemRecord.originalTitle,
    ),
    tagline: readString(itemRecord.tagline, metadataExtras.tagline),
    description:
      readString(
        metadataExtras.overview,
        itemRecord.description,
        itemRecord.summary,
        itemRecord.overview,
        baseCard.description,
      ) ??
      '暂时还没有内容简介。',
    kindLabel: baseCard.kindLabel,
    year: baseCard.year,
    ratingLabel: baseCard.ratingLabel,
    communityRating: readNumber(
      metadataExtras.community_rating,
      metadataExtras.communityRating,
      itemRecord.community_rating,
      itemRecord.communityRating,
      itemRecord.series_community_rating,
      itemRecord.seriesCommunityRating,
    ),
    premiered: readString(
      metadataExtras.premiered,
      metadataExtras.premiere_date,
      itemRecord.premiered,
      itemRecord.premiere_date,
      itemRecord.premiereDate,
    ),
    seasonNumber: baseCard.seasonNumber,
    episodeNumber: baseCard.episodeNumber,
    itemCount:
      readNumber(
        itemRecord.child_count,
        itemRecord.childCount,
        itemRecord.episode_count,
        itemRecord.episodeCount,
        record.children_total,
      ) ?? undefined,
    runtimeSeconds: baseCard.durationSeconds,
    progress: baseCard.progress,
    artwork: baseCard.artwork,
    meta,
    genres,
    tags: baseCard.tags,
    directors: directorNames,
    directorPeople,
    actors: readArray(metadataExtras.actors ?? itemRecord.actors, mapActor),
    studios: readStringArray(metadataExtras.studios ?? itemRecord.studios),
    library:
      baseCard.libraryId || baseCard.libraryName
        ? {
            id: baseCard.libraryId ?? '',
            name: baseCard.libraryName ?? '媒体库',
          }
        : undefined,
    series:
      baseCard.seriesId || baseCard.seriesName
        ? {
            id: baseCard.seriesId ?? '',
            name: baseCard.seriesName ?? '所属剧集',
          }
        : undefined,
    season:
      baseCard.seasonId || baseCard.seasonName
        ? {
            id: baseCard.seasonId ?? '',
            name: baseCard.seasonName ?? '所属季度',
          }
        : undefined,
    technical,
    children: readArray(record.children, mapMediaCard),
    related: readArray(record.related_items ?? record.relatedItems, mapMediaCard),
    versions,
    adminShortcuts,
    canPlay:
      readBoolean(record.can_play, record.canPlay) ??
      (hasPlaybackTarget || hasDirectPlayableSource),
    primaryActionLabel:
      hasPlaybackTarget && (baseCard.kind === 'series' || baseCard.kind === 'season')
        ? baseCard.progress
          ? '继续上次分集'
          : '播放推荐分集'
        : baseCard.progress
          ? '继续播放'
          : '立即播放',
    secondaryActionLabel:
      readString(record.secondary_action_label, record.secondaryActionLabel) ?? '查看所在媒体库',
    lastPlayedAt: baseCard.lastPlayedAt,
    addedAt: baseCard.addedAt,
    sourceStatusLabel: technical.sourceStatusLabel ?? mapSourceStatusLabel(primarySource),
  };
}

function mapTechnicalInfo(raw: unknown): ItemTechnicalInfo {
  const record = asRecord(raw);
  const width = readNumber(record.width);
  const height = readNumber(record.height);
  const videoStreams = readArray(record.video_streams ?? record.videoStreams, mapStreamInfo);
  const audioStreams = readArray(record.audio_streams ?? record.audioStreams, mapStreamInfo);
  const subtitleStreams = readArray(
    record.subtitle_streams ?? record.subtitleStreams,
    mapStreamInfo,
  );
  const embeddedSubtitleCount = subtitleStreams.filter(
    (stream) => !stream.isExternal,
  ).length;
  const externalSubtitleCount = subtitleStreams.filter(
    (stream) => stream.isExternal,
  ).length;

  return {
    resolutionLabel:
      readString(record.resolution_label, record.resolution, record.display_resolution) ??
      (width && height ? `${width}×${height}` : undefined),
    containerLabel: readString(record.container_label, record.container, record.format),
    videoCodecLabel: readString(record.video_codec_label, record.video_codec, record.videoCodec),
    audioCodecLabel: readString(record.audio_codec_label, record.audio_codec, record.audioCodec),
    dynamicRangeLabel: readString(record.dynamic_range_label, record.dynamicRangeLabel, record.hdr_label, record.hdrLabel),
    audioTrackCount: readNumber(record.audio_track_count, record.audioTrackCount),
    subtitleCount: readNumber(record.subtitle_count, record.subtitleCount),
    embeddedSubtitleCount: embeddedSubtitleCount > 0 ? embeddedSubtitleCount : undefined,
    externalSubtitleCount: externalSubtitleCount > 0 ? externalSubtitleCount : undefined,
    bitrateLabel:
      readString(record.bitrate_label, record.bitrateLabel) ??
      formatBitrateLabel(readNumber(record.bitrate, record.bit_rate, record.bitRate)),
    sourceStatusLabel: readString(record.source_status_label, record.sourceStatusLabel, record.status_label, record.statusLabel),
    releaseGroup: readString(record.release_group, record.releaseGroup),
    videoStreams,
    audioStreams,
    subtitleStreams,
  };
}

function mapVersion(raw: unknown): ItemVersion | null {
  const record = asRecord(raw);
  const id = readString(record.id, record.media_source_id, record.mediaSourceId);
  if (!id) {
    return null;
  }

  return {
    id,
    label:
      readString(record.label, record.name, record.display_name, record.displayName, record.mount_name, record.mountName) ??
      '默认版本',
    summary: readString(record.summary, record.container, record.path_hint, record.pathHint, record.file_path, record.filePath),
    selected: readBoolean(record.selected, record.is_default, record.isDefault) ?? false,
    directPlay: readBoolean(record.direct_play, record.directPlay, record.supports_direct_play, record.supportsDirectPlay) ?? true,
  };
}

function mapSourceStatusLabel(raw: Record<string, unknown> | undefined) {
  if (!raw) {
    return undefined;
  }

  const status = readString(raw.source_status, raw.sourceStatus);
  switch (status) {
    case 'Playable':
      return '可直接播放';
    case 'PendingValidation':
      return '待校验';
    case 'Unreachable':
      return '来源不可达';
    case 'Unsupported':
      return '暂不支持';
    case 'AuthExpired':
      return '凭据过期';
    default:
      return undefined;
  }
}

function mapActor(raw: unknown): ItemActor | null {
  const record = asRecord(raw);
  const name = readString(record.name, record.title);
  if (!name) {
    return null;
  }

  return {
    id: readString(record.id, record.person_id, record.personId),
    name,
    role: readString(record.role, record.character),
    thumbUrl: readString(record.thumb_url, record.thumbUrl, record.image_url, record.imageUrl),
    profileUrl: readString(record.profile_url, record.profileUrl, record.profile),
  };
}

function mapStreamInfo(raw: unknown): ItemStreamInfo | null {
  const record = asRecord(raw);

  return {
    index: readNumber(record.index),
    codecName: readString(record.codec_name, record.codecName),
    codecTag: readString(record.codec_tag, record.codecTag),
    title: readString(record.title, record.display_title, record.displayTitle),
    language: readString(record.language),
    channels: readNumber(record.channels),
    channelLayout: readString(record.channel_layout, record.channelLayout),
    width: readNumber(record.width),
    height: readNumber(record.height),
    profile: readString(record.profile),
    bitRate: readNumber(record.bit_rate, record.bitRate),
    bitDepth: readNumber(record.bit_depth, record.bitDepth),
    pixelFormat: readString(record.pixel_format, record.pixelFormat),
    colorPrimaries: readString(record.color_primaries, record.colorPrimaries),
    colorSpace: readString(record.color_space, record.colorSpace),
    colorTransfer: readString(record.color_transfer, record.colorTransfer),
    aspectRatio: readString(record.aspect_ratio, record.aspectRatio),
    averageFrameRate: readNumber(record.average_frame_rate, record.averageFrameRate),
    realFrameRate: readNumber(record.real_frame_rate, record.realFrameRate),
    dynamicRangeLabel: readString(record.dynamic_range_label, record.dynamicRangeLabel),
    deliveryUrl: readString(record.delivery_url, record.deliveryUrl, record.stream_url, record.streamUrl),
    subtitleLocationType: readString(record.subtitle_location_type, record.subtitleLocationType),
    isExternal: readBoolean(record.is_external, record.isExternal) ?? false,
    isTextSubtitleStream:
      readBoolean(record.is_text_subtitle_stream, record.isTextSubtitleStream) ?? false,
    isDefault: readBoolean(record.is_default, record.isDefault) ?? false,
    isForced: readBoolean(record.is_forced, record.isForced) ?? false,
  };
}

function formatBitrateLabel(value?: number) {
  if (!value || value <= 0) {
    return undefined;
  }

  const megabits = value / 1_000_000;
  if (megabits >= 1) {
    return `${megabits.toFixed(megabits >= 10 ? 0 : 1)} Mbps`;
  }

  return `${Math.round(value / 1_000)} Kbps`;
}
