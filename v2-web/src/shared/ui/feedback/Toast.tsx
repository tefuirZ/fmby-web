import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import styles from './Toast.module.css';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  durationMs: number;
}

interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

function getIcon(variant: ToastVariant) {
  switch (variant) {
    case 'success':
      return <CheckCircle2 size={20} aria-hidden="true" />;
    case 'error':
      return <XCircle size={20} aria-hidden="true" />;
    case 'warning':
      return <AlertTriangle size={20} aria-hidden="true" />;
    case 'info':
    default:
      return <Info size={20} aria-hidden="true" />;
  }
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const isError = toast.variant === 'error';
  return (
    <div
      className={styles.toast}
      data-variant={toast.variant}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <span className={styles.icon}>{getIcon(toast.variant)}</span>
      <div className={styles.body}>
        <p className={styles.title}>{toast.title}</p>
        {toast.description ? (
          <p className={styles.description}>{toast.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        className={styles.close}
        aria-label="关闭通知"
        onClick={() => onDismiss(toast.id)}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
