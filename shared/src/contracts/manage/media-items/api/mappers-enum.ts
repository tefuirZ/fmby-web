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
    case 'pendingvalidation':
    case 'pending_validation':
    case 'pending-validation':
      return 'pending-validation';
    case 'playable':
      return 'playable';
    case 'unreachable':
      return 'unreachable';
    case 'unsupported':
      return 'unsupported';
    case 'authexpired':
    case 'auth_expired':
    case 'auth-expired':
      return 'auth-expired';
    default:
      return 'missing';
  }
}

export function mapMountStatus(raw?: string | null): ManageMediaItemMountStatus {
  switch ((raw ?? '').trim().toLowerCase()) {
    case 'active':
      return 'active';
    case 'unreachable':
      return 'unreachable';
    case 'disabled':
      return 'disabled';
    default:
      return 'missing';
  }
}

export function mapMetadataStatus(raw?: string | null): ManageMediaItemMetadataStatus {
  switch ((raw ?? '').trim().toLowerCase()) {
    case 'pending':
      return 'pending';
    case 'success':
      return 'success';
    case 'failed':
    case 'failure':
      return 'failed';
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
  switch (value) {
    case 'pending-validation':
      return 'pending_validation';
    case 'auth-expired':
      return 'auth_expired';
    case 'missing':
      return undefined;
    default:
      return value;
  }
}

export function mapMountStatusToApi(value: ManageMediaItemMountStatus) {
  return value === 'missing' ? undefined : value;
}

export function mapMetadataStatusToApi(value: ManageMediaItemMetadataStatus) {
  return value === 'missing' ? 'missing' : value;
}
