import { useRef, useState } from 'react';
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
import { useTableRowRoving } from '@/features/a11y/useTableRowRoving';

function JobRow({
  job,
  index,
  onSelect,
  selected,
}: {
  job: UpstreamSyncJob;
  index: number;
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <tr
      className={styles.clickableRow}
      data-selected={selected || undefined}
      data-row-index={index}
      role="button"
      aria-label={`查看同步作业 ${job.id} 详情`}
      onClick={onSelect}
      // Enter 交给 useTableRowRoving 的 onActivate（避免与此处重复触发一次 select）；
      // Space 仍是行内自行处理（role=button 的 Space 语义由我们自己实现）。
      onKeyDown={(e) => {
        if (e.key === ' ') {
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

  // FE-LIST-KEYNAV-10：这两张表原本**每行写死 tabIndex={0}**（N 行全进 Tab 序，
  // Tab 要按 N 次），且 Enter/Space 由行内 onKeyDown 自己处理 ⇒ 与 roving 契约冲突。
  // 主代理裁决「选项 2」：改由 roving 接管 —— 唯一停靠点 + 方向键漫游 +
  // Enter 走 onActivate（仍是「查看详情」，用户感知零变化）。
  // ★hook 必须早于下面 isPending / isError 的两个 early return（Hooks 规则）。
  // ★必须排在 syncJobs / importJobs 之后：rowCount 与 onActivate 都要读它们（TDZ）。
  const syncJobsTbodyRef = useRef<HTMLTableSectionElement>(null);
  useTableRowRoving({
    tbodyRef: syncJobsTbodyRef,
    rowCount: syncJobs.length,
    onActivate: (index) => {
      const job = syncJobs[index];
      if (job) setSelectedJobId(job.id);
    },
  });

  const importJobsTbodyRef = useRef<HTMLTableSectionElement>(null);
  useTableRowRoving({
    tbodyRef: importJobsTbodyRef,
    rowCount: importJobs.length,
    onActivate: (index) => {
      const job = importJobs[index];
      if (job) setSelectedJobId(job.id);
    },
  });

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
              <tbody ref={syncJobsTbodyRef}>
                {syncJobs.map((j, index) => (
                  <JobRow
                    key={j.id}
                    job={j}
                    index={index}
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
              <tbody ref={importJobsTbodyRef}>
                {importJobs.map((j, index) => (
                  <JobRow
                    key={j.id}
                    job={j}
                    index={index}
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
