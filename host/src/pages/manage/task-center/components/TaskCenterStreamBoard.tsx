/*
 * E3 前端半边：任务中心流式面板（可以慢，不能空）。
 *
 * 卡面契约与本组件的对应：
 *   §5 ≤300ms 出内容      ⇒ `loading` 态渲染 **骨架行**（SKELETON_ROWS 条，带可读文案），
 *                            不是白屏、也不是「纯转圈」；
 *   §6 每批 append + 计数  ⇒ 顶部 `tc-stream-status` 走 buildStreamStatusText 三态文案，
 *                            行区保序累计（去重在 hook 的 mergeBatch）；
 *   §7 3s 无数据降级       ⇒ `stalled` 渲染 `tc-stalled`（降级文案 + 重试按钮 +
 *                            「任务仍在后台执行」提示），骨架保留不撤；
 *   §8 空态明确            ⇒ `empty` 渲染「当前没有运行中的任务」+ 引导动作；
 *   §9 实时可见            ⇒ 由 hook 的 subscribeBatches seam 供数（后端暂无
 *                            task-center WS 事件，见 useTaskCenterStream 头注）。
 *
 * ★本组件是**纯展示**（props 进、DOM 出，不取数、不定时）⇒ 真 DOM 断言只测呈现，
 *   顶部文案只吃 status + loadedCount（hasMore 与 status 冗余，不重复传两个真源）。
 *   计时线在 task-center-streaming.dom.test.ts 里由 hook 驱动。
 */

import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, ListTodo, RefreshCw } from 'lucide-react';
import type { TaskCenterItemRecord } from '@fmby/v2-shared/contracts/manage/task-center';
import { StatusBadge } from '@fmby/v2-shared/ui';
import { formatRelativeTime } from '@fmby/v2-shared/time';
import { getCategoryLabel, getStatusLabel, mapStatusVariant } from '../utils';
import {
  SKELETON_ROWS,
  buildStreamStatusText,
  type TaskCenterStreamStatus,
} from '../hooks/useTaskCenterStream';
import styles from './TaskCenterStreamBoard.module.css';

export interface TaskCenterStreamBoardProps {
  status: TaskCenterStreamStatus;
  items: TaskCenterItemRecord[];
  loadedCount: number;
  total: number;
  errorMessage: string | null;
  onRetry: () => void;
  /**
   * 行区渲染器（页面传既有 `<TaskCenterList>` ⇒ 保住表格/移动卡双分支 + 行键盘漫游）；
   * 不传则用本件自带的流式行（探针依赖这一分支）。
   * ★为什么不强制页面用自带行：那会让 TaskCenterList 变死代码，而它被
   *   `tablewrap-region-audit`（双向名单比对）与 `table-row-keynav`（真组件接线）
   *   两个既有用例引用 ⇒ 删除属跨卡改动，不在本卡越界。
   */
  children?: ReactNode;
}

/**
 * 本地状态词 → 徽标色调（与 task-center/utils 的 mapStatusVariant 同一套词表）。
 *
 * ★为什么不 import `../../components` 的 getManageStatusVariant：那个 barrel 带
 *   react-router + 整个 shared UI 面，让本组件在**测试探针**里多拖 15s+ 构建
 *   （实测：本文件单独打包 18.8s vs 去掉该 import 后 ~2s）。状态词映射是纯查表，
 *   本地一份不违反「单一事实源」——**词表**仍来自 utils.mapStatusVariant。
 */
