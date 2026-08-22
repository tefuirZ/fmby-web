import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import styles from './SideDrawer.module.css';

interface SideDrawerProps {
  open: boolean;
  title: string;
  description?: string;
  eyebrow?: string;
  placement?: 'right' | 'bottom' | 'fullscreen';
  mobileVariant?: 'bottom' | 'fullscreen';
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function SideDrawer({
  open,
  title,
  description,
  eyebrow = '详情面板',
  placement = 'right',
  mobileVariant = 'fullscreen',
  onOpenChange,
  children,
}: SideDrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.content}
          data-placement={placement}
          data-mobile-variant={mobileVariant}
        >
          <div className={styles.header}>
            <div className={styles.titleBlock}>
              <div className={styles.eyebrow}>{eyebrow}</div>
              <Dialog.Title className={styles.title}>{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className={styles.description}>
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close asChild>
              <button className={styles.closeButton} type="button" aria-label="关闭详情面板">
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
