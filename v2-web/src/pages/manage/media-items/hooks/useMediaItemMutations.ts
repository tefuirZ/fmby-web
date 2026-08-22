import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DangerousActionRequest } from '@/domains/manage';
import {
  mediaItemsApi,
  type ManageMediaItemDetailRecord,
  type RequestManageMediaItemScrapeOptions,
  type UpdateManageMediaItemSubtitleOverrideRequest,
  type UpdateManageMediaItemMetadataRequest,
  type UploadManageMediaItemArtworkRequest,
  type UploadManageMediaItemSubtitleRequest,
} from '@/domains/manage/media-items';
import { queryKeys } from '@/shared/query-keys';

function requireMediaItemId(itemId?: string) {
  if (!itemId) {
    throw new Error('缺少媒体资源 ID');
  }
  return itemId;
}

export function useManageMediaItemMetadataMutations(itemId?: string) {
  const queryClient = useQueryClient();

  const writeDetailCache = (detail: ManageMediaItemDetailRecord) => {
    queryClient.setQueryData(queryKeys.manage.mediaItems.detail(detail.item.id), detail);
  };

  const invalidateMediaItemQueries = async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.manage.mediaItems.all(),
    });
  };

  const invalidateCurrentDetail = async () => {
    if (!itemId) {
      return;
    }
    await queryClient.invalidateQueries({
      queryKey: queryKeys.manage.mediaItems.detail(itemId),
    });
  };

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateManageMediaItemMetadataRequest) =>
      mediaItemsApi.updateMediaItemMetadata(requireMediaItemId(itemId), payload),
    onSuccess: async (detail) => {
      writeDetailCache(detail);
      await invalidateMediaItemQueries();
    },
  });

  const resetMutation = useMutation({
    mutationFn: (payload: DangerousActionRequest) =>
      mediaItemsApi.resetMediaItemMetadata(requireMediaItemId(itemId), payload),
    onSuccess: async () => {
      await invalidateCurrentDetail();
      await invalidateMediaItemQueries();
    },
  });

  const uploadArtworkMutation = useMutation({
    mutationFn: (payload: UploadManageMediaItemArtworkRequest) =>
      mediaItemsApi.uploadMediaItemArtwork(requireMediaItemId(itemId), payload),
    onSuccess: async (detail) => {
      writeDetailCache(detail);
      await invalidateMediaItemQueries();
    },
  });

  const deleteArtworkMutation = useMutation({
    mutationFn: ({
      overrideId,
      confirmation,
    }: {
      overrideId: string;
      confirmation: DangerousActionRequest;
    }) =>
      mediaItemsApi.deleteMediaItemArtwork(
        requireMediaItemId(itemId),
        overrideId,
        confirmation,
      ),
    onSuccess: async () => {
      await invalidateCurrentDetail();
      await invalidateMediaItemQueries();
    },
  });

  const uploadSubtitleMutation = useMutation({
    mutationFn: (payload: UploadManageMediaItemSubtitleRequest) =>
      mediaItemsApi.uploadMediaItemSubtitle(requireMediaItemId(itemId), payload),
    onSuccess: async (detail) => {
      writeDetailCache(detail);
      await invalidateMediaItemQueries();
    },
  });

  const updateSubtitleMutation = useMutation({
    mutationFn: ({
      overrideId,
      payload,
    }: {
      overrideId: string;
      payload: UpdateManageMediaItemSubtitleOverrideRequest;
    }) =>
      mediaItemsApi.updateMediaItemSubtitle(requireMediaItemId(itemId), overrideId, payload),
    onSuccess: async (detail) => {
      writeDetailCache(detail);
      await invalidateMediaItemQueries();
    },
  });

  const deleteSubtitleMutation = useMutation({
    mutationFn: ({
      overrideId,
      confirmation,
    }: {
      overrideId: string;
      confirmation: DangerousActionRequest;
    }) =>
      mediaItemsApi.deleteMediaItemSubtitle(
        requireMediaItemId(itemId),
        overrideId,
        confirmation,
      ),
    onSuccess: async () => {
      await invalidateCurrentDetail();
      await invalidateMediaItemQueries();
    },
  });

  const deleteSourceMutation = useMutation({
    mutationFn: ({
      sourceId,
      confirmation,
    }: {
      sourceId: string;
      confirmation: DangerousActionRequest;
    }) =>
      mediaItemsApi.deleteMediaItemSource(
        requireMediaItemId(itemId),
        sourceId,
        confirmation,
      ),
    onSuccess: async () => {
      await invalidateCurrentDetail();
      await invalidateMediaItemQueries();
    },
  });

  const refreshMetadataMutation = useMutation({
    mutationFn: () => mediaItemsApi.refreshMediaItemMetadata(requireMediaItemId(itemId)),
    onSuccess: async (detail) => {
      writeDetailCache(detail);
      await invalidateMediaItemQueries();
    },
  });

  const scanMutation = useMutation({
    mutationFn: () => mediaItemsApi.scanMediaItem(requireMediaItemId(itemId)),
    onSuccess: async () => {
      await invalidateCurrentDetail();
      await invalidateMediaItemQueries();
    },
  });

  const invalidateCurrentPipeline = async () => {
    if (!itemId) {
      return;
    }
    await queryClient.invalidateQueries({
      queryKey: queryKeys.manage.mediaItems.pipeline(itemId),
    });
  };

  const enqueueScrapeMutation = useMutation({
    mutationFn: (options: RequestManageMediaItemScrapeOptions = {}) =>
      mediaItemsApi.enqueueMediaItemScrape(requireMediaItemId(itemId), options),
    onSuccess: async () => {
      await invalidateCurrentPipeline();
      await invalidateCurrentDetail();
    },
  });

  return {
    updateMutation,
    resetMutation,
    uploadArtworkMutation,
    deleteArtworkMutation,
    uploadSubtitleMutation,
    updateSubtitleMutation,
    deleteSubtitleMutation,
    deleteSourceMutation,
    refreshMetadataMutation,
    scanMutation,
    enqueueScrapeMutation,
  };
}
