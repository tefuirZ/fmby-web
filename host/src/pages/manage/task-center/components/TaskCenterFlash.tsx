import styles from '../../ManagePages.module.css';
import type { FlashState } from '../types';

interface TaskCenterFlashProps {
  flash: FlashState | null;
}

export function TaskCenterFlash({ flash }: TaskCenterFlashProps) {
  if (!flash) {
    return null;
  }

  return (
    <div className={styles.floatingToastLayer}>
      <div className={styles.floatingToast}>
        <div className={styles.floatingToastTitle}>{flash.title}</div>
        <div className={styles.floatingToastDescription}>{flash.description}</div>
      </div>
    </div>
  );
}
