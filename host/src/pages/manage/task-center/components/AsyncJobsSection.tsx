/**
 * ★FE-ASYNC-FEEDBACK ②：任务中心「后台任务」区——用户发起的后台操作在这里可见。
 *
 * 展示：任务名 / 发起人 / 状态 / 开始时间 / 耗时（走秒）/ 失败原因；
 * 进度：契约对齐前无数据源，「有则显示」（任一任务带 progress 才出列）。
 * 操作：失败 → 重试；已结束 → 移除。真取消（服务端 cancel）待 E1 契约。
 *
 * ★契约边界：数据源 = 本会话 AsyncJobsProvider（E1 202+job_id 未落地）；
 * 服务端异步任务全量聚合待契约对齐后接入。
 */

import { useEffect, useState } from 'react';
import { StatusBadge, useAsyncJobs, type AsyncJob } from '@fmby/v2-shared/ui';
import { ManageSectionCard } from '../../components';
import styles from '../../ManagePages.module.css';

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString('zh-CN', { hour12: false });
}

/** 耗时走秒：running 时每秒重渲染；已结束取 finishedAt-startedAt 定值。 */
function useNowTick(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [enabled]);
  return now;
}

const STATUS_BADGE: Record<AsyncJob['status'], { label: string; variant: 'info' | 'success' | 'danger' }> = {
  running: { label: '执行中', variant: 'info' },
  succeeded: { label: '已完成', variant: 'success' },
  failed: { label: '失败', variant: 'danger' },
};

export function AsyncJobsSection() {
  const { jobs, retry, clear } = useAsyncJobs();
  const hasRunning = jobs.some((job) => job.status === 'running');
  const now = useNowTick(hasRunning);
  const showProgressColumn = jobs.some((job) => job.progress != null);

  return (
    <ManageSectionCard
      title="后台任务"
      description="你在本会话发起的后台操作：提交即入列，完成/失败都在这里可查；失败可重试。"
    >
      {jobs.length === 0 ? (
        <div className={styles.emptyInlineState}>
          本会话暂无你发起的后台任务。服务端异步任务契约（202 + job_id）对齐后，这里将聚合全部用户后台操作（含跨会话）。
        </div>
      ) : (
        <div className={styles.tableWrap} role="region" aria-label="后台任务（可横向滚动）">
          <table className={styles.table}>
            <thead>
              <tr>
                <th>任务名</th>
                <th>发起人</th>
                <th>状态</th>
                <th>开始时间</th>
                <th>耗时</th>
                {showProgressColumn ? <th>进度</th> : null}
                <th>失败原因</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const badge = STATUS_BADGE[job.status];
                const duration =
                  job.status === 'running' ? now - job.startedAt : (job.finishedAt ?? now) - job.startedAt;
                return (
                  <tr key={job.id}>
                    <td>
                      <div className={styles.stackText}>
                        <span className={styles.primaryText}>{job.name}</span>
                        <span className={styles.mutedText}>{job.id}</span>
                      </div>
                    </td>
                    <td>{job.initiator}</td>
                    <td>
                      <div className={styles.stackText}>
                        <StatusBadge label={badge.label} variant={badge.variant} />
                        {job.busyNote ? <span className={styles.mutedText}>{job.busyNote}</span> : null}
                      </div>
                    </td>
                    <td className={styles.mutedText}>{formatClock(job.startedAt)}</td>
                    <td className={styles.mutedText}>
                      {formatDuration(duration)}
                      {job.status === 'running' ? ' · 进行中' : ''}
                    </td>
                    {showProgressColumn ? (
                      <td className={styles.mutedText}>
                        {job.progress != null ? `${Math.round(job.progress)}%` : '—'}
                      </td>
                    ) : null}
                    <td className={styles.mutedText}>{job.error ?? '—'}</td>
                    <td>
                      <div className={styles.rowActions}>
                        {job.status === 'failed' ? (
                          <button
                            className={styles.smallButton}
                            type="button"
                            onClick={() => retry(job.id)}
                          >
                            重试
                          </button>
                        ) : null}
                        {job.status !== 'running' ? (
                          <button
                            className={styles.smallDangerButton}
                            type="button"
                            onClick={() => clear(job.id)}
                          >
                            移除
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </ManageSectionCard>
  );
}
