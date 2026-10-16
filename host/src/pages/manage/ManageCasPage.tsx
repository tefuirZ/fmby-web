/**
 * CAS 编排页（fmby-web#8 卡面目标 1「多盘扇出配置/触发/状态」+ 目标 2 的容器）。
 *
 * 数据源 = fmby-v2 #42-N5（PR #378）提供的四端点：
 *   GET/PUT /api/admin/cas/drives、GET /api/admin/cas/fanout/{contentId}、
 *   GET /api/admin/cas/reconcile。契约层见 `contracts/manage/casAdmin`。
 *
 * ★fail-closed：端口未装配（后端 fail-closed 500 / not_implemented）时显示
 *   「服务未启用」并**停止请求**，**不得**渲染成「0 个盘」这类看似正常的空态 ——
 *   那会让运维以为「配好了但一个盘都没有」。
 *
 * 范式照 ManageEmailChannelPage：GET 载入回显、PUT 提交、queryKeys 工厂键、
 * 组件保持在 400 行门禁内（component-size）。
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  casAdminApi,
  isCasAdminUnwired,
  type CasDriveConfig,
} from '@fmby/v2-shared/contracts/manage/casAdmin';
import { FeedbackState, InlineBanner, StatusBadge } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { queryKeys } from '@fmby/v2-shared/query';
import { ManagePageHeader, ManageSectionCard } from './longtail-shared/components';
import { CasCopyStateBadge } from './cas/CasCopyStateBadge';
import { CasDeferredGateDetail } from './cas/CasDeferredGateDetail';
import { DriveConfigTable } from './cas/DriveConfigTable';
import { ReconcileTriggerButton, RetryCopyButton } from './cas/casWriteActions';
import {
  formatGeneratedAt,
  resolveReconcileSectionState,
  resolveReconcileView,
  summarizeReconcile,
} from './cas/reconcilePresentation';
import styles from './longtail-shared/ManageShared.module.css';

export function ManageCasPage() {
  const queryClient = useQueryClient();
  const [contentIdInput, setContentIdInput] = useState('');
  const [banner, setBanner] = useState<string | null>(null);
  // 最近一次保存成功的盘；用于清掉该行的脏草稿（否则刷新后仍显示「可保存」）。
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const drivesQuery = useQuery({
    queryKey: queryKeys.manage.cas.drives(),
    queryFn: async () => {
      try {
        return await casAdminApi.listDriveConfigs();
      } catch (err) {
        // 端口未装配 ⇒ 归一为 null，让下面显式渲染「未启用」而非空态。
        if (isCasAdminUnwired(err)) return null;
        throw err;
      }
    },
  });

  const upsertMutation = useMutation({
    mutationFn: (config: CasDriveConfig) => casAdminApi.upsertDriveConfig(config),
    onSuccess: async (_data, saved) => {
      setBanner('盘配置已保存');
      setSavedKey(`${saved.providerType}:${saved.driveRef}`);
      await queryClient.invalidateQueries({ queryKey: queryKeys.manage.cas.drives() });
    },
    onError: (err) => setBanner(getErrorMessage(err)),
  });

  const unwired = drivesQuery.data === null;

  return (
    <>
      <ManagePageHeader
        title="CAS 编排"
        description="多盘扇出配置与状态（后端 #42-N5）。未启用时不会显示成空列表。"
      />

      {unwired ? (
        <InlineBanner
          variant="warning"
          title="CAS 编排服务未启用（后端端口未装配），以下功能不可用。"
        />
      ) : (
        <ManageSectionCard title="盘配置（CAS 矩阵）">
          {drivesQuery.isPending ? (
            <FeedbackState variant="loading" title="载入盘配置…" description="正在读取 CAS 矩阵配置。" />
          ) : drivesQuery.isError ? (
            <FeedbackState
              variant="error"
              title="盘配置载入失败"
              description={getErrorMessage(drivesQuery.error)}
            />
          ) : (
            <DriveConfigTable
              configs={drivesQuery.data ?? []}
              onSave={(config) => upsertMutation.mutate(config)}
              saving={upsertMutation.isPending}
              savedKey={savedKey}
            />
          )}
          {banner ? <InlineBanner variant="info" title={banner} /> : null}
        </ManageSectionCard>
      )}

      <ManageSectionCard title="扇出状态">
        <FanoutLookup
          value={contentIdInput}
          onChange={setContentIdInput}
          enabled={!unwired}
        />
      </ManageSectionCard>

      {/* fmby-web#658：对账报告（契约/queryKey 早已就绪，此前页面未编排）。
          未启用端口时区块**完全不渲染** —— 不请求、不显示成「0 条报告」的假空态。 */}
      <ReconcileReportsSection unwired={unwired} />
    </>
  );
}

