import { useQuery } from '@tanstack/react-query';
import { licenseApi } from '@fmby/v2-shared/contracts/manage/license';
import { queryKeys } from '@fmby/v2-shared/query';

/** 授权状态查询（照 V1 `useLicenseStatusQuery`；staleTime 10s）。 */
export function useLicenseStatusQuery() {
  return useQuery({
    queryKey: queryKeys.manage.license.status(),
    queryFn: () => licenseApi.getStatus(),
    staleTime: 10_000,
  });
}
