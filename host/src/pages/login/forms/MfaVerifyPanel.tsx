/**
 * 登录二因子验证面板（FE-MFA-TOTP-UI）。
 *
 * 后端语义：密码正确但需二因子 ⇒ `status="mfa_required"` + `challenge_id`（**未建会话**，
 * 无 cookie）。本面板把 TOTP 码 POST 到 `/api/auth/mfa/totp/verify`；成功后由后端
 * 建会话 → 走既有 `onAuthenticated` 完成导航。
 *
 * 错误口径：不吞后端拒绝原因（challenge 过期/码错，均展示后端 message 原文）；
 * 过期仅提示重新登录（challenge 无刷新语义）。
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { mfaApi, SESSION_USERNAME_STORAGE_KEY } from '@fmby/v2-shared/contracts/auth';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import type { User } from '@fmby/v2-shared/types';
import { useSession } from '@/session';
import { Field, SubmitButton } from './fields';
import styles from '../LoginPage.module.css';

interface MfaVerifyPanelProps {
  challenge: { challengeId: string; expiresAt: number | null };
  onAuthenticated: (user: User) => void;
  onCancel: () => void;
}

export function MfaVerifyPanel({ challenge, onAuthenticated, onCancel }: MfaVerifyPanelProps) {
  const [code, setCode] = useState('');
  // 登录时已缓存用户名（authApi.login persistSessionUsername 同源语义）。
  const cachedUsername =
    typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem(SESSION_USERNAME_STORAGE_KEY)
      : null;

  const mutation = useMutation({
    mutationFn: () => mfaApi.verify({ challengeId: challenge.challengeId, code }),
    onSuccess: (result) => {
      if (!result.verified) {
        // 后端 verified=false（码错）不抛错；诚实提示，不伪造成功。
        setLocalError('验证码不正确，请重试。');
        return;
      }
      // 会话已由后端建立（cookie 已下发）。capabilities 由既有 restore 流经
      // /auth/me fail-closed 补齐——与 authApi.login 同口径，不从用户名推断。
      onAuthenticated({
        id: String(result.userId),
        name: cachedUsername,
        display_name: cachedUsername,
        roles: [],
        capabilities: [],
      });
    },
  });

  const [localError, setLocalError] = useState<string | null>(null);

  const expired =
    challenge.expiresAt !== null && Date.now() > challenge.expiresAt;

  return (
    <section aria-label="两步验证">
      <h1 className={styles.pageTitle}>两步验证</h1>
      <p className={styles.pageDescription}>
        请输入认证器 App 中的 6 位动态码完成登录。
      </p>

      {expired ? (
        <div className={styles.errorBanner} role="alert">
          验证会话已过期，请返回重新登录。
        </div>
      ) : null}

      {mutation.isError ? (
        <div className={styles.errorBanner} role="alert">
          {getErrorMessage(mutation.error)}
        </div>
      ) : null}
      {localError ? (
        <div className={styles.errorBanner} role="alert">
          {localError}
        </div>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          setLocalError(null);
          mutation.mutate();
        }}
      >
        <Field label="动态验证码" error={undefined}>
          {(inputId) => (
            <input
              id={inputId}
              className={styles.input}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              disabled={mutation.isPending || expired}
              onChange={(event) => setCode(event.target.value)}
            />
          )}
        </Field>
        <div className={styles.buttonRow}>
          <SubmitButton
            pending={mutation.isPending || expired}
            pendingText="正在验证…"
            text="验证并登录"
          />
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={onCancel}
            disabled={mutation.isPending}
          >
            返回登录
          </button>
        </div>
      </form>
    </section>
  );
}
