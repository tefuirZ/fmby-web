import type {
  ManageMediaItemListRecord,
  ManageMediaItemSourceRecord,
  ManageMediaItemSourceStatus,
  ManageMediaItemMetadataStatus,
} from '@/domains/manage/media-items';
import type { StatusBadgeVariant } from '@/shared/ui';

export function getSourceStatusLabel(status: ManageMediaItemSourceStatus) {
  switch (status) {
    case 'playable':
      return '可播放';
    case 'pending-validation':
      return '待校验';
    case 'unreachable':
      return '不可达';
    case 'unsupported':
      return '不支持';
    case 'auth-expired':
      return '凭证过期';
    default:
      return '状态缺失';
  }
}

export function getSourceStatusVariant(
  status: ManageMediaItemSourceStatus,
): StatusBadgeVariant {
  switch (status) {
    case 'playable':
      return 'success';
    case 'pending-validation':
      return 'warning';
    case 'unreachable':
    case 'unsupported':
    case 'auth-expired':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function getMetadataStatusLabel(status: ManageMediaItemMetadataStatus) {
  switch (status) {
    case 'success':
      return '元数据正常';
    case 'pending':
      return '等待解析';
    case 'failed':
      return '解析失败';
    default:
      return '元数据缺失';
  }
}

export function getMetadataStatusVariant(
  status: ManageMediaItemMetadataStatus,
): StatusBadgeVariant {
  switch (status) {
    case 'success':
      return 'success';
    case 'pending':
      return 'warning';
    case 'failed':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function buildOverrideSummary(item: ManageMediaItemListRecord) {
  const tags = [];

  if (item.hasLocalMetadataOverride) {
    tags.push('元数据');
  }
  if (item.hasLocalArtworkOverride) {
    tags.push('图片');
  }
  if (item.hasLocalSubtitleOverride) {
    tags.push('字幕');
  }

  return tags.length > 0 ? tags.join(' / ') : '无';
}

export function formatSourcePreview(source: ManageMediaItemSourceRecord) {
  return `${source.mountName} · ${source.filePath}`;
}

export function buildOwnershipSummary(item: ManageMediaItemListRecord) {
  const parts = [item.libraryName];

  if (item.seriesTitle) {
    parts.push(item.seriesTitle);
  }

  if (item.mediaType === 'episode') {
    const seasonLabel =
      item.seasonTitle ??
      (item.seasonNumber ? `第 ${item.seasonNumber} 季` : undefined);
    if (seasonLabel) {
      parts.push(seasonLabel);
    }
  }

  return parts.join(' / ');
}

export function buildItemCode(item: ManageMediaItemListRecord) {
  if (
    item.mediaType === 'episode' &&
    item.seasonNumber !== undefined &&
    item.episodeNumber !== undefined
  ) {
    return `S${String(item.seasonNumber).padStart(2, '0')}E${String(item.episodeNumber).padStart(2, '0')}`;
  }

  if (item.mediaType === 'season' && item.seasonNumber !== undefined) {
    return `S${String(item.seasonNumber).padStart(2, '0')}`;
  }

  return null;
}
