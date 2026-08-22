/**
 * 管理端媒体资源详情页的取值与文案格式化。
 *
 * 约定：
 * - 后端流水线相关字段（任务状态、绑定状态、匹配方式、刮削来源）是原样透传的
 *   PascalCase 字符串，映射层没有收敛成联合类型。这里统一「归一化成小写再查表」，
 *   查不到就把原值显示出来 —— 宁可露出后端原文，也不要用一个假的中文标签把
 *   真实状态盖掉。
 * - 缺值一律显示 EM_DASH，不显示 0 / null / undefined。
 */

import type {
  ManageMediaItemMetadataSourceType,
  ManageMediaItemMountStatus,
} from '@fmby/v2-shared/contracts/manage/media-items';
import type { StatusBadgeVariant } from '@fmby/v2-shared/ui';
import { formatDuration } from '@fmby/v2-shared/time';

/** 缺值占位符，全页统一。 */
export const EM_DASH = '—';

/** 1 tick = 100 纳秒，后端沿用 Emby 系的时长单位。 */
const TICKS_PER_SECOND = 10_000_000;

function normalizeKey(value: string): string {
  return value.replace(/[\s_-]/g, '').toLowerCase();
}

/** 把可能为空的标量收敛成可直接渲染的字符串。 */
export function formatOptional(value?: string | number | null): string {
  if (value === undefined || value === null) {
    return EM_DASH;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toLocaleString('zh-CN') : EM_DASH;
  }
  const trimmed = value.trim();
  return trimmed === '' ? EM_DASH : trimmed;
}

/** 列表字段（类型、导演、制片方）统一用顿号连接。 */
export function formatList(values: readonly string[]): string {
  const cleaned = values.map((value) => value.trim()).filter((value) => value !== '');
  return cleaned.length > 0 ? cleaned.join('、') : EM_DASH;
}

export function formatBoolean(value: boolean, truthy = '是', falsy = '否'): string {
  return value ? truthy : falsy;
}

