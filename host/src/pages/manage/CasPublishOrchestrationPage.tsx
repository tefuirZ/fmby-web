import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { casAdminApi } from '@fmby/v2-shared/contracts/manage/casAdmin';
import { FeedbackState, InlineBanner, StatusBadge } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { queryKeys } from '@fmby/v2-shared/query';
import { ManagePageHeader, ManageSectionCard } from './longtail-shared/components';
import { resolveCopyStateLabel, resolveCopyStateTone } from './cas/formatCasDrive';
import { CasDeferredGateDetail } from './cas/CasDeferredGateDetail';
import styles from './longtail-shared/ManageShared.module.css';

/**
 * CAS 发布编排页（#658 第 2 页）：选源内容 → 选目标盘 → 发起扇出 → 进度与失败原因。
 *
 * ★后端写面考古结论（照后端 admin_cas.rs + CasAdminService port，**不臆造**）：
 *   - 后端 CAS 管理面现有 4 端点全是读面 + 单盘配置写（GET/PUT drives、
 *     GET fanout/{content_id}、GET reconcile）——**无「发起扇出」写端点**。
 *   - 「扇出已存在内容的重试」= #671 写面 `retryFanoutCopy`（rb01 PR #678，503 unwired）。
 *   - 「选源内容」= `listCasContents`（后端读面**已实现**并挂进生产 router：
 *     `crates/fmby-v2-http/src/routes/admin_cas.rs` 的 `cas_list_contents`）。
 *   ⇒ 「发起扇出」核心写面后端**完全没有** ⇒ 本页 fixme（按钮禁用 + 显式提示待后端），
 *     **不得**调用不存在的端点、**不得**伪造扇出成功。
 * ★`unwired:true` 的**真语义**（#78 核后端所得）：不是「端点没做」，而是**本实例**没给出数据
 *   （CAS 端口未装配 ⇒ 503，或后端版本过旧、无该路由 ⇒ 404）⇒ 文案照此说，
 *   并与「后端返回空列表」分两态呈现（照 #40 纪律不造假数据）。
 * ★失败原因 reason_code/reason_detail 原样透出（#671）：key 缺失 = 无原因，
 *   存在但空 = 空值，两者**分开**显示，不折叠成布尔。
 */
