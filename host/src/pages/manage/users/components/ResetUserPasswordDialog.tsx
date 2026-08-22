import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';

import { manageResetUserPasswordSchema } from '@/domains/manage/schemas';
import type { DangerousActionRequest, ManageUserRecord } from '@/domains/manage';
import { useZodForm } from '@/shared/forms';
import { SensitiveActionDialog } from '@/shared/ui';
import { getErrorMessage } from '@/shared/utils/error';

import styles from '../../longtail-shared/ManageShared.module.css';

interface ResetUserPasswordDialogProps {
  user: ManageUserRecord | null;
  pending: boolean;
  error?: unknown;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: {
    userId: string;
    newPassword: string;
    forceChange: boolean;
    confirmation: DangerousActionRequest;
  }) => void;
}

export function ResetUserPasswordDialog({
  user,
  pending,
  error,
  onOpenChange,
  onConfirm,
}: ResetUserPasswordDialogProps) {
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const {
    register,
    reset,
    formState: { errors, isValid },
    getValues,
    trigger,
  } = useZodForm(manageResetUserPasswordSchema, {
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
      forceChange: false,
    },
    mode: 'onChange',
  });

  const open = user !== null;
  const displayName = user?.displayName || user?.username || '';
  const targetIsService = user?.accountKind === 'service';

  useEffect(() => {
    if (!open) {
      reset({
        newPassword: '',
        confirmPassword: '',
        forceChange: false,
      });
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    }
  }, [open, reset]);

  return (
    <SensitiveActionDialog
      open={open}
      actionKey="reset-user-password"
      title={displayName ? `重置密码：${displayName}` : '重置用户密码'}
      description="管理员将为该人工账号写入新的登录密码。默认不强制下次登录改密。"
      impact={[
        '新密码会立即替换旧密码，旧密码不会被展示或导出。',
        '不会修改账号状态、角色、来源授权或已有审计记录。',
        targetIsService
          ? '服务账号不允许交互式登录，不能在这里重置网页登录密码。'
          : '可按需勾选强制下次登录改密。',
      ]}
      confirmLabel="确认重置密码"
      errorMessage={error ? getErrorMessage(error) : undefined}
      extraConfirmDisabled={!isValid || targetIsService}
      pending={pending}
      onOpenChange={onOpenChange}
      onConfirm={(confirmation) => {
        void trigger().then((valid) => {
          if (!valid || !user) return;
          const values = getValues();
          onConfirm({
            userId: user.id,
            newPassword: values.newPassword,
            forceChange: values.forceChange,
            confirmation,
          });
        });
      }}
    >
      <form
        className={styles.fieldGroup}
        onSubmit={(event) => {
          event.preventDefault();
          void trigger();
        }}
        noValidate
      >
        <label className={styles.label} htmlFor="reset-user-password-new">
          新密码
          <div className={styles.inputActionWrapper}>
            <input
              id="reset-user-password-new"
              className={styles.input}
              type={showNewPassword ? 'text' : 'password'}
              autoComplete="new-password"
              disabled={pending || targetIsService}
              placeholder="至少 8 个字符"
              {...register('newPassword')}
            />
            <button
              className={styles.inputIconButton}
              type="button"
              aria-label={showNewPassword ? '隐藏新密码' : '显示新密码'}
              disabled={pending || targetIsService}
              onClick={() => setShowNewPassword((value) => !value)}
            >
              {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.newPassword ? (
            <span className={styles.fieldErrorText}>{errors.newPassword.message}</span>
          ) : null}
        </label>

        <label className={styles.label} htmlFor="reset-user-password-confirm">
          确认新密码
          <div className={styles.inputActionWrapper}>
            <input
              id="reset-user-password-confirm"
              className={styles.input}
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              disabled={pending || targetIsService}
              placeholder="再次输入新密码"
              {...register('confirmPassword')}
            />
            <button
              className={styles.inputIconButton}
              type="button"
              aria-label={showConfirmPassword ? '隐藏确认密码' : '显示确认密码'}
              disabled={pending || targetIsService}
              onClick={() => setShowConfirmPassword((value) => !value)}
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.confirmPassword ? (
            <span className={styles.fieldErrorText}>{errors.confirmPassword.message}</span>
          ) : null}
        </label>

        <label className={styles.checkboxRow}>
          <input
            className={styles.checkbox}
            type="checkbox"
            disabled={pending || targetIsService}
            {...register('forceChange')}
          />
          <span className={styles.stackText}>
            <span>强制下次登录改密</span>
            <span className={styles.mutedText}>
              默认关闭；需要临时密码交付时再启用。
            </span>
          </span>
        </label>
      </form>
    </SensitiveActionDialog>
  );
}
