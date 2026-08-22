import { useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '@/domains/settings';
import { queryKeys } from '@/shared/query-keys';
import type { SiteSettingsDraft } from '../types';

interface UseSiteSettingsMutationsOptions {
  onSettledSuccess: (message: string) => void;
}

export function useSiteSettingsMutations({
  onSettledSuccess,
}: UseSiteSettingsMutationsOptions) {
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async (payload: SiteSettingsDraft) => {
      const results = await Promise.allSettled([
        settingsApi.saveServerGeneral(payload.general),
        settingsApi.saveServerSecurity(payload.security),
        settingsApi.saveServerSessionPolicy(payload.sessionPolicy),
      ]);
      const general = results[0];
      const security = results[1];
      const sessionPolicy = results[2];

      if (
        general.status === 'fulfilled' &&
        security.status === 'fulfilled' &&
        sessionPolicy.status === 'fulfilled'
      ) {
        return {
          general: general.value,
          security: security.value,
          sessionPolicy: sessionPolicy.value,
        };
      }

      const partialSaved = results.some((result) => result.status === 'fulfilled');
      throw new Error(
        partialSaved
          ? '部分设置已经保存，但仍有一组设置写入失败。页面会自动回读服务端状态，请重新确认后再保存一次。'
          : '站点设置保存失败，本次没有拿到完整成功结果。',
      );
    },
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.manage.siteSettings(), result);
      queryClient.setQueryData(queryKeys.settings.server.general(), result.general);
      queryClient.setQueryData(queryKeys.settings.server.security(), result.security);
      queryClient.setQueryData(
        queryKeys.settings.server.sessionPolicy(),
        result.sessionPolicy,
      );
      onSettledSuccess('站点设置已保存。');
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.manage.siteSettings() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings.server.general() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings.server.security() });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.settings.server.sessionPolicy(),
      });
    },
  });

  return { saveMutation };
}
