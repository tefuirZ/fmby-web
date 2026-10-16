import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { resolveContentsTruncation } from './cas/contentsTruncation';
import { casAdminApi } from '@fmby/v2-shared/contracts/manage/casAdmin';
import { FeedbackState, InlineBanner, StatusBadge } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { queryKeys } from '@fmby/v2-shared/query';
import { formatDateTime } from '@fmby/v2-shared/time';
import { ManagePageHeader, ManageSectionCard } from './longtail-shared/components';
import {
  resolveCopyStateLabel,
  resolveCopyStateTone,
  resolveSourceKindLabel,
  resolveSourceKindTone,
  resolveDeferredGateLabel,
  formatGraceRemaining,
  buildDrivePriorityMap,
} from './cas/formatCasDrive';
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
  // #658 ④ 徽章：盘优先级真源 = drives 配置端点（GET /admin/cas/drives）；
  // 内容副本 CasContentDriveCopy 不带 priority ⇒ 按 drive_ref 关联。
  const drivesQuery = useQuery({
    queryKey: queryKeys.manage.cas.drives(),
    queryFn: () => casAdminApi.listDriveConfigs(),
  });
  const priorityMap = useMemo(
    () => buildDrivePriorityMap(drivesQuery.data ?? []),
    [drivesQuery.data],
  );
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const unwired = contentsQuery.data?.unwired ?? false;
  const items = contentsQuery.data?.items ?? [];
  // G3：首屏截断必须**可见**。判据落在纯函数里（措辞诚实性由测试钉死）。
  const truncation = resolveContentsTruncation({
    count: items.length,
    limit: contentsQuery.data?.limit ?? 0,
    unwired,
    loading: contentsQuery.isPending,
    isError: contentsQuery.isError,
  });

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

      {truncation.notice ? (
        // ★G3：后端此端点返回裸数组（无 total/has_more）⇒ 只能说「已到首屏上限、无法翻页」，
        //   不能写「共 N 条 / 还有 M 条」——那是在伪造不知道的数。
        <InlineBanner variant="warning" title="仅显示首屏" description={truncation.notice} />
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
                  {/* #658 ④：秒传来源（后端 CasContentListItemDto.source_kind，注释点名供本徽章消费
                      ⇒ rapid_upload = 秒传命中）；缺失显 —，未知码原样透出，不编造。 */}
                  <th>秒传来源</th>
                  {/* #658 ⑤（已接线）：lease 是「闸② TTL」的引用；**在挡的那一闸 + 宽限期剩余**
                      由后端 `CasContentListItemDto.deferred_gate` / `grace_remaining_ms` 提供
                      （#862 已合，本列消费）；三闸**逐闸明细**（会话/租约/宽限各一布尔）在
                      「发布编排」页的扇出面（`CasFanoutStatusDto.deferred`）。 */}
                  <th>Lease（闸② TTL）</th>
                  <th>删除安全（在挡的闸）</th>
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
                        <StatusBadge
                          label={resolveSourceKindLabel(item.sourceKind)}
                          variant={resolveSourceKindTone(item.sourceKind)}
                        />
                      </td>
                      <td>
                        {item.lease
                          ? `${item.lease.holder} · TTL 到期 ${formatDateTime(
                              new Date(item.lease.expiresAt).toISOString(),
                            )}`
                          : '—'}
                      </td>
                      <td>
                        {item.deferredGate ? resolveDeferredGateLabel(item.deferredGate) : '—'}
                        {item.deferredGate === 'grace'
                          ? `（还剩 ${formatGraceRemaining(item.graceRemainingMs)}）`
                          : ''}
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
                        <td colSpan={10}>
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
                                  {/* #658 ④：盘优先级来自 drives 配置端点，按 drive_ref 关联；
                                      未登记 ⇒ undefined ⇒ 显示「—」不编造。 */}
                                  <span className={styles.mutedText}>
                                    优先级{' '}
                                    {priorityMap.get(drive.driveRef) ?? '—'}
                                  </span>
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
