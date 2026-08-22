import type {
  TaskCenterAction,
  TaskCenterCategory,
  TaskCenterItemRecord,
  TaskCenterStatus,
} from '@/domains/manage/task-center';
import type { FlashState, RangePreset } from './types';
import { CST_OFFSET_MS } from './constants';

export function buildRangePreset(preset: RangePreset): { from?: string; to?: string } {
  const now = new Date();
  switch (preset) {
    case 'today':
      return {
        from: getCstTodayStartIso(now),
        to: now.toISOString(),
      };
    case '7d':
      return {
        from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        to: now.toISOString(),
      };
    case '30d':
      return {
        from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        to: now.toISOString(),
      };
    case 'all':
    default:
      return {};
  }
}

export function getCstTodayStartIso(now: Date): string {
  const cstNow = new Date(now.getTime() + CST_OFFSET_MS);
  const cstMidnightUtcMs =
    Date.UTC(cstNow.getUTCFullYear(), cstNow.getUTCMonth(), cstNow.getUTCDate(), 0, 0, 0, 0) -
    CST_OFFSET_MS;
  return new Date(cstMidnightUtcMs).toISOString();
}

export function getCategoryLabel(category: TaskCenterCategory): string {
  switch (category) {
    case 'Scan':
      return '扫描';
    case 'Identify':
      return '识别';
    case 'Scrape':
      return '刮削';
    case 'AiAssist':
      return 'AI 辅助';
    case 'Review':
      return '审核';
    case 'Tombstone':
      return '墓碑';
  }
}

export function getStatusLabel(status: TaskCenterStatus): string {
  switch (status) {
    case 'Queued':
      return '排队中';
    case 'Running':
      return '进行中';
    case 'RetryWaiting':
      return '等待重试';
    case 'Failed':
      return '失败';
    case 'Succeeded':
      return '已成功';
    case 'NeedsReview':
      return '待处理';
    case 'Cancelled':
      return '已取消';
    case 'Skipped':
      return '已跳过';
  }
}

export function mapStatusVariant(status: TaskCenterStatus): string {
  switch (status) {
    case 'Queued':
      return 'queued';
    case 'Running':
      return 'running';
    case 'RetryWaiting':
      return 'retry-waiting';
    case 'Failed':
      return 'failed';
    case 'Succeeded':
      return 'succeeded';
    case 'NeedsReview':
      return 'warning';
    case 'Cancelled':
      return 'disabled';
    case 'Skipped':
      return 'neutral';
  }
}

export function buildTaskActions(item: TaskCenterItemRecord): Array<{
  action: TaskCenterAction;
  label: string;
  tone?: 'danger';
}> {
  switch (item.category) {
    case 'Identify':
      return [{ action: 'Retry', label: '重试识别' }];
    case 'Scrape':
      return [
        { action: 'Retry', label: '重试刮削' },
        { action: 'Skip', label: '跳过 / 取消', tone: 'danger' },
      ];
    case 'AiAssist':
      return [
        { action: 'Retry', label: '重试 AI' },
        { action: 'Cancel', label: '取消 AI', tone: 'danger' },
      ];
    case 'Tombstone':
      return [{ action: 'Resolve', label: '标记已恢复' }];
    case 'Scan':
      return [{ action: 'Retry', label: '重新派发' }];
    case 'Review':
    default:
      return [];
  }
}

export function showFlash(
  setFlash: (value: FlashState | null) => void,
  title: string,
  description: string,
) {
  setFlash({ title, description });
  window.setTimeout(() => {
    setFlash(null);
  }, 2600);
}
