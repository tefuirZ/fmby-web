/**
 * 运行日志归档区（FE-LOG-ARCHIVE）。
 *
 * 接 `GET /api/manage/runtime-log-archives`（清单，能力门 VIEW_AUDIT）与
 * `GET /api/manage/runtime-log-archives/{id}/download`（zip）。
 * 后端真源：crates/fmby-v2-http/src/routes/manage/runtime_log_archives.rs
 *
 * 自 `ManageRuntimeLogsPage` 抽出：该页已近组件体积闸（400 warn），故按仓内既有
 * 「页面 → 子组件」范式独立成文件。
 */

import { useQuery } from '@tanstack/react-query';
import { manageApi } from '@fmby/v2-shared/contracts/manage';
import { queryKeys } from '@fmby/v2-shared/query';
import { InlineBanner } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { formatDateTime } from '@fmby/v2-shared/time';
import styles from '../longtail-shared/ManageShared.module.css';
import { EmptyTableRow, ManageSectionCard } from '../longtail-shared/components';
import {
  buildRuntimeLogArchiveDownloadUrl,
  formatBytes,
  formatCompressionRatio,
} from './archive';

const ARCHIVE_PAGE_SIZE = 50;

export function RuntimeLogArchiveSection() {
  const archivesQuery = useQuery({
    queryKey: queryKeys.manage.runtimeLogArchives(),
    queryFn: () => manageApi.getRuntimeLogArchives({ page: 1, pageSize: ARCHIVE_PAGE_SIZE }),
  });

  const archives = archivesQuery.data?.items ?? [];

  return (
    <ManageSectionCard
      title="日志归档"
      description="后端按保留窗把滚动日志打包成 zip。这里列出归档文件并提供下载；下载走浏览器原生链接（同源 Cookie 鉴权）。"
      actions={
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={() => archivesQuery.refetch()}
        >
          刷新归档
        </button>
      }
    >
      {archivesQuery.isPending ? (
        <div className={styles.emptyInlineState}>正在读取归档清单…</div>
      ) : archivesQuery.isError ? (
        <InlineBanner
          variant="warning"
          title="归档清单读取失败"
          description={getErrorMessage(archivesQuery.error)}
        />
      ) : (
        <>
          <div className={styles.rowActions}>
            <span className={styles.tableHint}>
              共 {archivesQuery.data?.total ?? 0} 个归档 · 归档目录{' '}
              {archivesQuery.data?.logDir ?? '—'} · 保留 {archivesQuery.data?.retentionDays ?? '—'} 天
            </span>
          </div>

          <div className={`${styles.tableWrap} ${styles.desktopOnly}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>归档</th>
                  <th>日志日</th>
                  <th>体积</th>
                  <th>压缩率</th>
                  <th>生成时间</th>
                  <th>到期</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {archives.length === 0 ? (
                  <EmptyTableRow
                    colSpan={7}
                    title="暂无归档"
                    description="归档由后端按保留窗周期性生成；若刚启动服务，稍后再刷新。"
                  />
                ) : (
                  archives.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className={styles.stackText}>
                          <span className={styles.primaryText}>{item.fileName}</span>
                          <span className={`${styles.mutedText} ${styles.mono}`}>{item.id}</span>
                        </div>
                      </td>
                      <td>{item.logDate ?? '—'}</td>
                      <td>
                        <div className={styles.stackText}>
                          <span className={styles.primaryText}>
                            {formatBytes(item.compressedSizeBytes)}
                          </span>
                          <span className={styles.mutedText}>
                            原始 {formatBytes(item.originalSizeBytes)}
                          </span>
                        </div>
                      </td>
                      <td>{formatCompressionRatio(item.compressionRatio)}</td>
                      <td>{formatDateTime(item.createdAt)}</td>
                      <td>{item.expiresAt ? formatDateTime(item.expiresAt) : '—'}</td>
                      <td>
                        <a
                          className={styles.secondaryButton}
                          href={buildRuntimeLogArchiveDownloadUrl(item.id)}
                          download={item.fileName}
                        >
                          下载
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className={`${styles.mobileOnly} ${styles.mobileCardList}`}>
            {archives.length === 0 ? (
              <div className={styles.emptyInlineState}>暂无归档。</div>
            ) : (
              archives.map((item) => (
                <article key={item.id} className={styles.mobileRecordCard}>
                  <div className={styles.mobileRecordHeader}>
                    <div className={styles.stackText}>
                      <strong className={styles.mobileRecordTitle}>{item.fileName}</strong>
                      <span className={styles.mobileRecordMeta}>
                        {item.logDate ?? '—'} · {formatBytes(item.compressedSizeBytes)} ·{' '}
                        {formatCompressionRatio(item.compressionRatio)}
                      </span>
                    </div>
                  </div>
                  <div className={styles.mobileRecordActions}>
                    <a
                      className={styles.secondaryButton}
                      href={buildRuntimeLogArchiveDownloadUrl(item.id)}
                      download={item.fileName}
                    >
                      下载
                    </a>
                  </div>
                </article>
              ))
            )}
          </div>
        </>
      )}
    </ManageSectionCard>
  );
}