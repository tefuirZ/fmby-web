import type {
  ManageProbeTaskDetailRecord,
  ManageProbeTaskRecord,
} from "../types";
import type {
  RawManagedProbeTaskDetailResponse,
  RawManagedProbeTaskRecord,
  RawManagedProbeTaskStreamRecord,
  RawManagedProbeTechnicalSummary,
} from "../raw-types";
import { mapProviderTypeFromApi as mapProviderType } from "../provider-mapping";
import { mapProbeTaskStatus } from "./shared";

export function mapManagedProbeTaskRecord(
  raw: RawManagedProbeTaskRecord,
): ManageProbeTaskRecord {
  return {
    sourceId: raw.source_id,
    mediaItemId: raw.media_item_id,
    title: raw.title,
    year: raw.year ?? undefined,
    libraryId: raw.library_id,
    libraryName: raw.library_name,
    mountId: raw.mount_id,
    mountName: raw.mount_name,
    providerType: mapProviderType(raw.provider_type),
    mountStatus: raw.mount_status,
    availabilityState:
      raw.availability_state === "Unavailable" ? "unavailable" : "active",
    sourcePath: raw.source_path,
    sourceStatus: raw.source_status,
    status: mapProbeTaskStatus(raw.status),
    priority: raw.priority ?? undefined,
    requestReason: raw.request_reason ?? undefined,
    attemptCount: raw.attempt_count,
    requestedAt: raw.requested_at ?? undefined,
    startedAt: raw.started_at ?? undefined,
    finishedAt: raw.finished_at ?? undefined,
    nextRetryAt: raw.next_retry_at ?? undefined,
    lastError: raw.last_error ?? undefined,
    probedAt: raw.probed_at ?? undefined,
    technicalSummary: mapManagedProbeTechnicalSummary(raw.technical_summary),
  };
}

export function mapManagedProbeTaskDetailResponse(
  raw: RawManagedProbeTaskDetailResponse,
): ManageProbeTaskDetailRecord {
  return {
    task: mapManagedProbeTaskRecord(raw.task),
    videoStreams: (raw.video_streams ?? []).map(mapManagedProbeTaskStreamRecord),
    audioStreams: (raw.audio_streams ?? []).map(mapManagedProbeTaskStreamRecord),
    subtitleStreams: (raw.subtitle_streams ?? []).map(
      mapManagedProbeTaskStreamRecord,
    ),
  };
}

function mapManagedProbeTechnicalSummary(
  raw?: RawManagedProbeTechnicalSummary | null,
) {
  if (!raw) {
    return undefined;
  }

  const mapped = {
    container: raw.container ?? undefined,
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
  };

  if (
    !mapped.container &&
    !mapped.durationTicks &&
    !mapped.bitrate &&
    !mapped.width &&
    !mapped.height &&
    !mapped.videoCodec &&
    !mapped.audioCodec &&
    !mapped.dynamicRangeLabel &&
    !mapped.audioTrackCount &&
    !mapped.subtitleCount &&
    !mapped.releaseGroup
  ) {
    return undefined;
  }

  return mapped;
}

function mapManagedProbeTaskStreamRecord(
  raw: RawManagedProbeTaskStreamRecord,
) {
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
    dvBlSignalCompatibilityId:
      raw.dv_bl_signal_compatibility_id ?? undefined,
    hdr10PlusPresentFlag: raw.hdr10_plus_present_flag ?? undefined,
    isDefault: raw.is_default ?? false,
    isForced: raw.is_forced ?? false,
  };
}
