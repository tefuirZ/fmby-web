import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '@/domains/settings';
import { queryKeys } from '@/shared/query-keys';
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
