/**
 * 账号 MFA/TOTP 自助管理（FE-MFA-TOTP-UI）。
 *
 * 后端：`/api/auth/mfa/totp` GET/POST/DELETE + `/confirm` + `/recovery-codes`
 * （`routes/auth_mfa.rs`；登录态自助面，非站点级设置——放安全区作入口）。
 *
 * 流程：状态 → （未启用）绑定 en QR → 输码 confirm → ★恢复码一次性展示；
 * （已启用）再生成恢复码 / 停用（需当前密码）。
 *
 * 恢复码纪律：一次性明文仅本响应；**只在内存态展示**（不落 localStorage/URL、
 * 不写 draft），展示后需用户确认已保存才关闭。
 *
 * 错误口径：展示后端 message 原文（不吞拒绝原因、不造文案）。
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mfaApi } from '@fmby/v2-shared/contracts/auth';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { ManageSectionCard } from '../../longtail-shared/components';
import styles from '../../longtail-shared/ManageShared.module.css';
import { queryKeys } from '@fmby/v2-shared/query';

export function MfaTotpSection() {
  const queryClient = useQueryClient();
  const statusQuery = useQuery({
    queryKey: queryKeys.auth.mfaStatus(),
    queryFn: () => mfaApi.status(),
  });

  const [enrollment, setEnrollment] = useState<{
    secret: string;
    otpauthUrl: string;
    qrImageDataUrl: string | null;
  } | null>(null);
  const [confirmCode, setConfirmCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [recoveryAcknowledged, setRecoveryAcknowledged] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableOpen, setDisableOpen] = useState(false);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.auth.mfa() });
  };

  const enrollMutation = useMutation({
    mutationFn: () => mfaApi.enroll(),
    onSuccess: (data) => setEnrollment(data),
  });

  const confirmMutation = useMutation({
    mutationFn: (code: string) => mfaApi.confirm({ code }),
    onSuccess: (data) => {
      setEnrollment(null);
      setConfirmCode('');
      setRecoveryCodes(data.recoveryCodes);
      setRecoveryAcknowledged(false);
      invalidate();
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: () => mfaApi.regenerateRecoveryCodes(),
    onSuccess: (data) => {
      setRecoveryCodes(data.recoveryCodes);
      setRecoveryAcknowledged(false);
      invalidate();
    },
  });

  const disableMutation = useMutation({
    mutationFn: (currentPassword: string) => mfaApi.disable({ currentPassword }),
    onSuccess: () => {
      setDisableOpen(false);
      setDisablePassword('');
      invalidate();
    },
  });

  const status = statusQuery.data;

  if (statusQuery.isPending) {
    return (
      <ManageSectionCard title="两步验证（TOTP）" description="正在读取当前绑定状态…">
        <p className={styles.mutedText}>加载中…</p>
      </ManageSectionCard>
    );
  }

  if (statusQuery.isError) {
    return (
      <ManageSectionCard title="两步验证（TOTP）" description="读取失败。">
        <div role="alert" className={styles.mutedText}>
          {getErrorMessage(statusQuery.error)}
        </div>
      </ManageSectionCard>
    );
  }

  const enabled = status?.enabled ?? false;
  const pending = status?.pendingConfirmation ?? false;

  // ★恢复码一次性展示：确认已保存后才允许关闭；不落任何持久层。
  if (recoveryCodes) {
    return (
      <ManageSectionCard
        title="两步验证（TOTP）— 恢复码"
        description="请立即把恢复码保存到密码管理器或离线处。每个恢复码只能使用一次，关闭本面板后不再显示。"
      >
        <pre className={styles.mutedText} aria-label="恢复码">
          {recoveryCodes.join('\n')}
        </pre>
        <label className={styles.checkboxRow}>
          <input
            className={styles.checkbox}
            type="checkbox"
            checked={recoveryAcknowledged}
            onChange={(event) => setRecoveryAcknowledged(event.target.checked)}
          />
          我已保存恢复码，理解关闭后无法再次查看
        </label>
        <button
          className={styles.primaryButton}
          type="button"
          disabled={!recoveryAcknowledged}
          onClick={() => {
            setRecoveryCodes(null);
            setRecoveryAcknowledged(false);
          }}
        >
          已保存，关闭
        </button>
      </ManageSectionCard>
    );
  }

  return (
    <ManageSectionCard
      title="两步验证（TOTP）"
      description={
        enabled
          ? `已启用。剩余恢复码 ${status?.recoveryCodesRemaining ?? 0} 个。`
          : '未启用。绑定认证器后，登录需输入动态验证码。'
      }
    >
      {pending ? (
        <div className={styles.mutedText} role="status">
          有未完成的绑定（待输码确认）；继续输入验证码或停用后重来。
        </div>
      ) : null}

      {!enabled || pending ? (
        <>
          {enrollment ? (
            <>
              {enrollment.qrImageDataUrl ? (
                <img
                  src={enrollment.qrImageDataUrl}
                  alt="TOTP 绑定二维码"
                  className={styles.readonlyField}
                />
              ) : null}
              <label className={styles.label}>
                密钥（手动录入用）
                <input className={styles.input} readOnly value={enrollment.secret} />
              </label>
              <label className={styles.label}>
                输入认证器显示的 6 位动态码完成绑定
                <input
                  className={styles.input}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={confirmCode}
                  onChange={(event) => setConfirmCode(event.target.value)}
                />
              </label>
              {confirmMutation.isError ? (
                <div role="alert" className={styles.mutedText}>
                  {getErrorMessage(confirmMutation.error)}
                </div>
              ) : null}
              <button
                className={styles.primaryButton}
                type="button"
                disabled={confirmMutation.isPending || confirmCode.trim() === ''}
                onClick={() => confirmMutation.mutate(confirmCode.trim())}
              >
                {confirmMutation.isPending ? '确认中…' : '确认绑定'}
              </button>
            </>
          ) : (
            <>
              {enrollMutation.isError ? (
                <div role="alert" className={styles.mutedText}>
                  {getErrorMessage(enrollMutation.error)}
                </div>
              ) : null}
              <button
                className={styles.primaryButton}
                type="button"
                disabled={enrollMutation.isPending}
                onClick={() => enrollMutation.mutate()}
              >
                {enrollMutation.isPending ? '生成中…' : '开始绑定'}
              </button>
            </>
          )}
        </>
      ) : (
        <>
          {regenerateMutation.isError ? (
            <div role="alert" className={styles.mutedText}>
              {getErrorMessage(regenerateMutation.error)}
            </div>
          ) : null}
          <button
            className={styles.secondaryButton}
            type="button"
            disabled={regenerateMutation.isPending}
            onClick={() => regenerateMutation.mutate()}
          >
            重新生成恢复码
          </button>

          {disableOpen ? (
            <>
              {disableMutation.isError ? (
                <div role="alert" className={styles.mutedText}>
                  {getErrorMessage(disableMutation.error)}
                </div>
              ) : null}
              <label className={styles.label}>
                当前密码（确认停用）
                <input
                  className={styles.input}
                  type="password"
                  autoComplete="current-password"
                  value={disablePassword}
                  onChange={(event) => setDisablePassword(event.target.value)}
                />
              </label>
              <div className={styles.buttonRow}>
                <button
                  className={styles.dangerButton}
                  type="button"
                  disabled={disableMutation.isPending || disablePassword === ''}
                  onClick={() => disableMutation.mutate(disablePassword)}
                >
                  {disableMutation.isPending ? '停用中…' : '确认停用'}
                </button>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => {
                    setDisableOpen(false);
                    setDisablePassword('');
                  }}
                >
                  取消
                </button>
              </div>
            </>
          ) : (
            <button
              className={styles.dangerButton}
              type="button"
              onClick={() => setDisableOpen(true)}
            >
              停用两步验证
            </button>
          )}
        </>
      )}
    </ManageSectionCard>
  );
}
