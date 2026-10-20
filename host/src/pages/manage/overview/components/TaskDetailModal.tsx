import { Link } from 'react-router';
import {
  ArrowUpCircle,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { DetailModal, StatusBadge } from '@fmby/v2-shared/ui';
import type { TaskCenterItemRecord } from '@fmby/v2-shared/contracts/manage/task-center';
import { formatDateTime, formatRelativeTime } from '@fmby/v2-shared/time';
import { getManageStatusVariant } from '../../components';
import { getCategoryLabel, getStatusLabel, mapStatusVariant } from '../../task-center/utils';
import styles from '../ManageOverviewCockpit.module.css';

interface TaskDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskCenterItemRecord | null;
  onBoostPriority?: (taskId: string) => void;
  onCancelTask?: (taskId: string) => void;
  onRetryTask?: (taskId: string) => void;
}

/** 后端 status 词 → 是否仍在执行（决定动作按钮是否出现）。 */
function isActive(status: TaskCenterItemRecord['status']): boolean {
  return status === 'Running' || status === 'Queued' || status === 'RetryWaiting';
}

/**
 * 中控任务详情（FE-UI-2 P0-①）。
 *
 * 改前用的是**本地假形状** `ActiveTaskQueueItem`（progressPercent /
 * totalSubItems / subItems / priority）——后端**没有这些字段**，只能编数据
 * （P0-① 的病灶之一：喂空数组 + 假形状 ⇒ 整个 widget 是空壳）。
 * 现改用契约真实形状 `TaskCenterItemRecord`（与 `/manage/task-center` 同一个
 * DTO）⇒ 每个字段都能在任务中心页对账。
 *
 * ★没有字段的块**直接不渲染**，不用假进度条/假子项日志充数（诚实 > 好看）。
 * 想深挖执行明细 ⇒ 走任务中心详情抽屉（真实 timeline 端点）。
 */
export function TaskDetailModal({
  open,
  onOpenChange,
  task,
  onBoostPriority,
  onCancelTask,
  onRetryTask,
}: TaskDetailModalProps) {
  if (!task) return null;

  return (
    <DetailModal
      open={open}
      onOpenChange={onOpenChange}
      title={task.summary}
      eyebrow={`${getCategoryLabel(task.category)} · 任务详情`}
      description={`任务 ID: ${task.id} · 创建于 ${formatDateTime(task.createdAt)}`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* 顶部：类别徽标 + 状态 + 媒体归属 */}
        <div className={styles.modalProgressBanner}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span className={styles.taskCategoryBadge}>{getCategoryLabel(task.category)}</span>
              <StatusBadge
                label={getStatusLabel(task.status)}
                variant={getManageStatusVariant(mapStatusVariant(task.status))}
              />
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {/* 后端 updated_at 是 Option：在途任务没有终态时刻 ⇒ 不许拿
                  formatRelativeTime 的兜底「刚刚更新」冒充"刚更新过"。 */}
              {task.updatedAt ? `更新于 ${formatRelativeTime(task.updatedAt)}` : '尚无终态时刻'}
            </span>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            <strong>媒体：</strong>
            {/* 后端 media_title 恒 null（V2 task_definition 无媒体标题列）⇒ 判「系统级任务」
                的判据只能是 mediaItemId，不能是恒空的标题字段。 */}
            {task.mediaTitle
              ? task.mediaTitle
              : task.mediaItemId
                ? `媒体 ${task.mediaItemId}`
                : '系统级任务'}
          </div>
        </div>

        {/* 错误明细（有则如实呈现） */}
        {task.lastErrorMessage ? (
          <div style={{ fontSize: '12.5px', color: 'var(--danger)' }}>
            <strong>最近失败：</strong>
            {task.lastErrorCode ? `[${task.lastErrorCode}] ` : ''}
            {task.lastErrorMessage}
            {`（第 ${task.retryCount} 次尝试）`}
          </div>
        ) : (
          <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
            {/* 后端该槽位是 attempt（首次执行即 1），不是"重试过几次" */}
            第 {task.retryCount} 次尝试
          </div>
        )}

        {/* 动作控制条：与任务中心同一套动作口径 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {isActive(task.status) && onBoostPriority ? (
            <button
              type="button"
              onClick={() => onBoostPriority(task.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                color: '#fbbf24',
                fontSize: '12.5px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <ArrowUpCircle size={14} />
              提高优先级（置顶执行）
            </button>
          ) : null}

          {isActive(task.status) && onCancelTask ? (
            <button
              type="button"
              onClick={() => onCancelTask(task.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                background: 'var(--danger-glass-bg)',
                border: '1px solid var(--danger-glass-border)',
                color: 'var(--danger)',
                fontSize: '12.5px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <XCircle size={14} />
              取消该任务
            </button>
          ) : null}

          {task.status === 'Failed' && onRetryTask ? (
            <button
              type="button"
              onClick={() => onRetryTask(task.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                background: 'rgba(6, 182, 212, 0.15)',
                border: '1px solid rgba(6, 182, 212, 0.35)',
                color: 'var(--manage-cyan)',
                fontSize: '12.5px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} />
              重新执行
            </button>
          ) : null}
        </div>

        {/* ★诚实：执行明细（timeline）在中控不重复实现——指回任务中心真实详情 */}
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
          执行明细与分项日志见
          <Link to="/manage/task-center" style={{ color: 'var(--manage-cyan)' }}>
            {' '}任务中心{' '}
          </Link>
          的该任务详情。
        </p>
      </div>
    </DetailModal>
  );
}
