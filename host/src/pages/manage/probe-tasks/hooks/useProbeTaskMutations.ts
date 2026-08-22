import { useMutation, useQueryClient } from '@tanstack/react-query';
import { manageApi } from '@fmby/v2-shared/contracts/manage';
import { queryKeys } from '@fmby/v2-shared/query';
import type { BannerState } from '@fmby/v2-shared/ui/types';
import { getErrorMessage } from '@fmby/v2-shared/errors';

export interface UseProbeTaskMutationsCallbacks {
  setBanner: (state: BannerState | null) => void;
}

export function useProbeTaskMutations({ setBanner }: UseProbeTaskMutationsCallbacks) {
  const queryClient = useQueryClient();

  const enqueueMutation = useMutation({
    mutationFn: (sourceId: string) => manageApi.enqueueProbeTask(sourceId),
    onSuccess: async (result, sourceId) => {
      setBanner({
        variant: 'success',
        title: '补全任务已提交',
        description: result.message,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.manage.probeTasks.all() }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.manage.probeTasks.detail(sourceId),
        }),
      ]);
    },
    onError: (error) => {
      setBanner({
        variant: 'error',
        title: '补全任务提交失败',
        description: getErrorMessage(error),
      });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: (sourceId: string) => manageApi.refreshProbeTask(sourceId),
    onSuccess: async (result, sourceId) => {
      setBanner({
        variant: 'success',
        title: '强制重探任务已提交',
        description: result.message,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.manage.probeTasks.all() }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.manage.probeTasks.detail(sourceId),
        }),
      ]);
    },
    onError: (error) => {
      setBanner({
        variant: 'error',
        title: '强制重探失败',
        description: getErrorMessage(error),
      });
    },
  });

  return { enqueueMutation, refreshMutation };
}