function FanoutLookup({
  value,
  onChange,
  enabled,
}: {
  value: string;
  onChange: (next: string) => void;
  enabled: boolean;
}) {
  const contentId = Number(value);
  const valid = Number.isInteger(contentId) && contentId > 0;

  const fanoutQuery = useQuery({
    queryKey: queryKeys.manage.cas.fanout(contentId),
    queryFn: () => casAdminApi.fanoutStatus(contentId),
    enabled: enabled && valid,
  });

  return (
    <div>
      <label>
        内容 ID
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="numeric"
        />
      </label>
      {/* #862 · #658 ⑤：扇出查询成功即渲染三闸明细（`CasFanoutStatusDto.deferred` DTO 必含）——
          放在此处而非「发布编排页」：真栈零 CAS 内容时后者选不到源 ⇒ 不可达。 */}
      {fanoutQuery.isSuccess && fanoutQuery.data ? (
        <CasDeferredGateDetail deferred={fanoutQuery.data.deferred} />
      ) : null}
      {!valid ? (
        <p>输入内容 ID 后查询其多盘副本状态。</p>
      ) : fanoutQuery.isPending ? (
        <FeedbackState variant="loading" title="查询扇出状态…" description="正在读取该内容的多盘副本。" />
      ) : fanoutQuery.isError ? (
        <FeedbackState
          variant="error"
          title="扇出状态查询失败"
          description={getErrorMessage(fanoutQuery.error)}
        />
      ) : (
        <div className={styles.tableWrap} role="region" aria-label="扇出状态（可横向滚动）">
          <table className={styles.table}>
          <thead>
            <tr>
              <th>盘 / 副本状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {(fanoutQuery.data?.drives ?? []).map((drive) => (
              <tr key={`${drive.driveId}:${drive.driveRef}`}>
                <td>
                  <CasCopyStateBadge drive={drive} />
                </td>
                <td>
                  {/* 重试仅对「实体丢失 / 上游已删」有意义；健康盘不给无用按钮。 */}
                  {drive.copyState === 'failed' || drive.copyState === 'tombstoned' ? (
                    <RetryCopyButton contentId={contentId} driveId={drive.driveId} />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}

/** `.cas` 对账报告区（fmby-web#658；只读，状态由后端 identified/reconciled 派生，不折叠）。 */
function ReconcileReportsSection({ unwired }: { unwired: boolean }) {
  // ★tsc TS2552 修复（#658 收尾）：本组件的 onSuccess 用 `queryClient` 失效对账报告，
  //   但组件内此前**未声明**（主组件那份不可跨组件引用）⇒ 触发对账成功后
  //   ReferenceError。契约测试只断结构未覆盖此运行路径，由 tsc 抓出。
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.manage.cas.reconcile(),
    queryFn: () => casAdminApi.reconcileReports(),
    // 未装配时不发请求（与 fail-closed 一致）。
    enabled: !unwired,
  });

  const trigger = useMutation({
    mutationFn: () => casAdminApi.triggerReconcile(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.manage.cas.reconcile() });
    },
  });

  const sectionState = resolveReconcileSectionState({
    unwired,
    isPending: query.isPending,
    isError: query.isError,
    count: (query.data ?? []).length,
  });

  // ★未装配 ⇒ **完全不渲染**（不是「0 条报告」）：把「服务没启用」
  //   显示成「没有数据」是本页最危险的假空态。
  if (sectionState === 'unwired') return null;

  if (sectionState === 'loading') {
    return (
      <ManageSectionCard title="对账报告">
        <FeedbackState variant="loading" title="载入对账报告…" description="正在读取 .cas 对账报告。" />
      </ManageSectionCard>
    );
  }

  if (sectionState === 'error') {
    return (
      <ManageSectionCard title="对账报告">
        <FeedbackState
          variant="error"
          title="对账报告载入失败"
          description={getErrorMessage(query.error)}
        />
        <ReconcileTriggerButton mutation={trigger} />
      </ManageSectionCard>
    );
  }

  const reports = query.data ?? [];
  const summary = summarizeReconcile(reports);

  return (
    <ManageSectionCard
      title="对账报告"
      description="状态由后端 identified / reconciled 两字段派生：未识别 / 已识别·未对账 / 已对账。"
    >
      <ReconcileTriggerButton mutation={trigger} />
      {sectionState === 'empty' ? (
        // 空列表是**真状态**（端口装配了但无报告），与「未启用」区分开。
        <p>暂无对账报告。</p>
      ) : (
        <>
          <p>
            共 {summary.total} 条 —— 已对账 {summary.reconciled} · 待处理 {summary.pending} · 未识别{' '}
            {summary.unidentified}
          </p>
          <div className={styles.tableWrap} role="region" aria-label="对账报告（可横向滚动）">
            <table className={styles.table}>
            <thead>
              <tr>
                <th>报告</th>
                <th>来源</th>
                <th>状态</th>
                <th>生成时间</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => {
                const view = resolveReconcileView(r);
                return (
                  <tr key={r.reportId}>
                    <td>{r.reportId}</td>
                    <td>{r.source}</td>
                    <td>
                      <StatusBadge label={view.label} variant={view.tone} />
                    </td>
                    <td>{formatGeneratedAt(r.generatedAtMs)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </>
      )}
    </ManageSectionCard>
  );
}
