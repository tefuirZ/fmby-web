import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { taskCenterApi, type TaskCenterListQuery } from '@fmby/v2-shared/contracts/manage/task-center';
import { queryKeys } from '@fmby/v2-shared/query';
import type { SelectedTaskRef } from '../types';

export function useOverviewQuery() {
  return useQuery({
    queryKey: queryKeys.manage.taskCenter.overview(),
    queryFn: () => taskCenterApi.getOverview(),
    staleTime: 15_000,
  });
}

export function useListQuery(listQueryInput: TaskCenterListQuery) {
  return useQuery({
    queryKey: queryKeys.manage.taskCenter.list(listQueryInput as Record<string, unknown>),
    queryFn: () => taskCenterApi.getItems(listQueryInput),
    placeholderData: keepPreviousData,
  });
}

export function useDetailQuery(selectedTask: SelectedTaskRef | null) {
  return useQuery({
    queryKey: queryKeys.manage.taskCenter.detail(selectedTask?.category, selectedTask?.id),
    queryFn: () => {
      if (!selectedTask) {
        throw new Error('缺少任务标识');
      }
      return taskCenterApi.getItem(selectedTask.category, selectedTask.id);
    },
    enabled: Boolean(selectedTask),
  });
}

export function useTaskCenterQueries(
  listQueryInput: TaskCenterListQuery,
  selectedTask: SelectedTaskRef | null,
) {
  const overviewQuery = useOverviewQuery();
  const listQuery = useListQuery(listQueryInput);
  const detailQuery = useDetailQuery(selectedTask);

  return {
    overviewQuery,
    listQuery,
    detailQuery,
  };
}
