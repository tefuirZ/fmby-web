import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

import { settingsApi } from '@/domains/settings/api';
import type { SensitiveActionConfirmation } from '@/domains/settings/types';
import type { DangerousActionRequest } from '@/domains/manage';
import { queryKeys } from '@/shared/query-keys';

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
              请输入操作标识 <code>{actionKey}</code>，后端会按当前管理会话再次校验，不再只认一个固定弹窗。
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
              请输入当前登录账号密码，危险操作不会再只靠前端弹窗自己拍脑袋通过。
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
