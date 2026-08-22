/**
 * @file Metadata & Pipeline Mappers
 * @description 元数据、流水线、刮削相关复合记录映射
 */

import type {
  ManageMediaItemDetailRecord,
  ManageMediaItemIdentifyTaskRecord,
  ManageMediaItemIdentityBindingRecord,
  ManageMediaItemLocalMetadataOverrideRecord,
  ManageMediaItemMetadataStateRecord,
  ManageMediaItemPipelineRecord,
  ManageMediaItemRemoteMetadataRecord,
  ManageMediaItemScrapeTaskRecord,
  RequestManageMediaItemScrapeResult,
} from '../types';
import { mapMetadata } from './mappers-simple';
import {
  mapArtworkOverrideRecord,
  mapRemoteAssetRecord,
  mapScrapedArtworkRecord,
  mapSourceRecord,
  mapSubtitleOverrideRecord,
  mapSummaryRecord,
} from './mappers-record';
import { mapMetadataSourceType, mapMetadataStatus } from './mappers-enum';
import type {
  RawManageMediaItemDetailRecord,
  RawManageMediaItemIdentifyTaskRecord,
  RawManageMediaItemIdentityBindingRecord,
  RawManageMediaItemLocalMetadataOverrideRecord,
  RawManageMediaItemMetadataStateRecord,
  RawManageMediaItemPipelineRecord,
  RawManageMediaItemRemoteMetadataRecord,
  RawManageMediaItemScrapeTaskRecord,
  RawRequestManageMediaItemScrapeResponse,
} from './types';

export function mapRemoteMetadataRecord(
  raw: RawManageMediaItemRemoteMetadataRecord,
): ManageMediaItemRemoteMetadataRecord {
  return {
    sourceType: mapMetadataSourceType(raw.source_type),
    parsedAt: raw.parsed_at ?? undefined,
    updatedAt: raw.updated_at,
    metadata: mapMetadata(raw.metadata),
  };
}

export function mapLocalOverrideRecord(
  raw: RawManageMediaItemLocalMetadataOverrideRecord,
): ManageMediaItemLocalMetadataOverrideRecord {
  return {
    updatedBy: raw.updated_by,
    updatedByUsername: raw.updated_by_username ?? undefined,
    updatedByDisplayName: raw.updated_by_display_name ?? undefined,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    metadata: mapMetadata(raw.metadata),
  };
}

export function mapMetadataStateRecord(
  raw: RawManageMediaItemMetadataStateRecord,
): ManageMediaItemMetadataStateRecord {
  return {
    status: mapMetadataStatus(raw.status),
    errorMessage: raw.error_message ?? undefined,
    parsedAt: raw.parsed_at ?? undefined,
    updatedAt: raw.updated_at ?? undefined,
    hasRemoteMetadata: raw.has_remote_metadata,
    hasLocalOverride: raw.has_local_override,
  };
}

export function mapDetailRecord(raw: RawManageMediaItemDetailRecord): ManageMediaItemDetailRecord {
  return {
    item: mapSummaryRecord(raw.item),
    baseMetadata: mapMetadata(raw.base_metadata),
    effectiveMetadata: mapMetadata(raw.effective_metadata),
    remoteMetadata: raw.remote_metadata ? mapRemoteMetadataRecord(raw.remote_metadata) : undefined,
    scrapedMetadata: raw.scraped_metadata ? mapMetadata(raw.scraped_metadata) : undefined,
    scrapedArtworks: (raw.scraped_artworks ?? []).map(mapScrapedArtworkRecord),
    localMetadataOverride: raw.local_metadata_override
      ? mapLocalOverrideRecord(raw.local_metadata_override)
      : undefined,
    metadataStatus: mapMetadataStateRecord(raw.metadata_status),
    sources: (raw.sources ?? []).map(mapSourceRecord),
    remoteAssets: (raw.remote_assets ?? []).map(mapRemoteAssetRecord),
    artworkOverrides: (raw.artwork_overrides ?? []).map(mapArtworkOverrideRecord),
    subtitleOverrides: (raw.subtitle_overrides ?? []).map(mapSubtitleOverrideRecord),
    latestMetadataRawContent: raw.latest_metadata_raw_content ?? undefined,
  };
}

export function mapIdentifyTaskRecord(
  raw: RawManageMediaItemIdentifyTaskRecord,
): ManageMediaItemIdentifyTaskRecord {
  return {
    id: raw.id,
    status: raw.status,
    requestReason: raw.request_reason ?? undefined,
    attemptCount: raw.attempt_count,
    nextRetryAt: raw.next_retry_at ?? undefined,
    lastError: raw.last_error ?? undefined,
    updatedAt: raw.updated_at ?? undefined,
  };
}

export function mapIdentityBindingRecord(
  raw: RawManageMediaItemIdentityBindingRecord,
): ManageMediaItemIdentityBindingRecord {
  return {
    id: raw.id,
    provider: raw.provider,
    entityType: raw.entity_type,
    providerItemId: raw.provider_item_id,
    state: raw.state,
    matchMethod: raw.match_method,
    confidence: raw.confidence ?? undefined,
    isLocked: raw.is_locked,
    updatedAt: raw.updated_at,
  };
}

export function mapScrapeTaskRecord(
  raw: RawManageMediaItemScrapeTaskRecord,
): ManageMediaItemScrapeTaskRecord {
  return {
    id: raw.id,
    status: raw.status,
    provider: raw.provider,
    entityType: raw.entity_type,
    bindingId: raw.binding_id,
    requestReason: raw.request_reason,
    fingerprint: raw.fingerprint,
    forceRefresh: raw.force_refresh,
    attemptCount: raw.attempt_count,
    maxAttempts: raw.max_attempts,
    nextRetryAt: raw.next_retry_at ?? undefined,
    lastError: raw.last_error ?? undefined,
    resultSnapshotId: raw.result_snapshot_id ?? undefined,
    updatedAt: raw.updated_at,
  };
}

export function mapPipelineRecord(
  raw: RawManageMediaItemPipelineRecord,
): ManageMediaItemPipelineRecord {
  return {
    itemId: raw.item_id,
    identifyTask: raw.identify_task ? mapIdentifyTaskRecord(raw.identify_task) : undefined,
    identityBinding: raw.identity_binding
      ? mapIdentityBindingRecord(raw.identity_binding)
      : undefined,
    scrapeTask: raw.scrape_task ? mapScrapeTaskRecord(raw.scrape_task) : undefined,
    currentMetadataSource: raw.current_metadata_source,
    reviewStatus: raw.review_status ?? undefined,
  };
}

export function mapScrapeResponse(
  raw: RawRequestManageMediaItemScrapeResponse,
): RequestManageMediaItemScrapeResult {
  return {
    itemId: raw.item_id,
    taskId: raw.task_id,
    outcome: raw.outcome,
    status: raw.status,
    fingerprint: raw.fingerprint,
  };
}
