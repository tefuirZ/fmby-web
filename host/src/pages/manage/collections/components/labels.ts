/** 合集页共享标签与表单工具（V1F 拆分）。 */

import type {
  CollectionVisibility,
  ManagedCollectionRecord,
} from '@fmby/v2-shared/contracts/manage/peripherals';
import type { CollectionFormState } from './CollectionFormDialog';

export const VISIBILITY_LABELS: Record<CollectionVisibility, string> = {
  Active: '对外可见',
  Hidden: '已隐藏',
};

export const SOURCE_LABELS: Record<string, string> = {
  manual: '手工创建',
  douban_doulist: '豆瓣片单同步',
  preset: '预设合集',
};

export function createInitialFormState(): CollectionFormState {
  return { title: '', overview: '', posterUrl: '', visibility: 'Active' };
}

export function buildFormStateFromRecord(record: ManagedCollectionRecord): CollectionFormState {
  return {
    title: record.title,
    overview: record.overview ?? '',
    posterUrl: record.posterUrl ?? '',
    visibility: record.visibility,
  };
}

export function formatEpochMs(epochMs: number): string {
  if (!Number.isFinite(epochMs) || epochMs <= 0) {
    return '—';
  }
  return new Date(epochMs).toLocaleString('zh-CN', { hour12: false });
}
