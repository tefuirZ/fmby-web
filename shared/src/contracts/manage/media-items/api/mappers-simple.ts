/**
 * @file Simple Object Mappers
 * @description 简单对象映射（person / external-id / metadata / stream）
 */

import type {
  ManageMediaExternalId,
  ManageMediaItemMetadataRecord,
  ManageMediaPerson,
} from '../types';
import type {
  RawManageMediaExternalId,
  RawManageMediaItemMetadata,
  RawManageMediaPerson,
  RawManageProbeTaskStreamRecord,
} from './types';

export function mapMediaPerson(raw: RawManageMediaPerson): ManageMediaPerson {
  return {
    name: raw.name,
    role: raw.role ?? undefined,
    thumbUrl: raw.thumb_url ?? undefined,
    profile: raw.profile ?? undefined,
  };
}

export function mapExternalId(raw: RawManageMediaExternalId): ManageMediaExternalId {
  return {
    provider: raw.provider,
    id: raw.id,
  };
}

export function mapMetadata(raw: RawManageMediaItemMetadata): ManageMediaItemMetadataRecord {
  return {
    title: raw.title ?? undefined,
    originalTitle: raw.original_title ?? undefined,
    sortTitle: raw.sort_title ?? undefined,
    year: raw.year ?? undefined,
    overview: raw.overview ?? undefined,
    communityRating: raw.community_rating ?? undefined,
    genres: raw.genres ?? [],
    directors: raw.directors ?? [],
    actors: (raw.actors ?? []).map(mapMediaPerson),
    studios: raw.studios ?? [],
    premiered: raw.premiered ?? undefined,
    externalIds: (raw.external_ids ?? []).map(mapExternalId),
  };
}

export function mapProbeStream(raw: RawManageProbeTaskStreamRecord) {
  return {
    index: raw.index ?? undefined,
    codecName: raw.codec_name ?? undefined,
    codecTag: raw.codec_tag ?? undefined,
    title: raw.title ?? undefined,
    language: raw.language ?? undefined,
    channels: raw.channels ?? undefined,
    channelLayout: raw.channel_layout ?? undefined,
    width: raw.width ?? undefined,
    height: raw.height ?? undefined,
    profile: raw.profile ?? undefined,
    bitRate: raw.bit_rate ?? undefined,
    bitDepth: raw.bit_depth ?? undefined,
    pixelFormat: raw.pixel_format ?? undefined,
    colorPrimaries: raw.color_primaries ?? undefined,
    colorSpace: raw.color_space ?? undefined,
    colorTransfer: raw.color_transfer ?? undefined,
    aspectRatio: raw.aspect_ratio ?? undefined,
    averageFrameRate: raw.average_frame_rate ?? undefined,
    realFrameRate: raw.real_frame_rate ?? undefined,
    dynamicRangeLabel: raw.dynamic_range_label ?? undefined,
    dvVersionMajor: raw.dv_version_major ?? undefined,
    dvVersionMinor: raw.dv_version_minor ?? undefined,
    dvProfile: raw.dv_profile ?? undefined,
    dvLevel: raw.dv_level ?? undefined,
    rpuPresentFlag: raw.rpu_present_flag ?? undefined,
    elPresentFlag: raw.el_present_flag ?? undefined,
    blPresentFlag: raw.bl_present_flag ?? undefined,
    dvBlSignalCompatibilityId: raw.dv_bl_signal_compatibility_id ?? undefined,
    hdr10PlusPresentFlag: raw.hdr10_plus_present_flag ?? undefined,
    isDefault: raw.is_default ?? false,
    isForced: raw.is_forced ?? false,
  };
}
