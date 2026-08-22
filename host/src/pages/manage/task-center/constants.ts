import type { TaskCenterCategory, TaskCenterStatus } from '@/domains/manage/task-center';
import type { RangePreset } from './types';

export const PAGE_SIZE = 20;
export const CST_OFFSET_MS = 8 * 60 * 60 * 1000;

export const CATEGORY_ORDER: TaskCenterCategory[] = [
  'Scan',
  'Identify',
  'Scrape',
  'AiAssist',
  'Review',
  'Tombstone',
];

export const CATEGORY_GROUPS: Array<{
  title: string;
  description: string;
  categories: TaskCenterCategory[];
}> = [
  {
    title: '入库流水线',
    description: '从扫描、识别到刮削与 AI 辅助，先看系统在跑什么。',
    categories: ['Scan', 'Identify', 'Scrape', 'AiAssist'],
  },
  {
    title: '异常与审核',
    description: '需要人工留意或补处理的异常入口。',
    categories: ['Review', 'Tombstone'],
  },
];

export const STATUS_OPTIONS: Array<{ value: 'all' | TaskCenterStatus; label: string }> = [
  { value: 'all', label: '全部状态' },
  { value: 'Queued', label: '排队中' },
  { value: 'Running', label: '进行中' },
  { value: 'RetryWaiting', label: '等待重试' },
  { value: 'Failed', label: '失败' },
  { value: 'Succeeded', label: '成功' },
  { value: 'NeedsReview', label: '待处理' },
  { value: 'Cancelled', label: '已取消' },
  { value: 'Skipped', label: '已跳过' },
];

export const RANGE_OPTIONS: Array<{ value: RangePreset; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'today', label: '今日' },
  { value: '7d', label: '7 天' },
  { value: '30d', label: '30 天' },
];
