import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  upstreamsApi,
} from '@fmby/v2-shared/contracts/manage/upstreams';
import type { UpstreamSyncJob } from '@fmby/v2-shared/contracts/manage/upstreams';
import { queryKeys } from '@fmby/v2-shared/query';
import { FeedbackState, StatusBadge } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { getManageStatusVariant } from '@/pages/manage/longtail-shared/components';
import styles from '@/pages/manage/longtail-shared/ManageShared.module.css';

function JobRow({
  job,
  onSelect,
  selected,
}: {
  job: UpstreamSyncJob;
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <tr
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`查看同步作业 ${job.id} 详情`}
      className={styles.clickableRow}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <td className={styles.cellText}>{job.jobKind}</td>
      <td>
        <StatusBadge label={job.status} variant={getManageStatusVariant(job.status)} />
      </td>
      <td className={styles.mutedText}>{job.attemptCount}/{job.maxAttempts}</td>
      <td className={styles.mutedText}>{job.lastErrorMessage ?? '—'}</td>
    </tr>
  );
}

/**
 * 同步任务监控（FE-PARITY-UPSTREAMS-SYNC）。
 *
 * 只读列举两类作业：采集自动同步（sync-jobs）+ Emby 选择性导入（emby/import/jobs）。
 * 后端端口未装配时 fail-closed 500；本区块透传错误码，不白屏、不伪造空列表。
 */
export function UpstreamSyncJobsSection({ sourceId }: { sourceId: string }) {
  const queryClient = useQueryClient();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const syncJobsQuery = useQuery({
    queryKey: queryKeys.manage.upstreams.syncJobs(sourceId),
    queryFn: () => upstreamsApi.listSyncJobs(sourceId),
    staleTime: 10_000,
  });

  const importJobsQuery = useQuery({
    queryKey: queryKeys.manage.upstreams.embyImportJobs(sourceId),
    queryFn: () => upstreamsApi.listEmbyImportJobs(sourceId),
    staleTime: 10_000,
  });

  // W5-D：单个同步作业详情（list 接好了，但 getSyncJob 一直没接 UI → 补真缺口）
  const selectedJobQuery = useQuery({
    queryKey: queryKeys.manage.upstreams.syncJob(sourceId, selectedJobId ?? ''),
    queryFn: () => upstreamsApi.getSyncJob(sourceId, selectedJobId as string),
    enabled: selectedJobId !== null,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.manage.upstreams.syncJobs(sourceId),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.manage.upstreams.embyImportJobs(sourceId),
    });
  };

  const syncJobs = syncJobsQuery.data?.items ?? [];
  const importJobs = importJobsQuery.data?.items ?? [];
  const isError = syncJobsQuery.isError || importJobsQuery.isError;
  const error = syncJobsQuery.error ?? importJobsQuery.error;

  if (syncJobsQuery.isPending || importJobsQuery.isPending) {
    return (
      <FeedbackState
        variant="loading"
        title="正在加载同步任务"
        description="正在读取自动同步与 Emby 导入作业列表。"
      />
    );
  }

  if (isError) {
    return (
      <FeedbackState
        variant="error"
        title="同步任务加载失败"
        description={getErrorMessage(error)}
        action={
          <button className={styles.primaryButton} type="button" onClick={refresh}>
            重试
          </button>
        }
      />
    );
  }

  return (
    <>
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.headerContent}>
            <h2 className={styles.sectionTitle}>同步任务监控</h2>
            <p className={styles.sectionDescription}>
              自动采集同步（BindingAutoSync）与 Emby 选择性导入作业。端口未装配时后端返回 500，不会伪造空列表。
            </p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.secondaryButton} type="button" onClick={refresh}>
              刷新
            </button>
          </div>
        </div>

        <h3 className={styles.eyebrow}>自动同步作业（sync-jobs）</h3>
        {syncJobs.length === 0 ? (
          <div className={styles.emptyInlineState}>暂无自动同步作业。</div>
        ) : (
          <div className={styles.tableWrap} role="region" aria-label="自动同步作业（可横向滚动）" tabIndex={0}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>类型</th>
                  <th>状态</th>
                  <th>重试</th>
                  <th>最近错误</th>
                </tr>
              </thead>
              <tbody>
                {syncJobs.map((j) => (
                  <JobRow
                    key={j.id}
                    job={j}
                    selected={selectedJobId === j.id}
                    onSelect={() => setSelectedJobId(j.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h3 className={styles.eyebrow}>Emby 导入作业（emby/import/jobs）</h3>
        {importJobs.length === 0 ? (
          <div className={styles.emptyInlineState}>暂无 Emby 导入作业。</div>
        ) : (
          <div className={styles.tableWrap} role="region" aria-label="Emby 导入作业（可横向滚动）" tabIndex={0}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>类型</th>
                  <th>状态</th>
                  <th>重试</th>
                  <th>最近错误</th>
                </tr>
              </thead>
              <tbody>
                {importJobs.map((j) => (
                  <JobRow
                    key={j.id}
                    job={j}
                    selected={selectedJobId === j.id}
                    onSelect={() => setSelectedJobId(j.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedJobId ? (
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.headerContent}>
              <h2 className={styles.sectionTitle}>作业详情（{selectedJobId}）</h2>
            </div>
            <div className={styles.headerActions}>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => setSelectedJobId(null)}
              >
                关闭
              </button>
            </div>
          </div>
          <JobDetail jobId={selectedJobId} query={selectedJobQuery} />
        </section>
      ) : null}
    </>
  );
}

function JobDetail({
  jobId,
  query,
}: {
  jobId: string;
  query: ReturnType<typeof useQuery<UpstreamSyncJob>>;
}) {
  if (query.isPending) {
    return <FeedbackState variant="loading" title="正在加载作业详情" description={`作业 ${jobId}`} />;
  }
  if (query.isError) {
    return (
      <FeedbackState
        variant="error"
        title="作业详情加载失败"
        description={getErrorMessage(query.error)}
      />
    );
  }
  const job = query.data;
  if (!job) {
    return <div className={styles.emptyInlineState}>无作业详情。</div>;
  }
  return (
    <dl className={styles.detailList}>
      <DetailItem label="作业 ID" value={String(job.id)} />
      <DetailItem label="类型" value={job.jobKind} />
      <DetailItem label="状态" value={job.status} />
      <DetailItem label="重试次数" value={`${job.attemptCount}/${job.maxAttempts}`} />
      <DetailItem label="源 ID" value={job.sourceId} />
      <DetailItem label="最近错误" value={job.lastErrorMessage ?? '—'} />
      <DetailItem label="开始时间" value={job.startedAt != null ? String(job.startedAt) : '—'} />
      <DetailItem label="结束时间" value={job.finishedAt != null ? String(job.finishedAt) : '—'} />
    </dl>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.detailRow}>
      <dt className={styles.detailLabel}>{label}</dt>
      <dd className={styles.detailValue}>{value}</dd>
    </div>
  );
}
