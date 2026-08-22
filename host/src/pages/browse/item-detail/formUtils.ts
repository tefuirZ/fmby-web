import type { ItemDetailResponse } from '@fmby/v2-shared/contracts/browse/item';
import type { MediaCardSummary } from '@fmby/v2-shared/contracts/browse';
import type { TechnicalCard, StreamInfo, StreamType } from './types';

export function buildTechnicalCards(
  technical: ItemDetailResponse['technical'],
  sourceStatusLabel?: string,
): TechnicalCard[] {
  const subtitleSummary = buildSubtitleSummary(technical);
  const cards: Array<TechnicalCard | null> = [
    buildTechnicalCard('清晰度', technical.resolutionLabel),
    buildTechnicalCard(
      '视频规格',
      [technical.videoCodecLabel, technical.dynamicRangeLabel]
        .filter((entry): entry is string => Boolean(entry))
        .join(' · '),
    ),
    buildTechnicalCard(
      '音频规格',
      technical.audioCodecLabel,
      technical.audioTrackCount ? `${technical.audioTrackCount} 条音轨` : undefined,
    ),
    buildTechnicalCard(
      '封装与码率',
      [technical.containerLabel, technical.bitrateLabel]
        .filter((entry): entry is string => Boolean(entry))
        .join(' · '),
    ),
    buildTechnicalCard(
      '字幕情况',
      subtitleSummary.value,
      subtitleSummary.hint,
    ),
    buildTechnicalCard(
      '来源状态',
      sourceStatusLabel ?? technical.sourceStatusLabel,
    ),
    buildTechnicalCard('发布组', technical.releaseGroup),
  ];

  return cards.filter((card): card is TechnicalCard => Boolean(card));
}

function buildTechnicalCard(label: string, value?: string, hint?: string): TechnicalCard | null {
  if (!value || value.trim() === '') {
    return null;
  }
  return { label, value, hint };
}

export function buildSubtitleSummary(technical: ItemDetailResponse['technical']) {
  const subtitleCount = technical.subtitleCount;
  const embedded = technical.embeddedSubtitleCount;
  const external = technical.externalSubtitleCount;

  if (!subtitleCount || subtitleCount <= 0) {
    return {
      value: '未识别到字幕',
      hint: undefined,
    };
  }

  const hints = [
    embedded ? `内嵌 ${embedded} 条` : undefined,
    external ? `外挂 ${external} 条` : undefined,
  ].filter((entry): entry is string => Boolean(entry));

  return {
    value: `${subtitleCount} 条字幕`,
    hint: hints.length > 0 ? hints.join(' · ') : undefined,
  };
}

export function shouldLoadTechnicalFallback(item: ItemDetailResponse) {
  if (
    (item.kind !== 'series' && item.kind !== 'season') ||
    !item.playbackTargetId ||
    item.playbackTargetId === item.id
  ) {
    return false;
  }

  return !hasRichTechnicalInfo(item.technical);
}

function hasRichTechnicalInfo(technical: ItemDetailResponse['technical']) {
  return Boolean(
    technical.videoCodecLabel ||
      technical.audioCodecLabel ||
      technical.dynamicRangeLabel ||
      technical.containerLabel ||
      technical.bitrateLabel ||
      technical.releaseGroup ||
      technical.audioTrackCount ||
      technical.subtitleCount ||
      technical.videoStreams.length > 0 ||
      technical.audioStreams.length > 0 ||
      technical.subtitleStreams.length > 0,
  );
}

export function mergeTechnicalInfo(
  primary: ItemDetailResponse['technical'],
  fallback?: ItemDetailResponse['technical'],
): ItemDetailResponse['technical'] {
  if (!fallback) {
    return primary;
  }

  return {
    resolutionLabel: primary.resolutionLabel ?? fallback.resolutionLabel,
    containerLabel: primary.containerLabel ?? fallback.containerLabel,
    videoCodecLabel: primary.videoCodecLabel ?? fallback.videoCodecLabel,
    audioCodecLabel: primary.audioCodecLabel ?? fallback.audioCodecLabel,
    dynamicRangeLabel: primary.dynamicRangeLabel ?? fallback.dynamicRangeLabel,
    audioTrackCount: primary.audioTrackCount ?? fallback.audioTrackCount,
    subtitleCount: primary.subtitleCount ?? fallback.subtitleCount,
    embeddedSubtitleCount: primary.embeddedSubtitleCount ?? fallback.embeddedSubtitleCount,
    externalSubtitleCount: primary.externalSubtitleCount ?? fallback.externalSubtitleCount,
    bitrateLabel: primary.bitrateLabel ?? fallback.bitrateLabel,
    sourceStatusLabel: primary.sourceStatusLabel ?? fallback.sourceStatusLabel,
    releaseGroup: primary.releaseGroup ?? fallback.releaseGroup,
    videoStreams:
      primary.videoStreams.length > 0 ? primary.videoStreams : fallback.videoStreams,
    audioStreams:
      primary.audioStreams.length > 0 ? primary.audioStreams : fallback.audioStreams,
    subtitleStreams:
      primary.subtitleStreams.length > 0
        ? primary.subtitleStreams
        : fallback.subtitleStreams,
  };
}