function statusTone(status: TaskCenterItemRecord['status']): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (mapStatusVariant(status)) {
    case 'succeeded':
      return 'success';
    case 'failed':
      return 'danger';
    case 'running':
    case 'retry-waiting':
    case 'queued':
      return 'info';
    case 'warning':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function TaskCenterStreamBoard({
  status,
  items,
  loadedCount,
  total,
  errorMessage,
  onRetry,
  children,
}: TaskCenterStreamBoardProps) {
  const statusText = buildStreamStatusText({ status, loaded: loadedCount, total });

  return (
    <section className={styles.board} data-testid="tc-stream-board" data-status={status}>
      {/* §6：顶部计数条（三态文案可辨） */}
      <div className={styles.statusBar}>
        <span className={styles.statusIcon}>
          <ListTodo size={14} />
        </span>
        <span className={styles.statusText} data-testid="tc-stream-status">
          {statusText}
        </span>
        {status === 'streaming' ? (
          <span className={styles.streamingDot} aria-hidden="true" />
        ) : null}
      </div>

      {/* §7：3s 无任何数据 ⇒ 降级文案 + 重试 + 后台提示（不是 spinner 到永远） */}
      {status === 'stalled' ? (
        <div className={styles.stalled} role="alert" data-testid="tc-stalled">
          <AlertTriangle size={16} />
          <div className={styles.stalledBody}>
            <strong>任务数据加载受阻</strong>
            <p>
              已等待超过 3 秒仍未取到任务。任务仍在后台执行，数据没有丢失；
              你可以重试，或稍后回任务中心查看。
            </p>
            <button className={styles.retryButton} type="button" onClick={onRetry} data-testid="tc-retry">
              <RefreshCw size={14} />
              重试加载
            </button>
          </div>
        </div>
      ) : null}

      {/* 取数失败：透传原因（不吞成空） */}
      {status === 'error' ? (
        <div className={styles.stalled} role="alert" data-testid="tc-error">
          <AlertTriangle size={16} />
          <div className={styles.stalledBody}>
            <strong>任务中心加载失败</strong>
            <p>{errorMessage ?? '未知原因'}</p>
            <button className={styles.retryButton} type="button" onClick={onRetry} data-testid="tc-retry">
              <RefreshCw size={14} />
              重试加载
            </button>
          </div>
        </div>
      ) : null}

      {/* §5：首块未到 ⇒ 骨架行（≤300ms 即出现在 DOM 里，有可读文案） */}
      {status === 'loading' || status === 'stalled' ? (
        <ul className={styles.list} aria-busy="true">
          {Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <li key={`skeleton-${i}`} className={styles.skeletonRow} data-testid="tc-skeleton-row">
              <span className={styles.skeletonBadge} />
              <span className={styles.skeletonLines}>
                <span className={styles.skeletonLine} style={{ width: '62%' }} />
                <span className={styles.skeletonLine} style={{ width: '38%' }} />
              </span>
              <span className={styles.skeletonHint}>正在装载任务…</span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* §8：空态明确（后端明确返回 0 条，不是卡死、不是空壳） */}
      {status === 'empty' ? (
        <div className={styles.empty} data-testid="tc-empty">
          <Inbox size={20} />
          <strong>当前没有运行中的任务</strong>
          <p>
            流水线空闲，或当前筛选条件下没有匹配的任务。任务一旦产生就会自动出现在这里。
          </p>
          <div className={styles.emptyActions}>
            <button className={styles.retryButton} type="button" onClick={onRetry}>
              <RefreshCw size={14} />
              刷新任务列表
            </button>
          </div>
        </div>
      ) : null}

      {/* 真行（loading/stalled 期不渲染 ⇒ 骨架让位给数据）。
          页面传 children ⇒ 用既有行渲染器；否则用自带流式行。 */}
      {status !== 'loading' && status !== 'stalled' && items.length > 0 ? (
        children ?? (
        <ul className={styles.list}>
          {items.map((item) => (
            <li
              key={`${item.category}:${item.id}`}
              className={styles.row}
              data-testid="tc-task-row"
              data-task-id={item.id}
            >
              <div className={styles.rowHead}>
                <span className={styles.category}>{getCategoryLabel(item.category)}</span>
                <StatusBadge
                  label={getStatusLabel(item.status)}
                  variant={statusTone(item.status)}
                />
              </div>
              <div className={styles.rowBody}>{item.summary}</div>
              <div className={styles.rowMeta}>
                <span>{item.mediaTitle ?? '系统级任务'}</span>
                <span>{formatRelativeTime(item.updatedAt)}</span>
                {item.retryCount > 0 ? <span>重试 {item.retryCount} 次</span> : null}
              </div>
              {item.lastErrorMessage ? (
                <div className={styles.rowError}>
                  {item.lastErrorCode ? `[${item.lastErrorCode}] ` : ''}
                  {item.lastErrorMessage}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        )
      ) : null}

      {/* 收口计数：必须区分「真显示完」与「流式封顶」——
          封顶时写「已显示全部」就是谎报（本仓 FE-UI-2 P0-① 刚因谎报空态被点名）。 */}
      {status === 'done' ? (
        <div className={styles.doneHint}>
          {loadedCount < total
            ? `已加载 ${loadedCount} 条（后端口径共 ${total} 条，其余用筛选或下方翻页查看）`
            : `已显示全部 ${loadedCount} 条。`}
        </div>
      ) : null}
    </section>
  );
}
