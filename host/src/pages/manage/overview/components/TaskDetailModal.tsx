import {
  DownloadCloud,
  FileSearch,
  FolderSync,
  ListFilter,
  Sparkles,
} from 'lucide-react';
import { DetailModal } from '@fmby/v2-shared/ui';
import type { TaskCenterItemRecord } from '@fmby/v2-shared/contracts/manage/task-center';
import styles from '../ManageOverviewCockpit.module.css';

// ★P1-2（fmby-web #152/#154）：假形状已删，改用契约真实 DTO。
// 原 ActiveTaskQueueItem/TaskSubItem 的 progressPercent/totalSubItems/subItems/
// priority/stageDescription 全是后端 TaskCenterItemRecord 没有的字段 ⇒ 只能编数据。
// 渲染面随真 DTO 收缩（见组件体）；首屏仍不挂本组件（main P1-9 ① 决策不变），
// 本卡只保证「组件留在仓里但类型/渲染面干净」。
export type { TaskCenterItemRecord as ActiveTaskQueueItem } from '@fmby/v2-shared/contracts/manage/task-center';

interface TaskDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // ★P1-2：真 DTO（re-export 别名，见文件头）。
  task: TaskCenterItemRecord | null;
}

export function TaskDetailModal({
  open,
  onOpenChange,
  task,
}: TaskDetailModalProps) {
  if (!task) return null;

  // ★P1-2：渲染面收缩到真 DTO 支撑的最小集（id/category/status/createdAt/summary/
  //   retryCount/lastError*）。原假进度条（progressPercent）、阶段描述、子项分页
  //   （subItems）、优先级置顶（priority）全部移除——后端无这些字段，渲染即编数据。
  return (
    <DetailModal
      open={open}
      onOpenChange={onOpenChange}
      title={task.summary}
      eyebrow={`${getCategoryLabel(task.category)} · 任务详情`}
      description={`任务 ID: ${task.id} · 创建于 ${new Date(task.createdAt).toLocaleString()}`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className={`${styles.taskCategoryBadge} ${styles.scan}`}>
            {getCategoryIcon(task.category)}
            {getCategoryLabel(task.category)}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            状态：{getStatusLabel(task.status)}
          </span>
        </div>

        {task.mediaTitle || task.mediaItemId ? (
          <div style={{ fontSize: '12.5px' }}>
            <strong>关联媒体：</strong>
            {task.mediaTitle ?? `#${task.mediaItemId}`}
          </div>
        ) : null}

        <div style={{ fontSize: '12.5px' }}>
          <strong>尝试次数：</strong>第 {task.retryCount} 次尝试
        </div>

        {task.lastErrorCode || task.lastErrorMessage ? (
          <div style={{ fontSize: '12.5px', color: 'var(--danger)' }}>
            <strong>最近错误：</strong>
            {task.lastErrorCode ? `[${task.lastErrorCode}] ` : ''}
            {task.lastErrorMessage ?? ''}
          </div>
        ) : null}

        {task.updatedAt ? (
          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
            <strong>终态时刻：</strong>
            {new Date(task.updatedAt).toLocaleString()}
          </div>
        ) : null}
      </div>
    </DetailModal>
  );
}

/** ★P1-2：真枚举类目图标。 */
function getCategoryIcon(category: string) {
  switch (category) {
    case 'Scrape':
      return <DownloadCloud size={14} />;
    case 'Scan':
      return <FolderSync size={14} />;
    case 'Identify':
      return <FileSearch size={14} />;
    case 'Tombstone':
      return <ListFilter size={14} />;
    default:
      return <Sparkles size={14} />;
  }
}

/** ★P1-2：真枚举类目文案。 */
function getCategoryLabel(category: string) {
  switch (category) {
    case 'Scrape':
      return '海报与信息刮削';
    case 'Scan':
      return '数据源目录更新';
    case 'Identify':
      return '音视频流探针识别';
    case 'AiAssist':
      return 'AI 辅助';
    case 'Review':
      return '审核';
    case 'Tombstone':
      return '墓碑（已删条目）';
    default:
      return '异步任务';
  }
}

/** ★P1-2：真枚举的文案（TaskCenterStatus，PascalCase）。 */
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
