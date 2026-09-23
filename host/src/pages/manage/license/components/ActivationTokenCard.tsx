/**
 * Activation Token 卡（照 V1 `ActivationTokenCard.tsx` 对位）：
 * zod 校验的表单，成功后清空输入；失败原样呈现后端错误。
 */

import { useEffect } from 'react';
import { KeyRound } from 'lucide-react';
import { FieldError, useZodForm } from '@fmby/v2-shared/forms';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import {
  manageLicenseActivationTokenSchema,
  type ManageLicenseActivationTokenForm,
} from '../schemas';
import styles from '../../longtail-shared/ManageShared.module.css';

interface ActivationTokenCardProps {
  pending: boolean;
  error: unknown;
  successSerial: number;
  onSubmit: (value: ManageLicenseActivationTokenForm) => void;
}

export function ActivationTokenCard({
  pending,
  error,
  successSerial,
  onSubmit,
}: ActivationTokenCardProps) {
  const form = useZodForm(manageLicenseActivationTokenSchema, {
    defaultValues: {
      activationToken: '',
    } satisfies ManageLicenseActivationTokenForm,
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (successSerial > 0) {
      reset({ activationToken: '' });
    }
  }, [reset, successSerial]);

  return (
    <form
      className={styles.fieldGroup}
      onSubmit={handleSubmit((value) => onSubmit(value))}
    >
      {error ? <div className={styles.dangerPanel}>{getErrorMessage(error)}</div> : null}

      <label className={styles.label}>
        Activation Token
        <textarea
          className={styles.textarea}
          autoComplete="off"
          spellCheck={false}
          placeholder="粘贴授权门户生成的一次性 activation token"
          {...register('activationToken')}
        />
        <FieldError
          message={errors.activationToken?.message}
          hint="Token 只用于换取服务端签发的 SignedLease，页面成功后会清空输入。"
        />
      </label>

      <div className={styles.rowActions}>
        <button className={styles.primaryButton} type="submit" disabled={pending}>
          <KeyRound size={16} />
          {pending ? '激活中...' : '使用 Token 激活'}
        </button>
      </div>
    </form>
  );
}
