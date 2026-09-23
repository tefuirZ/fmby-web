/**
 * 设备流授权卡（照 V1 `DeviceFlowCard.tsx` 对位）：
 * 发起/重新发起 + 立即轮询 + 自动轮询开关 + 用户码/授权入口/过期/间隔 + 复制。
 */

import { useEffect, useState } from 'react';
import { Copy, ExternalLink, Play, RefreshCw } from 'lucide-react';
import {
  getLicensePollStatusLabel,
  type LicensePollStatus,
  type LicenseStatusRecord,
} from '@fmby/v2-shared/contracts/manage/license';
import { FieldError } from '@fmby/v2-shared/forms';
import { StatusBadge } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { copyToClipboard, formatEpochMs, safeExternalHref } from '../licenseFormat';
import styles from '../../longtail-shared/ManageShared.module.css';

interface DeviceFlowCardProps {
  status: LicenseStatusRecord;
  lastPollStatus: LicensePollStatus | null;
  autoPolling: boolean;
  startPending: boolean;
  pollPending: boolean;
  startError: unknown;
  pollError: unknown;
  onAutoPollingChange: (enabled: boolean) => void;
  onStart: () => void;
  onPoll: () => void;
}

export function DeviceFlowCard({
  status,
  lastPollStatus,
  autoPolling,
  startPending,
  pollPending,
  startError,
  pollError,
  onAutoPollingChange,
  onStart,
  onPoll,
}: DeviceFlowCardProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const flow = status.deviceFlow;
  const verificationUrl = flow?.verificationUriComplete ?? flow?.verificationUri ?? null;
  const safeVerificationUrl = safeExternalHref(verificationUrl);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 2200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  function copyText(value: string, label: string) {
    void copyToClipboard(value)
      .then(() => {
        setCopyError(null);
        setCopied(label);
      })
      .catch(() => setCopyError('复制失败，请手动选择文本。'));
  }

  return (
    <div className={styles.fieldGroup}>
      <div className={styles.rowActions}>
        <button
          className={styles.primaryButton}
          type="button"
          onClick={onStart}
          disabled={startPending}
        >
          <Play size={16} />
          {startPending ? '发起中...' : flow ? '重新发起 Device Flow' : '发起 Device Flow'}
        </button>
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={onPoll}
          disabled={!flow || pollPending}
        >
          <RefreshCw size={16} />
          {pollPending ? '轮询中...' : '立即轮询'}
        </button>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={autoPolling}
            onChange={(event) => onAutoPollingChange(event.target.checked)}
          />
          自动轮询
        </label>
      </div>

      {lastPollStatus ? (
        <div className={styles.rowActions}>
          <StatusBadge
            label={getLicensePollStatusLabel(lastPollStatus)}
            variant={
              lastPollStatus === 'authorized'
                ? 'success'
                : lastPollStatus === 'pending'
                  ? 'warning'
                  : 'danger'
            }
          />
          <span className={styles.mutedText}>授权服务轮询状态：{lastPollStatus}</span>
        </div>
      ) : null}

      {copied ? <FieldError hint={`${copied} 已复制。`} /> : null}
      {copyError ? <div className={styles.dangerPanel}>{copyError}</div> : null}

      {startError ? <div className={styles.dangerPanel}>{getErrorMessage(startError)}</div> : null}
      {pollError ? <div className={styles.dangerPanel}>{getErrorMessage(pollError)}</div> : null}

      {flow ? (
        <div className={styles.fieldGroup}>
          <div className={styles.detailCard}>
            <span className={styles.mutedText}>用户码</span>
            <strong className={styles.mono}>{flow.userCode}</strong>
            <button
              className={styles.smallButton}
              type="button"
              onClick={() => copyText(flow.userCode, '用户码')}
            >
              <Copy size={14} />
              复制用户码
            </button>
          </div>

          <div className={styles.detailFieldGrid}>
            <div className={styles.detailCard}>
              <span className={styles.detailCardLabel}>Device Code</span>
              <strong className={styles.mono}>{flow.deviceCode}</strong>
            </div>
            <div className={styles.detailCard}>
              <span className={styles.detailCardLabel}>授权入口</span>
              {safeVerificationUrl ? (
                <a href={safeVerificationUrl} target="_blank" rel="noopener noreferrer">
                  {verificationUrl}
                  <ExternalLink size={14} />
                </a>
              ) : (
                <span className={styles.mutedText}>未提供</span>
              )}
            </div>
            <div className={styles.detailCard}>
              <span className={styles.detailCardLabel}>过期时间</span>
              <strong>{formatEpochMs(flow.expiresAt)}</strong>
            </div>
            <div className={styles.detailCard}>
              <span className={styles.detailCardLabel}>轮询间隔</span>
              <strong>{flow.pollIntervalSecs ?? 5} 秒</strong>
            </div>
          </div>
          {verificationUrl ? (
            <div className={styles.rowActions}>
              <button
                className={styles.smallButton}
                type="button"
                onClick={() => copyText(verificationUrl, '授权入口')}
              >
                <Copy size={14} />
                复制授权入口
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className={styles.emptyInlineState}>当前没有进行中的 Device Flow。</div>
      )}
    </div>
  );
}
