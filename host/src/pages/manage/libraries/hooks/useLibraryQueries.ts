import { useQuery } from '@tanstack/react-query';
import { manageApi } from '@fmby/v2-shared/contracts/manage';
import { queryKeys } from '@fmby/v2-shared/query';
import type { LibraryDrawerState } from '../types';

export function useLibrariesQuery() {
  return useQuery({
    queryKey: queryKeys.manage.libraries.list(),
    queryFn: () => manageApi.getLibraries(),
  });
}

export function useLibraryDetailQuery(drawerState: LibraryDrawerState | null) {
  const selectedLibraryId = drawerState?.libraryId;
  return useQuery({
    queryKey: queryKeys.manage.libraries.detail(selectedLibraryId),
    queryFn: async () => {
      if (!selectedLibraryId) {
        throw new Error('缺少媒体库 ID');
      }
      return manageApi.getLibraryDetail(selectedLibraryId);
    },
    enabled: Boolean(selectedLibraryId && drawerState),
    refetchInterval: (query) => {
      if (!selectedLibraryId || !drawerState) return false;
      return query.state.data?.recentScanTasks.some(
        (task) => task.status === 'pending' || task.status === 'running',
      )
        ? 1500
        : false;
    },
  });
}

export function useMountsPickerQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.manage.libraries.mountsPicker(),
    queryFn: () => manageApi.getMounts(),
    enabled,
  });
}

export function useUsersPickerQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.manage.libraries.usersPicker(),
    queryFn: () => manageApi.getUsers({ page: 1, pageSize: 100 }),
    enabled,
  });
}
