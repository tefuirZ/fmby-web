import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { peripheralsApi } from '@fmby/v2-shared/contracts/manage/peripherals';
import { queryKeys } from '@fmby/v2-shared/query';
import { InlineBanner, StatusBadge } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from './longtail-shared/ManageShared.module.css';
import { ManagePageHeader, ManageSectionCard } from './longtail-shared/components';

const LEDGER_LIMIT_OPTIONS = [50, 100, 200] as const;
const LEDGER_LIMIT_DEFAULT = 50;

function formatEpochMs(epochMs: number): string {
  if (!Number.isFinite(epochMs) || epochMs <= 0) {
    return '—';
  }
  return new Date(epochMs).toLocaleString('zh-CN', { hour12: false });
}

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : `${delta}`;
}

export function ManageRewardsPage() {
  const [userIdInput, setUserIdInput] = useState('');
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [ledgerLimit, setLedgerLimit] = useState<number>(LEDGER_LIMIT_DEFAULT);

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

  if (activeUserId === null) {
    return (
      <div className={styles.page}>
        <ManagePageHeader
          title="积分与签到"
          description="按用户查询积分账户与签到流水；只读视图，积分变更一律走签到/消耗链路，不提供手工调账。"
          meta={
            <span className={styles.metaText}>
              输入用户 ID 后加载账户汇总与最近流水
            </span>
          }
        />
        <ManageSectionCard title="查询用户" description="用户 ID 即管理面「用户账号」页中的 ID。">
          <form className={styles.fieldGroup} onSubmit={submitQuery}>
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

      <ManageSectionCard
        title={`积分流水（最近 ${ledgerLimit} 条）`}
        description="按时间倒序；变动与余额后值为账本快照，可直接复核对账。"
        actions={
          <label className={styles.label}>
            条数
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
        }
      >
        {ledgerQuery.isPending ? (
          <div className={styles.tableHint}>正在加载流水…</div>
        ) : ledger.length === 0 ? (
          <div className={styles.emptyInlineState}>该用户还没有任何积分流水。</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>时间</th>
                  <th>类型</th>
                  <th>来源</th>
                  <th>变动</th>
                  <th>余额后</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((entry) => (
                  <tr key={entry.id}>
                    <td className="nowrap">{formatEpochMs(entry.createdAt)}</td>
                    <td>
                      <StatusBadge
                        label={entry.transactionType}
                        variant={entry.delta >= 0 ? 'success' : 'warning'}
                      />
                    </td>
                    <td className={styles.mono}>
                      {entry.sourceType}/{entry.sourceId}
                    </td>
                    <td className={styles.mono}>{formatDelta(entry.delta)}</td>
                    <td className={styles.mono}>{entry.balanceAfter}</td>
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

export default ManageRewardsPage;
