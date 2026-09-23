/**
 * 授权状态总览（照 V1 `pages/manage/license/components/LicenseStatusOverview.tsx` 对位）。
 * 六态徽标 + 摘要卡 + 错误/realtime 阻断面板 + realtime 控制通道细节。
 */

import { RefreshCw } from 'lucide-react';
import {
  getLicenseRealtimeStatusTone,
  getLicenseRuntimeStateTone,
  type LicenseStatusRecord,
} from '@fmby/v2-shared/contracts/manage/license';
import { StatusBadge } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { formatEpochMs, formatEpochRelative } from '../licenseFormat';
import styles from '../../longtail-shared/ManageShared.module.css';

interface LicenseStatusOverviewProps {
  status: LicenseStatusRecord;
  heartbeatPending: boolean;
  heartbeatError: unknown;
  onHeartbeat: () => void;
}

export function LicenseStatusOverview({
  status,
  heartbeatPending,
  heartbeatError,
  onHeartbeat,
}: LicenseStatusOverviewProps) {
  const runtimeLabel = status.runtimeState ?? '未知';
  const realtimeStatusLabel = status.realtimeStatus ?? '待初始化';
  const summaryItems = [
    {
      label: '业务访问',
      value: status.businessAccessAllowed ? '允许' : '阻断',
      meta: status.businessAccessAllowed
        ? '当前授权状态允许业务链路继续运行'
        : '业务链路会被授权 gate 阻断',
      variant: status.businessAccessAllowed ? 'success' : 'danger',
    },
    {
      label: 'Lease 到期',
      value: formatEpochMs(status.expiresAt),
      meta: status.expiresAt ? formatEpochRelative(status.expiresAt) : '尚未拿到 SignedLease',
      variant: status.runtimeState === 'active' ? 'success' : 'warning',
    },
    {
      label: '宽限截止',
      value: formatEpochMs(status.graceExpiresAt),
      meta: status.runtimeState === 'grace' ? '当前处于宽限期' : '超过后业务访问会被阻断',
      variant: status.runtimeState === 'grace' ? 'warning' : 'neutral',
    },
    {
      label: '最近心跳',
      value: formatEpochMs(status.lastHeartbeatAt),
      meta: status.nextHeartbeatAt
        ? `下次计划 ${formatEpochMs(status.nextHeartbeatAt)}`
        : '尚无下次心跳计划',
      variant: status.lastErrorMessage ? 'warning' : 'info',
    },
    {
      label: 'Realtime 通道',
      value: status.realtimeEnabled ? realtimeStatusLabel : '未启用',
      meta: getRealtimeSummaryMeta(status),
      variant: getLicenseRealtimeStatusTone(status.realtimeStatus, {
        enabled: status.realtimeEnabled,
      }),
    },
    {
      label: '最近实时事件',
      value: formatRealtimeEventLabel(status.lastRealtimeEventKind),
      meta: status.lastRealtimeEventAt
        ? `${formatEpochMs(status.lastRealtimeEventAt)} · ${formatEpochRelative(status.lastRealtimeEventAt)}`
        : '尚未收到服务端实时控制事件',
      variant: status.realtimeBlockedReason ? 'danger' : 'neutral',
    },
  ] as const;

  return (
    <section>
      <div className={styles.rowActions}>
        <div className={styles.inlineMeta}>
          <StatusBadge
            label={runtimeLabel}
            variant={getLicenseRuntimeStateTone(status.runtimeState)}
          />
          <span className={styles.mutedText}>
            协议 v{status.protocolVersion} · {status.serverBaseUrl}
          </span>
        </div>
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={onHeartbeat}
          disabled={heartbeatPending}
        >
          <RefreshCw size={16} />
          {heartbeatPending ? '心跳中...' : '手动心跳'}
        </button>
      </div>

      {heartbeatError ? (
        <div className={styles.dangerPanel}>
          <strong>手动心跳失败</strong>
          <span>{getErrorMessage(heartbeatError)}</span>
        </div>
      ) : null}

      {status.lastErrorMessage ? (
        <div className={styles.dangerPanel}>
          <strong>{status.lastErrorCode ?? '授权错误'}</strong>
          <span>{status.lastErrorMessage}</span>
          {status.lastErrorAt ? (
            <span className={styles.mutedText}>发生时间：{formatEpochMs(status.lastErrorAt)}</span>
          ) : null}
        </div>
      ) : null}

      {status.realtimeBlockedReason ? (
        <div className={styles.dangerPanel}>
          <strong>Realtime 已触发强制阻断</strong>
          <span>{status.realtimeBlockedReason}</span>
          {status.realtimeBlockedAt ? (
            <span className={styles.mutedText}>阻断时间：{formatEpochMs(status.realtimeBlockedAt)}</span>
          ) : null}
        </div>
      ) : null}

      {status.realtimeEnabled && status.lastRealtimeError ? (
        <div className={styles.dangerPanel}>
          <strong>Realtime 通道异常</strong>
          <span>{status.lastRealtimeError}</span>
          {status.lastRealtimeErrorAt ? (
            <span className={styles.mutedText}>最近异常：{formatEpochMs(status.lastRealtimeErrorAt)}</span>
          ) : null}
        </div>
      ) : null}

      <div className={styles.metricsGrid}>
        {summaryItems.map((item) => (
          <div key={item.label} className={styles.metricCard}>
            <div className={styles.metricValue}>
              <StatusBadge label={item.label} variant={item.variant} />
            </div>
            <strong>{item.value}</strong>
            <span className={styles.metricLabel}>{item.meta}</span>
          </div>
        ))}
      </div>

      {status.realtimeEnabled ? (
        <>
          <div className={styles.stackText} style={{ marginTop: 16 }}>
            <strong>Realtime 控制通道</strong>
            <span className={styles.mutedText}>
              WebSocket 用于实时撤销和强制下线，heartbeat 仍是续租与真相兜底链路。
            </span>
          </div>
          <div className={styles.detailFieldGrid}>
            <Fact label="连接状态" value={realtimeStatusLabel} />
            <Fact label="最近连通" value={formatEpochMs(status.lastRealtimeConnectedAt)} />
            <Fact label="最近事件" value={formatRealtimeEventLabel(status.lastRealtimeEventKind)} />
            <Fact label="事件时间" value={formatEpochMs(status.lastRealtimeEventAt)} />
            <Fact label="最近事件 ID" value={status.lastRealtimeEventId || '—'} mono />
          </div>
        </>
      ) : null}
    </section>
  );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className={styles.detailCard}>
      <span className={styles.detailCardLabel}>{label}</span>
      <strong className={mono ? styles.mono : undefined}>{value}</strong>
    </div>
  );
}

function getRealtimeSummaryMeta(status: LicenseStatusRecord) {
  if (!status.realtimeEnabled) {
    return '当前实例只依赖 heartbeat 续租，不建立实时控制通道';
  }
  if (status.realtimeBlockedReason) {
    return '服务端已下发阻断事件，本地业务 gate 进入 fail-closed';
  }
  if (status.lastRealtimeConnectedAt) {
    return `最近连通 ${formatEpochRelative(status.lastRealtimeConnectedAt)}`;
  }
  switch (status.realtimeStatus) {
    case 'ready':
      return '当前 lease 有效，worker 会自动建立 WS 实时控制连接';
    case 'idle':
      return '当前没有可用 activation，realtime worker 保持空闲';
    case 'error':
      return '最近一次 realtime 连接或验签失败，worker 会自动重试';
    default:
      return '尚未建立实时控制连接';
  }
}

function formatRealtimeEventLabel(kind: string | null) {
  switch (kind) {
    case 'activation.replaced':
      return '激活已替换';
    case 'activation.revoked':
      return '激活已撤销';
    case 'license.expired':
      return '授权已过期';
    case 'license.suspended':
      return '授权已暂停';
    case null:
      return '—';
    default:
      return kind;
  }
}
