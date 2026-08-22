import type { ManageLibraryRecord } from '@/domains/manage';
import type { NamingCleanupPreviewResponse } from '@/domains/manage/naming';

/**
 * 指标项目类型
 */
export interface MetricItem {
  label: string;
  value: number;
  trend: string;
  status: string;
}

/**
 * 预览查询状态
 */
export interface PreviewQueryState {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  data?: NamingCleanupPreviewResponse;
}

/**
 * 媒体库查询状态
 */
export interface LibrariesState {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  items: ManageLibraryRecord[];
}
