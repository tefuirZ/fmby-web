import { httpClient } from '@/shared/api/client';
import type {
  TaskCenterAction,
  TaskCenterActionResponse,
  TaskCenterCategory,
  TaskCenterCategoryKpiRecord,
  TaskCenterItemDetailRecord,
  TaskCenterItemRecord,
  TaskCenterListQuery,
  TaskCenterListResponse,
  TaskCenterOverviewRecord,
  TaskCenterStatus,
  TaskCenterTimelineEntryRecord,
} from './types';

interface RawTaskCenterCategoryKpi {
  category: TaskCenterCategory;
  total: number;
  running: number;
  failed: number;
  today_succeeded: number;
}

interface RawTaskCenterOverview {
  categories: RawTaskCenterCategoryKpi[];
  total: number;
  running: number;
  failed: number;
  today_succeeded: number;
  today_start_utc: string;
}

interface RawTaskCenterItem {
  category: TaskCenterCategory;
  id: string;
  status: TaskCenterStatus;
  created_at: string;
  updated_at: string;
  media_item_id?: string | null;
  media_title?: string | null;
  retry_count: number;
  last_error_code?: string | null;
  last_error_message?: string | null;
  summary: string;
}

interface RawTaskCenterTimelineEntry {
  at: string;
  status: TaskCenterStatus;
  message?: string | null;
}

interface RawTaskCenterDetail extends RawTaskCenterItem {
  raw_payload: unknown;
  timeline: RawTaskCenterTimelineEntry[];
}

interface RawTaskCenterListResponse {
  items: RawTaskCenterItem[];
  total: number;
  page: number;
  size: number;
}

interface RawTaskCenterActionResponse {
  item: RawTaskCenterItem;
  redirect_hint?: string | null;
  redirect_to?: string | null;
}

function mapCategoryKpi(raw: RawTaskCenterCategoryKpi): TaskCenterCategoryKpiRecord {
  return {
    category: raw.category,
    total: raw.total,
    running: raw.running,
    failed: raw.failed,
    todaySucceeded: raw.today_succeeded,
  };
}

function mapItem(raw: RawTaskCenterItem): TaskCenterItemRecord {
  return {
    category: raw.category,
    id: raw.id,
    status: raw.status,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    mediaItemId: raw.media_item_id ?? undefined,
    mediaTitle: raw.media_title ?? undefined,
    retryCount: raw.retry_count,
    lastErrorCode: raw.last_error_code ?? undefined,
    lastErrorMessage: raw.last_error_message ?? undefined,
    summary: raw.summary,
  };
}

function mapTimelineEntry(raw: RawTaskCenterTimelineEntry): TaskCenterTimelineEntryRecord {
  return {
    at: raw.at,
    status: raw.status,
    message: raw.message ?? undefined,
  };
}

function mapOverview(raw: RawTaskCenterOverview): TaskCenterOverviewRecord {
  return {
    categories: raw.categories.map(mapCategoryKpi),
    total: raw.total,
    running: raw.running,
    failed: raw.failed,
    todaySucceeded: raw.today_succeeded,
    todayStartUtc: raw.today_start_utc,
  };
}

function mapDetail(raw: RawTaskCenterDetail): TaskCenterItemDetailRecord {
  return {
    ...mapItem(raw),
    rawPayload: raw.raw_payload,
    timeline: (raw.timeline ?? []).map(mapTimelineEntry),
  };
}

function mapActionResponse(raw: RawTaskCenterActionResponse): TaskCenterActionResponse {
  return {
    item: mapItem(raw.item),
    redirectHint: raw.redirect_hint ?? undefined,
    redirectTo: raw.redirect_to ?? undefined,
  };
}

export const taskCenterApi = {
  async getOverview(): Promise<TaskCenterOverviewRecord> {
    const raw = await httpClient.get<RawTaskCenterOverview>('/api/manage/task-center/overview');
    return mapOverview(raw);
  },

  async getItems(query: TaskCenterListQuery): Promise<TaskCenterListResponse> {
    const raw = await httpClient.get<RawTaskCenterListResponse>('/api/manage/task-center/items', {
      params: {
        category: query.category,
        status: query.status,
        from: query.from,
        to: query.to,
        page: query.page,
        size: query.size,
      },
    });
    return {
      items: raw.items.map(mapItem),
      total: raw.total,
      page: raw.page,
      size: raw.size,
    };
  },

  async getItem(
    category: TaskCenterCategory,
    taskId: string,
  ): Promise<TaskCenterItemDetailRecord> {
    const raw = await httpClient.get<RawTaskCenterDetail>(
      `/api/manage/task-center/items/${category}/${taskId}`,
    );
    return mapDetail(raw);
  },

  async runAction(
    category: TaskCenterCategory,
    taskId: string,
    action: TaskCenterAction,
  ): Promise<TaskCenterActionResponse> {
    const raw = await httpClient.post<RawTaskCenterActionResponse>(
      `/api/manage/task-center/items/${category}/${taskId}/actions`,
      {
        body: {
          action,
        },
      },
    );
    return mapActionResponse(raw);
  },
};
