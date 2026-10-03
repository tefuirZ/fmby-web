/**
 * 139 账号池「段 B」调度运维面（FE-UI-BACKLOG）。
 *
 * 契约层（`leaseFromPool` / `reportLease`）此前已合入，本卡补 **UI**。
 *
 * ★字段按 `shared/src/contracts/manage/yun139/types.ts` 实测（不凭记忆）：
 *   - `Yun139LeaseInput{ stickyKey? }` → `Yun139LeaseResult{ poolId?, leaseId,
 *     profileId, displayName, expiresAt(epoch 毫秒) }`
 *   - `Yun139ReportLeaseInput{ profileId, leaseId?, success, cooldownSeconds? }` → ok 布尔
 *
 * ★诚实口径：
 *   - `poolId` 为 null ⇒ 如实显示「—」，不伪造池 ID；
 *   - 回写 `success=false` 会触发该账号冷却 ⇒ 走 `ConfirmDialog` 二次确认，
 *     并展示冷却秒数缺省语义（留空 ⇒ 由池配置决定）。
 *   - 错误一律经既有 `getErrorMessage` 出后端原文，不本地臆造。
 *
 * 形态照同目录 `Yun139AccountPoolsSection.tsx`（设置/管理面同款），
 * 复用 `ManageSectionCard` / `FeedbackState` / `InlineBanner` / `StatusBadge` /
 * `ConfirmDialog` + `ManageShared.module.css`，未新造外壳/样式。
 */

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  yun139Api,
  type Yun139LeaseResult,
} from '@fmby/v2-shared/contracts/manage/yun139';
import { queryKeys } from '@fmby/v2-shared/query';
import {
  ConfirmDialog,
  FeedbackState,
  InlineBanner,
  StatusBadge,
} from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from '@/pages/manage/longtail-shared/ManageShared.module.css';
import { ManageSectionCard } from '@/pages/manage/longtail-shared/components';

function formatEpochMs(epochMs: number | null): string {
  if (epochMs === null || !Number.isFinite(epochMs) || epochMs <= 0) {
    return '—';
  }
  return new Date(epochMs).toLocaleString('zh-CN', { hour12: false });
}

