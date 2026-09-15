import type { ReactNode } from 'react';
import { Loader2, RotateCcw, X } from 'lucide-react';
import clsx from 'clsx';
import {
  failedItems,
  isBatchRunning,
  summarize,
  type BatchItemState,
} from '@fmby/v2-shared/batch';
import styles from './BatchProgressPanel.module.css';

interface BatchProgressPanelProps {
  /** 批量项状态快照（来自 runBatch 的 onUpdate 增量）。 */
  items: readonly BatchItemState[];
  /** 操作名（用于文案，如「删除」「停用」）。 */
  actionLabel: string;
  /** 关闭面板。 */
  onDismiss: () => void;
  /** 重试单个失败项。 */
  onRetryItem?: (id: string) => void;
  /** 重试全部失败项。 */
  onRetryFailed?: () => void;
  /** 追加渲染（如「查看详情」链接）。 */
  footer?: ReactNode;
}

/**
 * 批量操作进度面板（FE-OPT-04）
 *
 * 逐条状态：pending（待处理）/ running（进行中）/ ok（成功）/ fail（失败）。
 * 运行中展示进度条 + 计数；结束后展示汇总 + 失败项列表（可单条/批量重试）。
 * 面板内不发起请求——重试由调用方（页面）注入，保持组件纯净。
 */
export function BatchProgressPanel({
  items,
  actionLabel,
  onDismiss,
  onRetryItem,
  onRetryFailed,
  footer,
}: BatchProgressPanelProps) {
  const summary = summarize(items);
  const running = isBatchRunning(items);
  const failed = failedItems(items);
  const done = summary.ok + summary.fail;
  const percent = summary.total > 0 ? Math.round((done / summary.total) * 100) : 0;

  return (
    <div className={styles.panel} role="status" aria-live="polite" data-running={running || undefined}>
      <div className={styles.header}>
        <div className={styles.headerMain}>
          {running ? (
            <Loader2 className={styles.spinner} size={16} aria-hidden="true" />
          ) : null}
          <strong>
            {running
              ? `正在批量${actionLabel}…`
              : `批量${actionLabel}完成：成功 ${summary.ok} / 失败 ${summary.fail}${
                  summary.skipped > 0 ? ` / 未处理 ${summary.skipped}` : ''
                }`}
          </strong>
        </div>
        <button
          className={styles.iconButton}
          type="button"
          onClick={onDismiss}
          aria-label="关闭批量进度"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      <div
        className={styles.track}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`批量${actionLabel}进度`}
      >
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
      <div className={styles.counter}>
        {done} / {summary.total} 已处理
        {running ? `（进行中）` : ''}
      </div>

      {failed.length > 0 ? (
        <div className={styles.failedBlock}>
          <div className={styles.failedHeader}>
            <span>失败 {failed.length} 项</span>
            {onRetryFailed ? (
              <button className={styles.retryAll} type="button" onClick={onRetryFailed}>
                <RotateCcw size={13} aria-hidden="true" />
                重试全部失败项
              </button>
            ) : null}
          </div>
          <ul className={styles.failedList}>
            {failed.map((item) => (
              <li key={item.id} className={styles.failedItem}>
                <span className={styles.failedLabel} title={item.label}>
                  {item.label}
                </span>
                {item.error ? <span className={styles.failedReason}>{item.error}</span> : null}
                {onRetryItem ? (
                  <button
                    className={styles.retryOne}
                    type="button"
                    onClick={() => onRetryItem(item.id)}
                    aria-label={`重试 ${item.label}`}
                  >
                    <RotateCcw size={12} aria-hidden="true" />
                    重试
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </div>
  );
}

interface BatchActionBarProps {
  /** 选中项数。 */
  count: number;
  /** 清空选择。 */
  onClear: () => void;
  /** 动作按钮（由页面注入，如「批量删除」）。 */
  children?: ReactNode;
  /** 提示文案（如删除语义说明）。 */
  hint?: string;
  className?: string;
}

/** 批量动作条（选中 >0 时展示；底部吸附）。 */
export function BatchActionBar({ count, onClear, children, hint, className }: BatchActionBarProps) {
  if (count <= 0) return null;
  return (
    <div className={clsx(styles.actionBar, className)} role="region" aria-label="批量操作">
      <div className={styles.actionBarText}>
        <strong>已选择 {count} 项</strong>
        {hint ? <span className={styles.actionBarHint}>{hint}</span> : null}
      </div>
      <div className={styles.actionBarActions}>
        <button className={styles.clearButton} type="button" onClick={onClear}>
          清空选择
        </button>
        {children}
      </div>
    </div>
  );
}
