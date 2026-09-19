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
import { authApi } from '@fmby/v2-shared/contracts/auth';
import { queryKeys } from '@fmby/v2-shared/query';
import type { User } from '@fmby/v2-shared/types';

import styles from './LoginPage.module.css';
type EntryMode = 'login' | 'register';

import { LoginForm } from './forms/LoginForm';
import { RegisterForm } from './forms/RegisterForm';
import { SetupForm } from './forms/SetupForm';

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

  const entryQuery = useQuery({
    queryKey: queryKeys.auth.setupStatus(),
    queryFn: () => authApi.getSetupStatus(),
    retry: 2,
  });

  const needsSetup = entryQuery.data?.needs_setup ?? false;
  const registrationEnabled =
    !needsSetup && (entryQuery.data?.registration_enabled ?? false);

  useEffect(() => {
    if (!registrationEnabled && mode === 'register') {
      setMode('login');
    }
  }, [mode, registrationEnabled]);

  function handleAuthenticated(user: User) {
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
      ) : mode === 'register' && registrationEnabled ? (
        <RegisterForm
          onAuthenticated={handleAuthenticated}
          onPendingApproval={handlePendingApproval}
        />
      ) : (
        <LoginForm onAuthenticated={handleAuthenticated} />
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