export function buildStreamSummary(stream: StreamInfo, type: StreamType, index: number) {
  const baseLabel =
    type === 'video'
      ? `视频流 ${(stream.index ?? index) + 1}`
      : type === 'audio'
        ? `音轨 ${(stream.index ?? index) + 1}`
        : `字幕 ${(stream.index ?? index) + 1}`;

  const parts =
    type === 'video'
      ? [
          stream.codecName?.toUpperCase(),
          buildResolutionValue(stream),
          stream.dynamicRangeLabel,
        ]
      : type === 'audio'
        ? [
            stream.language,
            stream.codecName?.toUpperCase(),
            buildAudioLayoutValue(stream),
          ]
        : [
            stream.language,
            stream.title,
            stream.isExternal ? '外挂字幕' : '内嵌字幕',
          ];

  const summary = parts.filter((entry): entry is string => Boolean(entry)).join(' · ');
  return summary ? `${baseLabel} · ${summary}` : baseLabel;
}

export function buildStreamFacts(stream: StreamInfo, type: StreamType) {
  const facts = [
    buildFact('编码', stream.codecName?.toUpperCase()),
    buildFact('编码标签', stream.codecTag),
    buildFact('标题', stream.title),
    buildFact('语言', stream.language),
    buildFact('分辨率', type === 'video' ? buildResolutionValue(stream) : undefined),
    buildFact('动态范围', type === 'video' ? stream.dynamicRangeLabel : undefined),
    buildFact('声道', type === 'audio' ? buildAudioLayoutValue(stream) : undefined),
    buildFact('配置', stream.profile),
    buildFact('位深', stream.bitDepth ? `${stream.bitDepth} bit` : undefined),
    buildFact('像素格式', stream.pixelFormat),
    buildFact('色彩原色', stream.colorPrimaries),
    buildFact('色彩空间', stream.colorSpace),
    buildFact('色彩传输', stream.colorTransfer),
    buildFact('画面比例', stream.aspectRatio),
    buildFact(
      '帧率',
      stream.averageFrameRate || stream.realFrameRate
        ? [stream.averageFrameRate, stream.realFrameRate]
            .filter((entry): entry is number => Boolean(entry))
            .map((entry) => `${entry.toFixed(2)} fps`)
            .join(' / ')
        : undefined,
    ),
    buildFact(
      '码率',
      stream.bitRate ? formatBitRateValue(stream.bitRate) : undefined,
    ),
    buildFact(
      '默认 / 强制',
      [
        stream.isDefault ? '默认' : undefined,
        stream.isForced ? '强制' : undefined,
      ]
        .filter((entry): entry is string => Boolean(entry))
        .join(' · '),
    ),
    buildFact(
      '字幕类型',
      type === 'subtitle'
        ? [
            stream.subtitleLocationType,
            stream.isTextSubtitleStream ? '文本字幕' : undefined,
          ]
            .filter((entry): entry is string => Boolean(entry))
            .join(' · ')
        : undefined,
    ),
  ];

  return facts.filter((fact): fact is { label: string; value: string } => Boolean(fact));
}

function buildFact(label: string, value?: string) {
  if (!value || value.trim() === '') {
    return null;
  }
  return { label, value };
}

function buildResolutionValue(stream: StreamInfo) {
  if (!stream.width || !stream.height) {
    return undefined;
  }
  return `${stream.width} × ${stream.height}`;
}

function buildAudioLayoutValue(stream: StreamInfo) {
  return [stream.channels ? `${stream.channels} 声道` : undefined, stream.channelLayout]
    .filter((entry): entry is string => Boolean(entry))
    .join(' · ');
}

export function formatBitRateValue(value: number) {
  const megabits = value / 1_000_000;
  if (megabits >= 1) {
    return `${megabits.toFixed(megabits >= 10 ? 0 : 1)} Mbps`;
  }
  return `${Math.round(value / 1_000)} Kbps`;
}

export function pickPreferredSeasonId(item: ItemDetailResponse, seasons: MediaCardSummary[]) {
  if (seasons.length === 0) {
    return undefined;
  }

  if (item.playbackTargetId) {
    const matchedSeason = seasons.find((season) => season.playbackTargetId === item.playbackTargetId);
    if (matchedSeason) {
      return matchedSeason.id;
    }
  }

  return seasons[0]?.id;
}

export function buildEpisodeRowTitle(episode: MediaCardSummary) {
  if (episode.episodeNumber && episode.episodeNumber > 0) {
    return `第 ${episode.episodeNumber} 集 · ${episode.title}`;
  }
  return episode.title;
}

export function buildEpisodeSectionSummary(
  item: ItemDetailResponse,
  seasonOptions: MediaCardSummary[],
  episodeOptions: MediaCardSummary[],
  selectedSeasonId?: string,
) {
  if (item.kind === 'series') {
    const selectedSeason = seasonOptions.find((season) => season.id === selectedSeasonId);
    const seasonLabel = selectedSeason?.title ?? '当前季度';
    return `${seasonOptions.length} 季 · ${seasonLabel} · ${episodeOptions.length} 集`;
  }

  if (item.kind === 'season') {
    return `${episodeOptions.length} 集 · 推荐用横向卡片快速切换`;
  }

  return '可直接进入具体分集';
}
