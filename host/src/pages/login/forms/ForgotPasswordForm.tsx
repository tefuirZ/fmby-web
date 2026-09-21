/**
 * 找回密码表单（EMAIL-CHANNEL / WEB-EMAIL-UI ③ ③a）。
 *
 * ③ 起始：邮箱 → POST /api/auth/password-reset/start。提交后**恒显示同一文案**
 *    （防枚举：不因邮箱是否存在而改变）。依响应 delivery 分流：
 *    - code      → 内联渲染 ③a 验证码 + 新密码表单；
 *    - link      → 提示查收邮件并点重置链接；
 *    - password  → 提示新密码已发送、登录后按提示修改（C 形态无前端重置页）。
 * ③a 验证码重置：POST /api/auth/password-reset/complete（A 形态），验证码一次性，
 *    错误统一文案（后端负责统一；前端原样显示）。
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  authApi,
  passwordResetStartSchema,
  passwordResetCodeSchema,
  PASSWORD_RESET_START_CONFIRM_MESSAGE,
  type PasswordResetDelivery,
  type PasswordResetStartFormData,
  type PasswordResetCodeFormData,
} from '@fmby/v2-shared/contracts/auth';
import { useZodForm } from '@fmby/v2-shared/forms';
import { getErrorMessage } from '@fmby/v2-shared/errors';

import clsx from 'clsx';

import styles from '../LoginPage.module.css';
import { Field, PasswordToggle, SubmitButton } from './fields';
import { createResetSessionId } from '../resetHash';
import { resetAfterSubmitView } from '../passwordResetFlow';

interface ForgotPasswordFormProps {
  onBackToLogin: () => void;
}

export function ForgotPasswordForm({ onBackToLogin }: ForgotPasswordFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [delivery, setDelivery] = useState<PasswordResetDelivery | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [codeDone, setCodeDone] = useState(false);

  const {
    register: registerEmail,
    handleSubmit: handleSubmitEmail,
    formState: { errors: emailErrors },
  } = useZodForm(passwordResetStartSchema);

  const {
    register: registerCode,
    handleSubmit: handleSubmitCode,
    formState: { errors: codeErrors },
  } = useZodForm(passwordResetCodeSchema);

  const startMutation = useMutation({
    mutationFn: (data: PasswordResetStartFormData) =>
      authApi.startPasswordReset({ email: data.email, session_id: sessionId }),
    onSuccess: (response, variables) => {
      setSubmitted(true);
      setEmail(variables.email);
      setDelivery(response.delivery);
      if (response.challenge) {
        setSessionId(response.challenge);
      }
    },
  });

  const completeMutation = useMutation({
    mutationFn: (data: PasswordResetCodeFormData) =>
      authApi.completePasswordReset({
        session_id: sessionId,
        email,
        code: data.code,
        new_password: data.newPassword,
      }),
    onSuccess: () => {
      setCodeDone(true);
    },
  });

  const onStartSubmit = handleSubmitEmail((data) => {
    // 每次起始生成一次 session_id（后端若回 challenge 则以 challenge 为准）
    setSessionId(createResetSessionId());
    setCodeDone(false);
    startMutation.mutate(data);
  });

  const onCodeSubmit = handleSubmitCode((data) => {
    completeMutation.mutate(data);
  });

  if (codeDone) {
    return (
      <div className={styles.form}>
        <div className={styles.successBanner} role="status">
          密码已重置，请使用新密码登录。
        </div>
        <button type="button" className={styles.secondaryButton} onClick={onBackToLogin}>
          返回登录
        </button>
      </div>
    );
  }

  // ③ 起始表单（尚未提交）
  if (!submitted || delivery === null) {
    return (
      <form className={styles.form} onSubmit={onStartSubmit} noValidate>
        {startMutation.error ? (
          <div className={styles.errorBanner} role="alert">
            {getErrorMessage(startMutation.error)}
          </div>
        ) : null}

        <Field
          label="邮箱"
          error={emailErrors.email?.message}
          hint="提交后无论邮箱是否存在，都会显示同一条提示。"
        >
          {(id, invalid) => (
            <div className={styles.inputWrapper}>
              <input
                id={id}
                type="email"
                className={clsx(styles.input, invalid && styles.inputError)}
                placeholder="请输入注册邮箱"
                autoComplete="email"
                {...registerEmail('email')}
              />
            </div>
          )}
        </Field>

        <SubmitButton pending={startMutation.isPending} pendingText="提交中…" text="发送重置指引" />

        <button type="button" className={styles.secondaryButton} onClick={onBackToLogin}>
          返回登录
        </button>
      </form>
    );
  }

  // 已提交：恒显示同一防枚举文案；后续 UI 只由 delivery 决定
  const afterView = resetAfterSubmitView(delivery);
  return (
    <div className={styles.form}>
      <div className={styles.successBanner} role="status">
        {PASSWORD_RESET_START_CONFIRM_MESSAGE}
      </div>

      {afterView === 'code-form' ? (
        <form className={styles.form} onSubmit={onCodeSubmit} noValidate>
          {completeMutation.error ? (
            <div className={styles.errorBanner} role="alert">
              {getErrorMessage(completeMutation.error)}
            </div>
          ) : null}
          <Field label="验证码" error={codeErrors.code?.message}>
            {(id, invalid) => (
              <div className={styles.inputWrapper}>
                <input
                  id={id}
                  className={clsx(styles.input, invalid && styles.inputError)}
                  placeholder="请输入邮件中的验证码"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  {...registerCode('code')}
                />
              </div>
            )}
          </Field>
          <Field label="新密码" error={codeErrors.newPassword?.message}>
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
                  {...registerCode('newPassword')}
                />
                <PasswordToggle
                  visible={showPassword}
                  onToggle={() => setShowPassword((prev) => !prev)}
                />
              </div>
            )}
          </Field>
          <SubmitButton
            pending={completeMutation.isPending}
            pendingText="重置中…"
            text="重置密码"
          />
        </form>
      ) : afterView === 'link-notice' ? (
        <p className={styles.subtitle}>
          请查收邮件并点击其中的重置链接完成设置（链接有效期见站点配置）。
        </p>
      ) : (
        <p className={styles.subtitle}>
          新密码已发送至邮箱，请查收并登录；登录后会要求你修改密码。
        </p>
      )}

      <button type="button" className={styles.secondaryButton} onClick={onBackToLogin}>
        返回登录
      </button>
    </div>
  );
}
