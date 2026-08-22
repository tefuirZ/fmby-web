import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  taskCenterApi,
  type TaskCenterCategory,
  type TaskCenterAction,
} from '@/domains/manage/task-center';
import { queryKeys } from '@/shared/query-keys';
import { getErrorMessage } from '@/shared/utils/error';

interface TaskCenterMutationsOptions {
  onSettledSuccess?: (message: string, redirectHint?: string) => void;
  onError?: (errorMessage: string) => void;
}

export function useTaskCenterMutations(options: TaskCenterMutationsOptions = {}) {
  const queryClient = useQueryClient();

  const actionMutation = useMutation({
    mutationFn: ({
      category,
      taskId,
      action,
    }: {
      category: TaskCenterCategory;
      taskId: string;
      action: TaskCenterAction;
    }) => taskCenterApi.runAction(category, taskId, action),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.manage.taskCenter.all(),
      });
      if (options.onSettledSuccess) {
        options.onSettledSuccess(
          '任务操作已提交',
          result.redirectHint ?? '任务状态已刷新，列表与详情会重新同步。',
        );
      }
    },
    onError: (error) => {
      if (options.onError) {
        options.onError(getErrorMessage(error));
      }
    },
  });

  return {
    actionMutation,
  };
}
