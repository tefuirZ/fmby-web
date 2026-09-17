/** 常规登录表单（V1F 拆分：LoginPage → 独立组件）。 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authApi, loginSchema, type LoginFormData } from '@fmby/v2-shared/contracts/auth';
import { useZodForm } from '@fmby/v2-shared/forms';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import type { User } from '@fmby/v2-shared/types';

import clsx from 'clsx';

import styles from '../LoginPage.module.css';

import { Field, PasswordToggle, SubmitButton } from './fields';

interface LoginFormProps {
  onAuthenticated: (user: User) => void;
}

export function LoginForm({ onAuthenticated }: LoginFormProps) {
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
