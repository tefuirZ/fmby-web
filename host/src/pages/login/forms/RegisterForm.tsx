/** 注册码注册表单（V1F 拆分：LoginPage → 独立组件）。 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authApi, registerSchema, type RegisterFormData } from '@fmby/v2-shared/contracts/auth';
import { useZodForm } from '@fmby/v2-shared/forms';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import type { User } from '@fmby/v2-shared/types';

import styles from '../LoginPage.module.css';

import clsx from 'clsx';

import { Field, PasswordToggle, SubmitButton } from './fields';

interface RegisterFormProps {
  onAuthenticated: (user: User) => void;
  onPendingApproval: (message: string) => void;
}

export function RegisterForm({ onAuthenticated, onPendingApproval }: RegisterFormProps) {
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
    onSuccess: async (response) => {
      if (response.status === 'authenticated' && response.user) {
        // ★后端 user 字段是 `{token, user:{id,username,...}}` 嵌套手拼结构，
        // 与本仓 User 类型不符（登记见 RegisterResponse.user 注释）——不直接消费。
        // 注册成功即后端已签发会话 cookie：照 login() 先例经 /api/auth/me
        // 重新组装 User（capabilities 权威面），再进入认证态。
        try {
          const user = await authApi.getSession();
          onAuthenticated(user);
        } catch {
          // me 失败时 fail-closed 不伪装登录态，用户手动重新登录。
          onPendingApproval('注册成功，请使用新账号登录');
        }
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
