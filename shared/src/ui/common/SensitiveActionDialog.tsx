import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

import { settingsApi } from '@fmby/v2-shared/contracts/settings/api';
import type { SensitiveActionConfirmation } from '@fmby/v2-shared/contracts/settings/types';
import type { DangerousActionRequest } from '@fmby/v2-shared/contracts/manage';
import { queryKeys } from '@fmby/v2-shared/query';

import { ConfirmDialog } from './ConfirmDialog';
import styles from './SensitiveActionDialog.module.css';

interface SensitiveActionDialogProps {
  open: boolean;
  actionKey: string;
  title: string;
  description: string;
  impact?: string | string[];
  errorMessage?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  extraConfirmDisabled?: boolean;
  children?: ReactNode;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: DangerousActionRequest) => void;
}

export function SensitiveActionDialog({
  open,
  actionKey,
  title,
  description,
  impact,
  errorMessage,
  confirmLabel,
  cancelLabel,
  extraConfirmDisabled = false,
  children,
  pending = false,
  onOpenChange,
  onConfirm,
}: SensitiveActionDialogProps) {
  const [sessionConfirmation, setSessionConfirmation] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');

  const securityQuery = useQuery({
    queryKey: queryKeys.settings.server.security(),
    queryFn: () => settingsApi.getServerSecurity(),
    enabled: open,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!open) {
      setSessionConfirmation('');
      setCurrentPassword('');
    }
  }, [open]);

  const confirmationMode: SensitiveActionConfirmation =
    securityQuery.data?.sensitiveActionConfirmation ?? 'session';
  const queryErrorMessage = securityQuery.isError
    ? '敏感操作确认策略加载失败，请先重试。'
    : undefined;

  const confirmDisabled =
    pending ||
    extraConfirmDisabled ||
    securityQuery.isPending ||
    securityQuery.isError ||
    (confirmationMode === 'session' &&
      sessionConfirmation.trim().toLowerCase() !== actionKey.toLowerCase()) ||
    (confirmationMode === 'password' && currentPassword.length === 0);

  return (
    <ConfirmDialog
      open={open}
      title={title}
      description={description}
      impact={impact}
      errorMessage={errorMessage ?? queryErrorMessage}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      confirmDisabled={confirmDisabled}
      onOpenChange={onOpenChange}
      onConfirm={() =>
        onConfirm({
          confirmAction: actionKey,
          sessionConfirmation:
            confirmationMode === 'session'
              ? sessionConfirmation.trim()
              : undefined,
          currentPassword:
            confirmationMode === 'password' ? currentPassword : undefined,
        })
      }
      pending={pending}
    >
      <div className={styles.stack}>
        {securityQuery.isPending ? (
          <div className={styles.hintBox}>正在读取当前敏感操作确认策略…</div>
        ) : null}

        {!securityQuery.isPending && confirmationMode === 'session' ? (
          <>
            <div className={styles.hintBox}>
              <strong className={styles.hintTitle}>当前策略：会话级二次确认</strong>
              {/* ★FE-LIAR-TEXT：旧文案向用户承诺服务端会复核该输入 —— 实际
                 session_confirmation 后端接受但不校验（有意设计，2026-09-19 裁定）。
                 如实说：这是防误触确认，不是安全步进。 */}
              这是提交前的防误触确认：请输入操作标识 <code>{actionKey}</code>，
              以示你了解本次操作的影响。提交后服务端按既有权限直接执行，不会对本输入做额外校验。
            </div>
            <label className={styles.field}>
              <span className={styles.label}>操作标识</span>
              <input
                className={styles.input}
                type="text"
                autoComplete="off"
                value={sessionConfirmation}
                onChange={(event) => setSessionConfirmation(event.target.value)}
                placeholder={actionKey}
              />
              <span className={styles.helpText}>
                必须完整输入 <code>{actionKey}</code> 才能继续。
              </span>
            </label>
          </>
        ) : null}

        {!securityQuery.isPending && confirmationMode === 'password' ? (
          <>
            <div className={styles.hintBox}>
              <strong className={styles.hintTitle}>当前策略：密码确认</strong>
              这是提交前的防误触确认：请输入当前登录账号密码以示确认；
              服务端按既有权限直接执行，不会用本输入做身份再校验。
            </div>
            <label className={styles.field}>
              <span className={styles.label}>当前密码</span>
              <input
                className={styles.input}
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="请输入当前密码"
              />
            </label>
          </>
        ) : null}

        {children}
      </div>
    </ConfirmDialog>
  );
}
