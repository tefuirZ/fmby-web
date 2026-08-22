import { useMutation, useQueryClient } from '@tanstack/react-query';
import { namingCleanupApi } from '@/domains/manage/naming';
import { queryKeys } from '@/shared/query-keys';
import type {
  NamingCleanupReplayScope,
  NamingScrapeBatchRepairRequest,
  UpdateNamingScrapeSettingsRequest,
} from '@/domains/manage/naming';

interface UseNamingRulesMutationsCallbacks {
  onSaveSuccess: (message: string) => void;
  onSaveError: (message: string) => void;
  onReplaySuccess: (message: string) => void;
  onReplayError: (message: string) => void;
  onBatchRepairSuccess: (message: string) => void;
  onBatchRepairError: (message: string) => void;
}

export function useNamingRulesMutations(callbacks: UseNamingRulesMutationsCallbacks) {
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: (payload: UpdateNamingScrapeSettingsRequest) =>
      namingCleanupApi.updateScrapeSettings(payload),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.manage.namingScrape.settings(), result);
      callbacks.onSaveSuccess('命名刮削设置已保存');
    },
    onError: (error) => {
      callbacks.onSaveError(`命名刮削设置保存失败：${error}`);
    },
  });

  const replayMutation = useMutation({
    mutationFn: (payload: { scope: NamingCleanupReplayScope; libraryId?: string }) =>
      namingCleanupApi.replayIdentify(payload),
    onSuccess: (result) => {
      callbacks.onReplaySuccess(
        `历史识别重排已入队。目标 ${result.totalItems} 条，新入队 ${result.queuedCount} 条，刷新 ${result.updatedCount} 条，跳过 ${result.skippedCount} 条。`,
      );
    },
    onError: (error) => {
      callbacks.onReplayError(`历史识别重排失败：${error}`);
    },
  });

  const batchRepairMutation = useMutation({
    mutationFn: (payload: NamingScrapeBatchRepairRequest) =>
      namingCleanupApi.batchRepair(payload),
    onSuccess: (result) => {
      const scope = result.libraryName ? `目标媒体库：${result.libraryName}` : '目标范围：全部媒体库';
      callbacks.onBatchRepairSuccess(
        `缺失元数据 / 海报补刮已入队。${scope}。候选 ${result.totalCandidates} 条，新入队 ${result.queuedCount} 条，刷新 ${result.updatedCount} 条，跳过 ${result.skippedCount} 条。`,
      );
    },
    onError: (error) => {
      callbacks.onBatchRepairError(`批量补刮失败：${error}`);
    },
  });

  return { saveMutation, replayMutation, batchRepairMutation };
}
