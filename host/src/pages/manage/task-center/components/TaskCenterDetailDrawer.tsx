import type { Dispatch, SetStateAction } from 'react';
import { useNavigate } from 'react-router';
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import type {
  TaskCenterItemDetailRecord,
  TaskCenterItemRecord,
  TaskCenterCategory,
  TaskCenterAction,
} from '@fmby/v2-shared/contracts/manage/task-center';
import { SideDrawer } from '@fmby/v2-shared/ui';
import { FeedbackState } from '@fmby/v2-shared/ui';
import { StatusBadge } from '@fmby/v2-shared/ui';
import { formatDateTime } from '@fmby/v2-shared/time';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from '../../ManagePages.module.css';
import { ManageSectionCard, getManageStatusVariant } from '../../components';
// FE-AI-RESIDUAL ②：复用既有 AI 干预查询 hook 与标签工具（不新造一套契约/请求层）。
import { useAiInterventionThreadQuery } from '../../naming-rules/ai-intervention/hooks/useAiInterventionQueries';
import { sessionStateLabel, skillLabel } from '../../naming-rules/ai-intervention/aiInterventionSupport';
import { getCategoryLabel, getStatusLabel, mapStatusVariant, buildTaskActions } from '../utils';
import type { SelectedTaskRef } from '../types';

interface TaskCenterDetailDrawerProps {
  selectedTask: SelectedTaskRef | null;
  setSelectedTask: Dispatch<SetStateAction<SelectedTaskRef | null>>;
  detailQuery: UseQueryResult<TaskCenterItemDetailRecord>;
  actionMutation: UseMutationResult<
    { item: TaskCenterItemRecord; redirectHint?: string },
    Error,
    { category: TaskCenterCategory; taskId: string; action: TaskCenterAction }
  >;
}

/**
 * FE-AI-RESIDUAL ②：任务详情「AI 介入概览」（V1 对位
 * `apps/web/src/pages/manage/task-center/components/TaskCenterDetailDrawer.tsx:205`
 * 的 `TaskCenterAiInterventionSection`）。
 *
 * ★与 V1 的**有意偏离（据实）**：V1 读 `detail.aiIntervention`（V1 任务详情自带 ai 上下文）。
 *   V2 的 `TaskCenterItem`/`TaskCenterDetail` **没有**该字段 —— 后端
 *   `crates/fmby-v2-application/src/task_center.rs:181` 只有 `media_item_id`，且 `media_title`
 *   注释明写「恒 None：V2 `task_definition` 无媒体标题列（跨域 join 登记后续卡）」。
 *   ⇒ 本段改走**既有 AI 干预端点**（`GET /api/manage/ai-interventions/media/{id}`，复用
 *   `useAiInterventionThreadQuery`），以任务条目的 `mediaItemId` 定位；
 *   **无 mediaItemId 的条目直接不渲染**（同 V1 `if (!context) return null`，不造空壳）。
 *   只读展示，不在此处发写请求。
 */
function TaskCenterAiInterventionSection({ mediaItemId }: { mediaItemId: string | null }) {
  const navigate = useNavigate();
  const threadQuery = useAiInterventionThreadQuery(mediaItemId);
  if (!mediaItemId) {
    return null;
  }
  const thread = threadQuery.data?.thread;
  const detail = threadQuery.data;
  return (
    <ManageSectionCard
      title="AI 介入概览"
      description="任务详情保留单次 run 视角；条目级多轮会话与管理面续聊入口挂在「命名与刮削 / AI 干预」。"
      actions={
        <button
          className={styles.smallButton}
          type="button"
          onClick={() => navigate('/manage/media/naming-scrape')}
        >
          继续 AI 介入
        </button>
      }
    >
      {threadQuery.isPending ? (
        <FeedbackState
          variant="loading"
          title="正在读取 AI 介入…"
          description="按媒体项定位会话与运行记录。"
        />
      ) : threadQuery.isError ? (
        <FeedbackState
          variant="error"
          title="AI 介入读取失败"
          description={getErrorMessage(threadQuery.error)}
        />
      ) : !thread ? (
        <div className={styles.emptyInlineState}>该媒体项尚无 AI 介入记录。</div>
      ) : (
        <div className={styles.detailFieldGrid}>
          <div className={styles.detailCard}>
            <span className={styles.detailCardLabel}>最近技能</span>
            <span className={styles.detailCardValue}>{skillLabel(thread.latestSkillKey)}</span>
          </div>
          <div className={styles.detailCard}>
            <span className={styles.detailCardLabel}>会话状态</span>
            <span className={styles.detailCardValue}>{sessionStateLabel(thread.sessionState)}</span>
          </div>
          <div className={styles.detailCard}>
            <span className={styles.detailCardLabel}>最近运行</span>
            <span className={styles.detailCardValue}>{thread.latestRunStatus ?? '—'}</span>
          </div>
          <div className={styles.detailCard}>
            <span className={styles.detailCardLabel}>提供方 / 模型</span>
            <span className={styles.detailCardValue}>
              {thread.latestProvider ?? '未记录'} / {thread.latestModel ?? '未记录'}
            </span>
          </div>
          <div className={styles.detailCard}>
            <span className={styles.detailCardLabel}>消息 / 运行</span>
            <span className={styles.detailCardValue}>
              {detail ? `${detail.messages.length} / ${detail.runs.length}` : '—'}
            </span>
          </div>
        </div>
      )}
    </ManageSectionCard>
  );
}

