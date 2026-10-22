import type {
  TaskCenterAction,
  TaskCenterCategory,
  TaskCenterItemRecord,
  TaskCenterStatus,
} from '@fmby/v2-shared/contracts/manage/task-center';
import { formatRelativeTime } from '@fmby/v2-shared/time';
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

/**
 * 任务行/卡/抽屉统一使用的「媒体」文案。
 *
 * ★后端口径（`crates/fmby-v2-application/src/task_center.rs` 的 `TaskCenterItem`）：
 *   - `media_title` **恒 `None`**（V2 `task_definition` 无媒体标题列，跨域 join 登记后续卡）；
 *   - `media_item_id` 从 idempotency_key 解析，可能为 `Some`。
 *
 * ⇒ 改前各处的 `item.mediaTitle ?? '系统级任务'` 会把**所有**任务都说成「系统级任务」，
 *   包括明明绑定了媒体项的刮削任务（`mediaItemId` 有值）。判「是不是系统级任务」
 *   只能看 **mediaItemId**，不能拿一个恒空的标题字段当判据。
 */
export function getTaskMediaLabel(item: {
  mediaTitle?: string | null;
  mediaItemId?: string | null;
}): string {
  if (item.mediaTitle) return item.mediaTitle;
  if (item.mediaItemId) return `媒体 ${item.mediaItemId}`;
  return '系统级任务';
}

/**
 * 任务时间列的第二行（相对时间）。
 *
 * ★后端 `updated_at` 是 `Option`：**在途任务没有终态时刻 ⇒ null**。
 *   改前直接调 `formatRelativeTime(null)` ⇒ 兜底文案「刚刚更新」，
 *   等于把「八小时前开始、至今没结束」说成「刚刚更新」。没终态时刻就照实说。
 */
export function getTaskTimeHint(updatedAt?: string | null): string {
  return updatedAt ? formatRelativeTime(updatedAt) : '尚无终态时刻';
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
