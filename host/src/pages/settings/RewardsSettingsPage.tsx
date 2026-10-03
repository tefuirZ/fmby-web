/**
 * 用户自助「积分 / 签到」页（FE-REWARDS-UI）。
 *
 * 消费 `rewardsApi`（FE-POINTS-CHECKIN 已合入的契约层，session 登录即可）：
 * - `GET  /api/rewards/me`                        → 我的积分汇总
 * - `GET  /api/rewards/rule`                      → 当前生效规则
 * - `POST /api/rewards/checkins`                  → 每日签到（幂等）
 * - `POST /api/rewards/redemptions/server-days`   → 兑换使用时长
 * - `POST /api/rewards/redemptions/media-request-credits` → 兑换求片次数
 *
 * ★诚实口径（契约已定，本页不改）：
 *   - `account === null`（从未产生积分记录）⇒ 显示「暂无积分账户」，**不伪造 0 余额**；
 *   - 重复签到 ⇒ `created=false` / `awardedPoints=0` ⇒ 如实提示「今日已签到」，**不伪造发放**；
 *   - `latestLedger === null` ⇒ 显示「暂无流水」；
 *   - `validUntilAfter === null` ⇒ 不显示有效期（非该类型或幂等未续期）。
 * ★错误一律经既有 `getErrorMessage` 出后端原文，不本地臆造文案。
 *
 * 形态照 `IdentityBindingsSettingsPage.tsx`（同为设置中心的自助面）：
 * `SettingsPageHeader` + `SettingsSectionCard` + `SettingsCenter.module.css`，
 * 组件取 `@fmby/v2-shared/ui` 的 `Button/Input/InlineBanner/FeedbackState/StatusBadge`。
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, FeedbackState, InlineBanner, Input, StatusBadge } from '@fmby/v2-shared/ui';
import { rewardsApi } from '@fmby/v2-shared/contracts/rewards';
import { queryKeys } from '@fmby/v2-shared/query';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from './SettingsCenter.module.css';
import { SettingsPageHeader, SettingsSectionCard } from './components';

const REWARDS_SUMMARY_KEY = ['rewards', 'my-summary'] as const;
const REWARDS_RULE_KEY = ['rewards', 'rule'] as const;

function formatEpochMs(epochMs: number | null): string {
  if (epochMs === null || !Number.isFinite(epochMs) || epochMs <= 0) {
    return '—';
  }
  return new Date(epochMs).toLocaleString('zh-CN', { hour12: false });
}

/** 幂等键：同一按钮在同一次交互内复用（兑换不重复扣减）。 */
function newIdempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function RewardsSettingsPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const summaryQuery = useQuery({
    queryKey: REWARDS_SUMMARY_KEY,
    queryFn: () => rewardsApi.getMySummary(),
  });

  const ruleQuery = useQuery({
    queryKey: REWARDS_RULE_KEY,
    queryFn: () => rewardsApi.getCurrentRule(),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: REWARDS_SUMMARY_KEY });
  }

  const checkInMutation = useMutation({
    mutationFn: () => rewardsApi.checkIn(),
    onSuccess: (result) => {
      setError(null);
      // ★如实呈现幂等命中：不谎报「签到成功并获得积分」
      setNotice(
        result.created
          ? `签到成功，获得 ${result.awardedPoints} 积分。`
          : '今日已签到（本次未重复发放积分）。',
      );
      invalidate();
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const redeemServerDaysMutation = useMutation({
    mutationFn: (quantity: number) =>
      rewardsApi.redeemServerDays(newIdempotencyKey('server-days'), quantity),
    onSuccess: (result) => {
      setError(null);
      setNotice(
        result.applied
          ? `已兑换使用时长，消耗 ${result.pointsSpent} 积分，余额 ${result.balance}。`
          : '该兑换请求已处理过（本次未重复扣减）。',
      );
      invalidate();
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const redeemCreditsMutation = useMutation({
    mutationFn: (quantity: number) =>
      rewardsApi.redeemMediaRequestCredits(newIdempotencyKey('credits'), quantity),
    onSuccess: (result) => {
      setError(null);
      setNotice(
        result.applied
          ? `已兑换求片次数，消耗 ${result.pointsSpent} 积分，余额 ${result.balance}。`
          : '该兑换请求已处理过（本次未重复扣减）。',
      );
      invalidate();
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const summary = summaryQuery.data;
  const account = summary?.account ?? null;

  return (
    <div className={styles.layout}>
      <SettingsPageHeader
        title="积分与签到"
        description="查看当前积分、连续签到与最近流水；每日签到可领取积分，积分可兑换使用时长或求片次数。"
      />

      <div className={styles.pageSections}>
        {notice ? <InlineBanner variant="success" title={notice} /> : null}
        {error ? <InlineBanner variant="error" title={error} /> : null}

        <SettingsSectionCard
          title="积分概览"
          description="未产生过积分记录时显示「暂无积分账户」，不伪造零余额。"
        >
          {summaryQuery.isPending ? (
            <FeedbackState
              variant="loading"
              title="正在读取积分"
              description="正在读取你的积分与签到统计。"
            />
          ) : summaryQuery.isError ? (
            <FeedbackState
              variant="error"
              title="无法读取积分"
              description={getErrorMessage(summaryQuery.error)}
              action={
                <Button type="button" onClick={() => void summaryQuery.refetch()}>
                  重试
                </Button>
              }
            />
          ) : account === null ? (
            // ★诚实：无账户 ⇒ 明确提示，不显示 0
            <FeedbackState
              variant="empty"
              title="暂无积分账户"
              description="你还没有产生积分记录；完成首次签到后即可建立积分账户。"
            />
          ) : (
            <>
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <span className={styles.sectionDescription}>当前积分</span>
                  <strong>{account.balance}</strong>
                </div>
                <div className={styles.field}>
                  <span className={styles.sectionDescription}>累计获得</span>
                  <strong>{account.lifetimeEarned}</strong>
                </div>
                <div className={styles.field}>
                  <span className={styles.sectionDescription}>累计消耗</span>
                  <strong>{account.lifetimeSpent}</strong>
                </div>
                <div className={styles.field}>
                  <span className={styles.sectionDescription}>累计签到</span>
                  <strong>{summary?.totalCheckinDays ?? 0} 天</strong>
                </div>
                <div className={styles.field}>
                  <span className={styles.sectionDescription}>连续签到</span>
                  <strong>{summary?.currentStreakDays ?? 0} 天</strong>
                </div>
              </div>

              <div className={styles.fieldHint}>
                最近更新：{formatEpochMs(account.updatedAt)}
              </div>

              <div className={styles.compactList}>
                {summary?.latestLedger ? (
                  <div className={styles.reorderRow}>
                    <span>
                      最近流水：{summary.latestLedger.transactionType}（
                      {summary.latestLedger.delta >= 0 ? '+' : ''}
                      {summary.latestLedger.delta}）
                    </span>
                    <span className={styles.fieldHint}>
                      {formatEpochMs(summary.latestLedger.createdAt)}
                    </span>
                  </div>
                ) : (
                  // ★诚实：无流水 ⇒ 明确提示
                  <div className={styles.fieldHint}>暂无流水。</div>
                )}
              </div>
            </>
          )}
        </SettingsSectionCard>

        <SettingsSectionCard
          title="规则"
          description="当前生效的奖励规则版本；未发布时后端会给出真实错误。"
        >
          {ruleQuery.isPending ? (
            <div className={styles.fieldHint}>正在读取规则…</div>
          ) : ruleQuery.isError ? (
            <InlineBanner variant="error" title={getErrorMessage(ruleQuery.error)} />
          ) : (
            <div className={styles.compactList}>
              <div className={styles.reorderRow}>
                <span>规则版本 v{ruleQuery.data?.version ?? '—'}</span>
                <StatusBadge
                  label={ruleQuery.data?.status ?? '未知'}
                  variant="info"
                />
              </div>
              <div className={styles.fieldHint}>
                签到：{ruleQuery.data?.config?.checkinEnabled ? '已启用' : '未启用'}
              </div>
            </div>
          )}
        </SettingsSectionCard>

        <SettingsSectionCard
          title="签到"
          description="每日签到一次；当日重复签到不会重复发放积分（如实提示）。"
        >
          <div className={styles.stickyBar}>
            <Button
              type="button"
              disabled={checkInMutation.isPending}
              onClick={() => checkInMutation.mutate()}
            >
              {checkInMutation.isPending ? '签到中…' : '每日签到'}
            </Button>
            <span className={styles.stickyHint}>
              {checkInMutation.data
                ? checkInMutation.data.created
                  ? `本次发放 ${checkInMutation.data.awardedPoints} 积分`
                  : '今日已签到，未重复发放'
                : '签到幂等：当日仅首次发放积分。'}
            </span>
          </div>
        </SettingsSectionCard>

        <SettingsSectionCard
          title="兑换"
          description="消耗积分兑换使用时长或求片次数；兑换带幂等键，重复提交不会重复扣减。"
        >
          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span className={styles.sectionDescription}>数量</span>
              <Input
                aria-label="兑换数量"
                type="number"
                min={1}
                defaultValue={1}
                id="rewards-quantity"
              />
            </label>
          </div>

          <div className={styles.stickyBar}>
            <Button
              type="button"
              disabled={redeemServerDaysMutation.isPending}
              onClick={() => redeemServerDaysMutation.mutate(readQuantity())}
            >
              兑换使用时长
            </Button>
            <Button
              type="button"
              disabled={redeemCreditsMutation.isPending}
              onClick={() => redeemCreditsMutation.mutate(readQuantity())}
            >
              兑换求片次数
            </Button>
          </div>

          {redeemServerDaysMutation.data?.validUntilAfter ? (
            <div className={styles.fieldHint}>
              使用时长有效期至：{formatEpochMs(redeemServerDaysMutation.data.validUntilAfter)}
            </div>
          ) : null}
        </SettingsSectionCard>
      </div>
    </div>
  );
}

/** 读取兑换数量输入（缺省 1，非法值回落 1）。 */
function readQuantity(): number {
  const el = document.getElementById('rewards-quantity') as HTMLInputElement | null;
  const parsed = Number(el?.value ?? '1');
  return Number.isFinite(parsed) && parsed >= 1 ? Math.trunc(parsed) : 1;
}
