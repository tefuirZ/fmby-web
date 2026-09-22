/**
 * 奖励规则区（FE-PARITY-REWARDS-EXTRA）。
 *
 * 端点（真实后端，crates/fmby-v2-http/src/routes/manage_rewards.rs）：
 * - GET  /api/manage/rewards/rule  → 当前生效版本（RewardsRuleVersionDto）
 * - POST /api/manage/rewards/rule  → 发布新版本（同事务 retire 旧版）
 *
 * 二者均无 require_confirmed（仅 require_capability(MANAGE_ACCESS)），故前端不带
 * params:{confirmed:true}；发布新版本属不可逆写操作，用 ConfirmDialog 二次确认 + pending 禁用。
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { peripheralsApi, type RewardsRuleConfigRecord, type RewardsRuleVersionRecord } from '@fmby/v2-shared/contracts/manage/peripherals';
import { queryKeys } from '@fmby/v2-shared/query';
import { ConfirmDialog, InlineBanner, StatusBadge } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { formatEpochMs } from './RewardsLedgerSection';
import styles from '../longtail-shared/ManageShared.module.css';
import { ManageSectionCard } from '../longtail-shared/components';

function emptyRuleConfig(): RewardsRuleConfigRecord {
  return {
    checkinEnabled: true,
    rewardMode: 'tiered',
    tiers: [{ startDay: 1, endDay: null, points: 1 }],
    randomMinPoints: 1,
    randomMaxPoints: 5,
    watchTask: { enabled: false, requiredMinutes: 30 },
    allowExpiredCheckin: false,
    serverDays: { enabled: false, pointsPerUnit: 0, minQuantity: 0, maxQuantity: 0, dailyLimit: null, monthlyLimit: null },
    mediaRequestCredits: { enabled: false, pointsPerUnit: 0, minQuantity: 0, maxQuantity: 0, dailyLimit: null, monthlyLimit: null },
    mediaRequestCost: 0,
  };
}

function seedDraftFrom(version: RewardsRuleVersionRecord | null): RewardsRuleConfigRecord {
  if (!version) {
    return emptyRuleConfig();
  }
  const c = version.config;
  return {
    checkinEnabled: c.checkinEnabled,
    rewardMode: c.rewardMode,
    tiers: c.tiers.map((tier) => ({ startDay: tier.startDay, endDay: tier.endDay, points: tier.points })),
    randomMinPoints: c.randomMinPoints,
    randomMaxPoints: c.randomMaxPoints,
    watchTask: { enabled: c.watchTask.enabled, requiredMinutes: c.watchTask.requiredMinutes },
    allowExpiredCheckin: c.allowExpiredCheckin,
    serverDays: { ...c.serverDays },
    mediaRequestCredits: { ...c.mediaRequestCredits },
    mediaRequestCost: c.mediaRequestCost,
  };
}

export function RewardsRuleSection() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<RewardsRuleConfigRecord | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const ruleQuery = useQuery({
    queryKey: queryKeys.manage.rewards.rule(),
    queryFn: () => peripheralsApi.getRewardsRule(),
  });

  const publishMutation = useMutation({
    mutationFn: (config: RewardsRuleConfigRecord) => peripheralsApi.publishRewardsRule(config),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.manage.rewards.rule(), saved);
      queryClient.invalidateQueries({ queryKey: queryKeys.manage.rewards.rule() });
      setBanner(`已发布新版本规则 v${saved.version}（状态 ${saved.status}）。`);
      setDraft(null);
      setConfirmOpen(false);
    },
  });

  const rule = ruleQuery.data ?? null;
  const editing = draft !== null;

  const tierSummary = useMemo(() => {
    const cfg = draft ?? rule?.config ?? null;
    if (!cfg) {
      return '—';
    }
    if (cfg.rewardMode === 'random') {
      return `随机 ${cfg.randomMinPoints}~${cfg.randomMaxPoints} 分`;
    }
    return `${cfg.tiers.length} 档阶梯（首档 ${cfg.tiers[0]?.points ?? 0} 分）`;
  }, [draft, rule]);

  if (ruleQuery.isPending) {
    return (
      <ManageSectionCard title="奖励规则" description="读取当前生效的版本化奖励规则。">
        <div className={styles.tableHint}>正在加载奖励规则…</div>
      </ManageSectionCard>
    );
  }

  if (ruleQuery.isError) {
    return (
      <ManageSectionCard title="奖励规则" description="读取当前生效的版本化奖励规则。">
        <InlineBanner variant="error" title="奖励规则读取失败" description={getErrorMessage(ruleQuery.error)} />
      </ManageSectionCard>
    );
  }

  if (!editing) {
    return (
      <ManageSectionCard
        title="奖励规则"
        description="版本化规则：发布新版本会同时下线旧版本（同一时刻仅一个 published）。"
        actions={
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => setDraft(seedDraftFrom(rule))}
          >
            发布新版本
          </button>
        }
      >
        {rule ? (
          <div className={styles.detailFieldGrid}>
            <div className={styles.detailCard}>
              <div className={styles.detailCardLabel}>版本</div>
              <div className={styles.detailCardValue}>v{rule.version}</div>
            </div>
            <div className={styles.detailCard}>
              <div className={styles.detailCardLabel}>状态</div>
              <div className={styles.detailCardValue}>
                <StatusBadge label={rule.status} variant={rule.status === 'published' ? 'success' : 'neutral'} />
              </div>
            </div>
            <div className={styles.detailCard}>
              <div className={styles.detailCardLabel}>签到模式</div>
              <div className={styles.detailCardValue}>{rule.config.checkinEnabled ? '已启用' : '未启用'}</div>
            </div>
            <div className={styles.detailCard}>
              <div className={styles.detailCardLabel}>奖励方式</div>
              <div className={styles.detailCardValue}>{rule.config.rewardMode === 'random' ? '随机' : '阶梯'}</div>
            </div>
            <div className={styles.detailCard}>
              <div className={styles.detailCardLabel}>奖励阶梯</div>
              <div className={styles.detailCardValue}>{tierSummary}</div>
            </div>
            <div className={styles.detailCard}>
              <div className={styles.detailCardLabel}>发布时间</div>
              <div className={styles.detailCardValue}>{formatEpochMs(rule.publishedAt)}</div>
            </div>
          </div>
        ) : (
          <div className={styles.emptyInlineState}>后端尚未发布任何奖励规则版本。</div>
        )}
        {banner ? <InlineBanner variant="success" title={banner} /> : null}
      </ManageSectionCard>
    );
  }

  // editing draft
  const d = draft;
  const setTier = (index: number, patch: Partial<RewardsRuleConfigRecord['tiers'][number]>) => {
    setDraft({
      ...d,
      tiers: d.tiers.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)),
    });
  };

  return (
    <ManageSectionCard
      title="发布新版本规则"
      description="提交后旧版本下线，请确认配置无误。"
    >
      {banner ? <InlineBanner variant="success" title={banner} /> : null}
      {publishMutation.isError ? (
        <InlineBanner variant="error" title="发布失败" description={getErrorMessage(publishMutation.error)} />
      ) : null}
      <div className={styles.fieldGroup}>
        <label className={styles.checkboxRow}>
          <input
            className={styles.checkbox}
            type="checkbox"
            checked={d.checkinEnabled}
            onChange={(e) => setDraft({ ...d, checkinEnabled: e.target.checked })}
          />
          <span>启用每日签到</span>
        </label>
        <label className={styles.checkboxRow}>
          <input
            className={styles.checkbox}
            type="checkbox"
            checked={d.allowExpiredCheckin}
            onChange={(e) => setDraft({ ...d, allowExpiredCheckin: e.target.checked })}
          />
          <span>允许补签</span>
        </label>
        <div className={styles.fieldRow}>
          <label className={styles.label}>
            奖励方式
            <select
              className={styles.select}
              value={d.rewardMode}
              onChange={(e) => setDraft({ ...d, rewardMode: e.target.value })}
            >
              <option value="tiered">阶梯</option>
              <option value="random">随机</option>
            </select>
          </label>
        </div>

        {d.rewardMode === 'random' ? (
          <div className={styles.fieldRow}>
            <label className={styles.label}>
              随机最小积分
              <input className={styles.input} type="number" value={d.randomMinPoints} onChange={(e) => setDraft({ ...d, randomMinPoints: Number(e.target.value) })} />
            </label>
            <label className={styles.label}>
              随机最大积分
              <input className={styles.input} type="number" value={d.randomMaxPoints} onChange={(e) => setDraft({ ...d, randomMaxPoints: Number(e.target.value) })} />
            </label>
          </div>
        ) : (
          <div className={styles.fieldGroup}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>阶梯奖励</span>
              <button className={styles.smallButton} type="button" onClick={() => setDraft({ ...d, tiers: [...d.tiers, { startDay: 1, endDay: null, points: 1 }] })}>
                新增阶梯
              </button>
            </div>
            {d.tiers.map((tier, i) => (
              <div className={styles.fieldRow} key={i}>
                <label className={styles.label}>
                  起始天
                  <input className={styles.input} type="number" value={tier.startDay} onChange={(e) => setTier(i, { startDay: Number(e.target.value) })} />
                </label>
                <label className={styles.label}>
                  结束天（空=无限）
                  <input className={styles.input} type="number" value={tier.endDay ?? ''} onChange={(e) => setTier(i, { endDay: e.target.value === '' ? null : Number(e.target.value) })} />
                </label>
                <label className={styles.label}>
                  积分
                  <input className={styles.input} type="number" value={tier.points} onChange={(e) => setTier(i, { points: Number(e.target.value) })} />
                </label>
                <button className={styles.smallDangerButton} type="button" onClick={() => setDraft({ ...d, tiers: d.tiers.filter((_, j) => j !== i) })}>
                  删除
                </button>
              </div>
            ))}
          </div>
        )}

        <div className={styles.fieldRow}>
          <label className={styles.label}>
            观看任务积分
            <input className={styles.input} type="number" value={d.serverDays.pointsPerUnit} onChange={(e) => setDraft({ ...d, serverDays: { ...d.serverDays, pointsPerUnit: Number(e.target.value) } })} />
          </label>
          <label className={styles.label}>
            求片抵扣积分
            <input className={styles.input} type="number" value={d.mediaRequestCost} onChange={(e) => setDraft({ ...d, mediaRequestCost: Number(e.target.value) })} />
          </label>
        </div>

        <div className={styles.buttonRow}>
          <button className={styles.primaryButton} type="button" disabled={publishMutation.isPending} onClick={() => setConfirmOpen(true)}>
            提交发布新版本
          </button>
          <button className={styles.secondaryButton} type="button" disabled={publishMutation.isPending} onClick={() => setDraft(null)}>
            取消
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="发布新版本奖励规则"
        description="旧版本将下线，新版本立即生效。此操作不可逆。"
        confirmLabel="确认发布"
        cancelLabel="再想想"
        pending={publishMutation.isPending}
        onOpenChange={setConfirmOpen}
        onConfirm={() => publishMutation.mutate(d)}
      />
    </ManageSectionCard>
  );
}
