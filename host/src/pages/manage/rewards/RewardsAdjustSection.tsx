/**
 * 积分管理区（FE-PARITY-REWARDS-EXTRA）。
 *
 * 端点（真实后端，crates/fmby-v2-http/src/routes/manage_rewards.rs）：
 * - GET  /api/manage/rewards/stats            → 积分/签到管理统计
 * - POST /api/manage/rewards/points/adjust    → 管理员积分调整（单事务写账户+流水，幂等键防重复）
 *
 * 二者均无 require_confirmed（仅 require_capability(MANAGE_ACCESS)），故前端不带
 * params:{confirmed:true}；积分调整属不可逆写操作，用 ConfirmDialog 二次确认 + pending 禁用 +
 * 失败态透传后端 error_code（不吞成空列表/成功）。
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { peripheralsApi, type RewardsAdjustResultRecord } from '@fmby/v2-shared/contracts/manage/peripherals';
import { queryKeys } from '@fmby/v2-shared/query';
import { ConfirmDialog, InlineBanner } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from '../longtail-shared/ManageShared.module.css';
import { ManageSectionCard } from '../longtail-shared/components';

function makeIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `adj-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function RewardsAdjustSection() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState('');
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(() => makeIdempotencyKey());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<RewardsAdjustResultRecord | null>(null);

  const statsQuery = useQuery({
    queryKey: queryKeys.manage.rewards.stats(),
    queryFn: () => peripheralsApi.getRewardsAdminStats(),
  });

  const adjustMutation = useMutation({
    mutationFn: () =>
      peripheralsApi.adjustRewardsPoints({
        userId: userId.trim(),
        delta: Number(delta),
        reason: reason.trim(),
        idempotencyKey,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.manage.rewards.stats() });
      setResult(res);
      setIdempotencyKey(makeIdempotencyKey());
      setConfirmOpen(false);
    },
  });

  const deltaNum = Number(delta);
  const canSubmit = userId.trim().length > 0 && Number.isFinite(deltaNum) && delta.trim().length > 0;

  return (
    <>
      <ManageSectionCard
        title="积分管理统计"
        description="管理面全局积分/签到概览；求片相关计数属求片链独立功能，恒为空（不伪造 0）。"
      >
        {statsQuery.isPending ? (
          <div className={styles.tableHint}>正在加载统计…</div>
        ) : statsQuery.isError ? (
          <InlineBanner variant="error" title="统计读取失败" description={getErrorMessage(statsQuery.error)} />
        ) : statsQuery.data ? (
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>{statsQuery.data.pointsOutstanding}</div>
              <div className={styles.metricLabel}>在途积分</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>{statsQuery.data.checkinsToday}</div>
              <div className={styles.metricLabel}>今日签到</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>{statsQuery.data.pendingCheckins}</div>
              <div className={styles.metricLabel}>待处理签到</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>{statsQuery.data.redemptionsToday}</div>
              <div className={styles.metricLabel}>今日兑换</div>
            </div>
          </div>
        ) : null}
      </ManageSectionCard>

      <ManageSectionCard
        title="管理员积分调整"
        description="单事务写账户 + 流水；幂等键重复提交不重复变动余额（返回 applied=false）。"
      >
        {adjustMutation.isError ? (
          <InlineBanner variant="error" title="积分调整失败" description={getErrorMessage(adjustMutation.error)} />
        ) : null}
        {result ? (
          <InlineBanner
            variant={result.applied ? 'success' : 'info'}
            title={result.applied ? '积分已调整' : '未重复调整（幂等键已存在）'}
            description={`账户 ${result.userId}：余额 ${result.balance}，累计获得 ${result.lifetimeEarned}，累计消耗 ${result.lifetimeSpent}。`}
          />
        ) : null}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>
            用户 ID（必填）
            <input
              className={styles.input}
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setResult(null);
              }}
              placeholder="例如：1"
            />
          </label>
          <div className={styles.fieldRow}>
            <label className={styles.label}>
              增减积分（正=加，负=减）
              <input
                className={styles.input}
                type="number"
                value={delta}
                onChange={(e) => {
                  setDelta(e.target.value);
                  setResult(null);
                }}
              />
            </label>
            <label className={styles.label}>
              幂等键（重复提交防重复变动）
              <input className={styles.input} value={idempotencyKey} onChange={(e) => setIdempotencyKey(e.target.value)} />
            </label>
          </div>
          <label className={styles.label}>
            调整原因
            <input
              className={styles.input}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="例如：活动奖励 / 误扣回补"
            />
          </label>
          <div className={styles.buttonRow}>
            <button
              className={styles.primaryButton}
              type="button"
              disabled={!canSubmit || adjustMutation.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              提交调整
            </button>
          </div>
        </div>

        <ConfirmDialog
          open={confirmOpen}
          title="管理员积分调整"
          description={`将用户 ${userId.trim()} 的积分${deltaNum >= 0 ? '增加' : '减少'} ${Math.abs(deltaNum)}。此操作通过签到/消耗链路写入，不可逆。`}
          impact={`${deltaNum >= 0 ? '增加积分' : '减少积分'}`}
          confirmLabel="确认调整"
          cancelLabel="取消"
          confirmDisabled={!canSubmit}
          pending={adjustMutation.isPending}
          onOpenChange={setConfirmOpen}
          onConfirm={() => adjustMutation.mutate()}
        />
      </ManageSectionCard>
    </>
  );
}