export function TaskCenterDetailDrawer({
  selectedTask,
  setSelectedTask,
  detailQuery,
  actionMutation,
}: TaskCenterDetailDrawerProps) {
  return (
    <SideDrawer
      open={selectedTask !== null}
      title={
        detailQuery.data
          ? `${getCategoryLabel(detailQuery.data.category)} · ${detailQuery.data.mediaTitle ?? detailQuery.data.id}`
          : '任务详情'
      }
      description="原始载荷、状态和错误信息都会在这里摊开。"
      eyebrow="任务详情"
      onOpenChange={(open) => {
        if (!open) {
          setSelectedTask(null);
        }
      }}
    >
      {detailQuery.isPending && selectedTask ? (
        <FeedbackState
          variant="loading"
          title="正在拉取任务详情"
          description="正在读取原始 payload 与当前状态。"
        />
      ) : detailQuery.isError ? (
        <FeedbackState
          variant="error"
          title="任务详情加载失败"
          description={getErrorMessage(detailQuery.error)}
          action={
            <button
              className={styles.primaryButton}
              type="button"
              onClick={() => detailQuery.refetch()}
            >
              重试
            </button>
          }
        />
      ) : detailQuery.data ? (
        <div className={styles.list}>
          <div className={styles.detailSummaryGrid}>
            <div className={styles.detailCard}>
              <span className={styles.detailCardLabel}>状态</span>
              <div className={styles.stackText}>
                <StatusBadge
                  label={getStatusLabel(detailQuery.data.status)}
                  variant={getManageStatusVariant(mapStatusVariant(detailQuery.data.status))}
                />
              </div>
            </div>
            <div className={styles.detailCard}>
              <span className={styles.detailCardLabel}>创建时间</span>
              <span className={styles.detailCardValue}>
                {formatDateTime(detailQuery.data.createdAt)}
              </span>
            </div>
            <div className={styles.detailCard}>
              <span className={styles.detailCardLabel}>最近更新时间</span>
              <span className={styles.detailCardValue}>
                {formatDateTime(detailQuery.data.updatedAt)}
              </span>
            </div>
            <div className={styles.detailCard}>
              <span className={styles.detailCardLabel}>重试次数</span>
              <span className={styles.detailCardValue}>{detailQuery.data.retryCount}</span>
            </div>
          </div>

          <div className={styles.detailFieldGrid}>
            <div className={styles.detailCard}>
              <span className={styles.detailCardLabel}>任务 ID</span>
              <span className={`${styles.detailCardValue} ${styles.mono}`}>
                {detailQuery.data.id}
              </span>
            </div>
            <div className={styles.detailCard}>
              <span className={styles.detailCardLabel}>媒体项</span>
              <span className={styles.detailCardValue}>
                {detailQuery.data.mediaTitle ?? detailQuery.data.mediaItemId ?? '系统级任务'}
              </span>
            </div>
            <div className={styles.detailCard}>
              <span className={styles.detailCardLabel}>错误码</span>
              <span className={styles.detailCardValue}>
                {detailQuery.data.lastErrorCode ?? '—'}
              </span>
            </div>
            <div className={styles.detailCard}>
              <span className={styles.detailCardLabel}>错误信息</span>
              <span className={styles.detailCardValue}>
                {detailQuery.data.lastErrorMessage ?? '—'}
              </span>
            </div>
          </div>

          <ManageSectionCard
            title="摘要与动作"
            description={detailQuery.data.summary}
            actions={
              <div className={styles.rowActions}>
                {buildTaskActions(detailQuery.data).map((action) => (
                  <button
                    key={action.action}
                    className={
                      action.tone === 'danger' ? styles.smallDangerButton : styles.smallButton
                    }
                    type="button"
                    disabled={actionMutation.isPending}
                    onClick={() =>
                      actionMutation.mutate({
                        category: detailQuery.data.category,
                        taskId: detailQuery.data.id,
                        action: action.action,
                      })
                    }
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            }
          >
            {detailQuery.data.category === 'Review' ? (
              <div className={styles.emptyInlineState}>
                审核前端页还没接好，这里先保留状态与原始载荷；后续接入 `/manage/review`
                后再补跳转。
              </div>
            ) : (
              <div className={styles.stackText}>
                <span className={styles.mutedText}>
                  动作会写入审计日志，并在完成后自动刷新总览与当前列表。
                </span>
              </div>
            )}
          </ManageSectionCard>

          <TaskCenterAiInterventionSection mediaItemId={detailQuery.data?.mediaItemId ?? null} />

          <ManageSectionCard
            title="原始载荷"
            description="服务层已经把常见 JSON 字段解包，方便直接定位上下文。"
          >
            <pre className={styles.jsonBlock}>
              {JSON.stringify(detailQuery.data.rawPayload, null, 2)}
            </pre>
          </ManageSectionCard>
        </div>
      ) : null}
    </SideDrawer>
  );
}
