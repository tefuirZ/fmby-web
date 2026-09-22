import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pan115Api } from '@fmby/v2-shared/contracts/manage/pan115';
import type {
  Pan115SyncSource,
  Pan115SyncTask,
} from '@fmby/v2-shared/contracts/manage/pan115';
import { ManageSectionCard, getManageStatusVariant } from '@/pages/manage/longtail-shared/components';
import { StatusBadge, InlineBanner } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { queryKeys } from '@fmby/v2-shared/query';
import styles from '@/pages/manage/longtail-shared/ManageShared.module.css';

function SyncSourceRow({ source }: { source: Pan115SyncSource }) {
  return (
    <tr>
      <td className={styles.cellText}>{source.displayName ?? source.sourceId}</td>
      <td className={styles.mutedText}>{source.sourceKind}</td>
      <td>
        <StatusBadge label={source.status} variant={getManageStatusVariant(source.status)} />
      </td>
      <td className={styles.mutedText}>{source.lastErrorMessage ?? '—'}</td>
    </tr>
  );
}

function SyncTaskRow({ task }: { task: Pan115SyncTask }) {
  return (
    <tr>
      <td className={styles.cellText}>{task.displayName ?? task.id}</td>
      <td className={styles.mutedText}>{task.taskKind}</td>
      <td>
        <StatusBadge label={task.status} variant={getManageStatusVariant(task.status)} />
      </td>
      <td className={styles.mutedText}>{task.lastErrorMessage ?? '—'}</td>
    </tr>
  );
}

/**
 * 115 同步管理面（GET .../sync/mounts/{id} 概览 + POST .../enqueue 手动入队）。
 * 端口未装配后端 500（fail-closed），前端透传错误码；worker 未启用时 enqueue 仍成功
 * （message 明示等待消费），故 enqueue 成功态须展示后端 message，不伪造「已同步」。
 */
export function SyncSection() {
  const queryClient = useQueryClient();
  const [mountId, setMountId] = useState('');

  const overviewQuery = useQuery({
    queryKey: queryKeys.manage.pan115.syncOverview(mountId),
    queryFn: () => pan115Api.syncOverview(mountId),
    enabled: mountId.trim().length > 0,
    staleTime: 15_000,
  });

  const enqueueMutation = useMutation({
    mutationFn: (action: string) =>
      pan115Api.syncEnqueue(mountId.trim(), { action }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.manage.pan115.syncOverview(mountId),
      });
    },
  });

  const id = mountId.trim();
  const isError = overviewQuery.isError || enqueueMutation.isError;
  const error = overviewQuery.error ?? enqueueMutation.error;
  const actions = overviewQuery.data?.supportedActions ?? [];

  return (
    <ManageSectionCard
      title="115 同步管理"
      description="查看 115 挂载的同步来源 / 检查点 / 最近任务，并手动触发入队（全量索引 / 存活轮询 / 增量刷新）。"
      actions={
        <div className={styles.rowActions}>
          <input
            className={styles.input}
            value={mountId}
            onChange={(e) => setMountId(e.target.value)}
            placeholder="挂载 ID（mount_id）"
            aria-label="挂载 ID"
          />
        </div>
      }
    >
      {!id ? (
        <p className={styles.mutedText}>请输入挂载 ID 以载入同步概览。</p>
      ) : overviewQuery.isPending ? (
        <p className={styles.mutedText}>正在读取同步概览…</p>
      ) : overviewQuery.isError ? (
        <InlineBanner
          variant="error"
          title="同步概览读取失败"
          description={getErrorMessage(error)}
        />
      ) : (
        <>
          {isError && enqueueMutation.isError ? (
            <InlineBanner
              variant="error"
              title="入队失败"
              description={getErrorMessage(error)}
            />
          ) : null}

          {enqueueMutation.isSuccess ? (
            <InlineBanner
              variant={enqueueMutation.data.accepted ? 'info' : 'warning'}
              title={enqueueMutation.data.accepted ? '已入队' : '未接受'}
              description={enqueueMutation.data.message}
            />
          ) : null}

          <div className={styles.fieldRow}>
            <div className={styles.stackText}>
              <span className={styles.mutedText}>挂载</span>
              <span>{overviewQuery.data?.mountId}</span>
            </div>
            <div className={styles.stackText}>
              <span className={styles.mutedText}>提供方类型</span>
              <span>{overviewQuery.data?.providerType}</span>
            </div>
          </div>

          {actions.length > 0 ? (
            <div className={styles.buttonRow}>
              {actions.map((action) => (
                <button
                  key={action}
                  type="button"
                  className={styles.smallButton}
                  disabled={enqueueMutation.isPending}
                  onClick={() => enqueueMutation.mutate(action)}
                >
                  {enqueueMutation.isPending && enqueueMutation.variables === action
                    ? '入队中…'
                    : `触发 ${action}`}
                </button>
              ))}
            </div>
          ) : null}

          <h3 className={styles.eyebrow}>同步来源</h3>
          {overviewQuery.data?.sources.length ? (
            <div className={styles.tableWrap} role="region" aria-label="同步来源（可横向滚动）" tabIndex={0}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">名称</th>
                    <th scope="col">类型</th>
                    <th scope="col">状态</th>
                    <th scope="col">最近错误</th>
                  </tr>
                </thead>
                <tbody>
                  {overviewQuery.data.sources.map((s) => (
                    <SyncSourceRow key={s.sourceId} source={s} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.mutedText}>无同步来源。</p>
          )}

          <h3 className={styles.eyebrow}>最近任务</h3>
          {overviewQuery.data?.recentTasks.length ? (
            <div className={styles.tableWrap} role="region" aria-label="最近同步任务（可横向滚动）" tabIndex={0}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">名称</th>
                    <th scope="col">类型</th>
                    <th scope="col">状态</th>
                    <th scope="col">最近错误</th>
                  </tr>
                </thead>
                <tbody>
                  {overviewQuery.data.recentTasks.map((t) => (
                    <SyncTaskRow key={t.id} task={t} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.mutedText}>无最近同步任务。</p>
          )}
        </>
      )}
    </ManageSectionCard>
  );
}
