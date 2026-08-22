/**
 * 登录页面（aurora-glass）
 *
 * 全屏 aurora 渐变背景，中心玻璃拟态卡片。
 * 支持三种入口：
 * 1. 常规登录
 * 2. 注册码注册（entry status 的 registration_enabled 控制）
 * 3. 首次初始化创建管理员
 */

import { useEffect, useState, useId } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import clsx from 'clsx';

import { useSession } from '@/session';
import {
  authApi,
  loginSchema,
  registerSchema,
  setupSchema,
  type LoginFormData,
  type RegisterFormData,
  type SetupFormData,
} from '@fmby/v2-shared/contracts/auth';
import { useZodForm } from '@fmby/v2-shared/forms';
import { queryKeys } from '@fmby/v2-shared/query';
import type { User } from '@fmby/v2-shared/types';
import { getErrorMessage } from '@fmby/v2-shared/errors';

import styles from './LoginPage.module.css';

type EntryMode = 'login' | 'register';

interface LoginFormProps {
  onAuthenticated: (user: User) => void;
}

interface RegisterFormProps extends LoginFormProps {
  onPendingApproval: (message: string) => void;
}

/* ---- 通用字段封装（减少重复，行内错误展示）---- */

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  children: (id: string, invalid: boolean) => ReactNode;
}

function Field({ label, error, hint, children }: FieldProps) {
  const id = useId();
  return (
    <div className={styles.fieldGroup}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {children(id, Boolean(error))}
      {error ? (
        <span className={styles.fieldError} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className={styles.fieldHint}>{hint}</span>
      ) : null}
    </div>
  );
}

interface PasswordToggleProps {
  visible: boolean;
  onToggle: () => void;
}

function PasswordToggle({ visible, onToggle }: PasswordToggleProps) {
  return (
    <button
      type="button"
      className={styles.passwordToggle}
      onClick={onToggle}
      aria-label={visible ? '隐藏密码' : '显示密码'}
    >
      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  );
}

interface SubmitButtonProps {
  pending: boolean;
  pendingText: string;
  text: string;
}

function SubmitButton({ pending, pendingText, text }: SubmitButtonProps) {
  return (
    <button type="submit" className={styles.submitButton} disabled={pending}>
      {pending ? (
        <>
          <Loader2 size={18} className={styles.spinner} />
          {pendingText}
        </>
      ) : (
        text
      )}
    </button>
  );
}

/* ---- 登录表单 ---- */

function LoginForm({ onAuthenticated }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useZodForm(loginSchema);

  const mutation = useMutation({
    mutationFn: (data: LoginFormData) => authApi.login(data),
    onSuccess: (response) => {
      onAuthenticated(response.user);
    },
  });

  const onSubmit = handleSubmit((data) => {
    mutation.mutate(data);
  });

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      {mutation.error ? (
        <div className={styles.errorBanner} role="alert">
          {getErrorMessage(mutation.error)}
        </div>
      ) : null}

      <Field label="用户名" error={errors.username?.message}>
        {(id, invalid) => (
          <div className={styles.inputWrapper}>
            <input
              id={id}
              className={clsx(styles.input, invalid && styles.inputError)}
              placeholder="请输入用户名"
              autoComplete="username"
              {...register('username')}
            />
          </div>
        )}
      </Field>

      <Field label="密码" error={errors.password?.message}>
        {(id, invalid) => (
          <div className={styles.inputWrapper}>
            <input
              id={id}
              type={showPassword ? 'text' : 'password'}
              className={clsx(
                styles.input,
                styles.inputHasToggle,
                invalid && styles.inputError,
              )}
              placeholder="请输入密码"
              autoComplete="current-password"
              {...register('password')}
            />
            <PasswordToggle
              visible={showPassword}
              onToggle={() => setShowPassword((prev) => !prev)}
            />
          </div>
        )}
      </Field>

      <SubmitButton pending={mutation.isPending} pendingText="登录中…" text="登录" />
    </form>
  );
}

/* ---- 注册码注册表单 ---- */

