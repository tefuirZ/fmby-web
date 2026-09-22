import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  isBackendUnavailableError,
  peripheralsApi,
  type RewardsEventConfigRecord,
} from '@fmby/v2-shared/contracts/manage/peripherals';
import { queryKeys } from '@fmby/v2-shared/query';
import { FeedbackState, InlineBanner } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from './longtail-shared/ManageShared.module.css';
import { ManagePageHeader, ManageSectionCard } from './longtail-shared/components';

import {
  LEDGER_LIMIT_OPTIONS,
  RewardsLedgerSection,
  formatEpochMs,
} from './rewards/RewardsLedgerSection';
import { RewardsRuleSection } from './rewards/RewardsRuleSection';
import { RewardsAdjustSection } from './rewards/RewardsAdjustSection';

const LEDGER_LIMIT_DEFAULT = 50;

export function ManageRewardsPage() {
  const queryClient = useQueryClient();
  const [userIdInput, setUserIdInput] = useState('');
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [ledgerLimit, setLedgerLimit] = useState<number>(LEDGER_LIMIT_DEFAULT);
  const [configDraft, setConfigDraft] = useState<RewardsEventConfigRecord | null>(null);
  const [configBanner, setConfigBanner] = useState<string | null>(null);

  const rewardsConfigKey = ['manage', 'rewards', 'config'] as const;

  const configQuery = useQuery({
    queryKey: rewardsConfigKey,
    queryFn: async () => {
      try {
        return await peripheralsApi.getRewardsEventConfig();
      } catch (err) {
        if (isBackendUnavailableError(err)) {
          return null;
        }
        throw err;
      }
    },
  });

  useEffect(() => {
    if (configQuery.data) {
      setConfigDraft(configQuery.data);
    }
  }, [configQuery.data]);

  const saveConfigMutation = useMutation({
    mutationFn: () => {
      if (!configDraft) {
        throw new Error('配置草稿尚未就绪');
      }
      return peripheralsApi.putRewardsEventConfig(configDraft);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(rewardsConfigKey, saved);
      setConfigDraft(saved);
      setConfigBanner('签到/积分事件配置已写入。');
    },
  });

  const summaryQuery = useQuery({
    queryKey: queryKeys.manage.rewards.account(activeUserId ?? undefined),
    queryFn: () => peripheralsApi.getRewardsAccountSummary(activeUserId as string),
    enabled: activeUserId !== null,
  });

  const ledgerQuery = useQuery({
    queryKey: queryKeys.manage.rewards.ledger(
      activeUserId ?? undefined,
      activeUserId !== null ? ledgerLimit : undefined,
    ),
    queryFn: () => peripheralsApi.getRewardsLedger(activeUserId as string, ledgerLimit),
    enabled: activeUserId !== null,
  });

  function submitQuery(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = userIdInput.trim();
    if (trimmed.length === 0) {
      return;
    }
    setActiveUserId(trimmed);
  }

  if (configQuery.isPending) {
    return (
      <FeedbackState
        variant="loading"
        title="正在读取积分与签到配置"
        description="正在检测签到/积分事件配置端口。"
      />
    );
  }

  if (configQuery.isError) {
    return (
      <FeedbackState
        variant="error"
        title="积分与签到配置读取失败"
        description={getErrorMessage(configQuery.error)}
        action={
          <button className={styles.primaryButton} type="button" onClick={() => void configQuery.refetch()}>
            重试
          </button>
        }
      />
    );
  }

  const configUnavailable = configQuery.data === null;

  if (activeUserId === null) {
    return (
      <div className={styles.page}>
        <ManagePageHeader
          title="积分与签到"
          description="配置签到/积分事件规则；按用户查询积分账户与签到流水。积分变更一律走签到/消耗链路，不提供手工调账，也不伪造账户数据。"
          meta={
            <span className={styles.metaText}>
              输入用户 ID 后加载账户汇总与最近流水
            </span>
          }
        />
        {configUnavailable || !configDraft ? (
          <ManageSectionCard
            title="事件配置未装配"
            description="GET/PUT /api/manage/rewards/config 由本卡冻结，后端规则端口另行开卡。"
          >
            <InlineBanner
              variant="info"
              title="等待后端装配"
              description="签到/积分事件配置端点尚未提供。本页不以零积分默认值冒充已生效规则。"
            />
            <button className={styles.secondaryButton} type="button" onClick={() => void configQuery.refetch()}>
              重新检测
            </button>
          </ManageSectionCard>
        ) : (
          <ManageSectionCard title="签到/积分事件配置" description="规则写入后由签到链路消费；管理面不直接改账户余额。">
            {configBanner ? <InlineBanner variant="success" title={configBanner} /> : null}
            {saveConfigMutation.isError ? (
              <InlineBanner
                variant="error"
                title="保存失败"
                description={getErrorMessage(saveConfigMutation.error)}
              />
            ) : null}
            <form
              className={styles.fieldGroup}
              onSubmit={(event) => {
                event.preventDefault();
                saveConfigMutation.mutate();
              }}
            >
              <label className={styles.checkboxRow}>
                <input
                  className={styles.checkbox}
                  type="checkbox"
                  checked={configDraft.checkinEnabled}
                  onChange={(event) =>
                    setConfigDraft((current) =>
                      current ? { ...current, checkinEnabled: event.target.checked } : current,
                    )
                  }
                />
                <span>启用每日签到</span>
              </label>
              <div className={styles.fieldRow}>
                <label className={styles.label}>
                  每日签到积分
                  <input
                    className={styles.input}
                    type="number"
                    min={0}
                    value={configDraft.dailyCheckinPoints}
                    onChange={(event) =>
                      setConfigDraft((current) =>
                        current
                          ? { ...current, dailyCheckinPoints: Number(event.target.value) }
                          : current,
                      )
                    }
                  />
                </label>
                <label className={styles.label}>
                  连续签到奖励积分
                  <input
                    className={styles.input}
                    type="number"
                    min={0}
                    value={configDraft.streakBonusPoints}
                    onChange={(event) =>
                      setConfigDraft((current) =>
                        current
                          ? { ...current, streakBonusPoints: Number(event.target.value) }
                          : current,
                      )
                    }
                  />
                </label>
                <label className={styles.label}>
                  连续签到上限天数
                  <input
                    className={styles.input}
                    type="number"
                    min={0}
                    value={configDraft.maxStreakDays}
                    onChange={(event) =>
                      setConfigDraft((current) =>
                        current
                          ? { ...current, maxStreakDays: Number(event.target.value) }
                          : current,
                      )
                    }
                  />
                </label>
              </div>
              <div className={styles.buttonRow}>
                <button
                  className={styles.primaryButton}
                  type="submit"
                  disabled={saveConfigMutation.isPending}
                >
                  {saveConfigMutation.isPending ? '保存中…' : '保存事件配置'}
                </button>
              </div>
            </form>
          </ManageSectionCard>
        )}
        <ManageSectionCard title="查询用户" description="用户 ID 即管理面「用户账号」页中的 ID。">          <form className={styles.fieldGroup} onSubmit={submitQuery}>
            <label className={styles.label}>
              用户 ID（必填）
              <input
                className={styles.input}
                value={userIdInput}
                onChange={(e) => setUserIdInput(e.target.value)}
                placeholder="例如：1"
              />
            </label>
            <div className={styles.fieldRow}>
              <label className={styles.label}>
                流水条数
                <select
                  className={styles.select}
                  value={ledgerLimit}
                  onChange={(e) => setLedgerLimit(Number(e.target.value))}
                >
                  {LEDGER_LIMIT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      最近 {option} 条
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className={styles.buttonRow}>
              <button
                className={styles.primaryButton}
                type="submit"
                disabled={userIdInput.trim().length === 0}
              >
                查询积分账户
              </button>
            </div>
          </form>
        </ManageSectionCard>
        <RewardsRuleSection />
        <RewardsAdjustSection />
      </div>
    );
  }

  const summaryError = summaryQuery.error ?? ledgerQuery.error;
  const summary = summaryQuery.data;
  const ledger = ledgerQuery.data ?? [];

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="积分与签到"
        description={`用户 ${activeUserId} 的积分账户与流水。`}
        meta={
          <span className={styles.metaText}>
            账户为空表示该用户从未产生积分记录（未签到、无消耗）。
          </span>
        }
        actions={
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => {
              setActiveUserId(null);
              setUserIdInput('');
            }}
          >
            换一个用户
          </button>
        }
      />

      {summaryError ? (
        <InlineBanner
          variant="error"
          title="积分账户加载失败"
          description={getErrorMessage(summaryError)}
        />
      ) : null}

      <ManageSectionCard title="账户汇总" description="余额与累计值来自积分账户账本，签到天数为签到域统计。">
        {summaryQuery.isPending ? (
          <div className={styles.tableHint}>正在加载积分账户…</div>
        ) : summary ? (
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>{summary.account?.balance ?? 0}</div>
              <div className={styles.metricLabel}>当前余额</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>{summary.account?.lifetimeEarned ?? 0}</div>
              <div className={styles.metricLabel}>累计获得</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>{summary.account?.lifetimeSpent ?? 0}</div>
              <div className={styles.metricLabel}>累计消耗</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>{summary.totalCheckinDays}</div>
              <div className={styles.metricLabel}>累计签到天数</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>
                {summary.account ? formatEpochMs(summary.account.updatedAt) : '—'}
              </div>
              <div className={styles.metricLabel}>账户更新时间</div>
            </div>
          </div>
        ) : null}
        {summary && !summary.account ? (
          <div className={styles.emptyInlineState}>
            该用户还没有积分账户；首次签到后才会建账。
          </div>
        ) : null}
      </ManageSectionCard>

      <RewardsLedgerSection
        ledger={ledger}
        ledgerLimit={ledgerLimit}
        onLedgerLimitChange={setLedgerLimit}
        isPending={ledgerQuery.isPending}
      />
      <RewardsRuleSection />
      <RewardsAdjustSection />
    </div>
  );
}

export default ManageRewardsPage;
