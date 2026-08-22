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
  updatedAt: string;
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
