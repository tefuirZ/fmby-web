/**
 * @file Enum & Status Mappers
 * @description 枚举类型、状态字段映射
 */

import type {
  ManageMediaItemArtworkKind,
  ManageMediaItemMediaType,
  ManageMediaItemMetadataSourceType,
  ManageMediaItemMetadataStatus,
  ManageMediaItemMountStatus,
  ManageMediaItemSourceStatus,
} from '../types';

export function mapMediaType(raw?: string | null): ManageMediaItemMediaType {
  switch ((raw ?? '').trim().toLowerCase()) {
    case 'movie':
      return 'movie';
    case 'series':
      return 'series';
    case 'season':
      return 'season';
    case 'episode':
      return 'episode';
    case 'music':
      return 'music';
    case 'musicalbum':
    case 'music_album':
    case 'music-album':
      return 'music-album';
    case 'musicartist':
    case 'music_artist':
    case 'music-artist':
      return 'music-artist';
    default:
      return 'unknown';
  }
}

export function mapSourceStatus(raw?: string | null): ManageMediaItemSourceStatus {
  switch ((raw ?? '').trim().toLowerCase()) {
    case 'mounted':
      return 'mounted';
    // 二元真值：未知/旧后端其它值一律 fail-soft 落 missing（不伪造已知态）
    default:
      return 'missing';
  }
}

export function mapMountStatus(raw?: string | null): ManageMediaItemMountStatus {
  switch ((raw ?? '').trim().toLowerCase()) {
    case 'configured':
      return 'configured';
    case 'unavailable':
      return 'unavailable';
    case 'maintenance':
      return 'maintenance';
    case 'verified':
      return 'verified';
    default:
      return 'missing';
  }
}

export function mapMetadataStatus(raw?: string | null): ManageMediaItemMetadataStatus {
  switch ((raw ?? '').trim().toLowerCase()) {
    case 'identified':
      return 'identified';
    default:
      return 'missing';
  }
}

export function mapMetadataSourceType(raw?: string | null): ManageMediaItemMetadataSourceType {
  switch ((raw ?? '').trim().toLowerCase()) {
    case 'nfo':
      return 'nfo';
    case 'manual':
      return 'manual';
    case 'scraped':
      return 'scraped';
    default:
      return 'unknown';
  }
}

export function assertArtworkKind(value: string): ManageMediaItemArtworkKind {
  switch (value) {
    case 'poster':
    case 'backdrop':
    case 'thumb':
      return value;
    default:
      return 'poster';
  }
}

export function mapMediaTypeToApi(value: ManageMediaItemMediaType) {
  switch (value) {
    case 'music-album':
      return 'music_album';
    case 'music-artist':
      return 'music_artist';
    default:
      return value;
  }
}

export function mapSourceStatusToApi(value: ManageMediaItemSourceStatus) {
  // 二元词表两个值都直发（missing 不再抑制：/api/search 白名单含 missing，
  // query_mapping.rs:49-52；media-items 筛选参数后端在途）。
  return value;
}

export function mapMetadataStatusToApi(value: ManageMediaItemMetadataStatus) {
  // /api/search 白名单含 identified/missing（query_mapping.rs:61-66）⇒ 直发。
  return value;
}
