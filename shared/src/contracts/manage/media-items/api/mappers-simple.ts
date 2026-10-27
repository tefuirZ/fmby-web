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
  };
}

export function mapExternalId(raw: RawManageMediaExternalId): ManageMediaExternalId {
  return {
    provider: raw.provider,
    id: raw.id,
  };
}

export function mapMetadata(
  raw: RawManageMediaItemMetadata | null | undefined,
): ManageMediaItemMetadataRecord {
  // W-METAFAMILY：旧 BE wire 曾把 base/effective_metadata 恒送 null，
  // 无守卫访问 = 详情页整页 TypeError（e2e 基线红 38 条同族）⇒ 空记录兑底。
  const src: RawManageMediaItemMetadata = raw ?? {};
  return {
    title: src.title ?? undefined,
    originalTitle: src.original_title ?? undefined,
    sortTitle: src.sort_title ?? undefined,
    year: src.year ?? undefined,
    overview: src.overview ?? undefined,
    communityRating: src.community_rating ?? undefined,
    genres: src.genres ?? [],
    directors: src.directors ?? [],
    actors: (src.actors ?? []).map(mapMediaPerson),
    studios: src.studios ?? [],
    premiered: src.premiered ?? undefined,
    externalIds: (src.external_ids ?? []).map(mapExternalId),
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
