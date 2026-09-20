/**
 * 第三方登录入口面板 —— 消费 `identityLoginApi`（THIRDPARTY-LOGIN-FLOW 前端面）。
 *
 * 能力面（如实呈现，不假装成功）：
 * - **Google**：`start` 返回 `authorizeUrl` ⇒ 浏览器跳转授权；回站由 `LoginPage`
 *   读 URL 参数（`identity_provider`/`state`/`code`）经 `/callback` 捕获后完成。
 * - **Telegram**：`start` 返回深链（`authorizeUrl`）；`LoginPage` 打开新窗口并轮询
 *   `login/status`。后端该面当前恒 503 ⇒ 错误**原样呈现**，不假装可用。
 * - **Email**：`start` 需邮箱；后端发信面未装配时返 503 ⇒ 错误**原样呈现**。
 *
 * 后端未装配（503/500）或列表为空时不渲染入口（不产出「可用」假象）。
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { identityLoginApi } from '@fmby/v2-shared/contracts/auth';
import type {
  IdentityLoginStart,
  IdentityProviderAvailability,
} from '@fmby/v2-shared/contracts/auth';
import { getErrorMessage } from '@fmby/v2-shared/errors';

import styles from '../LoginPage.module.css';
import { rememberPendingIdentity } from './identityPendingContext';

interface IdentityLoginPanelProps {
  providers: IdentityProviderAvailability[];
  /** 发起成功后的回调（LoginPage 据此进入下一步：跳转授权 / 轮询 / 输入验证码）。 */
  onStarted: (provider: IdentityProviderAvailability, result: IdentityLoginStart) => void;
}

/** provider 图标字形（纯文本标记，不引外部资源）。 */
function providerMark(provider: string): string {
  if (provider === 'google') return 'G';
  if (provider === 'telegram') return 'TG';
  if (provider === 'email') return '@';
  return provider.slice(0, 2).toUpperCase();
}

export function IdentityLoginPanel({ providers, onStarted }: IdentityLoginPanelProps) {
  const [email, setEmail] = useState('');
  const [emailOpen, setEmailOpen] = useState(false);

  const startMutation = useMutation({
    mutationFn: (provider: IdentityProviderAvailability) =>
      identityLoginApi
        .start(provider.provider, {
          email: provider.provider === 'email' ? email.trim() : undefined,
          // **不传 redirect_uri**：V2 后端的 `start_oauth` 会用入参**覆盖**配置面
          // `redirect_uri`（与 V1 忽略入参不同），而 Google 要求回调 URL 与注册值
          // **严格一致**——擅自传递会导致 `redirect_uri_mismatch`。故交由后端用
          // 配置面已登记的值；前端改用 sessionStorage 按 `state`(=challenge_id)
          // 反查 provider（见 `identityPendingContext.ts`），无需注册带 query 的 URL。
        })
        .then((result) => ({ provider, result })),
    onSuccess: ({ provider, result }) => {
      // 跳转/轮询前记住发起上下文：OAuth 回站只带 `state`(=challenge_id)，
      // 借此反查 provider。
      rememberPendingIdentity({ challengeId: result.challengeId, provider: provider.provider });
      onStarted(provider, result);
    },
  });

  const pendingProvider = startMutation.isPending
    ? (startMutation.variables?.provider ?? null)
    : null;

  if (providers.length === 0) {
    // 无任何就绪 provider：不渲染分隔线与按钮（不伪造可用入口）。
    return null;
  }

  const nonEmail = providers.filter((provider) => provider.provider !== 'email');
  const hasEmail = providers.some((provider) => provider.provider === 'email');

  return (
    <div className={styles.identityPanel} aria-label="第三方登录">
      <div className={styles.identityDivider} aria-hidden="true">
        <span />
        <small>或使用第三方账号</small>
        <span />
      </div>

      {startMutation.error ? (
        <div className={styles.errorBanner} role="alert">
          {getErrorMessage(startMutation.error)}
        </div>
      ) : null}

      <div className={styles.identityButtonList}>
        {nonEmail.map((provider) => (
          <button
            key={provider.provider}
            type="button"
            className={styles.identityButton}
            disabled={startMutation.isPending}
            aria-label={`使用 ${provider.displayName} 登录`}
            onClick={() => startMutation.mutate(provider)}
          >
            <span className={styles.identityButtonMark} aria-hidden="true">
              {pendingProvider === provider.provider ? '…' : providerMark(provider.provider)}
            </span>
            <span>{provider.displayName}</span>
          </button>
        ))}
        {hasEmail ? (
          <button
            type="button"
            className={styles.identityButton}
            disabled={startMutation.isPending}
            aria-expanded={emailOpen}
            aria-label="使用邮箱登录"
            onClick={() => setEmailOpen((open) => !open)}
          >
            <span className={styles.identityButtonMark} aria-hidden="true">
              {pendingProvider === 'email' ? '…' : providerMark('email')}
            </span>
            <span>邮箱登录</span>
          </button>
        ) : null}
      </div>

      {hasEmail && emailOpen ? (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            const emailProvider = providers.find((provider) => provider.provider === 'email');
            if (emailProvider && email.trim()) {
              startMutation.mutate(emailProvider);
            }
          }}
          noValidate
        >
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="identity-login-email">
              登录邮箱
            </label>
            <div className={styles.inputWrapper}>
              <input
                id="identity-login-email"
                className={styles.input}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="请输入已绑定邮箱"
              />
            </div>
            <span className={styles.fieldHint}>仅已绑定站内账号的邮箱可登录。</span>
          </div>
          <button
            type="submit"
            className={styles.submitButton}
            disabled={startMutation.isPending || email.trim().length === 0}
          >
            {startMutation.isPending ? '发起中…' : '发送登录验证码'}
          </button>
        </form>
      ) : null}
    </div>
  );
}