export function formatFileSize(bytes?: number): string {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes <= 0) {
    return EM_DASH;
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const digits = unitIndex === 0 ? 0 : size >= 100 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(digits)} ${units[unitIndex]}`;
}

export function formatTicksDuration(ticks?: number): string {
  if (ticks === undefined || !Number.isFinite(ticks) || ticks <= 0) {
    return EM_DASH;
  }
  return formatDuration(ticks / TICKS_PER_SECOND);
}

export function formatBitrate(bitsPerSecond?: number): string {
  if (bitsPerSecond === undefined || !Number.isFinite(bitsPerSecond) || bitsPerSecond <= 0) {
    return EM_DASH;
  }
  if (bitsPerSecond >= 1_000_000) {
    return `${(bitsPerSecond / 1_000_000).toFixed(2)} Mbps`;
  }
  return `${Math.round(bitsPerSecond / 1000)} kbps`;
}

export function formatResolution(width?: number, height?: number): string {
  if (!width || !height) {
    return EM_DASH;
  }
  return `${width} × ${height}`;
}

export function formatRating(rating?: number): string {
  if (rating === undefined || !Number.isFinite(rating)) {
    return EM_DASH;
  }
  return rating.toFixed(1);
}

export function formatConfidence(confidence?: number): string {
  if (confidence === undefined || !Number.isFinite(confidence)) {
    return EM_DASH;
  }
  // 后端可能给 0~1 的小数，也可能已经是百分制，这里按量级判断
  const percent = confidence <= 1 ? confidence * 100 : confidence;
  return `${percent.toFixed(0)}%`;
}

export function getMountStatusLabel(status: ManageMediaItemMountStatus): string {
  switch (status) {
    case 'active':
      return '挂载正常';
    case 'unreachable':
      return '挂载不可达';
    case 'disabled':
      return '挂载已停用';
    default:
      return '挂载缺失';
  }
}

export function getMountStatusVariant(
  status: ManageMediaItemMountStatus,
): StatusBadgeVariant {
  switch (status) {
    case 'active':
      return 'success';
    case 'unreachable':
      return 'danger';
    case 'disabled':
      return 'warning';
    default:
      return 'neutral';
  }
}

/** 兼容 artworkOverrides 的枚举与 scrapedArtworks 的自由字符串，统一按字符串查表。 */
export function getArtworkKindLabel(kind: string): string {
  switch (normalizeKey(kind)) {
    case 'poster':
      return '海报';
    case 'backdrop':
      return '背景图';
    case 'thumb':
      return '缩略图';
    case 'logo':
      return '标识图';
    case 'banner':
      return '横幅图';
    default:
      return kind;
  }
}

/** 背景图与缩略图是横构图，预览框需要换宽高比。 */
export function isWideArtwork(kind: string): boolean {
  const key = normalizeKey(kind);
  return key === 'backdrop' || key === 'thumb' || key === 'banner';
}

export function getMetadataSourceTypeLabel(
  sourceType: ManageMediaItemMetadataSourceType,
): string {
  switch (sourceType) {
    case 'nfo':
      return '随文件的 NFO';
    case 'manual':
      return '人工录入';
    case 'scraped':
      return '刮削获取';
    default:
      return '来源未标注';
  }
}

/** 当前生效的元数据来源（pipeline.currentMetadataSource）。 */
export function formatMetadataSourceLabel(source: string): string {
  switch (normalizeKey(source)) {
    case 'nfo':
      return '随文件的 NFO';
    case 'manual':
    case 'localoverride':
      return '本地覆盖';
    case 'scraped':
      return '刮削获取';
    case 'none':
    case '':
      return '尚无来源';
    default:
      return source;
  }
}

export function formatPipelineStatusLabel(status: string): string {
  switch (normalizeKey(status)) {
    case 'queued':
      return '排队中';
    case 'running':
      return '执行中';
    case 'retrywaiting':
      return '等待重试';
    case 'succeeded':
    case 'success':
    case 'completed':
      return '已完成';
    case 'failed':
    case 'failure':
      return '已失败';
    case 'cancelled':
    case 'canceled':
      return '已取消';
    case 'skipped':
      return '已跳过';
    case 'idle':
      return '空闲';
    default:
      return status;
  }
}

export function getPipelineStatusVariant(status: string): StatusBadgeVariant {
  switch (normalizeKey(status)) {
    case 'succeeded':
    case 'success':
    case 'completed':
      return 'success';
    case 'running':
      return 'info';
    case 'queued':
    case 'retrywaiting':
    case 'idle':
      return 'warning';
    case 'failed':
    case 'failure':
    case 'cancelled':
    case 'canceled':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function formatBindingStateLabel(state: string): string {
  switch (normalizeKey(state)) {
    case 'active':
      return '已生效';
    case 'pending':
      return '待确认';
    case 'candidate':
      return '候选';
    case 'rejected':
      return '已否决';
    case 'superseded':
      return '已被替换';
    default:
      return state;
  }
}

export function getBindingStateVariant(state: string): StatusBadgeVariant {
  switch (normalizeKey(state)) {
    case 'active':
      return 'success';
    case 'pending':
    case 'candidate':
      return 'warning';
    case 'rejected':
    case 'superseded':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function formatMatchMethodLabel(method: string): string {
  switch (normalizeKey(method)) {
    case 'manual':
      return '人工指定';
    case 'auto':
    case 'automatic':
      return '自动匹配';
    case 'nfo':
      return '读取 NFO';
    case 'filename':
      return '文件名解析';
    case 'externalid':
      return '外部编号命中';
    case 'search':
      return '搜索命中';
    default:
      return method;
  }
}

export function formatEntityTypeLabel(entityType: string): string {
  switch (normalizeKey(entityType)) {
    case 'movie':
      return '电影';
    case 'series':
      return '剧集';
    case 'season':
      return '季';
    case 'episode':
      return '单集';
    case 'music':
      return '音乐';
    case 'musicalbum':
      return '专辑';
    case 'musicartist':
      return '艺术家';
    default:
      return entityType;
  }
}

export function formatReviewStatusLabel(status: string): string {
  switch (normalizeKey(status)) {
    case 'approved':
      return '已通过复核';
    case 'pending':
    case 'pendingreview':
      return '待复核';
    case 'rejected':
      return '复核未通过';
    case 'none':
      return '无需复核';
    default:
      return status;
  }
}

export function formatScrapeOutcomeLabel(outcome: string): string {
  switch (normalizeKey(outcome)) {
    case 'enqueued':
    case 'created':
      return '已加入刮削队列';
    case 'reused':
    case 'existing':
      return '已复用队列中的既有任务';
    case 'reset':
    case 'refreshed':
      return '已重置并重新排队';
    case 'skipped':
      return '已跳过';
    default:
      return outcome;
  }
}

/** 操作人展示名：优先显示名，其次用户名，最后回落到用户 ID。 */
export function formatOperator(
  displayName?: string,
  username?: string,
  userId?: string,
): string {
  return displayName?.trim() || username?.trim() || userId?.trim() || EM_DASH;
}

/** 归一化 `premiered`，`<input type="date">` 只接受 YYYY-MM-DD。 */
export function toDateInputValue(value?: string): string {
  if (!value) {
    return '';
  }
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return match ? match[1] : '';
}
