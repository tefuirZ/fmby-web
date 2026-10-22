export type TaskCenterCategory =
  | 'Scan'
  | 'Identify'
  | 'Scrape'
  | 'AiAssist'
  | 'Review'
  | 'Tombstone';

export type TaskCenterStatus =
  | 'Queued'
  | 'Running'
  | 'RetryWaiting'
  | 'Failed'
  | 'Succeeded'
  | 'NeedsReview'
  | 'Cancelled'
  | 'Skipped';

export type TaskCenterAction = 'Retry' | 'Cancel' | 'Skip' | 'Resolve';

export interface TaskCenterCategoryKpiRecord {
  category: TaskCenterCategory;
  total: number;
  running: number;
  failed: number;
  todaySucceeded: number;
}

export interface TaskCenterOverviewRecord {
  categories: TaskCenterCategoryKpiRecord[];
  total: number;
  running: number;
  failed: number;
  todaySucceeded: number;
  todayStartUtc: string;
}

export interface TaskCenterItemRecord {
  category: TaskCenterCategory;
  id: string;
  status: TaskCenterStatus;
  createdAt: string;
  /**
   * 终态时刻（ISO）。★后端 `updated_at` 是 `Option`：**在途任务为 null**
   * （`crates/fmby-v2-application/src/task_center.rs` 的 `TaskCenterItem.updated_at`）
   * ⇒ 前端必须按「可能没有」处理，不许当成恒有值。
   */
  updatedAt?: string;
  mediaItemId?: string;
  mediaTitle?: string;
  retryCount: number;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  summary: string;
}

export interface TaskCenterTimelineEntryRecord {
  at: string;
  status: TaskCenterStatus;
  message?: string;
}

export interface TaskCenterItemDetailRecord extends TaskCenterItemRecord {
  rawPayload: unknown;
  timeline: TaskCenterTimelineEntryRecord[];
}

export interface TaskCenterListQuery {
  category?: TaskCenterCategory;
  status?: TaskCenterStatus;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

export interface TaskCenterListResponse {
  items: TaskCenterItemRecord[];
  total: number;
  page: number;
  size: number;
}

export interface TaskCenterActionResponse {
  item: TaskCenterItemRecord;
  redirectHint?: string;
  redirectTo?: string;
}
