import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { manageApi } from '@/domains/manage';
import {
  mediaItemsApi,
  type ManageMediaItemsQuery,
  type ManageMediaItemPipelineRecord,
} from '@/domains/manage/media-items';
import { queryKeys } from '@/shared/query-keys';

function requireMediaItemId(itemId?: string) {
  if (!itemId) {
    throw new Error('缺少媒体资源 ID');
  }
  return itemId;
}

const ACTIVE_PIPELINE_TASK_STATUSES = new Set(['Queued', 'Running', 'RetryWaiting']);

function hasActivePipelineTaskStatus(status?: string) {
  return status ? ACTIVE_PIPELINE_TASK_STATUSES.has(status) : false;
}

export function isManageMediaItemPipelineActive(
  pipeline?: ManageMediaItemPipelineRecord,
) {
  return (
    hasActivePipelineTaskStatus(pipeline?.identifyTask?.status) ||
    hasActivePipelineTaskStatus(pipeline?.scrapeTask?.status)
  );
}

export function useManageMediaItemsQuery(query: ManageMediaItemsQuery) {
  return useQuery({
    queryKey: queryKeys.manage.mediaItems.list(query as Record<string, unknown>),
    queryFn: () => mediaItemsApi.getMediaItems(query),
    placeholderData: keepPreviousData,
  });
}

export function useManageMediaItemLibrariesQuery() {
  return useQuery({
    queryKey: queryKeys.manage.libraries.list(),
    queryFn: () => manageApi.getLibraries(),
    staleTime: 60_000,
  });
}

export function useManageMediaItemDetailQuery(
  itemId?: string,
  options?: {
    refetchIntervalMs?: number | false;
  },
) {
  return useQuery({
    queryKey: queryKeys.manage.mediaItems.detail(itemId),
    queryFn: () => mediaItemsApi.getMediaItemDetail(requireMediaItemId(itemId)),
    enabled: Boolean(itemId),
    refetchInterval: options?.refetchIntervalMs ?? false,
    refetchIntervalInBackground: Boolean(options?.refetchIntervalMs),
  });
}

export function useManageMediaItemPipelineQuery(itemId?: string) {
  return useQuery({
    queryKey: queryKeys.manage.mediaItems.pipeline(itemId),
    queryFn: () => mediaItemsApi.getMediaItemPipeline(requireMediaItemId(itemId)),
    enabled: Boolean(itemId),
    staleTime: 10_000,
    refetchInterval: (query) =>
      isManageMediaItemPipelineActive(
        query.state.data as ManageMediaItemPipelineRecord | undefined,
      )
        ? 3_000
        : false,
    refetchIntervalInBackground: true,
  });
}
