import styles from './styles/cards.module.css';

interface PosterBadgesProps {
  feature?: string;
  score?: string;
  resolution?: string;
  footer?: string;
}

interface PosterBadgeInput {
  kind?: string;
  badge?: string;
  tags?: ReadonlyArray<string>;
  featureCandidates?: ReadonlyArray<string | undefined>;
  ratingLabel?: string;
  resolutionLabel?: string;
  year?: number;
  itemCount?: number;
  durationSeconds?: number;
  preferSeriesTopLeftResolution?: boolean;
}

const FEATURE_BADGE_PRIORITIES = [
  'imax',
  'dolby vision',
  '杜比视界',
  'hdr10+',
  'hdr10',
  'hdr',
  'atmos',
  'dts:x',
];

function getFeatureBadgeClass(feature?: string) {
  if (!feature) return styles.posterFeatureBadge;
  const lower = feature.toLowerCase();
  if (lower.includes('dolby') || lower.includes('杜比')) {
    return styles.badgeDolby;
  }
  if (lower.includes('hdr')) {
    return styles.badgeHdr;
  }
  if (lower.includes('imax')) {
    return styles.badgeImax;
  }
  if (lower.includes('4k') || lower.includes('8k') || lower.includes('uhd')) {
    return styles.badgeUhd;
  }
  if (lower.includes('1080') || lower.includes('720') || lower.includes('2k') || lower.includes('fhd')) {
    return styles.badgeHd;
  }
  return styles.posterFeatureBadge;
}

function getScoreBadgeClass(score?: string) {
  if (!score) return '';
  const num = Number.parseFloat(score);
  if (Number.isNaN(num)) return styles.scoreNeutral;
  if (num >= 8.5) return styles.scoreGold;
  if (num >= 7.0) return styles.scoreGreen;
  return styles.scoreNeutral;
}

export function PosterBadges({ feature, score, resolution, footer }: PosterBadgesProps) {
  return (
    <>
      {feature ? (
        <span
          className={`${styles.posterCornerBadge} ${styles.posterBadgeTopLeft} ${getFeatureBadgeClass(
            feature,
          )}`}
        >
          {feature}
        </span>
      ) : null}
      {score ? (
        <span
          className={`${styles.posterCornerBadge} ${styles.posterBadgeTopRight} ${styles.posterScoreBadge} ${getScoreBadgeClass(
            score,
          )}`}
        >
          {score}
        </span>
      ) : null}
      {resolution ? (
        <span
          className={`${styles.posterCornerBadge} ${styles.posterBadgeBottomLeft} ${styles.posterResolutionBadge} ${getResolutionBadgeClass(
            resolution,
          )}`}
        >
          {resolution}
        </span>
      ) : null}
      {footer ? (
        <span className={`${styles.posterCornerBadge} ${styles.posterBadgeBottomRight} ${styles.posterFooterBadge}`}>
          {footer}
        </span>
      ) : null}
    </>
  );
}

export function pickFeatureBadge(candidates: ReadonlyArray<string | undefined>) {
  const normalizedCandidates = candidates
    .map((candidate) => candidate?.trim())
    .filter((candidate): candidate is string => Boolean(candidate));

  for (const keyword of FEATURE_BADGE_PRIORITIES) {
    const match = normalizedCandidates.find((candidate) =>
      candidate.toLowerCase().includes(keyword),
    );
    if (match) {
      return match;
    }
  }

  return undefined;
}

export function pickScoreBadge(ratingLabel?: string) {
  if (!ratingLabel) {
    return undefined;
  }

  const normalized = ratingLabel.trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    return undefined;
  }

  return Number.parseFloat(normalized) > 0 ? normalized : undefined;
}

export function buildPosterBadgeModel({
  kind,
  badge,
  tags = [],
  featureCandidates = [],
  ratingLabel,
  resolutionLabel,
  year,
  itemCount,
  durationSeconds,
  preferSeriesTopLeftResolution = true,
}: PosterBadgeInput): PosterBadgesProps {
  const normalizedResolution = buildResolutionBadge(resolutionLabel, year);
  const feature = pickFeatureBadge([...featureCandidates, badge, ...tags]);
  let topLeftFeature = feature;
  let bottomLeftResolution = normalizedResolution;

  if (
    preferSeriesTopLeftResolution &&
    isSeriesLike(kind) &&
    normalizedResolution &&
    !isYearBadge(normalizedResolution)
  ) {
    topLeftFeature = normalizedResolution;
    bottomLeftResolution = year ? String(year) : undefined;
  }

  return {
    feature: topLeftFeature,
    score: pickScoreBadge(ratingLabel),
    resolution: bottomLeftResolution,
    footer: buildFooterBadge(kind, itemCount, durationSeconds),
  };
}

