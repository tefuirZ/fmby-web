import {
  DownloadCloud,
  FileSearch,
  FolderSync,
  ListFilter,
  ListTodo,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router';
import type { TaskCenterItemRecord } from '@fmby/v2-shared/contracts/manage/task-center';
import styles from '../ManageOverviewCockpit.module.css';

interface ActiveTaskQueueWidgetProps {
  // ★P1-2：真 DTO（原 ActiveTaskQueueItem 是 9 假字段的本地形状）。
  tasks: TaskCenterItemRecord[];
  onOpenTaskDetail: (task: TaskCenterItemRecord) => void;
}

export function ActiveTaskQueueWidget({
  tasks,
  onOpenTaskDetail,
}: ActiveTaskQueueWidgetProps) {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Scrape':
        return <DownloadCloud size={13} />;
      case 'Scan':
        return <FolderSync size={13} />;
      case 'Identify':
        return <FileSearch size={13} />;
      case 'Tombstone':
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
      case 'Tombstone':
        return '墓碑（已删条目）';
      default:
        return '异步任务';
    }
  };

  const runningCount = tasks.filter((t) => t.status === 'Running').length;

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
              title="点击查看任务详情"
            >
              <div className={styles.taskHeaderRow}>
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
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {getStatusLabel(task.status)}
                </span>
              </div>
              {/* 真 DTO 无 title/summary 之外的可信名称字段 ⇒ 用 summary（后端字段）。 */}
              <div className={styles.taskTitleText}>{task.summary}</div>
              {task.lastErrorMessage ? (
                <div style={{ fontSize: '11px', color: 'var(--danger)' }}>{task.lastErrorMessage}</div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

/** ★P1-2：真枚举状态文案（TaskCenterStatus，PascalCase）。 */
function getStatusLabel(status: TaskCenterItemRecord['status']): string {
  switch (status) {
    case 'Queued':
      return '排队中';
    case 'Running':
      return '执行中';
    case 'RetryWaiting':
      return '等待重试';
    case 'Failed':
      return '失败';
    case 'Succeeded':
      return '成功';
    case 'NeedsReview':
      return '待审核';
    case 'Cancelled':
      return '已取消';
    case 'Skipped':
      return '已跳过';
    default:
      return status;
  }
}
