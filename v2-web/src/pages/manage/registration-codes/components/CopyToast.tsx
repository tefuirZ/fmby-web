import styles from '../../longtail-shared/ManageShared.module.css';
import type { CopyToastState } from '../types';

export interface CopyToastProps {
  toast: CopyToastState | null;
}

export function CopyToast({ toast }: CopyToastProps) {
  if (!toast) {
    return null;
  }

  return (
    <div className={styles.floatingToastLayer} aria-live="polite" aria-atomic="true">
      <div className={styles.floatingToast} role="status">
        <strong className={styles.floatingToastTitle}>{toast.title}</strong>
        <span className={styles.floatingToastDescription}>{toast.description}</span>
      </div>
    </div>
  );
}
