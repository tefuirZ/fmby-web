import { useDeferredValue, useState } from 'react';
import { useSearchParams } from 'react-router';
import { FeedbackState } from '@/shared/ui';
import { InlineBanner } from '@/shared/ui';
import styles from './ManagePages.module.css';
import { ManagePageHeader, MetricCard } from './components';
import { getErrorMessage } from '@/shared/utils/error';
import type { BannerState } from '@/shared/types/ui';
import { useProbeTasksQuery, useProbeTaskDetailQuery, useProbeTaskMutations } from './probe-tasks/hooks';
import { ProbeTaskTable, ProbeTaskDetailModal } from './probe-tasks/components';
import { buildScopeLabel } from './probe-tasks/utils';
import type { ProbeStatusFilter } from './probe-tasks/types';

export function ManageProbeTasksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProbeStatusFilter>('all');
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const deferredKeyword = useDeferredValue(keyword.trim().toLowerCase());
  const scopedLibraryId = searchParams.get('libraryId') ?? undefined;
  const scopedMountId = searchParams.get('mountId') ?? undefined;

  const probeTasksQuery = useProbeTasksQuery({ statusFilter, deferredKeyword, scopedLibraryId, scopedMountId });
  const detailQuery = useProbeTaskDetailQuery(selectedSourceId);
  const { enqueueMutation, refreshMutation } = useProbeTaskMutations({ setBanner });

  const tasks = probeTasksQuery.data?.items ?? [];
  const filteredTasks = tasks;
  const scopeLabel = buildScopeLabel(filteredTasks, scopedLibraryId, scopedMountId);

  if (probeTasksQuery.isPending) {
    return <FeedbackState variant="loading" title="正在加载技术参数探测任务" description="正在整理媒体库、来源状态和最近探测快照。" />;
  }
  if (probeTasksQuery.isError) {
    return (
      <FeedbackState
        variant="error"
        title="技术参数探测任务加载失败"
        description={getErrorMessage(probeTasksQuery.error)}
        action={<button className={styles.primaryButton} type="button" onClick={() => probeTasksQuery.refetch()}>重试</button>}
      />
    );
  }

  const runningCount = tasks.filter((task) => task.status === 'running').length;
  const queuedCount = tasks.filter((task) => task.status === 'queued' || task.status === 'retry-waiting').length;
  const failedCount = tasks.filter((task) => task.status === 'failed').length;
  const readyCount = tasks.filter((task) => task.status === 'succeeded').length;
  const actionPending = enqueueMutation.isPending || refreshMutation.isPending;

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="技术参数探测任务"
        description="管理员可以直接查看当前哪个媒体库、哪个来源正在做技术参数探测，并对单条来源发起补全或强制重探。"
        meta={<span className={styles.metaText}>当前展示 {filteredTasks.length} 条来源记录</span>}
        actions={
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => {
              setBanner(null);
              probeTasksQuery.refetch();
              if (selectedSourceId) detailQuery.refetch();
            }}
          >
            刷新列表
          </button>
        }
      />

      {banner ? <InlineBanner variant={banner.variant} title={banner.title} description={banner.description} /> : null}
      {(scopedLibraryId || scopedMountId) ? (
        <InlineBanner
          variant="info"
          title="当前列表已带来源范围过滤"
          description={scopeLabel}
          actions={
            <div className={styles.rowActions}>
              <button className={styles.smallButton} type="button" onClick={() => setSearchParams({})}>清除范围</button>
            </div>
          }
        />
      ) : null}

      <section className={styles.metricsGrid}>
        <MetricCard label="运行中" value={runningCount} trend="当前正在探测" status="running" />
        <MetricCard label="排队中" value={queuedCount} trend="等待执行或重试" status="warning" />
        <MetricCard label="已完成" value={readyCount} trend="已有探测快照" status="success" />
        <MetricCard label="失败" value={failedCount} trend="需要管理员关注" status="failed" />
      </section>

      <ProbeTaskTable
        tasks={tasks}
        filteredTasks={filteredTasks}
        keyword={keyword}
        statusFilter={statusFilter}
        scopedLibraryId={scopedLibraryId}
        scopedMountId={scopedMountId}
        onKeywordChange={setKeyword}
        onStatusFilterChange={setStatusFilter}
        onClearScope={() => setSearchParams({})}
        onSelectSource={(sourceId) => { setBanner(null); setSelectedSourceId(sourceId); }}
      />

      <ProbeTaskDetailModal
        selectedSourceId={selectedSourceId}
        detailQuery={detailQuery}
        enqueueMutation={enqueueMutation}
        refreshMutation={refreshMutation}
        actionPending={actionPending}
        onClose={() => setSelectedSourceId(null)}
      />
    </div>
  );
}

export default ManageProbeTasksPage;
