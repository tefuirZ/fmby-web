import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aiInterventionsApi } from '@fmby/v2-shared/contracts/manage/aiInterventions';
import { aiAssistApi } from '@fmby/v2-shared/contracts/settings/aiAssist.api';
import type { UpdateAiAssistSettingsInput } from '@fmby/v2-shared/contracts/settings/aiAssist.api';
import { queryKeys } from '@fmby/v2-shared/query';

/**
 * AI 干预写操作（open/message/close/apply）。
 *
 * 失效范围：会话类操作同时刷「列表」与「该媒体项详情」（二者都随会话状态变化）。
 */
export function useAiInterventionMutations(mediaItemId: string | null) {
  const queryClient = useQueryClient();

  function invalidateAll() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.manage.aiInterventions.all() });
  }

  const openSessionMutation = useMutation({
    mutationFn: (preferredSkillKey?: Parameters<typeof aiInterventionsApi.openSession>[1]) =>
      aiInterventionsApi.openSession(mediaItemId as string, preferredSkillKey),
    onSuccess: invalidateAll,
  });

  const sendMessageMutation = useMutation({
    mutationFn: (input: { sessionId: string; message: string }) =>
      aiInterventionsApi.sendMessage(input.sessionId, input.message),
    onSuccess: invalidateAll,
  });

  const closeSessionMutation = useMutation({
    mutationFn: (sessionId: string) => aiInterventionsApi.closeSession(sessionId),
    onSuccess: invalidateAll,
  });

  const applyMutation = useMutation({
    mutationFn: (sessionId: string) =>
      aiInterventionsApi.applyLatestResult(mediaItemId as string, sessionId),
    onSuccess: invalidateAll,
  });

  return { openSessionMutation, sendMessageMutation, closeSessionMutation, applyMutation };
}

/** AI 辅助设置保存（成功后失效设置查询）。 */
export function useSaveAiAssistSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAiAssistSettingsInput) => aiAssistApi.saveSettings(input),
    onSuccess: (settings) => {
      queryClient.setQueryData(queryKeys.settings.aiAssist(), settings);
    },
  });
}
