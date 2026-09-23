/**
 * AI 干预详情面板（FE-AI-INTERVENTIONS，照 V1 `AiInterventionDetailPanel` 对位）。
 *
 * 交互（以 V2 后端为准）：发起会话 → 会话输入（用 `current_session_id`）→
 * 关闭会话 / 应用最近结果。message/close 是 **session 级路径 + session_id body**。
 */

import { useEffect, useState } from 'react';
import { FeedbackState, StatusBadge } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import type {
  AiInterventionSkillKey,
  AiInterventionThreadDetailRecord,
} from '@fmby/v2-shared/contracts/manage/aiInterventions';
import {
  SKILL_OPTIONS,
  formatJsonForDisplay,
  messageRoleLabel,
  runKindLabel,
  sessionStateLabel,
  skillLabel,
} from '../aiInterventionSupport';
import styles from '../../../longtail-shared/ManageShared.module.css';

interface AiInterventionDetailPanelProps {
  mediaItemId: string;
  detail: AiInterventionThreadDetailRecord | undefined;
  isPending: boolean;
  error: unknown;
  openPending: boolean;
  sendPending: boolean;
  closePending: boolean;
  applyPending: boolean;
  actionError: unknown;
  onOpen: (skillKey?: AiInterventionSkillKey) => void;
  onSend: (sessionId: string, message: string) => void;
  onClose: (sessionId: string) => void;
  onApply: (sessionId: string) => void;
  onDismissError: () => void;
}

export function AiInterventionDetailPanel({
  mediaItemId,
  detail,
  isPending,
  error,
  openPending,
  sendPending,
  closePending,
  applyPending,
  actionError,
  onOpen,
  onSend,
  onClose,
  onApply,
  onDismissError,
}: AiInterventionDetailPanelProps) {
  const [skillKey, setSkillKey] = useState<AiInterventionSkillKey>('naming_cleanup');
  const [draft, setDraft] = useState('');

  useEffect(() => {
    setDraft('');
    onDismissError();
    // 切换媒体项时清空草稿与错误
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaItemId]);

  if (isPending) {
    return (
      <FeedbackState
        variant="loading"
        title="正在加载线程详情"
        description="正在读取会话消息与运行记录。"
      />
    );
  }

  if (error) {
    return (
      <FeedbackState
        variant="error"
        title="线程详情加载失败"
        description={getErrorMessage(error)}
      />
    );
  }

  if (!detail) {
    return <div className={styles.emptyInlineState}>请选择左侧线程以查看详情。</div>;
  }

  const { thread, messages, runs } = detail;
  const sessionId = thread.currentSessionId;
  const canSend = thread.sessionState === 'Open' && Boolean(sessionId);
  const busy = openPending || sendPending || closePending || applyPending;

  return (
    <div className={styles.fieldGroup}>
      <div className={styles.rowActions}>
        <StatusBadge
          label={sessionStateLabel(thread.sessionState)}
          variant={thread.sessionState === 'Open' ? 'success' : 'neutral'}
        />
        <span className={styles.mutedText}>
          媒体项 {mediaItemId} · 最近技能 {skillLabel(thread.latestSkillKey)} · 运行 {thread.latestRunStatus ?? '—'}
        </span>
      </div>

      {actionError ? <div className={styles.dangerPanel}>{getErrorMessage(actionError)}</div> : null}

      <div className={styles.rowActions}>
        <label className={styles.label}>
          会话技能
          <select
            className={styles.select}
            value={skillKey}
            aria-label="AI 会话技能"
            onChange={(e) => setSkillKey(e.target.value as AiInterventionSkillKey)}
          >
            {SKILL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          className={styles.primaryButton}
          type="button"
          disabled={busy}
          onClick={() => onOpen(skillKey)}
        >
          {openPending ? '发起中…' : '发起会话'}
        </button>
        <button
          className={styles.secondaryButton}
          type="button"
          disabled={busy || !sessionId || thread.sessionState !== 'Open'}
          onClick={() => sessionId && onClose(sessionId)}
        >
          {closePending ? '关闭中…' : '关闭会话'}
        </button>
        <button
          className={styles.secondaryButton}
          type="button"
          disabled={busy || !sessionId}
          onClick={() => sessionId && onApply(sessionId)}
        >
          {applyPending ? '应用中…' : '应用最近结果'}
        </button>
      </div>

      <div className={styles.stackText}>
        <strong>会话消息（{messages.length}）</strong>
        {messages.length === 0 ? (
          <span className={styles.mutedText}>暂无消息。</span>
        ) : (
          <ul className={styles.list}>
            {messages.map((m) => (
              <li key={m.id} className={styles.listItem}>
                <span className={styles.chip}>{messageRoleLabel(m.role)}</span>
                <span>{m.contentText ?? m.archivedSummaryText ?? '（空消息）'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.rowActions}>
        <input
          className={styles.input}
          value={draft}
          placeholder={canSend ? '输入发给 AI 的消息' : '会话未开启，无法发送'}
          aria-label="AI 会话消息"
          disabled={!canSend || busy}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSend && draft.trim()) {
              onSend(sessionId as string, draft.trim());
              setDraft('');
            }
          }}
        />
        <button
          className={styles.primaryButton}
          type="button"
          disabled={!canSend || busy || !draft.trim()}
          onClick={() => {
            if (sessionId && draft.trim()) {
              onSend(sessionId, draft.trim());
              setDraft('');
            }
          }}
        >
          {sendPending ? '发送中…' : '发送'}
        </button>
      </div>

      <div className={styles.stackText}>
        <strong>运行记录（{runs.length}）</strong>
        {runs.length === 0 ? (
          <span className={styles.mutedText}>暂无运行记录。</span>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>类别</th>
                  <th>技能</th>
                  <th>状态</th>
                  <th>提供方 / 模型</th>
                  <th>摘要</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>{runKindLabel(run.runKind)}</td>
                    <td>{skillLabel(run.skillKey)}</td>
                    <td>{run.runStatus}</td>
                    <td>
                      {run.provider ?? '—'}
                      {run.model ? ` · ${run.model}` : ''}
                    </td>
                    <td>
                      <pre className={styles.jsonBlock}>{formatJsonForDisplay(run.summaryJson)}</pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
