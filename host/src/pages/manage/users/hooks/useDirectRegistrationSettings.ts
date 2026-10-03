import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { manageApi, type DirectRegistrationSettings } from '@fmby/v2-shared/contracts/manage';
import { queryKeys } from '@fmby/v2-shared/query';

/**
 * 直接注册窗口设置（FE-REGISTRATION-WINDOW-UI）。
 *
 * 端点：`GET/PUT /api/manage/users/direct-registration/settings`
 * （`crates/fmby-v2-http/src/routes/manage_registration_window.rs`）
 *
 * ★诚实错误：后端校验（`validate_direct_registration_settings`）会给 `Validation`
 *   具体原因（start_at 须早于 end_at / 名额不得为负 / 启用时须指定模板），
 *   本 hook **不吞、不自动纠正**，交由 UI 展示后端原文。
 * ★PUT 是**全量替换**并用响应（落库后真值）写回缓存，不本地乐观臆造。
 */
export function useDirectRegistrationSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.manage.users.directRegistrationSettings(),
    queryFn: () => manageApi.getDirectRegistrationSettings(),
  });
}

export function useSaveDirectRegistrationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: DirectRegistrationSettings) =>
      manageApi.putDirectRegistrationSettings(settings),
    onSuccess: (saved) => {
      queryClient.setQueryData(
        queryKeys.manage.users.directRegistrationSettings(),
        saved,
      );
    },
  });
}
