import type { MediaCardSummary } from '@fmby/v2-shared/contracts/browse';
import type { ItemDetailResponse } from '@fmby/v2-shared/contracts/browse/item';

const DETAIL_QUERY_IDLE_TIMEOUT = 1_200;
const DETAIL_QUERY_FALLBACK_DELAY = 250;

export function parseMimeContainer(mimeType?: string): string | undefined {
  if (!mimeType) return undefined;
  const lc = mimeType.toLowerCase();
  if (lc.includes('mp4')) return 'MP4';
  if (lc.includes('webm')) return 'WebM';
  if (lc.includes('matroska') || lc.includes('mkv')) return 'MKV';
  if (lc.includes('ogg')) return 'OGG';
  return undefined;
}

export function buildPortablePlaybackUrl(url: string): string {
  return buildFullUrl(url);
}

export function buildPlaybackPath(item: MediaCardSummary) {
  return `/play/${item.playbackTargetId ?? item.id}`;
}

export function sortEpisodeCards(items: MediaCardSummary[]) {
  return [...items].sort((left, right) => {
    const leftSeason = left.seasonNumber ?? 0;
    const rightSeason = right.seasonNumber ?? 0;
    const leftEpisode = left.episodeNumber ?? Number.MAX_SAFE_INTEGER;
    const rightEpisode = right.episodeNumber ?? Number.MAX_SAFE_INTEGER;
    return (
      leftSeason - rightSeason ||
      leftEpisode - rightEpisode ||
      left.title.localeCompare(right.title, 'zh-Hans-CN')
    );
  });
}

export function resolveEpisodeNeighbors(
  currentItemId: string | undefined,
  siblings: MediaCardSummary[],
) {
  const currentIndex = currentItemId
    ? siblings.findIndex(
        (candidate) =>
          candidate.id === currentItemId || candidate.playbackTargetId === currentItemId,
      )
    : -1;

  return {
    currentIndex,
    previous: currentIndex > 0 ? siblings[currentIndex - 1] : undefined,
    next:
      currentIndex >= 0 && currentIndex < siblings.length - 1
        ? siblings[currentIndex + 1]
        : undefined,
  };
}

export function buildOverviewMeta(item: ItemDetailResponse) {
  return [
    item.year ? String(item.year) : undefined,
    item.kindLabel,
    item.itemCount && (item.kind === 'series' || item.kind === 'season')
      ? `共 ${item.itemCount} 集`
      : undefined,
    formatDurationLabel(item.runtimeSeconds),
    item.ratingLabel ? `${item.ratingLabel} 分` : undefined,
  ].filter((entry): entry is string => Boolean(entry));
}

export function buildOverviewArtwork(
  item: ItemDetailResponse,
  seriesItem?: ItemDetailResponse,
) {
  if (item.kind !== 'episode') {
    return item.artwork;
  }

  return seriesItem?.artwork ?? item.artwork;
}

export function buildPlayerPoster(
  item: ItemDetailResponse | undefined,
  seriesItem: ItemDetailResponse | undefined,
) {
  if (!item) {
    return undefined;
  }

  if (item.kind === 'episode') {
    return (
      seriesItem?.artwork.bannerUrl ??
      seriesItem?.artwork.backdropUrl ??
      seriesItem?.artwork.posterUrl ??
      seriesItem?.artwork.thumbUrl ??
      item.artwork.bannerUrl ??
      item.artwork.backdropUrl ??
      item.artwork.posterUrl ??
      item.artwork.thumbUrl
    );
  }

  return (
    item.artwork.bannerUrl ??
    item.artwork.backdropUrl ??
    item.artwork.posterUrl ??
    item.artwork.thumbUrl
  );
}

export function buildEpisodeListArtwork(item: MediaCardSummary) {
  return item.artwork;
}

export function scheduleDeferredQuery(task: () => void) {
  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

  if (typeof idleWindow.requestIdleCallback === 'function') {
    const idleHandle = idleWindow.requestIdleCallback(task, {
      timeout: DETAIL_QUERY_IDLE_TIMEOUT,
    });
    return () => idleWindow.cancelIdleCallback?.(idleHandle);
  }

  const timer = window.setTimeout(task, DETAIL_QUERY_FALLBACK_DELAY);
  return () => window.clearTimeout(timer);
}

function buildFullUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${window.location.origin}${url}`;
}

function formatDurationLabel(seconds?: number) {
  if (!seconds || seconds <= 0) {
    return undefined;
  }

  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes} 分钟`;
  }

  return minutes > 0 ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`;
}
