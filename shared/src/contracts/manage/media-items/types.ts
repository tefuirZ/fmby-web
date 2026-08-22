import type {
  ManageMountProviderType,
  ManageProbeTaskStreamRecord,
} from '../types';

export type ManageMediaItemMediaType =
  | 'movie'
  | 'series'
  | 'season'
  | 'episode'
  | 'music'
  | 'music-album'
  | 'music-artist'
  | 'unknown';

export type ManageMediaItemSourceStatus =
  | 'pending-validation'
  | 'playable'
  | 'unreachable'
  | 'unsupported'
  | 'auth-expired'
  | 'missing';

export type ManageMediaItemMountStatus =
  | 'active'
  | 'unreachable'
  | 'disabled'
  | 'missing';

export type ManageMediaItemMetadataStatus =
  | 'pending'
  | 'success'
  | 'failed'
  | 'missing';

export type ManageMediaItemMetadataSourceType =
  | 'nfo'
  | 'manual'
  | 'scraped'
  | 'unknown';

export type ManageMediaItemSortOrder = 'asc' | 'desc';
export type ManageMediaItemArtworkKind = 'poster' | 'backdrop' | 'thumb';

export interface ManageMediaItemsQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  libraryId?: string;
  mediaType?: ManageMediaItemMediaType;
  sourceStatus?: ManageMediaItemSourceStatus;
  mountStatus?: ManageMediaItemMountStatus;
  metadataStatus?: ManageMediaItemMetadataStatus;
  hasLocalOverride?: boolean;
  hasPoster?: boolean;
  hasSubtitle?: boolean;
  sortBy?: string;
  sortOrder?: ManageMediaItemSortOrder;
}

export interface ManageMediaPerson {
  name: string;
  role?: string;
  thumbUrl?: string;
  profile?: string;
}

export interface ManageMediaExternalId {
  provider: string;
  id: string;
}

export interface ManageMediaItemMetadataRecord {
  title?: string;
  originalTitle?: string;
  sortTitle?: string;
  year?: number;
  overview?: string;
  communityRating?: number;
  genres: string[];
  directors: string[];
  actors: ManageMediaPerson[];
  studios: string[];
  premiered?: string;
  externalIds: ManageMediaExternalId[];
}

export interface ManageMediaItemListRecord {
  id: string;
  libraryId: string;
  libraryName: string;
  parentId?: string;
  title: string;
  originalTitle?: string;
  mediaType: ManageMediaItemMediaType;
  typeLabel: string;
  year?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  indexNumber?: number;
  seriesId?: string;
  seriesTitle?: string;
  seasonId?: string;
  seasonTitle?: string;
  posterUrl?: string;
  sourceStatus: ManageMediaItemSourceStatus;
  mountStatus: ManageMediaItemMountStatus;
  metadataStatus: ManageMediaItemMetadataStatus;
  hasLocalOverride: boolean;
  hasLocalMetadataOverride: boolean;
  hasLocalArtworkOverride: boolean;
  hasLocalSubtitleOverride: boolean;
  hasPoster: boolean;
  hasSubtitle: boolean;
  updatedAt: string;
  lastScanAt?: string;
}

export interface ManageMediaItemsResponse {
  items: ManageMediaItemListRecord[];
  total: number;
}

export interface ManageMediaItemRemoteMetadataRecord {
  sourceType: ManageMediaItemMetadataSourceType;
  parsedAt?: string;
  updatedAt: string;
  metadata: ManageMediaItemMetadataRecord;
}

export interface ManageMediaItemLocalMetadataOverrideRecord {
  updatedBy: string;
  updatedByUsername?: string;
  updatedByDisplayName?: string;
  createdAt: string;
  updatedAt: string;
  metadata: ManageMediaItemMetadataRecord;
}

export interface ManageMediaItemMetadataStateRecord {
  status: ManageMediaItemMetadataStatus;
  errorMessage?: string;
  parsedAt?: string;
  updatedAt?: string;
  hasRemoteMetadata: boolean;
  hasLocalOverride: boolean;
}

