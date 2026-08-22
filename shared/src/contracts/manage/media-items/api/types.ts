/**
 * @file Internal Raw API Response Types
 * @description 仅供 api 内部使用的原始响应类型定义
 */

export interface RawListResponse<T> {
  items: T[];
  total: number;
}

export interface RawManageMediaPerson {
  name: string;
  role?: string | null;
  thumb_url?: string | null;
  profile?: string | null;
}

export interface RawManageMediaExternalId {
  provider: string;
  id: string;
}

export interface RawManageMediaItemMetadata {
  title?: string | null;
  original_title?: string | null;
  sort_title?: string | null;
  year?: number | null;
  overview?: string | null;
  community_rating?: number | null;
  genres?: string[] | null;
  directors?: string[] | null;
  actors?: RawManageMediaPerson[] | null;
  studios?: string[] | null;
  premiered?: string | null;
  external_ids?: RawManageMediaExternalId[] | null;
}

export interface RawManageMediaItemListRecord {
  id: string;
  library_id: string;
  library_name: string;
  parent_id?: string | null;
  title: string;
  original_title?: string | null;
  media_type: string;
  type_label: string;
  year?: number | null;
  season_number?: number | null;
  episode_number?: number | null;
  index_number?: number | null;
  series_id?: string | null;
  series_title?: string | null;
  season_id?: string | null;
  season_title?: string | null;
  poster_url?: string | null;
  source_status: string;
  mount_status: string;
  metadata_status: string;
  has_local_override: boolean;
  has_local_metadata_override: boolean;
  has_local_artwork_override: boolean;
  has_local_subtitle_override: boolean;
  has_poster: boolean;
  has_subtitle: boolean;
  updated_at: string;
  last_scan_at?: string | null;
}

export interface RawManageMediaItemRemoteMetadataRecord {
  source_type: string;
  parsed_at?: string | null;
  updated_at: string;
  metadata: RawManageMediaItemMetadata;
}

export interface RawManageMediaItemLocalMetadataOverrideRecord {
  updated_by: string;
  updated_by_username?: string | null;
  updated_by_display_name?: string | null;
  created_at: string;
  updated_at: string;
  metadata: RawManageMediaItemMetadata;
}

export interface RawManageMediaItemMetadataStateRecord {
  status: string;
  error_message?: string | null;
  parsed_at?: string | null;
  updated_at?: string | null;
  has_remote_metadata: boolean;
  has_local_override: boolean;
}

export interface RawManageProbeTaskStreamRecord {
  index?: number | null;
  codec_name?: string | null;
  codec_tag?: string | null;
  title?: string | null;
  language?: string | null;
  channels?: number | null;
  channel_layout?: string | null;
  width?: number | null;
  height?: number | null;
  profile?: string | null;
  bit_rate?: number | null;
  bit_depth?: number | null;
  pixel_format?: string | null;
  color_primaries?: string | null;
  color_space?: string | null;
  color_transfer?: string | null;
  aspect_ratio?: string | null;
  average_frame_rate?: number | null;
  real_frame_rate?: number | null;
  dynamic_range_label?: string | null;
  dv_version_major?: number | null;
  dv_version_minor?: number | null;
  dv_profile?: number | null;
  dv_level?: number | null;
  rpu_present_flag?: number | null;
  el_present_flag?: number | null;
  bl_present_flag?: number | null;
  dv_bl_signal_compatibility_id?: number | null;
  hdr10_plus_present_flag?: boolean | null;
  is_default?: boolean | null;
  is_forced?: boolean | null;
}

export interface RawManageMediaItemSourceRecord {
  id: string;
  media_item_id: string;
  mount_id: string;
  mount_name: string;
  provider_type: string;
  provider_label: string;
  mount_status: string;
  file_path: string;
  source_status: string;
  container?: string | null;
  size_bytes?: number | null;
  duration_ticks?: number | null;
  bitrate?: number | null;
  width?: number | null;
  height?: number | null;
  video_codec?: string | null;
  audio_codec?: string | null;
  dynamic_range_label?: string | null;
  audio_track_count?: number | null;
  subtitle_count?: number | null;
  release_group?: string | null;
  video_streams?: RawManageProbeTaskStreamRecord[] | null;
  audio_streams?: RawManageProbeTaskStreamRecord[] | null;
  subtitle_streams?: RawManageProbeTaskStreamRecord[] | null;
  stream_url: string;
  created_at: string;
  updated_at: string;
}

