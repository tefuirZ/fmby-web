/**
 * 三方登录「完成阶段」面板 —— 承载发起后的分支：
 *
 * - **Email**：输入验证码 → `complete`（`verification_code`）；
 * - **Telegram**：打开深链 + 轮询 `login/status`，`verified` 后自动 `complete`；
 * - **Google 回流**：`LoginPage` 捕获 `/callback` 后传入 challenge，自动 `complete`；
 * - **MFA**：`complete` 返回 `mfa_required` 时**如实提示需二因子**——
 *   当前前端无 TOTP 输入面（全仓零 MFA UI），故**明确告知用户去已完成二因子的
 *   客户端/管理端操作，或联系管理员重置**，绝不假装登录成功。
 *
 * 失败态（含后端 503「通道未接线」）一律经 `getErrorMessage` 原样呈现。
 */

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { identityLoginApi } from '@fmby/v2-shared/contracts/auth';
import type {
  IdentityLoginStart,
  IdentityProviderType,
} from '@fmby/v2-shared/contracts/auth';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import type { User } from '@fmby/v2-shared/types';

import styles from '../LoginPage.module.css';

/** 待完成的登录流状态（发起成功后进入）。 */
export interface PendingIdentityLogin {
  provider: IdentityProviderType;
  challengeId: string;
  action: string;
  authorizeUrl?: string;
  completionToken?: string;
  message?: string;
  /** `callback` 回流时携带的 code（Google 自动完成用）。 */
  suggestedCode?: string;
  /** 来源：`start`（用户主动发起）或 `callback`（OAuth 回站）。 */
  source: 'start' | 'callback';
}

interface IdentityCompletionPanelProps {
  pending: PendingIdentityLogin;
  onAuthenticated: (user: User) => void;
  onBack: () => void;
}

/** Telegram 轮询间隔（与 V1 一致）。 */
const TELEGRAM_POLL_INTERVAL_MS = 1500;

export function IdentityCompletionPanel({
  pending,
  onAuthenticated,
  onBack,
}: IdentityCompletionPanelProps) {
  const [code, setCode] = useState(pending.suggestedCode ?? '');
  const [mfaNotice, setMfaNotice] = useState<string | null>(null);
  const autoCompleteStartedFor = useRef<string | null>(null);

  const telegramAutoLogin =
    pending.provider === 'telegram' && Boolean(pending.completionToken);

  const completeMutation = useMutation({
    mutationFn: (input: { code?: string }) =>
      identityLoginApi.complete(pending.provider, {
        challengeId: pending.challengeId,
        code: input.code,
        verificationCode: pending.provider === 'email' ? input.code : undefined,
      }),
    onSuccess: (result) => {
      if (result.status === 'mfa_required') {
        // ★不建会话：如实提示，绝不置登录态。
        setMfaNotice(
          '该账号已启用二因子（TOTP），需先完成动态验证码校验。当前版本尚未提供二因子输入界面，请在本站已通过二因子校验的设备上完成登录，或联系管理员。',
        );
        return;
      }
      onAuthenticated(result.user);
    },
  });

  const telegramStatusQuery = useQuery({
    queryKey: ['identity', 'telegram-login-status', pending.challengeId],
    queryFn: () =>
      identityLoginApi.telegramStatus({
        challengeId: pending.challengeId,
        completionToken: pending.completionToken ?? '',
      }),
    enabled: telegramAutoLogin,
    refetchInterval: TELEGRAM_POLL_INTERVAL_MS,
    retry: false,
  });

  // 轮询确认后自动完成（一次性；防重复触发）。
  useEffect(() => {
    if (
      !telegramAutoLogin ||
      !telegramStatusQuery.data?.verified ||
      completeMutation.isPending ||
      autoCompleteStartedFor.current === pending.challengeId
    ) {
      return;
    }
    autoCompleteStartedFor.current = pending.challengeId;
    completeMutation.mutate({});
  }, [
    telegramAutoLogin,
    telegramStatusQuery.data?.verified,
    completeMutation,
    pending.challengeId,
  ]);

  // Google callback 回流：带上 code 自动完成一次。
  useEffect(() => {
    if (
      pending.source !== 'callback' ||
      pending.provider !== 'google' ||
      !pending.suggestedCode ||
      autoCompleteStartedFor.current === pending.challengeId
    ) {
      return;
    }
    autoCompleteStartedFor.current = pending.challengeId;
    completeMutation.mutate({ code: pending.suggestedCode });
  }, [pending, completeMutation]);

  const needsCode =
    !telegramAutoLogin && pending.provider === 'email' && pending.action === 'enter_code';
  const googleRedirecting =
    pending.provider === 'google' &&
    pending.source === 'start' &&
    Boolean(pending.authorizeUrl);
  const error = completeMutation.error ?? telegramStatusQuery.error;

  return (
    <div className={styles.identityPanel}>
      {mfaNotice ? (
        <div className={styles.successBanner} role="status">
          {mfaNotice}
        </div>
      ) : (
        <div className={styles.fieldHint}>
          {pending.message ?? '三方登录已发起。'}
        </div>
      )}

      {error ? (
        <div className={styles.errorBanner} role="alert">
          {getErrorMessage(error)}
        </div>
      ) : null}

      {googleRedirecting ? (
        <a
          className={styles.submitButton}
          href={pending.authorizeUrl}
          rel="noreferrer"
          target="_self"
        >
          前往 Google 授权
        </a>
      ) : null}

      {telegramAutoLogin ? (
        <div className={styles.fieldHint} role="status">
          {telegramStatusQuery.data?.verified
            ? 'Telegram 身份已确认，正在登录…'
            : '请在 Telegram 中确认身份，本页会自动继续。'}
        </div>
      ) : null}

      {telegramAutoLogin && pending.authorizeUrl ? (
        <a
          className={styles.secondaryButton}
          href={pending.authorizeUrl}
          rel="noreferrer"
          target="_blank"
        >
          打开 Telegram Bot
        </a>
      ) : null}

      {needsCode ? (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            if (code.trim()) completeMutation.mutate({ code: code.trim() });
          }}
          noValidate
        >
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="identity-login-code">
              邮箱验证码
            </label>
            <div className={styles.inputWrapper}>
              <input
                id="identity-login-code"
                className={styles.input}
                autoComplete="one-time-code"
                inputMode="numeric"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="请输入邮件中的验证码"
              />
            </div>
          </div>
          <button
            type="submit"
            className={styles.submitButton}
            disabled={completeMutation.isPending || code.trim().length === 0}
          >
            {completeMutation.isPending ? '完成中…' : '完成登录'}
          </button>
        </form>
      ) : null}

      {!mfaNotice ? (
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onBack}
          disabled={completeMutation.isPending}
        >
          返回账号登录
        </button>
      ) : null}
    </div>
  );
}

/** 由 start 结果构造待完成状态。 */
export function pendingFromStart(result: IdentityLoginStart): PendingIdentityLogin {
  return {
    provider: result.provider,
    challengeId: result.challengeId,
    action: result.action,
    authorizeUrl: result.authorizeUrl,
    completionToken: result.completionToken,
    message: result.message,
    source: 'start',
  };
}
