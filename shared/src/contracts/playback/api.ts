import { httpClient } from '@fmby/v2-shared/api/client';
import {
  asRecord,
  readArray,
  readBoolean,
  readNumber,
  readString,
  ticksToSeconds,
} from '@fmby/v2-shared/api/mapping';
import { mapArtwork } from '@fmby/v2-shared/contracts/assets';
import type {
  PlaybackProgressUpdate,
  PlaybackReportRequest,
  PlaybackResolveRequest,
  PlaybackSession,
  PlaybackTarget,
  PlaybackTrack,
} from './types';

type PlaybackSourceRecord = Record<string, unknown>;

type BrowserPlaybackAssessment = {
  supported: boolean;
  confident: boolean;
  hint?: string;
};

// 这些编码/容器在网页端经常兼容性稀烂，但不再前端硬拦，先提示风险再允许尝试
const RISKY_AUDIO_CODECS = new Set([
  'truehd', 'mlp', 'mlpa',
  'dts', 'dtshd', 'dts-hd', 'dtshd_ma', 'dtshdma',
  'pcmbluray',
  'ac3',
  'eac3', 'ec3',
]);
const RISKY_CONTAINERS = new Set(['matroska', 'mkv', 'avi', 'flv', 'mpegts', 'ts']);

export const playbackApi = {
  async createSession(itemId: string): Promise<PlaybackSession> {
    const sessionRaw = await httpClient.post<unknown>('/api/playback/sessions', {
      body: {
        item_id: itemId,
      },
    });
    return mapPlaybackSession(sessionRaw, itemId);
  },

  async reportProgress(sessionId: string, payload: PlaybackProgressUpdate) {
    const positionTicks = secondsToTicks(payload.positionSeconds);
    const durationTicks = secondsToTicks(payload.durationSeconds);
    await httpClient.post(`/api/playback/sessions/${sessionId}/progress`, {
      body: {
        position_ticks: positionTicks,
        duration_ticks: durationTicks,
        is_completed: payload.completed ?? false,
      },
    });
    if (payload.paused !== undefined) {
      await httpClient.post(`/api/playback/sessions/${sessionId}/heartbeat`, {
        body: {
          position_ticks: positionTicks,
          paused: payload.paused,
        },
      });
    }
  },

  async stopSession(sessionId: string, payload: PlaybackProgressUpdate) {
    await httpClient.post(`/api/playback/sessions/${sessionId}/stop`, {
      body: {
        position_ticks: secondsToTicks(payload.positionSeconds),
        duration_ticks: secondsToTicks(payload.durationSeconds),
        is_completed: payload.completed ?? false,
      },
    });
  },

  /** 播放端点解析（docs/interfaces/webui.md） */
  async resolve(payload: PlaybackResolveRequest): Promise<PlaybackTarget> {
    const raw = await httpClient.post<unknown>('/api/playback/resolve', {
      body: {
        variant_id: payload.variantId,
        variantId: payload.variantId,
      },
    });
    return mapPlaybackTarget(raw);
  },

  /** 播放会话进度上报（docs/interfaces/webui.md） */
  async report(payload: PlaybackReportRequest): Promise<void> {
    await httpClient.post('/api/playback/report', {
      body: {
        session_id: payload.sessionId,
        sessionId: payload.sessionId,
        progress: payload.progress,
        completed: payload.completed ?? false,
      },
    });
  },
};

export function mapPlaybackTarget(raw: unknown): PlaybackTarget {
  const record = asRecord(raw);
  const rawKind = readString(record.kind, record.type) ?? 'direct';
  const kind: PlaybackTarget['kind'] =
    rawKind === 'hls' || rawKind === 'dash' || rawKind === 'external' ? rawKind : 'direct';

  return {
    urlRef: readString(record.url_ref, record.urlRef, record.url, record.stream_url) ?? '',
    kind,
    format: readString(record.format, record.container),
    headers: asRecord(record.headers) as Record<string, string>,
  };
}

