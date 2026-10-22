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

export function useListQuery(listQueryInput: TaskCenterListQuery, enabled = true) {
  return useQuery({
    queryKey: queryKeys.manage.taskCenter.list(listQueryInput as Record<string, unknown>),
    queryFn: () => taskCenterApi.getItems(listQueryInput),
    placeholderData: keepPreviousData,
    // ★E3：第 1 页由流式装配负责（首批 + 逐批 append），此处 disabled 以免
    //   同一份数据被两条路径各拉一次。用户手动翻页（page>1）时才走分页 REST。
    //   注意：disabled 时 react-query 的 status 恒为 'pending' ⇒ 调用方**不得**再拿
    //   listQuery.isPending 做整页 loading 早退（E3 正是把它拆掉的）。
    enabled,
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
  listEnabled = true,
) {
  const overviewQuery = useOverviewQuery();
  const listQuery = useListQuery(listQueryInput, listEnabled);
  const detailQuery = useDetailQuery(selectedTask);

  return {
    overviewQuery,
    listQuery,
    detailQuery,
  };
}