export interface ManageMediaItemSourceRecord {
  id: string;
  mediaItemId: string;
  mountId: string;
  mountName: string;
  providerType: ManageMountProviderType;
  providerLabel: string;
  mountStatus: ManageMediaItemMountStatus;
  filePath: string;
  sourceStatus: ManageMediaItemSourceStatus;
  container?: string;
  sizeBytes?: number;
  durationTicks?: number;
  bitrate?: number;
  width?: number;
  height?: number;
  videoCodec?: string;
  audioCodec?: string;
  dynamicRangeLabel?: string;
  audioTrackCount?: number;
  subtitleCount?: number;
  releaseGroup?: string;
  videoStreams: ManageProbeTaskStreamRecord[];
  audioStreams: ManageProbeTaskStreamRecord[];
  subtitleStreams: ManageProbeTaskStreamRecord[];
  streamUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface ManageMediaItemRemoteAssetRecord {
  id: string;
  mediaItemId: string;
  assetType: string;
  assetTypeLabel: string;
  language?: string;
  isCached: boolean;
  cachePath?: string;
  filePath: string;
  mountId?: string;
  mountName?: string;
  providerType?: ManageMountProviderType;
  url: string;
  createdAt: string;
}

export interface ManageMediaItemArtworkOverrideRecord {
  id: string;
  artworkKind: ManageMediaItemArtworkKind;
  url: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  isActive: boolean;
  createdBy: string;
  createdByUsername?: string;
  createdByDisplayName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ManageMediaItemScrapedArtworkRecord {
  kind: string;
  url: string;
  language?: string;
  width?: number;
  height?: number;
}

export interface ManageMediaItemSubtitleOverrideRecord {
  id: string;
  url: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  subtitleFormat: string;
  language?: string;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  createdBy: string;
  createdByUsername?: string;
  createdByDisplayName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ManageMediaItemSummaryRecord {
  id: string;
  libraryId: string;
  libraryName: string;
  parentId?: string;
  title: string;
  originalTitle?: string;
  mediaType: ManageMediaItemMediaType;
  typeLabel: string;
  year?: number;
  overview?: string;
  communityRating?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  indexNumber?: number;
  seriesId?: string;
  seriesTitle?: string;
  seasonId?: string;
  seasonTitle?: string;
  posterUrl?: string;
  backdropUrl?: string;
  thumbUrl?: string;
  sourceStatus: ManageMediaItemSourceStatus;
  mountStatus: ManageMediaItemMountStatus;
  metadataStatus: ManageMediaItemMetadataStatus;
  metadataErrorMessage?: string;
  hasLocalOverride: boolean;
  hasLocalMetadataOverride: boolean;
  hasLocalArtworkOverride: boolean;
  hasLocalSubtitleOverride: boolean;
  createdAt: string;
  updatedAt: string;
  lastScanAt?: string;
}

export interface ManageMediaItemDetailRecord {
  item: ManageMediaItemSummaryRecord;
  baseMetadata: ManageMediaItemMetadataRecord;
  effectiveMetadata: ManageMediaItemMetadataRecord;
  remoteMetadata?: ManageMediaItemRemoteMetadataRecord;
  /** 来自刮削源（metadata_cache.source_type='Scraped'）的元数据快照，仅在 Active 身份绑定存在时返回。 */
  scrapedMetadata?: ManageMediaItemMetadataRecord;
  scrapedArtworks: ManageMediaItemScrapedArtworkRecord[];
  localMetadataOverride?: ManageMediaItemLocalMetadataOverrideRecord;
  metadataStatus: ManageMediaItemMetadataStateRecord;
  sources: ManageMediaItemSourceRecord[];
  remoteAssets: ManageMediaItemRemoteAssetRecord[];
  artworkOverrides: ManageMediaItemArtworkOverrideRecord[];
  subtitleOverrides: ManageMediaItemSubtitleOverrideRecord[];
  latestMetadataRawContent?: string;
}

/**
 * Pipeline 视图：识别 / 绑定 / 刮削 任务卡 + 当前 metadata 来源 + 审核状态。
 *
 * 后端契约：`GET /api/manage/media-items/:id/pipeline` 返回 `ManagedMediaItemPipelineDto`。
 */
export interface ManageMediaItemIdentifyTaskRecord {
  id: string;
  status: string;
  requestReason?: string;
  attemptCount: number;
  nextRetryAt?: string;
  lastError?: string;
  updatedAt?: string;
}

export interface ManageMediaItemIdentityBindingRecord {
  id: string;
  provider: string;
  entityType: string;
  providerItemId: string;
  state: string;
  matchMethod: string;
  confidence?: number;
  isLocked: boolean;
  updatedAt: string;
}

export interface ManageMediaItemScrapeTaskRecord {
  id: string;
  status: string;
  provider: string;
  entityType: string;
  bindingId: string;
  requestReason: string;
  fingerprint: string;
  forceRefresh: boolean;
  attemptCount: number;
  maxAttempts: number;
  nextRetryAt?: string;
  lastError?: string;
  resultSnapshotId?: string;
  updatedAt: string;
}

export interface ManageMediaItemPipelineRecord {
  itemId: string;
  identifyTask?: ManageMediaItemIdentifyTaskRecord;
  identityBinding?: ManageMediaItemIdentityBindingRecord;
  scrapeTask?: ManageMediaItemScrapeTaskRecord;
  currentMetadataSource: string;
  reviewStatus?: string;
}

/** 手动入队刮削请求体。 */
export interface RequestManageMediaItemScrapeOptions {
  /** 是否强制重新刮削（force_refresh=true，会重置已成功任务）。 */
  force?: boolean;
  /** 可选的入队原因备注，会落到任务 request_reason。 */
  reason?: string;
}

/** 手动入队刮削响应。 */
export interface RequestManageMediaItemScrapeResult {
  itemId: string;
  taskId: string;
  outcome: string;
  status: string;
  fingerprint: string;
}

export interface UpdateManageMediaPersonInput {
  name: string;
  role?: string;
  thumbUrl?: string;
  profile?: string;
}

export interface UpdateManageMediaItemMetadataRequest {
  title?: string;
  originalTitle?: string;
  sortTitle?: string;
  year?: number;
  overview?: string;
  communityRating?: number;
  genres?: string[];
  directors?: string[];
  actors?: UpdateManageMediaPersonInput[];
  studios?: string[];
  premiered?: string;
}

export interface UploadManageMediaItemArtworkRequest {
  artworkKind: ManageMediaItemArtworkKind;
  file: File;
}

export interface UploadManageMediaItemSubtitleRequest {
  file: File;
  language?: string;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
}

export interface UpdateManageMediaItemSubtitleOverrideRequest {
  language?: string;
  isActive?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
}