export function CasPublishOrchestrationPage() {
  // 选源内容（读面已实现；本实例不可用时 unwired=true，原因见下方横幅）。
  const contentsQuery = useQuery({
    queryKey: queryKeys.manage.cas.contents(),
    queryFn: () => casAdminApi.listCasContents(),
  });
  // 选目标盘（盘配置矩阵，读面可接）。
  const drivesQuery = useQuery({
    queryKey: queryKeys.manage.cas.drives(),
    queryFn: () => casAdminApi.listDriveConfigs(),
  });

  const unwired = contentsQuery.data?.unwired ?? false;
  const contents = contentsQuery.data?.items ?? [];
  const drives = drivesQuery.data ?? [];

  const [sourceContentId, setSourceContentId] = useState<number | null>(null);
  const [targetDrives, setTargetDrives] = useState<Set<string>>(new Set());

  const toggleTarget = (driveRef: string) => {
    setTargetDrives((prev) => {
      const next = new Set(prev);
      if (next.has(driveRef)) next.delete(driveRef);
      else next.add(driveRef);
      return next;
    });
  };

  // 进度与失败原因（选中源内容后查询 fanoutStatus）。
  const fanoutQuery = useQuery({
    queryKey: queryKeys.manage.cas.fanout(sourceContentId ?? 0),
    queryFn: () => casAdminApi.fanoutStatus(sourceContentId as number),
    enabled: sourceContentId != null,
  });

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="CAS 发布编排"
        description="选源内容 → 选目标盘 → 发起扇出 → 查看进度与失败原因。"
      />

      {/* 两态分开（#78 G5）：数据面不可用 ≠ 实例里没有内容。 */}
      {unwired ? (
        <InlineBanner
          variant="warning"
          title="CAS 内容数据面在本实例不可用"
          description="后端未返回 CAS 内容数据：本实例 CAS 端口未装配（503），或该路由不存在（404，多见于旧版本后端）⇒ 暂时无法选源内容。列表端点在 fmby-v2 已实现（admin_cas.rs 的 cas_list_contents）⇒ 请核对后端版本与 CAS 端口装配。"
        />
      ) : null}

      {/* ① 选源内容 */}
      <ManageSectionCard title="① 选源内容" description="从 CAS 内容列表选一条内容作为发布源。">
        {contentsQuery.isPending ? (
          <FeedbackState variant="loading" title="载入内容列表…" description="正在读取 CAS 内容真值。" />
        ) : contentsQuery.isError ? (
          <FeedbackState variant="error" title="内容列表载入失败" description={getErrorMessage(contentsQuery.error)} />
        ) : contents.length === 0 ? (
          <FeedbackState
            variant="empty"
            title={unwired ? '数据面不可用（非空列表）' : '暂无 CAS 内容'}
            description={
              unwired
                ? '本页没能从后端取到 CAS 内容数据，不等于「实例里没有内容」——原因见上方提示。'
                : '后端返回空列表：当前实例确实没有 CAS 内容记录。'
            }
          />
        ) : (
          <div className={`${styles.tableWrap} ${styles.desktopOnly}`} role="region" aria-label="选源内容（可横向滚动）">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>选</th>
                  <th>内容 ID</th>
                  <th>指纹</th>
                  <th>媒体项</th>
                  <th>盘副本</th>
                </tr>
              </thead>
              <tbody>
                {contents.map((item) => (
                  <tr key={item.contentId}>
                    <td>
                      <input
                        type="radio"
                        name="cas-source"
                        aria-label={`选择内容 ${item.contentId}`}
                        checked={sourceContentId === item.contentId}
                        onChange={() => setSourceContentId(item.contentId)}
                      />
                    </td>
                    <td>{item.contentId}</td>
                    <td>
                      {/* 指纹是对象（sha256/md5/sizeBytes）⇒ 不能直接当 ReactNode 渲染。
                          照 CasContentListPage 惯例取去重键（sha256 优先，其次 md5）。 */}
                      <span className={styles.mono}>
                        {item.fingerprint.sha256 ?? item.fingerprint.md5 ?? '—'}
                      </span>
                    </td>
                    <td>{item.mediaItemId ?? '—'}</td>
                    <td>{item.drives.length} 盘</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ManageSectionCard>

      {/* ② 选目标盘（N 盘复选） */}
      <ManageSectionCard title="② 选目标盘" description="选择本次发布要扇出到的盘（N 盘复选）。">
        {drivesQuery.isPending ? (
          <FeedbackState variant="loading" title="载入盘配置…" description="正在读取 CAS 矩阵配置。" />
        ) : drivesQuery.isError ? (
          <FeedbackState variant="error" title="盘配置载入失败" description={getErrorMessage(drivesQuery.error)} />
        ) : drives.length === 0 ? (
          <p>尚未配置任何盘。CAS 扇出不会发生。</p>
        ) : (
          <ul className={styles.stackText}>
            {drives.map((drive) => (
              <li key={drive.driveRef} className={styles.casHitCell}>
                <label className={styles.casHitCheck}>
                  <input
                    type="checkbox"
                    aria-label={`${drive.driveRef} 选为目标盘`}
                    checked={targetDrives.has(drive.driveRef)}
                    onChange={() => toggleTarget(drive.driveRef)}
                  />
                  <span className={styles.primaryText}>{drive.driveRef}</span>
                  <span className={styles.mutedText}>{drive.providerType}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </ManageSectionCard>

      {/* ③ 发起扇出（fixme：后端无「发起扇出」写端点） */}
      <ManageSectionCard title="③ 发起扇出" description="把选中源内容扇出到选中目标盘。">
        <InlineBanner
          variant="warning"
          title="发起扇出写面待后端接线"
          description="后端 CAS 管理面暂无「发起扇出」写端点（admin_cas.rs 只有读面 + 单盘配置写）。本按钮禁用，待后端补 POST /api/admin/cas/fanout 后启用。"
        />
        <button type="button" className={styles.casHitBtn} disabled>
          发起扇出（待后端）
        </button>
      </ManageSectionCard>

      {/* 进度与失败原因 */}
      <ManageSectionCard title="进度与失败原因" description="选中源内容后显示其多盘扇出进度与失败原因；失败盘可重试。">
        {sourceContentId == null ? (
          <p>先在上方选一条源内容。</p>
        ) : fanoutQuery.isPending ? (
          <FeedbackState variant="loading" title="查询扇出状态…" description="正在读取该内容的多盘副本。" />
        ) : fanoutQuery.isError ? (
          <FeedbackState variant="error" title="扇出状态查询失败" description={getErrorMessage(fanoutQuery.error)} />
        ) : (
          <div className={`${styles.tableWrap} ${styles.desktopOnly}`} role="region" aria-label="扇出进度与失败原因（可横向滚动）">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>盘</th>
                  <th>副本状态</th>
                  <th>失败原因</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {fanoutQuery.data?.deferred ? (
                  <tr>
                    <td colSpan={4}>
                      <CasDeferredGateDetail deferred={fanoutQuery.data.deferred} />
                    </td>
                  </tr>
                ) : null}
                {(fanoutQuery.data?.drives ?? []).map((drive) => (
                  <tr key={`${drive.driveId}:${drive.driveRef}`}>
                    <td>{drive.driveRef}</td>
                    <td>
                      <StatusBadge
                        label={resolveCopyStateLabel(drive.copyState)}
                        variant={resolveCopyStateTone(drive.copyState)}
                      />
                    </td>
                    <td>
                      {drive.reasonCodePresent ? (
                        <span>
                          {drive.reasonCode ?? ''}
                          {drive.reasonDetail ? ` · ${drive.reasonDetail}` : ''}
                        </span>
                      ) : (
                        <span className={styles.mutedText}>无</span>
                      )}
                    </td>
                    <td>
                      {/* 重试仅对「实体丢失 / 上游已删」有意义；健康盘不给无用按钮。 */}
                      {drive.copyState === 'failed' || drive.copyState === 'tombstoned' ? (
                        <button
                          type="button"
                          className={styles.smallButton}
                          onClick={() => casAdminApi.retryFanoutCopy(sourceContentId, drive.driveId)}
                        >
                          重试
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ManageSectionCard>
    </div>
  );
}

export default CasPublishOrchestrationPage;
