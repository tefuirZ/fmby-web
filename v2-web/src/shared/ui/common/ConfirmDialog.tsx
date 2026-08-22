import * as Dialog from '@radix-ui/react-dialog';
import type { KeyboardEvent, ReactNode } from 'react';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  impact?: string | string[];
  children?: ReactNode;
  errorMessage?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  pending?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  description,
  impact,
  children,
  errorMessage,
  confirmLabel = '确认',
  cancelLabel = '取消',
  confirmDisabled = false,
  onOpenChange,
  onConfirm,
  pending = false,
}: ConfirmDialogProps) {
  const impactItems = Array.isArray(impact) ? impact.filter(Boolean) : impact ? [impact] : [];

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter') {
      return;
    }
    const target = event.target as HTMLElement;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      event.stopPropagation();
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content} onKeyDown={handleKeyDown}>
          <div className={styles.header}>
            <div className={styles.eyebrow}>危险操作</div>
            <Dialog.Title className={styles.title}>{title}</Dialog.Title>
            <Dialog.Description className={styles.description}>
              {description}
            </Dialog.Description>
          </div>

          {impactItems.length > 0 ? (
            <div className={styles.impact}>
              <div className={styles.impactLead}>影响范围</div>
              {impactItems.length === 1 ? (
                <div>{impactItems[0]}</div>
              ) : (
                <ul className={styles.impactList}>
                  {impactItems.map((item) => (
                    <li key={item} className={styles.impactItem}>
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {children ? <div className={styles.body}>{children}</div> : null}

          {errorMessage ? (
            <div className={styles.errorBox} role="alert">
              <div className={styles.errorLead}>执行失败</div>
              <div>{errorMessage}</div>
            </div>
          ) : null}

          <div className={styles.actions}>
            <Dialog.Close asChild>
              <button className={styles.button} type="button" disabled={pending}>
                {cancelLabel}
              </button>
            </Dialog.Close>
            <button
              className={`${styles.button} ${styles.buttonDanger}`}
              type="button"
              disabled={pending || confirmDisabled}
              onClick={onConfirm}
            >
              {pending ? '处理中…' : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
