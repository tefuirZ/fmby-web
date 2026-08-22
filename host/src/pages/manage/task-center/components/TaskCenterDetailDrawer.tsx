import type { Dispatch, SetStateAction } from 'react';
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import type {
  TaskCenterItemDetailRecord,
  TaskCenterItemRecord,
  TaskCenterCategory,
  TaskCenterAction,
} from '@/domains/manage/task-center';
import { SideDrawer } from '@/shared/ui';
import { FeedbackState } from '@/shared/ui';
import { StatusBadge } from '@/shared/ui';
import { formatDateTime } from '@/shared/utils/date';
import { getErrorMessage } from '@/shared/utils/error';
import styles from '../../ManagePages.module.css';
import { ManageSectionCard, getManageStatusVariant } from '../../components';
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