function mapPlaybackSession(raw: unknown, requestedItemId: string): PlaybackSession {
  const record = asRecord(raw);
  const itemId = readString(record.item_id, record.itemId) ?? requestedItemId;
  const item = asRecord(record.item);
  const activeSource = asRecord(record.active_source ?? record.activeSource);
  const streamUrl = readString(record.stream_url, record.streamUrl, record.direct_stream_url, record.directStreamUrl);
  const externalStreamUrl = sanitizeExternalPlaybackUrl(
    readString(record.external_stream_url, record.externalStreamUrl),
  );
  const externalStreamExpiresAt = readString(
    record.external_stream_expires_at,
    record.externalStreamExpiresAt,
  );

  const externalPlaybackUrl = sanitizeExternalPlaybackUrl(
    readString(
      record.external_playback_url,
      record.externalPlaybackUrl,
      record.direct_url,
      record.directUrl,
    ),
  );
  const canUseExternalPlayer = readBoolean(
    record.can_use_external_player,
    record.canUseExternalPlayer,
    record.external_player_available,
    record.externalPlayerAvailable,
  ) ?? Boolean(externalStreamUrl ?? externalPlaybackUrl);
  const browserPlayback = assessBrowserPlayback(activeSource);
  const explicitBrowserCapability = readBoolean(
    record.can_direct_play_in_browser,
    record.canDirectPlayInBrowser,
  );
  const browserPlaybackHint = browserPlayback.hint
    ? appendBrowserFallbackAction(browserPlayback.hint, canUseExternalPlayer)
    : undefined;

  return {
    sessionId: readString(record.session_id, record.sessionId, record.id) ?? itemId,
    itemId,
    title: readString(item.title, item.name, record.title, record.name) ?? '正在播放',
    subtitle: readString(
      item.subtitle,
      item.original_title,
      item.originalTitle,
      item.tagline,
      item.library_name,
      item.libraryName,
    ),
    streamUrl,
    externalStreamUrl,
    externalStreamExpiresAt,
    externalPlaybackUrl,
    mimeType:
      readString(record.mime_type, record.mimeType, record.content_type, record.contentType) ??
      mapMimeType(activeSource),
    durationSeconds:
      ticksToSeconds(record.duration_ticks ?? record.durationTicks) ??
      ticksToSeconds(activeSource?.duration_ticks ?? activeSource?.durationTicks) ??
      readNumber(record.duration_seconds, record.durationSeconds, record.runtime_seconds, record.runtimeSeconds),
    resumePositionSeconds: readNumber(
      record.resume_position_seconds,
      record.resumePositionSeconds,
      record.position_seconds,
      record.positionSeconds,
    ) ?? ticksToSeconds(record.position_ticks ?? record.positionTicks),
    canUseExternalPlayer,
    // 后端明确给出能力判定时，以真实源探测合同为准；缺失时才本地
    // fail-closed 探测，避免 mock/未知 MIME 被误报为可播。
    canDirectPlayInBrowser:
      Boolean(streamUrl) && (explicitBrowserCapability ?? browserPlayback.supported),
    browserPlaybackHint,
    fallbackHint: readString(record.fallback_hint, record.fallbackHint, record.message) ?? browserPlaybackHint,
    artwork: mapArtwork(item.artwork ?? item.images ?? item, { itemId }),
    audioTracks: readArray(record.audio_tracks ?? record.audioTracks, (item) => mapTrack(item, 'audio')),
    subtitleTracks: readArray(record.subtitle_tracks ?? record.subtitleTracks, (item) => mapTrack(item, 'subtitle')),
  };
}

function mapTrack(raw: unknown, type: 'audio' | 'subtitle'): PlaybackTrack | null {
  const record = asRecord(raw);
  const id = readString(record.id, record.index);
  if (!id) {
    return null;
  }

  return {
    id,
    label: readString(record.label, record.display_title, record.displayTitle, record.name) ?? id,
    type,
    languageLabel: readString(record.language_label, record.languageLabel, record.language),
    codecLabel: readString(record.codec_label, record.codecLabel, record.codec),
    selected: readBoolean(record.selected, record.is_selected, record.isSelected) ?? false,
    isDefault: readBoolean(record.default, record.is_default, record.isDefault) ?? false,
  };
}

function secondsToTicks(value?: number) {
  if (value === undefined || Number.isNaN(value)) {
    return undefined;
  }
  return Math.max(0, Math.round(value * 10_000_000));
}

function mapMimeType(raw: Record<string, unknown> | undefined) {
  const container = normalizeToken(readString(raw?.container));
  switch (container) {
    case 'mp4':
    case 'mov':
    case 'm4v':
      return 'video/mp4';
    case 'mkv':
    case 'matroska':
      return 'video/x-matroska';
    case 'webm':
      return 'video/webm';
    case 'mp3':
      return 'audio/mpeg';
    default:
      return undefined;
  }
}

function assessBrowserPlayback(source: PlaybackSourceRecord | undefined): BrowserPlaybackAssessment {
  if (!source) {
    return {
      supported: false,
      confident: false,
      hint: '播放源没有提供容器或编码信息，网页端无法安全确认兼容性，请使用外部播放器。',
    };
  }

  const container = normalizeToken(readString(source.container));
  const videoCodec = normalizeToken(readString(source.video_codec, source.videoCodec));
  const audioCodec = normalizeToken(readString(source.audio_codec, source.audioCodec));

  const testNode = document.createElement('video');
  const mimeCandidates = buildMimeCandidates(source, videoCodec, audioCodec);
  if (mimeCandidates.length === 0) {
    return {
      supported: false,
      confident: false,
      hint: buildBrowserRiskHint(source, {
        riskyContainer: Boolean(container && RISKY_CONTAINERS.has(container)),
        riskyAudioCodec: Boolean(
          audioCodec &&
            (RISKY_AUDIO_CODECS.has(audioCodec) || audioCodec.startsWith('pcm')),
        ),
        missingMimeCandidates: true,
      }),
    };
  }

  const canPlayNatively = mimeCandidates.some((candidate) => {
    const result = testNode.canPlayType(candidate);
    return result === 'maybe' || result === 'probably';
  });

  if (canPlayNatively) {
    return { supported: true, confident: true };
  }

  return {
    supported: false,
    confident: false,
    hint: buildBrowserRiskHint(source, {
      riskyContainer: Boolean(container && RISKY_CONTAINERS.has(container)),
      riskyAudioCodec: Boolean(
        audioCodec &&
          (RISKY_AUDIO_CODECS.has(audioCodec) || audioCodec.startsWith('pcm')),
      ),
      missingMimeCandidates: false,
    }),
  };
}

