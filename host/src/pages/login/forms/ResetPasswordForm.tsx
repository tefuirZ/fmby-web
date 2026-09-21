/**
 * 链接重置页（EMAIL-CHANNEL / WEB-EMAIL-UI ④）。
 *
 * 固定路由 /login#password-reset?ticket=...（登录页据 hash 渲染本组件）。
 * 填新密码（≥8）→ POST /api/auth/password-reset/complete（B 形态 {ticket,new_password}）。
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  authApi,
  passwordResetLinkSchema,
  type PasswordResetLinkFormData,
} from '@fmby/v2-shared/contracts/auth';
import { useZodForm } from '@fmby/v2-shared/forms';
import { getErrorMessage } from '@fmby/v2-shared/errors';

import clsx from 'clsx';

import styles from '../LoginPage.module.css';
import { Field, PasswordToggle, SubmitButton } from './fields';

interface ResetPasswordFormProps {
  ticket: string;
  onDone: () => void;
}

export function ResetPasswordForm({ ticket, onDone }: ResetPasswordFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useZodForm(passwordResetLinkSchema, {
    defaultValues: { ticket, newPassword: '' },
  });

  const mutation = useMutation({
    mutationFn: (data: PasswordResetLinkFormData) =>
      authApi.completePasswordReset({ ticket: data.ticket, new_password: data.newPassword }),
    onSuccess: () => setDone(true),
  });

  const onSubmit = handleSubmit((data) => {
    mutation.mutate(data);
  });

  if (done) {
    return (
      <div className={styles.form}>
        <div className={styles.successBanner} role="status">
          密码已重置，请使用新密码登录。
        </div>
        <button type="button" className={styles.secondaryButton} onClick={onDone}>
          返回登录
        </button>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      {mutation.error ? (
        <div className={styles.errorBanner} role="alert">
          {getErrorMessage(mutation.error)}
        </div>
      ) : null}

      <input type="hidden" {...register('ticket')} />

      <Field label="新密码" error={errors.newPassword?.message}>
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
              {...register('newPassword')}
            />
            <PasswordToggle
              visible={showPassword}
              onToggle={() => setShowPassword((prev) => !prev)}
            />
          </div>
        )}
      </Field>

      <SubmitButton pending={mutation.isPending} pendingText="重置中…" text="设置新密码" />

      <button type="button" className={styles.secondaryButton} onClick={onDone}>
        返回登录
      </button>
    </form>
  );
}
