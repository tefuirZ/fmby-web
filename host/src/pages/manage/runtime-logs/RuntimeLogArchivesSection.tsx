import { useQuery } from '@tanstack/react-query';
import {
  runtimeLogArchivesApi,
  type RuntimeLogArchivesResponse,
} from '@fmby/v2-shared/contracts/manage/runtime-log-archives';
import { queryKeys } from '@fmby/v2-shared/query';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from '../longtail-shared/ManageShared.module.css';
import { EmptyTableRow, ManageSectionCard } from '../longtail-shared/components';
import { formatBytes } from './archives-format';

function formatDateTime(rfc3339: string | null): string {
  if (!rfc3339) return '—';
  const t = new Date(rfc3339);
  return Number.isNaN(t.getTime()) ? (rfc3339 ?? '—') : t.toLocaleString('zh-CN', { hour12: false });
}

function downloadArchive(archive: RuntimeLogArchivesResponse['items'][number]): void {
  void runtimeLogArchivesApi
    .download(archive.id)
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = archive.fileName;
      a.click();
      URL.revokeObjectURL(url);
    })
    .catch((error: unknown) => {
      // ponytail：下载失败就地提示（与页面 Feedback 同语义，不引全局态）
      console.error('runtime log archive download failed', error);
      window.alert(`归档下载失败：${getErrorMessage(error)}`);
    });
}

/** B08/B09：运行日志归档清单 + zip 下载入口（后端 /api/manage/runtime-log-archives）。 */
export function RuntimeLogArchivesSection() {
  const archivesQuery = useQuery({
    queryKey: queryKeys.manage.runtimeLogs('archives'),
    queryFn: () => runtimeLogArchivesApi.list(),
  });

  return (
    <ManageSectionCard
      title="日志归档"
      description={
        archivesQuery.data
          ? `保留 ${archivesQuery.data.retentionDays} 天 · 目录 ${archivesQuery.data.logDir}`
          : '按日志日压缩的历史归档，可下载留存。'
      }
    >
      {archivesQuery.isPending ? (
        <div className={styles.emptyInlineState}>正在加载归档清单…</div>
      ) : archivesQuery.isError ? (
        <div className={styles.emptyInlineState}>
          归档清单加载失败：{getErrorMessage(archivesQuery.error)}
          <button className={styles.secondaryButton} type="button" onClick={() => void archivesQuery.refetch()}>
            重试
          </button>
        </div>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>文件名</th>
                <th>日志日</th>
                <th>压缩后</th>
                <th>原始</th>
                <th>压缩比</th>
                <th>保留到期</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {archivesQuery.data.items.length === 0 ? (
                <EmptyTableRow colSpan={7} title="暂无归档" description="归档任务尚未产生文件。" />
              ) : (
                archivesQuery.data.items.map((archive) => (
                  <tr key={archive.id}>
                    <td>{archive.fileName}</td>
                    <td>{archive.logDate ?? '—'}</td>
                    <td>{formatBytes(archive.compressedSizeBytes)}</td>
                    <td>{formatBytes(archive.originalSizeBytes)}</td>
                    <td>{archive.compressionRatio.toFixed(1)}×</td>
                    <td>{formatDateTime(archive.expiresAt)}</td>
                    <td>
                      <button
                        className={styles.secondaryButton}
                        type="button"
                        onClick={() => downloadArchive(archive)}
                      >
                        下载
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </ManageSectionCard>
  );
}
