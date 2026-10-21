/*
 * 中控「正在运行的任务队列」（FE-UI-2 P0-① 数据接线）。
 *
 * 改前：`ManageOverviewPage` 喂硬编码空数组（`const tasks = []`）⇒ 本组件
 * **恒渲染空态**，而空态文案是「任务队列空闲 / 所有挂载目录、海报与元数据
 * 已完成最新刮削与入库」⇒ 用户读到的是「系统全绿」的**谎报**。
 *
 * 现在：tasks 由 `taskCenterApi.getItems({status:'active'})`（真实端点
 * `/api/manage/task-center/items`）供给；本组件只负责呈现**后端给的事实**：
 *   - `items=[]`   ⇒ 「暂无进行中的任务」（不说「全部完成」）
 *   - `items=[…]`  ⇒ 逐条列出（类别 / 媒体 / 状态 / 摘要）
 *
 * ★为什么用 TaskCenterItemRecord 而不是本地 ActiveTaskQueueItem 形状：
 *   本地形状（progressPercent / totalSubItems / subItems / priority）**后端
 *   没有对应字段**，硬造就只能编假数据（正是 P0-① 要修的病）。改用契约真实
 *   字段 ⇒ 每个数字都能在任务中心页对账。
 *
 * ★死链已修：改前「任务中心 ➔」指向 `/manage/tasks`（路由表只有
 *   `/manage/task-center` ⇒ 点击进 RouteErrorPage）；现指真实路由。
 */

import { Link } from 'react-router';
import {
  ArrowUpCircle,
  ListTodo,
  XCircle,
} from 'lucide-react';
import type { TaskCenterItemRecord } from '@fmby/v2-shared/contracts/manage/task-center';
import { StatusBadge } from '@fmby/v2-shared/ui';
import { formatRelativeTime } from '@fmby/v2-shared/time';
import { getManageStatusVariant } from '../../components';
import { getCategoryLabel, getStatusLabel, mapStatusVariant } from '../../task-center/utils';
import styles from '../ManageOverviewCockpit.module.css';

interface ActiveTaskQueueWidgetProps {
  tasks: TaskCenterItemRecord[];
  onOpenTaskDetail: (task: TaskCenterItemRecord) => void;
  onBoostPriority?: (taskId: string) => void;
  onCancelTask?: (taskId: string) => void;
}

/** 后端 status 词 → 前端口径（running/queued 计「执行中」）。 */
function isRunning(status: TaskCenterItemRecord['status']): boolean {
  return status === 'Running' || status === 'Queued' || status === 'RetryWaiting';
}

export function ActiveTaskQueueWidget({
  tasks,
  onOpenTaskDetail,
  onBoostPriority,
  onCancelTask,
}: ActiveTaskQueueWidgetProps) {
  const runningCount = tasks.filter((t) => t.status === 'Running').length;

  return (
    <section className={styles.cockpitCard}>
      <div className={styles.cockpitCardHeader}>
        <div className={styles.cardTitleWrap}>
          <span className={styles.cardTitleIcon}>
            <ListTodo size={18} />
          </span>
          <h2 className={styles.cardTitle}>正在运行的任务队列</h2>
          <span className={styles.cardSubtitle}>（{runningCount} 个执行中 · 共 {tasks.length} 项）</span>
        </div>
        <div className={styles.cardHeaderActions}>
          {/* FE-UI-2 P0-①c：改前指向 /manage/tasks（不存在 ⇒ 404 死链）。 */}
          <Link
            to="/manage/task-center"
            style={{
              fontSize: '12px',
              color: 'var(--manage-cyan)',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            任务中心 ➔
          </Link>
        </div>
      </div>

      {/*
       * FE-UI-2 P0-①b：空态**只陈述数据事实**。改前文案「所有挂载目录、海报与
       * 元数据已完成最新刮削与入库」把「没取到任务」说成「全部完成」= 谎报。
       */}
      {tasks.length === 0 ? (
        <div style={{ padding: 'var(--space-6) var(--space-4)', textAlign: 'center', color: 'var(--text-muted)' }}>
          <ListTodo size={24} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
          <div style={{ fontSize: '13.5px', color: 'var(--text-primary)', fontWeight: 500 }}>
            暂无进行中的任务
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            当前没有扫描、刮削或识别任务在执行。任务明细与历史见任务中心。
          </p>
        </div>
      ) : (
        <div className={styles.taskQueueList}>
          {tasks.map((task) => (
            <article
              key={`${task.category}:${task.id}`}
              className={styles.taskItemCard}
              onClick={() => onOpenTaskDetail(task)}
              title="点击查看任务详情与子条目"
            >
              <div className={styles.taskHeaderRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <span className={styles.taskCategoryBadge}>
                    {getCategoryLabel(task.category)}
                  </span>
                  <StatusBadge
                    label={getStatusLabel(task.status)}
                    variant={getManageStatusVariant(mapStatusVariant(task.status))}
                  />
                </div>
                <div className={styles.taskActionsRow} onClick={(e) => e.stopPropagation()}>
                  {onBoostPriority && isRunning(task.status) ? (
                    <button
                      type="button"
                      className={`${styles.taskActionButton} ${styles.boost}`}
                      title="置顶提高优先级"
                      onClick={() => onBoostPriority(task.id)}
                    >
                      <ArrowUpCircle size={14} />
                    </button>
                  ) : null}

                  {onCancelTask && isRunning(task.status) ? (
                    <button
                      type="button"
                      className={`${styles.taskActionButton} ${styles.cancel}`}
                      title="取消此任务"
                      onClick={() => onCancelTask(task.id)}
                    >
                      <XCircle size={14} />
                    </button>
                  ) : null}
                </div>
              </div>

              {/* 任务目标名称（后端 summary；无媒体标题时说明是系统级任务） */}
              <div className={styles.taskTitleText}>{task.summary}</div>

              <div className={styles.taskProgressArea}>
                <div className={styles.taskProgressHeader}>
                  <span className={styles.taskProgressStage}>
                    {task.mediaTitle ?? '系统级任务'}
                    {task.retryCount > 0 ? ` · 已重试 ${task.retryCount} 次` : ''}
                  </span>
                  <span className={styles.taskProgressPercent}>
                    {formatRelativeTime(task.updatedAt)}
                  </span>
                </div>
                {task.lastErrorMessage ? (
                  <div style={{ fontSize: '11.5px', color: 'var(--danger)', marginTop: '4px' }}>
                    {task.lastErrorCode ? `[${task.lastErrorCode}] ` : ''}
                    {task.lastErrorMessage}
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
