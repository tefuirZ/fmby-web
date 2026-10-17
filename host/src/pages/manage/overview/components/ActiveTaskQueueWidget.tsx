import {
  ArrowUpCircle,
  DownloadCloud,
  FileSearch,
  FolderSync,
  ListFilter,
  ListTodo,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router';
import type { ActiveTaskQueueItem } from './TaskDetailModal';
import styles from '../ManageOverviewCockpit.module.css';

interface ActiveTaskQueueWidgetProps {
  tasks: ActiveTaskQueueItem[];
  onOpenTaskDetail: (task: ActiveTaskQueueItem) => void;
  onBoostPriority?: (taskId: string) => void;
  onCancelTask?: (taskId: string) => void;
}

export function ActiveTaskQueueWidget({
  tasks,
  onOpenTaskDetail,
  onBoostPriority,
  onCancelTask,
}: ActiveTaskQueueWidgetProps) {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Scrape':
        return <DownloadCloud size={13} />;
      case 'Scan':
        return <FolderSync size={13} />;
      case 'Identify':
        return <FileSearch size={13} />;
      case 'Cleanup':
        return <ListFilter size={13} />;
      default:
        return <Sparkles size={13} />;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'Scrape':
        return '海报与刮削';
      case 'Scan':
        return '数据源扫描';
      case 'Identify':
        return '音视频探针';
      case 'Cleanup':
        return '命名规则清洗';
      default:
        return '异步任务';
    }
  };

  const runningCount = tasks.filter((t) => t.status === 'running').length;

  return (
    <section className={styles.cockpitCard}>
      <div className={styles.cockpitCardHeader}>
        <div className={styles.cardTitleWrap}>
          <span className={styles.cardTitleIcon}>
            <ListTodo size={18} />
          </span>
          <h2 className={styles.cardTitle}>正在运行的任务队列</h2>
          {/* FE-UI-ACCEPT A2：tasks 数据面未接入前不渲染「0 个执行中 · 共 0 项」——
              把「没有数据」算成「0 项在跑」同样是谎报的一半。 */}
          {tasks.length > 0 ? (
            <span className={styles.cardSubtitle}>（{runningCount} 个执行中 · 共 {tasks.length} 项）</span>
          ) : null}
        </div>
        <div className={styles.cardHeaderActions}>
          {/* FE-UI-ACCEPT A2：死链修复——路由表只有 /manage/task-center，
              原先的 /manage/tasks 会进 RouteErrorPage（验收 deadLinkCount=1 实锤）。 */}
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

      {tasks.length === 0 ? (
        <div style={{ padding: 'var(--space-6) var(--space-4)', textAlign: 'center', color: 'var(--text-muted)' }}>
          <ListTodo size={24} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
          <div style={{ fontSize: '13.5px', color: 'var(--text-primary)', fontWeight: 500 }}>
            暂无任务数据
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            运行中任务的数据面尚未接入，这里不展示猜测值；全量任务请到任务中心查看。
          </p>
        </div>
      ) : (
        <div className={styles.taskQueueList}>
          {tasks.map((task) => (
            <article
              key={task.id}
              className={styles.taskItemCard}
              onClick={() => onOpenTaskDetail(task)}
              title="点击查看任务详情与子条目"
            >
              {/* 头部：分类标签与快捷操作 */}
              <div className={styles.taskHeaderRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                    <span style={{ fontSize: '10.5px', color: '#fbbf24', fontWeight: 600 }}>
                      ⚡ 优先
                    </span>
                  ) : null}
                </div>

                <div className={styles.taskActionsRow} onClick={(e) => e.stopPropagation()}>
                  {task.priority !== 'urgent' && onBoostPriority ? (
                    <button
                      type="button"
                      className={`${styles.taskActionButton} ${styles.boost}`}
                      title="置顶提高优先级"
                      onClick={() => onBoostPriority(task.id)}
                    >
                      <ArrowUpCircle size={14} />
                    </button>
                  ) : null}

                  {onCancelTask ? (
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

              {/* 任务目标名称 */}
              <div className={styles.taskTitleText}>{task.title}</div>

              {/* 进度条与阶段描述 */}
              <div className={styles.taskProgressArea}>
                <div className={styles.taskProgressHeader}>
                  <span className={styles.taskProgressStage}>{task.stageDescription}</span>
                  <span className={styles.taskProgressPercent}>
                    {task.completedSubItems}/{task.totalSubItems} ({task.progressPercent}%)
                  </span>
                </div>
                <div className={styles.threadTrack}>
                  <div
                    className={styles.streamProgressFill}
                    style={{ width: `${Math.max(6, task.progressPercent)}%` }}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
