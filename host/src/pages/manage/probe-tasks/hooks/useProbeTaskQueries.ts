import { useQuery } from '@tanstack/react-query';
import { manageApi } from '@fmby/v2-shared/contracts/manage';
import { queryKeys } from '@fmby/v2-shared/query';
import type { ManageProbeTaskStatus } from '@fmby/v2-shared/contracts/manage';
import { ACTIVE_PROBE_STATUSES } from '../types';

export function useProbeTasksQuery({
  statusFilter,
  deferredKeyword,
  scopedLibraryId,
  scopedMountId,
}: {
  statusFilter: 'all' | ManageProbeTaskStatus;
  deferredKeyword: string;
  scopedLibraryId?: string;
  scopedMountId?: string;
  }) {
  return useQuery({
    queryKey: queryKeys.manage.probeTasks.list(
      statusFilter === 'all' ? undefined : statusFilter,
      deferredKeyword || undefined,
      scopedLibraryId,
      scopedMountId,
    ),
    queryFn: () =>
      manageApi.getProbeTasks({
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: deferredKeyword || undefined,
        libraryId: scopedLibraryId,
        mountId: scopedMountId,
      }),
    refetchInterval: (query) =>
      (query.state.data?.items ?? []).some((task) => ACTIVE_PROBE_STATUSES.includes(task.status))
        ? 1500
        : 5000,
  });
}

export function useProbeTaskDetailQuery(selectedSourceId: string | null) {
  return useQuery({
    queryKey: queryKeys.manage.probeTasks.detail(selectedSourceId ?? undefined),
    queryFn: async () => {
      if (!selectedSourceId) {
        throw new Error('缺少探测任务来源 ID');
      }
      return manageApi.getProbeTaskDetail(selectedSourceId);
    },
    enabled: Boolean(selectedSourceId),
    refetchInterval: (query) =>
      selectedSourceId && ACTIVE_PROBE_STATUSES.includes(query.state.data?.task.status as ManageProbeTaskStatus)
        ? 1500
        : false,
  });
}
