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
import { useMutation } from '@tanstack/react-query';
import { mfaApi } from '@fmby/v2-shared/contracts/auth';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import type { User } from '@fmby/v2-shared/types';
import { Field, SubmitButton } from './fields';
import styles from '../LoginPage.module.css';

interface MfaVerifyPanelProps {
  challenge: { challengeId: string; expiresAt: number | null };
  onAuthenticated: (user: User) => void;
  onCancel: () => void;
}

export function MfaVerifyPanel({ challenge, onAuthenticated, onCancel }: MfaVerifyPanelProps) {
  const [code, setCode] = useState('');
  const mutation = useMutation({
    // #289：verify 成功（后端已建会话）后**按契约补拉 /auth/me** 取真实 capabilities，
    // 不再由本面板自行拼 `capabilities: []`（那会让 MFA 后权限视图恒空且不自愈）。
    mutationFn: () => mfaApi.verifyForSession({ challengeId: challenge.challengeId, code }),
    onSuccess: (result) => {
      if (!result.verified) {
        // 后端 verified=false（码错）不抛错；诚实提示，不伪造成功。
        setLocalError('验证码不正确，请重试。');
        return;
      }
      if (!result.user) {
        // 会话已建但权限面拉不到（/auth/me 失败或主体不一致）：fail-closed，
        // 绝不带着空/伪造权限进入认证态。
        setLocalError('登录已通过，但权限信息获取失败，请重新登录。');
        return;
      }
      onAuthenticated(result.user);
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
