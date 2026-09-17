/** 登录页通用字段封装（V1F 拆分：LoginPage → 独立组件）。 */

import { useId } from 'react';
import type { ReactNode } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

import styles from '../LoginPage.module.css';

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  children: (id: string, invalid: boolean) => ReactNode;
}

export function Field({ label, error, hint, children }: FieldProps) {
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

export function PasswordToggle({ visible, onToggle }: PasswordToggleProps) {
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

export function SubmitButton({ pending, pendingText, text }: SubmitButtonProps) {
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
