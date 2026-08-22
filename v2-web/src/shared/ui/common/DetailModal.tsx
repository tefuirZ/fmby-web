import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import styles from './DetailModal.module.css';

interface DetailModalProps {
  open: boolean;
  title: string;
  description?: string;
  eyebrow?: string;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function DetailModal({
  open,
  title,
  description,
  eyebrow = '详情',
  onOpenChange,
  children,
}: DetailModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <div className={styles.header}>
            <div className={styles.copy}>
              <div className={styles.eyebrow}>{eyebrow}</div>
              <Dialog.Title className={styles.title}>{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className={styles.description}>
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close asChild>
              <button className={styles.closeButton} type="button" aria-label="关闭">
                关闭
              </button>
            </Dialog.Close>
          </div>
          <div className={styles.body}>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
