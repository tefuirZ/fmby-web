/** 积分流水区（V1F 拆分：ManageRewardsPage → 子组件）。 */

import { StatusBadge } from '@fmby/v2-shared/ui';
import styles from '../longtail-shared/ManageShared.module.css';
import { ManageSectionCard } from '../longtail-shared/components';

export const LEDGER_LIMIT_OPTIONS = [50, 100, 200] as const;

export function formatEpochMs(epochMs: number): string {
  if (!Number.isFinite(epochMs) || epochMs <= 0) {
    return '—';
  }
  return new Date(epochMs).toLocaleString('zh-CN', { hour12: false });
}

export function formatDelta(delta: number): string {
  return delta >= 0 ? `+${delta}` : `${delta}`;
}

interface LedgerEntry {
  id: string;
  createdAt: number;
  transactionType: string;
  sourceType: string;
  sourceId: string;
  delta: number;
  balanceAfter: number;
}

interface RewardsLedgerSectionProps {
  ledger: LedgerEntry[];
  ledgerLimit: number;
  onLedgerLimitChange: (limit: number) => void;
  isPending: boolean;
}

export function RewardsLedgerSection({
  ledger,
  ledgerLimit,
  onLedgerLimitChange,
  isPending,
}: RewardsLedgerSectionProps) {
  return (
    <ManageSectionCard
      title={`积分流水（最近 ${ledgerLimit} 条）`}
      description="按时间倒序；变动与余额后值为账本快照，可直接复核对账。"
      actions={
        <label className={styles.label}>
          条数
          <select
            className={styles.select}
            value={ledgerLimit}
            onChange={(e) => onLedgerLimitChange(Number(e.target.value))}
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
      {isPending ? (
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
  );
}
