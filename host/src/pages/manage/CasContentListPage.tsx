import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { casAdminApi } from '@fmby/v2-shared/contracts/manage/casAdmin';
import { FeedbackState, InlineBanner, StatusBadge } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { queryKeys } from '@fmby/v2-shared/query';
import { formatDateTime } from '@fmby/v2-shared/time';
import { ManagePageHeader, ManageSectionCard } from './longtail-shared/components';
import { resolveCopyStateLabel, resolveCopyStateTone } from './cas/formatCasDrive';
import styles from './longtail-shared/ManageShared.module.css';

/**
 * CAS 内容列表页（#658-CONTENT-LIST 第 1 页）：内容寻址存储真值视图
 * —— 每条内容 → 已落哪些盘 / 是否有本地实体 / lease 状态。
 *
 * ★数据面未就绪（w02 后端 CAS-CONTENT-LIST-API 端点未合）⇒ `listCasContents`
 *   返回空列表 + `unwired` 标记 ⇒ 本页显式提示「数据面未就绪」，**不造假数据**。
 * ★copy_state 徽章复用 `formatCasDrive` 纯函数（`resolveCopyStateLabel/Tone`），
 *   未知值显示原文码，绝不默认「已复制」（防伪造对账关键态）。
 */
export function CasContentListPage() {
  const contentsQuery = useQuery({
    queryKey: queryKeys.manage.cas.contents(),
    queryFn: () => casAdminApi.listCasContents(),
  });
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const unwired = contentsQuery.data?.unwired ?? false;
  const items = contentsQuery.data?.items ?? [];

  const toggle = (contentId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(contentId)) {
        next.delete(contentId);
      } else {
        next.add(contentId);
      }
      return next;
    });
  };

  const hasAnomaly = (drives: { copyState: string }[]) =>
    drives.some((d) => d.copyState === 'failed' || d.copyState === 'tombstoned');

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="CAS 内容列表"
        description="内容寻址存储真值视图：每条内容已落哪些盘、是否有本地实体、lease 状态（#658 第 1 页；发布编排/分享转存另卡）。"
      />

      {unwired ? (
        <InlineBanner
          variant="warning"
          title="CAS 内容列表数据面未就绪"
          description="后端列表端点（w02 CAS-CONTENT-LIST-API）尚未接线，下方为占位空列表，不含任何数据。"
        />
      ) : null}

      <ManageSectionCard
        title="内容列表"
        description="内容 → 盘副本 / 本地实体 / lease 状态。每行可展开看各盘副本明细。"
      >
        {contentsQuery.isPending ? (
          <FeedbackState variant="loading" title="载入内容列表…" description="正在读取 CAS 内容真值。" />
        ) : contentsQuery.isError ? (
          <FeedbackState
            variant="error"
            title="内容列表载入失败"
            description={getErrorMessage(contentsQuery.error)}
          />
        ) : items.length === 0 ? (
          <FeedbackState
            variant="empty"
            title={unwired ? '数据面未就绪' : '暂无 CAS 内容'}
            description={unwired ? '等待后端列表端点（w02）接线后展示。' : '当前没有 CAS 内容记录。'}
          />
        ) : (
          <div className={`${styles.tableWrap} ${styles.desktopOnly}`} role="region" aria-label="CAS 内容列表（可横向滚动）">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>内容 ID</th>
                  <th>指纹</th>
                  <th>媒体项</th>
                  <th>盘副本</th>
                  <th>本地实体</th>
                  <th>Lease</th>
                  <th>更新时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isExpanded = expanded.has(item.contentId);
                  return [
                    <tr key={item.contentId}>
                      <td>{item.contentId}</td>
                      <td>
                        <span className={styles.mono}>
                          {item.fingerprint.sha256 ?? item.fingerprint.md5 ?? '—'}
                          {` · ${item.fingerprint.sizeBytes}B`}
                        </span>
                      </td>
                      <td>{item.mediaItemId ?? '—'}</td>
                      <td>
                        <span>{item.drives.length} 盘</span>
                        {hasAnomaly(item.drives) ? (
                          <StatusBadge label="有异常副本" variant="warning" />
                        ) : item.drives.length > 0 ? (
                          <StatusBadge label="已复制" variant="success" />
                        ) : null}
                      </td>
                      <td>{item.hasLocalEntity ? '有' : '无'}</td>
                      <td>
                        {item.lease
                          ? `${item.lease.holder} · ${formatDateTime(
                              new Date(item.lease.expiresAt).toISOString(),
                            )}`
                          : '—'}
                      </td>
                      <td>{item.updatedAt ? formatDateTime(new Date(item.updatedAt).toISOString()) : '—'}</td>
                      <td>
                        <button
                          className={styles.smallButton}
                          type="button"
                          onClick={() => toggle(item.contentId)}
                        >
                          {isExpanded ? '收起副本' : '展开副本'}
                        </button>
                      </td>
                    </tr>,
                    isExpanded ? (
                      <tr key={`${item.contentId}-detail`}>
                        <td colSpan={8}>
                          {item.drives.length === 0 ? (
                            <span className={styles.mutedText}>该内容尚无盘副本。</span>
                          ) : (
                            <div className={styles.stackText}>
                              {item.drives.map((drive, index) => (
                                <div key={`${drive.driveRef}-${index}`}>
                                  <StatusBadge
                                    label={resolveCopyStateLabel(drive.copyState)}
                                    variant={resolveCopyStateTone(drive.copyState)}
                                  />
                                  <span className={styles.primaryText}>{drive.driveRef}</span>
                                  <span className={styles.mutedText}>{drive.providerType}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : null,
                  ];
                })}
              </tbody>
            </table>
          </div>
        )}
      </ManageSectionCard>
    </div>
  );
}

export default CasContentListPage;