export function buildResolutionBadge(resolutionLabel?: string, year?: number) {
  const normalizedResolution = normalizeResolutionBucket(resolutionLabel);
  return normalizedResolution ?? (year ? String(year) : undefined);
}

function getResolutionBadgeClass(value: string) {
  const normalized = value.toLowerCase();
  if (/^\d{4}$/.test(normalized)) {
    return styles.posterResolutionYear;
  }
  if (normalized.includes('8k')) {
    return styles.posterResolution4k;
  }
  if (normalized.includes('4k') || normalized.includes('2160')) {
    return styles.posterResolution4k;
  }
  if (normalized.includes('2k') || normalized.includes('1440') || normalized.includes('1080') || normalized.includes('fhd')) {
    return styles.posterResolutionFhd;
  }
  if (normalized.includes('720') || normalized.includes('hd')) {
    return styles.posterResolutionHd;
  }
  return styles.posterResolutionSd;
}

function normalizeResolutionBucket(value?: string) {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  const dimensions = parseResolutionDimensions(normalized);
  const maxDimension = dimensions ? Math.max(dimensions.width, dimensions.height) : undefined;
  const minDimension = dimensions ? Math.min(dimensions.width, dimensions.height) : undefined;

  if (normalized.includes('8k') || (maxDimension && maxDimension >= 7680)) {
    return '8K';
  }
  if (
    normalized.includes('4k') ||
    normalized.includes('uhd') ||
    (maxDimension && maxDimension >= 3840) ||
    (minDimension && minDimension >= 2160)
  ) {
    return '4K';
  }
  if (
    normalized.includes('2k') ||
    normalized.includes('1440') ||
    (maxDimension && maxDimension >= 2560) ||
    (minDimension && minDimension >= 1440)
  ) {
    return '2K';
  }
  if (
    normalized.includes('1080') ||
    normalized.includes('fhd') ||
    normalized.includes('full hd') ||
    (maxDimension && maxDimension >= 1920) ||
    (minDimension && minDimension >= 1080)
  ) {
    return '1080P';
  }
  if (
    normalized.includes('720') ||
    /\bhd\b/.test(normalized) ||
    (maxDimension && maxDimension >= 1280) ||
    (minDimension && minDimension >= 720)
  ) {
    return '720P';
  }
  if (
    normalized.includes('576') ||
    (maxDimension && maxDimension >= 1024) ||
    (minDimension && minDimension >= 576)
  ) {
    return '576P';
  }
  if (
    normalized.includes('480') ||
    normalized.includes('sd') ||
    (maxDimension && maxDimension >= 854) ||
    (minDimension && minDimension >= 480)
  ) {
    return '480P';
  }

  return value.toUpperCase();
}

function parseResolutionDimensions(value: string) {
  const match = value.match(/(\d{3,4})\s*[x×*]\s*(\d{3,4})/i);
  if (!match) {
    return undefined;
  }

  return {
    width: Number.parseInt(match[1] ?? '0', 10),
    height: Number.parseInt(match[2] ?? '0', 10),
  };
}

function buildFooterBadge(kind?: string, itemCount?: number, durationSeconds?: number) {
  if ((kind === 'series' || kind === 'season') && itemCount && itemCount > 0) {
    return `${itemCount} 集`;
  }

  if (kind === 'collection' && itemCount && itemCount > 0) {
    return `${itemCount} 项`;
  }

  if (!durationSeconds || durationSeconds <= 0) {
    return undefined;
  }

  const totalMinutes = Math.max(1, Math.round(durationSeconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${totalMinutes}分钟`;
  }

  return minutes > 0 ? `${hours}小时${minutes}分` : `${hours}小时`;
}

function isSeriesLike(kind?: string) {
  return kind === 'series' || kind === 'season';
}

function isYearBadge(value: string) {
  return /^\d{4}$/.test(value);
}