function RegisterForm({ onAuthenticated, onPendingApproval }: RegisterFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useZodForm(registerSchema);

  const mutation = useMutation({
    mutationFn: (data: RegisterFormData) =>
      authApi.register({
        code: data.code,
        username: data.username,
        password: data.password,
        display_name: data.displayName || undefined,
      }),
    onSuccess: (response) => {
      if (response.status === 'authenticated' && response.user) {
        onAuthenticated(response.user);
        return;
      }
      onPendingApproval(response.message);
    },
  });

  const onSubmit = handleSubmit((data) => {
    mutation.mutate(data);
  });

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      {mutation.error ? (
        <div className={styles.errorBanner} role="alert">
          {getErrorMessage(mutation.error)}
        </div>
      ) : null}

      <Field
        label="注册码"
        error={errors.code?.message}
        hint="需要有效注册码才能完成注册。"
      >
        {(id, invalid) => (
          <div className={styles.inputWrapper}>
            <input
              id={id}
              className={clsx(styles.input, invalid && styles.inputError)}
              placeholder="请输入管理员提供的注册码"
              autoComplete="one-time-code"
              {...register('code')}
            />
          </div>
        )}
      </Field>

      <Field label="用户名" error={errors.username?.message}>
        {(id, invalid) => (
          <div className={styles.inputWrapper}>
            <input
              id={id}
              className={clsx(styles.input, invalid && styles.inputError)}
              placeholder="至少 3 个字符"
              autoComplete="username"
              {...register('username')}
            />
          </div>
        )}
      </Field>

      <Field label="显示名称（可选）">
        {(id) => (
          <div className={styles.inputWrapper}>
            <input
              id={id}
              className={styles.input}
              placeholder="显示名称"
              autoComplete="name"
              {...register('displayName')}
            />
          </div>
        )}
      </Field>

      <Field label="密码" error={errors.password?.message}>
        {(id, invalid) => (
          <div className={styles.inputWrapper}>
            <input
              id={id}
              type={showPassword ? 'text' : 'password'}
              className={clsx(
                styles.input,
                styles.inputHasToggle,
                invalid && styles.inputError,
              )}
              placeholder="至少 8 个字符"
              autoComplete="new-password"
              {...register('password')}
            />
            <PasswordToggle
              visible={showPassword}
              onToggle={() => setShowPassword((prev) => !prev)}
            />
          </div>
        )}
      </Field>

      <Field label="确认密码" error={errors.confirmPassword?.message}>
        {(id, invalid) => (
          <div className={styles.inputWrapper}>
            <input
              id={id}
              type={showConfirm ? 'text' : 'password'}
              className={clsx(
                styles.input,
                styles.inputHasToggle,
                invalid && styles.inputError,
              )}
              placeholder="再次输入密码"
              autoComplete="new-password"
              {...register('confirmPassword')}
            />
            <PasswordToggle
              visible={showConfirm}
              onToggle={() => setShowConfirm((prev) => !prev)}
            />
          </div>
        )}
      </Field>

      <SubmitButton
        pending={mutation.isPending}
        pendingText="注册中…"
        text="使用注册码注册"
      />
    </form>
  );
}

/* ---- 首次初始化表单 ---- */

function SetupForm({ onAuthenticated }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useZodForm(setupSchema);

  const mutation = useMutation({
    mutationFn: (data: SetupFormData) =>
      authApi.setup({
        username: data.username,
        password: data.password,
        display_name: data.displayName || undefined,
      }),
    onSuccess: (response) => {
      onAuthenticated(response.user);
    },
  });

  const onSubmit = handleSubmit((data) => {
    mutation.mutate(data);
  });

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      {mutation.error ? (
        <div className={styles.errorBanner} role="alert">
          {getErrorMessage(mutation.error)}
        </div>
      ) : null}

      <Field label="用户名" error={errors.username?.message}>
        {(id, invalid) => (
          <div className={styles.inputWrapper}>
            <input
              id={id}
              className={clsx(styles.input, invalid && styles.inputError)}
              placeholder="管理员用户名"
              autoComplete="username"
              {...register('username')}
            />
          </div>
        )}
      </Field>

      <Field label="显示名称（可选）">
        {(id) => (
          <div className={styles.inputWrapper}>
            <input
              id={id}
              className={styles.input}
              placeholder="显示名称"
              autoComplete="name"
              {...register('displayName')}
            />
          </div>
        )}
      </Field>

      <Field label="密码" error={errors.password?.message}>
        {(id, invalid) => (
          <div className={styles.inputWrapper}>
            <input
              id={id}
              type={showPassword ? 'text' : 'password'}
              className={clsx(
                styles.input,
                styles.inputHasToggle,
                invalid && styles.inputError,
              )}
              placeholder="至少 8 个字符"
              autoComplete="new-password"
              {...register('password')}
            />
            <PasswordToggle
              visible={showPassword}
              onToggle={() => setShowPassword((prev) => !prev)}
            />
          </div>
        )}
      </Field>

      <Field label="确认密码" error={errors.confirmPassword?.message}>
        {(id, invalid) => (
          <div className={styles.inputWrapper}>
            <input
              id={id}
              type={showConfirm ? 'text' : 'password'}
              className={clsx(
                styles.input,
                styles.inputHasToggle,
                invalid && styles.inputError,
              )}
              placeholder="再次输入密码"
              autoComplete="new-password"
              {...register('confirmPassword')}
            />
            <PasswordToggle
              visible={showConfirm}
              onToggle={() => setShowConfirm((prev) => !prev)}
            />
          </div>
        )}
      </Field>

      <SubmitButton
        pending={mutation.isPending}
        pendingText="创建中…"
        text="创建管理员"
      />
    </form>
  );
}

/* ---- 页面骨架（aurora 背景 + 玻璃卡片）---- */

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
        <SetupForm onAuthenticated={handleAuthenticated} />
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
