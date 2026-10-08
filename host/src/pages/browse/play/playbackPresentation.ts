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

/**
 * F-28（fmby-web#2）：相邻集解析。
 *
 * 修法（按卡面「邻居解析用真实 seasonId+episodeNumber；拿不到就禁用按钮，不伪造」）：
 * 1. **删掉 `episode-${200+n}` 合成 id**。该编码前后端均无出处：后端
 *    `fmby-v2-application/src/task_center.rs:786` 的 `media_item_id_from_key` 表明
 *    item_id 是 provider **纯数字串**；全 `crates/` 仅 3 处 `"episode-N"` 字面量，
 *    全在 `fmby-v2-search/src/runtime_tests.rs` 测试夹具里，与 `200+` 无关。
 * 2. **删掉 `episode-(\d+)$` 反推**。真实 id 下该正则恒不命中（已实测 9001 /
 *    e-s02e01 / tt0111161 全部 false）⇒ 右侧恒 NaN ⇒ 是死代码。
 * 3. **按 `seasonId` 分组取相邻**。不能用 `seasonNumber`：后端 bridge 建卡时
 *    `season_number`/`episode_number` 硬编码 `None`（browse/service.rs:110-113、
 *    610-613；manage_media/convert.rs:87），恒为 undefined；且前端
 *    `browse/api.ts:162` 回退链含 `index_number`，只有集号时会把 seasonNumber
 *    填成**集号**（实测 E01/E02/E03 ⇒ 1/2/3），按它分组会把当季每集拆散。
 *    `seasonId` 是当前唯一可靠的同季判据（来自 `node_parent_context`）。
 *
 * 退化：卡片无 `seasonId` 时全部归入同一组，退回原有「整剧平铺」行为（仍不伪造
 * id）——此时与修复前一致，不产生新的用户可见回退。
 */
export function resolveAdjacentEpisodes(args: {
  currentItemId: string | undefined;
  siblings: MediaCardSummary[];
  isEpisodeView: boolean;
  seasonId?: string;
}) {
  const { currentItemId, siblings, isEpisodeView, seasonId } = args;
  const resolved = resolveEpisodeNeighbors(currentItemId, siblings);
  if (!isEpisodeView) {
    return resolved;
  }
  // 同季分组：无 seasonId 的卡片归入同一组（键 null），保持原有平铺语义。
  const sameSeason = siblings.filter((card) => (card.seasonId ?? null) === (seasonId ?? null));
  const indexInSeason = currentItemId
    ? sameSeason.findIndex(
        (card) => card.id === currentItemId || card.playbackTargetId === currentItemId,
      )
    : -1;
  return {
    ...resolved,
    previous: indexInSeason > 0 ? sameSeason[indexInSeason - 1] : undefined,
    next:
      indexInSeason >= 0 && indexInSeason < sameSeason.length - 1
        ? sameSeason[indexInSeason + 1]
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
