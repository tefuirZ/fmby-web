import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '@fmby/v2-shared/contracts/settings';
import { queryKeys } from '@fmby/v2-shared/query';
import type { SiteSettingsDraft } from '../types';

export function useSiteSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.manage.siteSettings(),
    queryFn: async (): Promise<SiteSettingsDraft> => {
      const [general, security, sessionPolicy] = await Promise.all([
        settingsApi.getServerGeneral(),
        settingsApi.getServerSecurity(),
        settingsApi.getServerSessionPolicy(),
      ]);
      return { general, security, sessionPolicy };
    },
  });
}
