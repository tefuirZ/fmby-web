import { useQuery } from '@tanstack/react-query';
import { manageApi } from '@/domains/manage';
import { queryKeys } from '@/shared/query-keys';

export function useRoleTemplatesQuery() {
  return useQuery({
    queryKey: queryKeys.manage.roleTemplates.list(),
    queryFn: () => manageApi.getRoleTemplates(),
  });
}

export function useLibrariesQueryForTemplates() {
  return useQuery({
    queryKey: queryKeys.manage.libraries.list(),
    queryFn: () => manageApi.getLibraries({ pageSize: 200 }),
    staleTime: 60_000,
  });
}

export function useMountsQueryForTemplates() {
  return useQuery({
    queryKey: queryKeys.manage.mounts.list(),
    queryFn: () => manageApi.getMounts(),
    staleTime: 60_000,
  });
}
