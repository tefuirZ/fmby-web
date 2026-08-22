import { type KeyboardEvent, type ReactNode } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import clsx from 'clsx';
import styles from './Dialog.module.css';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** 顶部小标 */
  eyebrow?: string;
  /** 尺寸：sm 420 / md 560 / lg 760 */
  size?: 'sm' | 'md' | 'lg';
  /** 底部操作区 */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * 玻璃基础模态。
 *
 * 挂载策略：children 直接渲染在 Dialog.Content 内，不做条件重挂载 / key 重置，
 * 打开后输入框输入不会因父级重渲染被卸载失焦。
 * Enter 键在表单控件内按下时阻止冒泡，避免外层监听误关闭模态。
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  eyebrow,
  size = 'md',
  footer,
  children,
}: DialogProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter') {
      return;
    }
    const target = event.target as HTMLElement;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement
    ) {
      // 表单内 Enter 不冒泡到模态外层，防止被外部快捷键 / 关闭逻辑捕获
      event.stopPropagation();
    }
  };

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={styles.overlay} />
        <RadixDialog.Content
          className={styles.content}
          data-size={size}
          onKeyDown={handleKeyDown}
        >
          <div className={styles.header}>
            <div className={styles.copy}>
              {eyebrow ? <div className={styles.eyebrow}>{eyebrow}</div> : null}
              <RadixDialog.Title className={styles.title}>{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className={styles.description}>
                  {description}
                </RadixDialog.Description>
              ) : null}
            </div>
            <RadixDialog.Close asChild>
              <button type="button" className={styles.closeButton} aria-label="关闭">
                <X size={16} aria-hidden="true" />
              </button>
            </RadixDialog.Close>
          </div>
          <div className={clsx(styles.body)}>{children}</div>
          {footer ? <div className={styles.footer}>{footer}</div> : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