export interface RawManageMediaItemRemoteAssetRecord {
  id: string;
  media_item_id: string;
  asset_type: string;
  asset_type_label: string;
  language?: string | null;
  is_cached: boolean;
  cache_path?: string | null;
  file_path: string;
  mount_id?: string | null;
  mount_name?: string | null;
  provider_type?: string | null;
  url: string;
  created_at: string;
}

export interface RawManageMediaItemArtworkOverrideRecord {
  id: string;
  artwork_kind: string;
  url: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  width?: number | null;
  height?: number | null;
  is_active: boolean;
  created_by: string;
  created_by_username?: string | null;
  created_by_display_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RawManageMediaItemSubtitleOverrideRecord {
  id: string;
  url: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  subtitle_format: string;
  language?: string | null;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
  created_by: string;
  created_by_username?: string | null;
  created_by_display_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RawManageMediaItemScrapedArtworkRecord {
  kind: string;
  url: string;
  language?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface RawManageMediaItemSummaryRecord {
  id: string;
  library_id: string;
  library_name: string;
  parent_id?: string | null;
  title: string;
  original_title?: string | null;
  media_type: string;
  type_label: string;
  year?: number | null;
  overview?: string | null;
  community_rating?: number | null;
  season_number?: number | null;
  episode_number?: number | null;
  index_number?: number | null;
  series_id?: string | null;
  series_title?: string | null;
  season_id?: string | null;
  season_title?: string | null;
  poster_url?: string | null;
  backdrop_url?: string | null;
  thumb_url?: string | null;
  source_status: string;
  mount_status: string;
  metadata_status: string;
  metadata_error_message?: string | null;
  has_local_override: boolean;
  has_local_metadata_override: boolean;
  has_local_artwork_override: boolean;
  has_local_subtitle_override: boolean;
  created_at: string;
  updated_at: string;
  last_scan_at?: string | null;
}

export interface RawManageMediaItemDetailRecord {
  item: RawManageMediaItemSummaryRecord;
  base_metadata: RawManageMediaItemMetadata;
  effective_metadata: RawManageMediaItemMetadata;
  remote_metadata?: RawManageMediaItemRemoteMetadataRecord | null;
  scraped_metadata?: RawManageMediaItemMetadata | null;
  scraped_artworks?: RawManageMediaItemScrapedArtworkRecord[] | null;
  local_metadata_override?: RawManageMediaItemLocalMetadataOverrideRecord | null;
  metadata_status: RawManageMediaItemMetadataStateRecord;
  sources?: RawManageMediaItemSourceRecord[] | null;
  remote_assets?: RawManageMediaItemRemoteAssetRecord[] | null;
  artwork_overrides?: RawManageMediaItemArtworkOverrideRecord[] | null;
  subtitle_overrides?: RawManageMediaItemSubtitleOverrideRecord[] | null;
  latest_metadata_raw_content?: string | null;
}

export interface RawManageMediaItemIdentifyTaskRecord {
  id: string;
  status: string;
  request_reason?: string | null;
  attempt_count: number;
  next_retry_at?: string | null;
  last_error?: string | null;
  updated_at?: string | null;
}

export interface RawManageMediaItemIdentityBindingRecord {
  id: string;
  provider: string;
  entity_type: string;
  provider_item_id: string;
  state: string;
  match_method: string;
  confidence?: number | null;
  is_locked: boolean;
  updated_at: string;
}

export interface RawManageMediaItemScrapeTaskRecord {
  id: string;
  status: string;
  provider: string;
  entity_type: string;
  binding_id: string;
  request_reason: string;
  fingerprint: string;
  force_refresh: boolean;
  attempt_count: number;
  max_attempts: number;
  next_retry_at?: string | null;
  last_error?: string | null;
  result_snapshot_id?: string | null;
  updated_at: string;
}

export interface RawManageMediaItemPipelineRecord {
  item_id: string;
  identify_task?: RawManageMediaItemIdentifyTaskRecord | null;
  identity_binding?: RawManageMediaItemIdentityBindingRecord | null;
  scrape_task?: RawManageMediaItemScrapeTaskRecord | null;
  current_metadata_source: string;
  review_status?: string | null;
}

export interface RawRequestManageMediaItemScrapeResponse {
  item_id: string;
  task_id: string;
  outcome: string;
  status: string;
  fingerprint: string;
}
