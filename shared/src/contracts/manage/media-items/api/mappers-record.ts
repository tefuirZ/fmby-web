/**
 * @file Media Item Record Mappers
 * @description 媒体项核心记录映射（list / summary / source / asset / artwork / subtitle）
 */

import { mapProviderTypeFromApi } from '../../provider-mapping';
import type {
  ManageMediaItemArtworkOverrideRecord,
  ManageMediaItemListRecord,
  ManageMediaItemRemoteAssetRecord,
  ManageMediaItemScrapedArtworkRecord,
  ManageMediaItemSourceRecord,
  ManageMediaItemSubtitleOverrideRecord,
  ManageMediaItemSummaryRecord,
} from '../types';
import { mapProbeStream } from './mappers-simple';
import {
  assertArtworkKind,
  mapMediaType,
  mapMetadataStatus,
  mapMountStatus,
  mapSourceStatus,
} from './mappers-enum';
import type {
  RawManageMediaItemArtworkOverrideRecord,
  RawManageMediaItemListRecord,
  RawManageMediaItemRemoteAssetRecord,
  RawManageMediaItemScrapedArtworkRecord,
  RawManageMediaItemSourceRecord,
  RawManageMediaItemSubtitleOverrideRecord,
  RawManageMediaItemSummaryRecord,
} from './types';

export function mapListRecord(raw: RawManageMediaItemListRecord): ManageMediaItemListRecord {
  return {
    id: raw.id,
    libraryId: raw.library_id,
    libraryName: raw.library_name,
    parentId: raw.parent_id ?? undefined,
    title: raw.title,
    originalTitle: raw.original_title ?? undefined,
    mediaType: mapMediaType(raw.media_type),
    typeLabel: raw.type_label,
    year: raw.year ?? undefined,
    seasonNumber: raw.season_number ?? undefined,
    episodeNumber: raw.episode_number ?? undefined,
    indexNumber: raw.index_number ?? undefined,
    seriesId: raw.series_id ?? undefined,
    seriesTitle: raw.series_title ?? undefined,
    seasonId: raw.season_id ?? undefined,
    seasonTitle: raw.season_title ?? undefined,
    posterUrl: raw.poster_url ?? undefined,
    sourceStatus: mapSourceStatus(raw.source_status),
    mountStatus: mapMountStatus(raw.mount_status),
    metadataStatus: mapMetadataStatus(raw.metadata_status),
    hasLocalOverride: raw.has_local_override,
    hasLocalMetadataOverride: raw.has_local_metadata_override,
    hasLocalArtworkOverride: raw.has_local_artwork_override,
    hasLocalSubtitleOverride: raw.has_local_subtitle_override,
    hasPoster: raw.has_poster,
    hasSubtitle: raw.has_subtitle,
    updatedAt: raw.updated_at,
    lastScanAt: raw.last_scan_at ?? undefined,
  };
}

export function mapSummaryRecord(raw: RawManageMediaItemSummaryRecord): ManageMediaItemSummaryRecord {
  return {
    id: raw.id,
    libraryId: raw.library_id,
    libraryName: raw.library_name,
    parentId: raw.parent_id ?? undefined,
    title: raw.title,
    originalTitle: raw.original_title ?? undefined,
    mediaType: mapMediaType(raw.media_type),
    typeLabel: raw.type_label,
    year: raw.year ?? undefined,
    overview: raw.overview ?? undefined,
    communityRating: raw.community_rating ?? undefined,
    seasonNumber: raw.season_number ?? undefined,
    episodeNumber: raw.episode_number ?? undefined,
    indexNumber: raw.index_number ?? undefined,
    seriesId: raw.series_id ?? undefined,
    seriesTitle: raw.series_title ?? undefined,
    seasonId: raw.season_id ?? undefined,
    seasonTitle: raw.season_title ?? undefined,
    posterUrl: raw.poster_url ?? undefined,
    backdropUrl: raw.backdrop_url ?? undefined,
    thumbUrl: raw.thumb_url ?? undefined,
    sourceStatus: mapSourceStatus(raw.source_status),
    mountStatus: mapMountStatus(raw.mount_status),
    metadataStatus: mapMetadataStatus(raw.metadata_status),
    metadataErrorMessage: raw.metadata_error_message ?? undefined,
    hasLocalOverride: raw.has_local_override,
    hasLocalMetadataOverride: raw.has_local_metadata_override,
    hasLocalArtworkOverride: raw.has_local_artwork_override,
    hasLocalSubtitleOverride: raw.has_local_subtitle_override,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    lastScanAt: raw.last_scan_at ?? undefined,
  };
}

