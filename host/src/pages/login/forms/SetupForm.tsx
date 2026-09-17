/** 首次初始化创建管理员表单（V1F 拆分：LoginPage → 独立组件）。 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authApi, setupSchema, type SetupFormData } from '@fmby/v2-shared/contracts/auth';
import { useZodForm } from '@fmby/v2-shared/forms';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import type { User } from '@fmby/v2-shared/types';

import styles from '../LoginPage.module.css';

import clsx from 'clsx';

import { Field, PasswordToggle, SubmitButton } from './fields';

interface LoginFormProps {
  onAuthenticated: (user: User) => void;
}

export function SetupForm({ onAuthenticated }: LoginFormProps) {
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
