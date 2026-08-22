import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { manageApi, type ManageUsersQuery } from '@fmby/v2-shared/contracts/manage';
import { queryKeys } from '@fmby/v2-shared/query';
import type { UserDrawerState } from '../types';

export function useUsersQuery(query: ManageUsersQuery) {
  return useQuery({
    queryKey: queryKeys.manage.users.list(query),
    queryFn: () => manageApi.getUsers(query),
    placeholderData: keepPreviousData,
  });
}

export function useUserDetailQuery(drawerState: UserDrawerState | null) {
  const selectedUserId = drawerState?.userId;
  return useQuery({
    queryKey: queryKeys.manage.users.detail(selectedUserId),
    queryFn: async () => {
      if (!selectedUserId) {
        throw new Error('缺少用户 ID');
      }
      return manageApi.getUserDetail(selectedUserId);
    },
    enabled: Boolean(selectedUserId && drawerState?.mode !== 'create'),
  });
}
