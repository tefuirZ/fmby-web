/**
 * 登录页面（aurora-glass）
 *
 * 全屏 aurora 渐变背景，中心玻璃拟态卡片。
 * 支持三种入口：
 * 1. 常规登录
 * 2. 注册码注册（entry status 的 registration_enabled 控制）
 * 3. 首次初始化创建管理员
 *
 * V1F 拆分：三个表单与通用字段已抽到 ./forms/*（纯结构搬迁）。
 */

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import clsx from 'clsx';

import { useSession } from '@/session';
import { authApi, identityLoginApi } from '@fmby/v2-shared/contracts/auth';
import type {
  IdentityProviderAvailability,
  IdentityProviderType,
} from '@fmby/v2-shared/contracts/auth';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { queryKeys } from '@fmby/v2-shared/query';
import type { User } from '@fmby/v2-shared/types';

import styles from './LoginPage.module.css';
type EntryMode = 'login' | 'register';

import { LoginForm } from './forms/LoginForm';
import { RegisterForm } from './forms/RegisterForm';
import { SetupForm } from './forms/SetupForm';
import { IdentityLoginPanel } from './forms/IdentityLoginPanel';
import {
  IdentityCompletionPanel,
  pendingFromStart,
  type PendingIdentityLogin,
} from './forms/IdentityCompletionPanel';
import { clearPendingIdentity, resolvePendingProvider } from './forms/identityPendingContext';

function LoginShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={styles.auroraLayer} aria-hidden="true" />
      <div className={styles.card}>
        <h1 className={styles.brand}>FMBY</h1>
        {children}
      </div>
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useSession();
  const [mode, setMode] = useState<EntryMode>('login');
  const [registrationNotice, setRegistrationNotice] = useState<string | null>(null);
  const [pendingIdentity, setPendingIdentity] = useState<PendingIdentityLogin | null>(null);

  const entryQuery = useQuery({
    queryKey: queryKeys.auth.setupStatus(),
    queryFn: () => authApi.getSetupStatus(),
    retry: 2,
  });

  // 公开 provider 可用性（免会话）。失败时**不渲染入口**（不伪造可用）。
  const providersQuery = useQuery({
    queryKey: ['identity', 'login-providers'],
    queryFn: () => identityLoginApi.loginReadyProviders(),
    retry: false,
  });

  const needsSetup = entryQuery.data?.needs_setup ?? false;
  const registrationEnabled =
    !needsSetup && (entryQuery.data?.registration_enabled ?? false);

  useEffect(() => {
    if (!registrationEnabled && mode === 'register') {
      setMode('login');
    }
  }, [mode, registrationEnabled]);

  // OAuth 回调回流：Google 只回 append `code`/`state`（state=challenge_id），
  // **不回** provider。故先看 URL 是否显式带 `identity_provider`，否则用发起时
  // 存入 sessionStorage 的上下文按 `state` 反查。
  const callbackStateParam = searchParams.get('state');
  const callbackChallengeId =
    searchParams.get('challenge_id') ?? searchParams.get('challengeId') ?? callbackStateParam;
  const callbackCode = searchParams.get('code');
  const callbackProvider =
    (searchParams.get('identity_provider') as IdentityProviderType | null) ??
    (callbackChallengeId ? resolvePendingProvider(callbackChallengeId) : undefined);
  const callbackCaptureQuery = useQuery({
    queryKey: ['identity', 'callback', callbackProvider, callbackChallengeId, callbackCode],
    enabled: Boolean(callbackProvider && callbackChallengeId),
    retry: false,
    queryFn: () =>
      identityLoginApi.captureCallback(callbackProvider as IdentityProviderType, {
        challengeId: callbackChallengeId ?? undefined,
        code: callbackCode ?? undefined,
        state: callbackStateParam ?? undefined,
      }),
  });

  useEffect(() => {
    const captured = callbackCaptureQuery.data;
    if (!captured) {
      return;
    }
    // 回调捕获成功 → 进入完成阶段；Google 携 code 自动完成，其余等用户输入/轮询。
    setPendingIdentity({
      provider: captured.provider,
      challengeId: captured.challengeId,
      action: captured.provider === 'google' ? 'external_callback' : 'enter_code',
      message: captured.message,
      suggestedCode: callbackCode ?? undefined,
      source: 'callback',
    });
  }, [callbackCaptureQuery.data, callbackCode]);

  function handleIdentityStarted(
    provider: IdentityProviderAvailability,
    result: Awaited<ReturnType<typeof identityLoginApi.start>>,
  ) {
    // Google：start 的 authorizeUrl 需浏览器跳转授权，不在站内展示完成面板。
    if (provider.provider === 'google' && result.authorizeUrl) {
      window.location.assign(result.authorizeUrl);
      return;
    }
    setPendingIdentity(pendingFromStart(result));
  }

  function handleAuthenticated(user: User) {
    clearPendingIdentity();
    login(user);
    const from = getSafeRedirectPath(searchParams.get('from'));
    navigate(from, { replace: true });
  }

  function handlePendingApproval(message: string) {
    setRegistrationNotice(message);
    setMode('login');
  }

  function handleSwitchMode(nextMode: EntryMode) {
    setRegistrationNotice(null);
    setMode(nextMode);
  }

  if (entryQuery.isLoading) {
    return (
      <LoginShell>
        <div className={styles.loading}>
          <Loader2 size={32} className={styles.spinner} />
        </div>
      </LoginShell>
    );
  }

  if (entryQuery.isError) {
    return (
      <LoginShell>
        <div className={styles.retryContainer}>
          <div className={styles.errorBanner} role="alert">
            无法连接到服务器，请检查网络连接
          </div>
          <button
            type="button"
            className={styles.submitButton}
            onClick={() => entryQuery.refetch()}
          >
            重试
          </button>
        </div>
      </LoginShell>
    );
  }

  return (
    <LoginShell>
      <p className={styles.subtitle}>
        {needsSetup
          ? '创建管理员账户以开始使用'
          : mode === 'register'
            ? '输入有效注册码，完成账号创建并接入默认权限'
            : registrationEnabled
              ? '使用已有账号登录，或切换到注册码注册'
              : '登录以继续'}
      </p>

      {registrationNotice ? (
        <div className={styles.successBanner} role="status">
          {registrationNotice}
        </div>
      ) : null}

      {!needsSetup && registrationEnabled ? (
        <div className={styles.modeSwitch} aria-label="认证入口模式切换">
          <button
            type="button"
            className={clsx(
              styles.modeButton,
              mode === 'login' && styles.modeButtonActive,
            )}
            onClick={() => handleSwitchMode('login')}
          >
            账号登录
          </button>
          <button
            type="button"
            className={clsx(
              styles.modeButton,
              mode === 'register' && styles.modeButtonActive,
            )}
            onClick={() => handleSwitchMode('register')}
          >
            注册码注册
          </button>
        </div>
      ) : null}

      {needsSetup ? (
        <SetupForm
          onSetupCompleted={(username) => {
            setMode('login');
            setRegistrationNotice(`管理员 ${username} 创建成功，请登录`);
          }}
        />
      ) : pendingIdentity ? (
        <IdentityCompletionPanel
          pending={pendingIdentity}
          onAuthenticated={handleAuthenticated}
          onBack={() => {
            setPendingIdentity(null);
            setMode('login');
          }}
        />
      ) : mode === 'register' && registrationEnabled ? (
        <RegisterForm
          onAuthenticated={handleAuthenticated}
          onPendingApproval={handlePendingApproval}
        />
      ) : (
        <>
          <LoginForm onAuthenticated={handleAuthenticated} />
          {callbackCaptureQuery.isError ? (
            <div className={styles.errorBanner} role="alert">
              三方登录回流失败：{getErrorMessage(callbackCaptureQuery.error)}
            </div>
          ) : null}
          <IdentityLoginPanel
            providers={providersQuery.data ?? []}
            onStarted={handleIdentityStarted}
          />
        </>
      )}
    </LoginShell>
  );
}

/** 登录后跳转白名单：仅接受同源相对路径，拒绝 //host 形式的外链 */
function getSafeRedirectPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/';
  }
  return value;
}