export function mapSourceRecord(raw: RawManageMediaItemSourceRecord): ManageMediaItemSourceRecord {
  return {
    id: raw.id,
    mediaItemId: raw.media_item_id,
    mountId: raw.mount_id,
    mountName: raw.mount_name,
    providerType: mapProviderTypeFromApi(raw.provider_type),
    providerLabel: raw.provider_label,
    mountStatus: mapMountStatus(raw.mount_status),
    filePath: raw.file_path,
    sourceStatus: mapSourceStatus(raw.source_status),
    container: raw.container ?? undefined,
    sizeBytes: raw.size_bytes ?? undefined,
    durationTicks: raw.duration_ticks ?? undefined,
    bitrate: raw.bitrate ?? undefined,
    width: raw.width ?? undefined,
    height: raw.height ?? undefined,
    videoCodec: raw.video_codec ?? undefined,
    audioCodec: raw.audio_codec ?? undefined,
    dynamicRangeLabel: raw.dynamic_range_label ?? undefined,
    audioTrackCount: raw.audio_track_count ?? undefined,
    subtitleCount: raw.subtitle_count ?? undefined,
    releaseGroup: raw.release_group ?? undefined,
    videoStreams: (raw.video_streams ?? []).map(mapProbeStream),
    audioStreams: (raw.audio_streams ?? []).map(mapProbeStream),
    subtitleStreams: (raw.subtitle_streams ?? []).map(mapProbeStream),
    streamUrl: raw.stream_url,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export function mapRemoteAssetRecord(
  raw: RawManageMediaItemRemoteAssetRecord,
): ManageMediaItemRemoteAssetRecord {
  return {
    id: raw.id,
    mediaItemId: raw.media_item_id,
    assetType: raw.asset_type,
    assetTypeLabel: raw.asset_type_label,
    language: raw.language ?? undefined,
    isCached: raw.is_cached,
    cachePath: raw.cache_path ?? undefined,
    filePath: raw.file_path,
    mountId: raw.mount_id ?? undefined,
    mountName: raw.mount_name ?? undefined,
    providerType: raw.provider_type ? mapProviderTypeFromApi(raw.provider_type) : undefined,
    url: raw.url,
    createdAt: raw.created_at,
  };
}

export function mapArtworkOverrideRecord(
  raw: RawManageMediaItemArtworkOverrideRecord,
): ManageMediaItemArtworkOverrideRecord {
  return {
    id: raw.id,
    artworkKind: assertArtworkKind(raw.artwork_kind),
    url: raw.url,
    storagePath: raw.storage_path,
    originalFilename: raw.original_filename,
    mimeType: raw.mime_type,
    sizeBytes: raw.size_bytes,
    width: raw.width ?? undefined,
    height: raw.height ?? undefined,
    isActive: raw.is_active,
    createdBy: raw.created_by,
    createdByUsername: raw.created_by_username ?? undefined,
    createdByDisplayName: raw.created_by_display_name ?? undefined,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export function mapScrapedArtworkRecord(
  raw: RawManageMediaItemScrapedArtworkRecord,
): ManageMediaItemScrapedArtworkRecord {
  return {
    kind: raw.kind,
    url: raw.url,
    language: raw.language ?? undefined,
    width: raw.width ?? undefined,
    height: raw.height ?? undefined,
  };
}

export function mapSubtitleOverrideRecord(
  raw: RawManageMediaItemSubtitleOverrideRecord,
): ManageMediaItemSubtitleOverrideRecord {
  return {
    id: raw.id,
    url: raw.url,
    storagePath: raw.storage_path,
    originalFilename: raw.original_filename,
    mimeType: raw.mime_type,
    subtitleFormat: raw.subtitle_format,
    language: raw.language ?? undefined,
    isActive: raw.is_active,
    isDefault: raw.is_default,
    sortOrder: raw.sort_order,
    createdBy: raw.created_by,
    createdByUsername: raw.created_by_username ?? undefined,
    createdByDisplayName: raw.created_by_display_name ?? undefined,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}
