import { useQuery } from '@tanstack/react-query';
import { manageApi } from '@/domains/manage';
import { queryKeys } from '@/shared/query-keys';
import type { MountDrawerState } from '../types';

export function useMountsQuery() {
  return useQuery({
    queryKey: queryKeys.manage.mounts.list(),
    queryFn: () => manageApi.getMounts(),
  });
}

export function useMountDetailQuery(drawerState: MountDrawerState | null) {
  const selectedMountId = drawerState?.mountId;
  return useQuery({
    queryKey: queryKeys.manage.mounts.detail(selectedMountId),
    queryFn: async () => {
      if (!selectedMountId) {
        throw new Error('缺少数据源 ID');
      }
      return manageApi.getMountDetail(selectedMountId);
    },
    enabled: Boolean(selectedMountId && drawerState),
    refetchInterval: (query) => {
      if (!selectedMountId || !drawerState) {
        return false;
      }
      return query.state.data?.recentScanTasks.some(
        (task) => task.status === 'pending' || task.status === 'running',
      )
        ? 1500
        : false;
    },
  });
}
