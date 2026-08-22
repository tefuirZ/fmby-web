import { useState } from 'react';
import {
  AlertCircle,
  ArrowUpCircle,
  CheckCircle2,
  Clock,
  DownloadCloud,
  FileSearch,
  FolderSync,
  ListFilter,
  Loader2,
  RefreshCw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { DetailModal } from '@fmby/v2-shared/ui';
import styles from '../ManageOverviewCockpit.module.css';

export interface TaskSubItem {
  id: string;
  title: string;
  stage: string;
  status: 'succeeded' | 'running' | 'queued' | 'failed';
  updatedAt: string;
  errorMessage?: string;
}

export interface ActiveTaskQueueItem {
  id: string;
  category: 'Scrape' | 'Scan' | 'Identify' | 'Cleanup';
  title: string;
  stageDescription: string;
  progressPercent: number;
  totalSubItems: number;
  completedSubItems: number;
  status: 'running' | 'queued' | 'retry-waiting' | 'failed' | 'succeeded';
  priority: 'normal' | 'high' | 'urgent';
  createdAt: string;
  subItems: TaskSubItem[];
}

interface TaskDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: ActiveTaskQueueItem | null;
  onBoostPriority?: (taskId: string) => void;
  onCancelTask?: (taskId: string) => void;
  onRetryTask?: (taskId: string) => void;
}

export function TaskDetailModal({
  open,
  onOpenChange,
  task,
  onBoostPriority,
  onCancelTask,
  onRetryTask,
}: TaskDetailModalProps) {
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  if (!task) return null;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Scrape':
        return <DownloadCloud size={14} />;
      case 'Scan':
        return <FolderSync size={14} />;
      case 'Identify':
        return <FileSearch size={14} />;
      case 'Cleanup':
        return <ListFilter size={14} />;
      default:
        return <Sparkles size={14} />;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'Scrape':
        return '海报与信息刮削';
      case 'Scan':
        return '数据源目录更新';
      case 'Identify':
        return '音视频流探针识别';
      case 'Cleanup':
        return '命名规则清洗与对齐';
      default:
        return '异步任务';
    }
  };

  // 分页计算
  const subItems = task.subItems || [];
  const totalPages = Math.max(1, Math.ceil(subItems.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const currentSubItems = subItems.slice(startIndex, startIndex + pageSize);

  return (
    <DetailModal
      open={open}
      onOpenChange={onOpenChange}
      title={task.title}
      eyebrow={`${getCategoryLabel(task.category)} · 任务详情`}
      description={`任务 ID: ${task.id} · 创建于 ${new Date(task.createdAt).toLocaleTimeString()}`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* 顶部进度条与当前阶段横幅 */}
        <div className={styles.modalProgressBanner}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                className={`${styles.taskCategoryBadge} ${
                  task.category === 'Scrape'
                    ? styles.scrape
                    : task.category === 'Scan'
                      ? styles.scan
                      : task.category === 'Identify'
                        ? styles.identify
                        : styles.cleanup
                }`}
              >
                {getCategoryIcon(task.category)}
                {getCategoryLabel(task.category)}
              </span>

              {task.priority === 'urgent' || task.priority === 'high' ? (
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#fbbf24',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    fontWeight: 600,
                  }}
                >
                  ⚡ 已置顶高优先
                </span>
              ) : null}
            </div>

            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--manage-cyan)' }}>
              {task.completedSubItems} / {task.totalSubItems} 完成 ({task.progressPercent}%)
            </div>
          </div>

          {/* 进度条 */}
          <div className={styles.threadTrack} style={{ height: '7px' }}>
            <div
              className={styles.streamProgressFill}
              style={{ width: `${Math.max(8, task.progressPercent)}%` }}
            />
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            <strong>当前阶段：</strong>{task.stageDescription}
          </div>
        </div>

        {/* 动作控制条：提高优先级、取消任务、重试 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {task.status === 'running' || task.status === 'queued' ? (
            <>
              {task.priority !== 'urgent' && onBoostPriority ? (
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

              {onCancelTask ? (
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
            </>
          ) : null}

          {task.status === 'failed' && onRetryTask ? (
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

        {/* 子任务条目与分页控制 */}
        <div>
          <div className={styles.modalControlsRow}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              执行明细与分项日志 ({subItems.length} 个条目)
            </div>

            {/* 每页最大条目数选择器 */}
            <div className={styles.pageSizeSelectWrap}>
              <span>每页显示：</span>
              <select
                className={styles.pageSizeSelect}
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={10}>10 条/页</option>
                <option value={20}>20 条/页</option>
                <option value={50}>50 条/页</option>
              </select>
            </div>
          </div>

          {/* 子任务列表 */}
          <div className={styles.subTasksList}>
            {currentSubItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '12.5px' }}>
                暂无子任务分项日志
              </div>
            ) : (
              currentSubItems.map((item) => (
                <div key={item.id} className={styles.subTaskRow}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    {item.status === 'succeeded' ? (
                      <CheckCircle2 size={15} style={{ color: 'var(--success)', flexShrink: 0 }} />
                    ) : item.status === 'running' ? (
                      <Loader2 size={15} className="spin" style={{ color: 'var(--manage-cyan)', flexShrink: 0 }} />
                    ) : item.status === 'failed' ? (
                      <AlertCircle size={15} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                    ) : (
                      <Clock size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div className={styles.subTaskName} title={item.title}>
                        {item.title}
                      </div>
                      {item.errorMessage ? (
                        <div style={{ color: 'var(--danger)', fontSize: '11px', marginTop: '2px' }}>
                          {item.errorMessage}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className={styles.subTaskStage}>{item.stage}</div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {new Date(item.updatedAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 分页控制栏 */}
          {totalPages > 1 ? (
            <div className={styles.paginationRow}>
              <span>
                第 {validCurrentPage} / {totalPages} 页 · 共 {subItems.length} 条
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  disabled={validCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  style={{
                    padding: '3px 10px',
                    borderRadius: '4px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                    fontSize: '11.5px',
                    cursor: validCurrentPage <= 1 ? 'not-allowed' : 'pointer',
                    opacity: validCurrentPage <= 1 ? 0.5 : 1,
                  }}
                >
                  上一页
                </button>
                <button
                  type="button"
                  disabled={validCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  style={{
                    padding: '3px 10px',
                    borderRadius: '4px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                    fontSize: '11.5px',
                    cursor: validCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
                    opacity: validCurrentPage >= totalPages ? 0.5 : 1,
                  }}
                >
                  下一页
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </DetailModal>
  );
}