export function Yun139PoolLeaseSection() {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [poolId, setPoolId] = useState('');
  const [stickyKey, setStickyKey] = useState('');
  const [lease, setLease] = useState<Yun139LeaseResult | null>(null);

  const [cooldownSeconds, setCooldownSeconds] = useState('');
  const [pendingFailReport, setPendingFailReport] = useState(false);

  const poolsQuery = useQuery({
    queryKey: queryKeys.manage.yun139.pools(),
    queryFn: () => yun139Api.listAccountPools(),
  });

  const leaseMutation = useMutation({
    mutationFn: () =>
      // stickyKey 留空 ⇒ 不发送（后端 Option）
      yun139Api.leaseFromPool(poolId.trim(), stickyKey.trim() ? { stickyKey: stickyKey.trim() } : {}),
    onSuccess: (result) => {
      setError(null);
      setNotice(result.poolId ? '已取得租借。' : '已取得租借（后端未返回池 ID）。');
      setLease(result);
    },
    onError: (err) => {
      setError(getErrorMessage(err));
      setLease(null);
    },
  });

  const reportMutation = useMutation({
    mutationFn: (input: { success: boolean; cooldownSeconds?: number }) => {
      if (!lease) {
        throw new Error('尚未取得租借，无法回写结果');
      }
      const trimmed = cooldownSeconds.trim();
      const parsed = trimmed ? Number(trimmed) : undefined;
      return yun139Api.reportLease(poolId.trim(), {
        profileId: lease.profileId,
        leaseId: lease.leaseId,
        success: input.success,
        // 冷却秒数留空 ⇒ 不发送，交后端池配置
        ...(parsed !== undefined && Number.isFinite(parsed)
          ? { cooldownSeconds: Math.trunc(parsed) }
          : {}),
      });
    },
    onSuccess: (_ok, variables) => {
      setError(null);
      setNotice(variables.success ? '已回写：本次租借成功。' : '已回写：本次租借失败。');
      setLease(null);
      setPendingFailReport(false);
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const pools = poolsQuery.data ?? [];

  return (
    <>
      <ManageSectionCard
        title="账号池调度（试租借 / 结果回写）"
        description="按调度策略从池中试租借一个账号，用完后回写结果；失败回写会触发该账号冷却。"
      >
        {notice ? <InlineBanner variant="success" title={notice} /> : null}
        {error ? <InlineBanner variant="error" title={error} /> : null}

        <div className={styles.fieldGroup}>
          <label className={styles.label}>
            账号池（必填）
            <select
              className={styles.input}
              aria-label="选择账号池"
              value={poolId}
              onChange={(e) => setPoolId(e.target.value)}
            >
              <option value="">请选择…</option>
              {pools.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}（{p.isEnabled ? '启用' : '停用'} · 成员 {p.memberCount}）
                </option>
              ))}
            </select>
          </label>
          <label className={styles.label}>
            粘性键（可留空）
            <input
              className={styles.input}
              aria-label="租借粘性键"
              placeholder="例如分享 ID；同键恒选同一账号"
              value={stickyKey}
              onChange={(e) => setStickyKey(e.target.value)}
            />
          </label>
        </div>

        {poolsQuery.isError ? (
          <FeedbackState
            variant="error"
            title="无法读取账号池"
            description={getErrorMessage(poolsQuery.error)}
            action={
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => void poolsQuery.refetch()}
              >
                重试
              </button>
            }
          />
        ) : null}

        <div className={styles.buttonRow}>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={leaseMutation.isPending || !poolId.trim()}
            onClick={() => leaseMutation.mutate()}
          >
            {leaseMutation.isPending ? '租借中…' : '试租借'}
          </button>
        </div>

        {lease ? (
          <div className={styles.batchDetailPanel}>
            <div className={styles.batchHeaderRow}>
              <span className={styles.activityTitle}>{lease.displayName}</span>
              <StatusBadge label="已租借" variant="info" />
            </div>
            <div className={styles.batchMetaRow}>
              <span>池 {lease.poolId ?? '—'}</span>
              <span>租借 ID {lease.leaseId}</span>
              <span className={styles.mono}>档案 {lease.profileId}</span>
              <span>到期 {formatEpochMs(lease.expiresAt)}</span>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                失败冷却秒数（仅失败回写用，留空 ⇒ 由池配置决定）
                <input
                  className={styles.input}
                  aria-label="失败冷却秒数"
                  type="number"
                  min={0}
                  value={cooldownSeconds}
                  onChange={(e) => setCooldownSeconds(e.target.value)}
                />
              </label>
            </div>

            <div className={styles.buttonRow}>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={reportMutation.isPending}
                onClick={() => reportMutation.mutate({ success: true })}
              >
                回写成功
              </button>
              <button
                type="button"
                className={styles.dangerButton}
                disabled={reportMutation.isPending}
                onClick={() => setPendingFailReport(true)}
              >
                回写失败
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.tableHint}>尚未租借；点击「试租借」取得账号后可回写结果。</div>
        )}
      </ManageSectionCard>

      <ConfirmDialog
        open={pendingFailReport}
        title="回写租借失败"
        description="回写失败会按冷却秒数冷却该账号，期间不会被再次选中。确定继续？"
        impact={
          cooldownSeconds.trim()
            ? `冷却 ${cooldownSeconds.trim()} 秒`
            : '冷却时长由账号池配置决定（本次不传）'
        }
        confirmLabel="确认失败"
        pending={reportMutation.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingFailReport(false);
        }}
        onConfirm={() => reportMutation.mutate({ success: false })}
      />
    </>
  );
}
