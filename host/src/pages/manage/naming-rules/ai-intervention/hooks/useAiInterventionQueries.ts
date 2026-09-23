import { useQuery } from '@tanstack/react-query';
import { aiInterventionsApi } from '@fmby/v2-shared/contracts/manage/aiInterventions';
import { aiAssistApi } from '@fmby/v2-shared/contracts/settings/aiAssist.api';
import { queryKeys } from '@fmby/v2-shared/query';

/** 线程列表（后端仅支持 limit/offset；筛选在客户端做）。 */
export function useAiInterventionThreadsQuery(query: { limit?: number; offset?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.manage.aiInterventions.threads(query),
    queryFn: () => aiInterventionsApi.listThreads(query),
    staleTime: 10_000,
  });
}

/** 单个媒体项的线程详情（无选择时不发请求）。 */
export function useAiInterventionThreadQuery(mediaItemId: string | null) {
  return useQuery({
    queryKey: queryKeys.manage.aiInterventions.thread(mediaItemId ?? ''),
    queryFn: () => aiInterventionsApi.getThread(mediaItemId as string),
    enabled: Boolean(mediaItemId),
    staleTime: 5_000,
  });
}

/** AI 辅助设置（provider / 模型 / 策略）。 */
export function useAiAssistSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.settings.aiAssist(),
    queryFn: () => aiAssistApi.getSettings(),
    staleTime: 30_000,
  });
}