function buildMimeCandidates(
  source: PlaybackSourceRecord,
  videoCodec: string | undefined,
  audioCodec: string | undefined,
) {
  const mimeType = mapMimeType(source);
  if (!mimeType) {
    return [];
  }

  const codecParts = [mapVideoCodec(videoCodec), mapAudioCodec(audioCodec)].filter(
    (value): value is string => Boolean(value),
  );
  return codecParts.length > 0 ? [`${mimeType}; codecs="${codecParts.join(', ')}"`, mimeType] : [mimeType];
}

function mapVideoCodec(value?: string) {
  switch (value) {
    case 'h264':
    case 'avc':
    case 'avc1':
      return 'avc1.42E01E';
    case 'hevc':
    case 'h265':
    case 'x265':
    case 'hvc1':
      return 'hvc1';
    case 'av1':
      return 'av01.0.05M.08';
    case 'vp9':
      return 'vp09.00.10.08';
    case 'vp8':
      return 'vp8';
    default:
      return undefined;
  }
}

function mapAudioCodec(value?: string) {
  switch (value) {
    case 'aac':
    case 'aaclc':
      return 'mp4a.40.2';
    case 'mp3':
      return 'mp3';
    case 'opus':
      return 'opus';
    case 'vorbis':
      return 'vorbis';
    case 'flac':
      return 'flac';
    case 'ac3':
      return 'ac-3';
    case 'eac3':
    case 'ec3':
      return 'ec-3';
    default:
      return undefined;
  }
}

function buildBrowserRiskHint(
  source: PlaybackSourceRecord,
  context: {
    riskyContainer: boolean;
    riskyAudioCodec: boolean;
    missingMimeCandidates: boolean;
  },
) {
  const parts = [
    formatContainerLabel(readString(source.container)),
    formatCodecLabel(readString(source.video_codec, source.videoCodec)),
    formatCodecLabel(readString(source.audio_codec, source.audioCodec)),
  ].filter((value): value is string => Boolean(value));

  const reasons = [
    context.riskyContainer ? '容器兼容性不稳定' : undefined,
    context.riskyAudioCodec ? '音频编码兼容性不稳定' : undefined,
    context.missingMimeCandidates ? '浏览器无法提前确认支持情况' : undefined,
  ].filter((value): value is string => Boolean(value));

  if (parts.length === 0) {
    return reasons.length > 0
      ? `网页端会尝试直接播放，但${reasons.join('，')}，可能出现没声音、没字幕或没画面。`
      : '网页端会尝试直接播放，但浏览器兼容性暂时无法确认，可能出现没声音、没字幕或没画面。';
  }

  return reasons.length > 0
    ? `当前版本为 ${parts.join(' · ')}，网页端会尝试直接播放，但${reasons.join('，')}，可能出现没声音、没字幕或没画面。`
    : `当前版本为 ${parts.join(' · ')}，网页端会尝试直接播放，但浏览器兼容性暂时无法确认，可能出现没声音、没字幕或没画面。`;
}

function appendBrowserFallbackAction(message: string, canUseExternalPlayer: boolean) {
  return canUseExternalPlayer
    ? `${message} 如果播放异常，你可以改用外部播放器继续。`
    : `${message} 如果播放异常，请换一个更适合网页播放的版本再试。`;
}

function formatContainerLabel(value?: string) {
  const normalized = normalizeToken(value);
  switch (normalized) {
    case 'mov':
    case 'mp4':
    case 'm4v':
      return 'MP4';
    case 'mkv':
    case 'matroska':
      return 'MKV';
    case 'webm':
      return 'WebM';
    case 'mp3':
      return 'MP3';
    default:
      return value?.trim();
  }
}

function formatCodecLabel(value?: string) {
  const normalized = normalizeToken(value);
  switch (normalized) {
    case 'h264':
    case 'avc':
    case 'avc1':
      return 'H.264';
    case 'hevc':
    case 'h265':
    case 'x265':
    case 'hvc1':
      return 'HEVC';
    case 'aac':
    case 'aaclc':
      return 'AAC';
    case 'eac3':
    case 'ec3':
      return 'EAC3';
    case 'ac3':
      return 'AC3';
    case 'truehd':
      return 'TrueHD';
    case 'dts':
    case 'dtshd':
    case 'dtshdma':
    case 'dts-hd':
      return 'DTS';
    default:
      return value?.trim();
  }
}

function normalizeToken(value?: string) {
  return value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function sanitizeExternalPlaybackUrl(raw?: string) {
  if (!raw) {
    return undefined;
  }

  try {
    const url = new URL(raw, window.location.origin);
    const protocol = url.protocol.toLowerCase();
    if (protocol === 'javascript:' || protocol === 'data:' || protocol === 'vbscript:' || protocol === 'file:') {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}
