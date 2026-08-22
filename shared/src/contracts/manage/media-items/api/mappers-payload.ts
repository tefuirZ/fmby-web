/**
 * @file ToApi Mappers (Payload Builders)
 * @description 领域模型 → API 请求体映射（query params / form data / request body）
 */

import type {
  ManageMediaItemsQuery,
  UpdateManageMediaItemMetadataRequest,
  UpdateManageMediaItemSubtitleOverrideRequest,
  UploadManageMediaItemArtworkRequest,
  UploadManageMediaItemSubtitleRequest,
} from '../types';
import {
  mapMediaTypeToApi,
  mapMetadataStatusToApi,
  mapMountStatusToApi,
  mapSourceStatusToApi,
} from './mappers-enum';

export function mapQueryParams(query?: ManageMediaItemsQuery) {
  if (!query) {
    return undefined;
  }

  return {
    page: query.page,
    pageSize: query.pageSize,
    keyword: query.keyword,
    libraryId: query.libraryId,
    mediaType: query.mediaType ? mapMediaTypeToApi(query.mediaType) : undefined,
    sourceStatus: query.sourceStatus ? mapSourceStatusToApi(query.sourceStatus) : undefined,
    mountStatus: query.mountStatus ? mapMountStatusToApi(query.mountStatus) : undefined,
    metadataStatus: query.metadataStatus ? mapMetadataStatusToApi(query.metadataStatus) : undefined,
    hasLocalOverride: query.hasLocalOverride,
    hasPoster: query.hasPoster,
    hasSubtitle: query.hasSubtitle,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  };
}

export function mapUpdatePayloadToApi(payload: UpdateManageMediaItemMetadataRequest) {
  return {
    title: payload.title,
    original_title: payload.originalTitle,
    sort_title: payload.sortTitle,
    year: payload.year,
    overview: payload.overview,
    community_rating: payload.communityRating,
    genres: payload.genres,
    directors: payload.directors,
    actors: payload.actors?.map((actor) => ({
      name: actor.name,
      role: actor.role,
      thumb_url: actor.thumbUrl,
      profile: actor.profile,
    })),
    studios: payload.studios,
    premiered: payload.premiered,
  };
}

export function buildArtworkUploadFormData(payload: UploadManageMediaItemArtworkRequest) {
  const formData = new FormData();
  formData.set('artwork_kind', payload.artworkKind);
  formData.set('file', payload.file);
  return formData;
}

export function buildSubtitleUploadFormData(payload: UploadManageMediaItemSubtitleRequest) {
  const formData = new FormData();
  formData.set('file', payload.file);
  if (payload.language?.trim()) {
    formData.set('language', payload.language.trim());
  }
  formData.set('is_active', String(payload.isActive));
  formData.set('is_default', String(payload.isDefault));
  formData.set('sort_order', String(payload.sortOrder));
  return formData;
}

export function mapSubtitleUpdatePayloadToApi(payload: UpdateManageMediaItemSubtitleOverrideRequest) {
  return {
    language: payload.language,
    is_active: payload.isActive,
    is_default: payload.isDefault,
    sort_order: payload.sortOrder,
  };
}
