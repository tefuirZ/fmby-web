import { useQuery } from '@tanstack/react-query';
import { manageApi } from '@fmby/v2-shared/contracts/manage';
import { queryKeys } from '@fmby/v2-shared/query';

export function useRegistrationCodesQuery() {
  return useQuery({
    queryKey: queryKeys.manage.registrationCodes.list(),
    queryFn: () => manageApi.getRegistrationCodes(),
  });
}

export function useLibrariesQuery() {
  return useQuery({
    queryKey: queryKeys.manage.libraries.list(),
    queryFn: () => manageApi.getLibraries({ pageSize: 200 }),
    staleTime: 60_000,
  });
}
