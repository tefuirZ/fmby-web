/**
 * 卡片展示派生（WEB-B1 上移自 `apps/host/src/pages/browse/components/utils.ts`）。
 *
 * 这些是**纯展示派生**（DTO → 展示字符串），属 view-model 层职责：主题（L3）
 * 与页面都消费同一份派生，避免卡片元信息在不同渲染层出现两套写法。
 */

import type { MediaCardSummary } from '@fmby/v2-shared/contracts/browse';

/** 卡片元信息行（年份 / 类型 / 时长或集数 / 分辨率 / 分级）。 */
export function buildMediaMeta(item: MediaCardSummary): string[] {
  const runtimeLabel =
    item.kind === 'series' || item.kind === 'season'
      ? item.itemCount
        ? `${item.itemCount} 集`
        : undefined
      : item.durationSeconds
        ? formatCompactDuration(item.durationSeconds)
        : undefined;

  return [
    item.year ? String(item.year) : undefined,
    item.kindLabel,
    runtimeLabel,
    item.resolutionLabel,
    item.ratingLabel,
  ].filter((entry): entry is string => Boolean(entry));
}

/** 紧凑时长（2小时15分 / 45分）。 */
export function formatCompactDuration(seconds?: number): string | undefined {
  if (!seconds) return undefined;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}小时${minutes > 0 ? `${minutes}分` : ''}`;
  }
  return `${minutes}分`;
}

/** 进度文案（已看完 / 剩余提示 / 已观看 N%）。 */
export function buildCardProgressLabel(item: MediaCardSummary): string | undefined {
  if (!item.progress) {
    return undefined;
  }

  if (item.progress.completed) {
    return '已看完';
  }

  const contextLabel = normalizeCardContextLabel(item.progress.remainingLabel ?? item.subtitle);
  return contextLabel ?? `已观看 ${Math.round(item.progress.progressPercent)}%`;
}

function normalizeCardContextLabel(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value
    .replace(/^(播放到|更新至)\s*/u, '')
    .replace(/\s+/gu, ' ')
    .trim();

  return normalized || undefined;
}

/** 可播放目标 id（不可播放时 undefined，供路由判定）。 */
export function resolvePlayableTargetId(item: MediaCardSummary): string | undefined {
  if (item.availabilityNotice) {
    return undefined;
  }

  return item.playbackTargetId ?? (item.hasPlayableSource ? item.id : undefined);
}
