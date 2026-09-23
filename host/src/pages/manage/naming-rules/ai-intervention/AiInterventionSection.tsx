/**
 * AI 干预区（FE-AI-INTERVENTIONS）—— 照 V1 挂载点（命名与刮削页）对位。
 *
 * 组合：线程列表（客户端筛选）+ 详情面板（发起/发消息/关闭/应用）+ provider 设置面板。
 * 诚实边界（后端缺口，见 handoff）：threads 无服务端过滤、无分页 total、线程无 mediaTitle。
 */

import { useCallback, useEffect, useState } from 'react';
import { ManageSectionCard } from '../../longtail-shared/components';
import { InlineBanner } from '@fmby/v2-shared/ui';
import type { AiInterventionSkillKey } from '@fmby/v2-shared/contracts/manage/aiInterventions';
import { AiInterventionThreadList } from './components/AiInterventionThreadList';
import { AiInterventionDetailPanel } from './components/AiInterventionDetailPanel';
import { AiInterventionProviderPanel } from './components/AiInterventionProviderPanel';
import {
  useAiAssistSettingsQuery,
  useAiInterventionThreadQuery,
  useAiInterventionThreadsQuery,
} from './hooks/useAiInterventionQueries';
import {
  useAiInterventionMutations,
  useSaveAiAssistSettingsMutation,
} from './hooks/useAiInterventionMutations';
import { readAiMediaItemIdFromUrl, syncAiMediaItemIdToUrl } from './aiInterventionSupport';

export function AiInterventionSection() {
  const [selectedMediaItemId, setSelectedMediaItemId] = useState<string | null>(() =>
    readAiMediaItemIdFromUrl(),
  );
  const [actionError, setActionError] = useState<unknown>(null);
  const [assistSaved, setAssistSaved] = useState(false);

  const threadsQuery = useAiInterventionThreadsQuery({ limit: 50 });
  const threadQuery = useAiInterventionThreadQuery(selectedMediaItemId);
  const settingsQuery = useAiAssistSettingsQuery();

  const { openSessionMutation, sendMessageMutation, closeSessionMutation, applyMutation } =
    useAiInterventionMutations(selectedMediaItemId);
  const saveSettingsMutation = useSaveAiAssistSettingsMutation();

  const selectThread = useCallback((mediaItemId: string) => {
    setSelectedMediaItemId(mediaItemId);
    syncAiMediaItemIdToUrl(mediaItemId);
  }, []);

  useEffect(() => {
    if (!threadsQuery.isError) return;
    setActionError(threadsQuery.error);
  }, [threadsQuery.isError, threadsQuery.error]);

  const actionErrorValue =
    actionError ??
    openSessionMutation.error ??
    sendMessageMutation.error ??
    closeSessionMutation.error ??
    applyMutation.error;

  return (
    <div id="ai-intervention" data-testid="ai-intervention-section">
      <ManageSectionCard
        title="AI 干预"
        description="对识别/刮削结果发起 AI 会话式干预：查看线程、开会话、对话、应用结果。"
      >
        <InlineBanner
          variant="info"
          title="线程列表为客户端筛选"
          description="后端 /ai-interventions/threads 仅支持 limit/offset 与不含标题字段；列表搜索/筛选在本页客户端完成，标题位显示 —（不伪造）。"
        />
        <AiInterventionThreadList
          threads={threadsQuery.data ?? []}
          isPending={threadsQuery.isPending}
          error={threadsQuery.error}
          selectedMediaItemId={selectedMediaItemId}
          onSelect={selectThread}
        />
      </ManageSectionCard>

      <ManageSectionCard
        title="会话详情"
        description="发起会话后在此对话；message/close 走后端 session 级端点（session_id）。"
      >
        {selectedMediaItemId ? (
          <AiInterventionDetailPanel
            mediaItemId={selectedMediaItemId}
            detail={threadQuery.data}
            isPending={threadQuery.isPending}
            error={threadQuery.error}
            openPending={openSessionMutation.isPending}
            sendPending={sendMessageMutation.isPending}
            closePending={closeSessionMutation.isPending}
            applyPending={applyMutation.isPending}
            actionError={actionErrorValue}
            onOpen={(skillKey: AiInterventionSkillKey | undefined) =>
              openSessionMutation.mutate(skillKey)
            }
            onSend={(sessionId, message) => sendMessageMutation.mutate({ sessionId, message })}
            onClose={(sessionId) => closeSessionMutation.mutate(sessionId)}
            onApply={(sessionId) => applyMutation.mutate(sessionId)}
            onDismissError={() => setActionError(null)}
          />
        ) : (
          <div>请选择左侧线程以查看详情。</div>
        )}
      </ManageSectionCard>

      <ManageSectionCard
        title="AI 辅助设置"
        description="配置 provider、模型、密钥与策略；密钥永不明文回显。"
      >
        <AiInterventionProviderPanel
          settings={settingsQuery.data}
          isPending={settingsQuery.isPending}
          error={settingsQuery.error}
          savePending={saveSettingsMutation.isPending}
          saveError={saveSettingsMutation.error}
          saved={assistSaved}
          onSave={(input) =>
            saveSettingsMutation.mutate(input, { onSuccess: () => setAssistSaved(true) })
          }
        />
      </ManageSectionCard>
    </div>
  );
}
