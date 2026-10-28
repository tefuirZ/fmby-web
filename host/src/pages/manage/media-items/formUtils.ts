import type {
  ManageMediaItemListRecord,
  ManageMediaItemSourceRecord,
  ManageMediaItemSourceStatus,
  ManageMediaItemMetadataStatus,
} from '@fmby/v2-shared/contracts/manage/media-items';
import type { StatusBadgeVariant } from '@fmby/v2-shared/ui';

// ★W-A-RESUME：后端二元真值 mounted/missing（旧 V1 词表已废，旧行把 mounted
// 落进 default ⇒ 每行都显示「状态缺失」）。default 仅对未知值 fail-soft。
export function getSourceStatusLabel(status: ManageMediaItemSourceStatus) {
  switch (status) {
    case 'mounted':
      return '已挂载';
    case 'missing':
      return '来源缺失';
    default:
      return '状态缺失';
  }
}

export function getSourceStatusVariant(
  status: ManageMediaItemSourceStatus,
): StatusBadgeVariant {
  switch (status) {
    case 'mounted':
      return 'success';
    case 'missing':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function getMetadataStatusLabel(status: ManageMediaItemMetadataStatus) {
  switch (status) {
    case 'identified':
      return '已识别';
    case 'missing':
      return '元数据缺失';
    default:
      return '元数据缺失';
  }
}

export function getMetadataStatusVariant(
  status: ManageMediaItemMetadataStatus,
): StatusBadgeVariant {
  switch (status) {
    case 'identified':
      return 'success';
    case 'missing':
      return 'neutral';
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
