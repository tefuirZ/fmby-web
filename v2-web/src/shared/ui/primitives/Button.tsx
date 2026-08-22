import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import clsx from 'clsx';
import styles from './Button.module.css';

interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'ghost',
      size = 'md',
      loading = false,
      disabled,
      className,
      children,
      type = 'button',
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={clsx(styles.button, className)}
        data-variant={variant}
        data-size={size}
        data-loading={loading || undefined}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {loading ? (
          <Loader2 className={styles.spinner} size={size === 'sm' ? 14 : 16} aria-hidden="true" />
        ) : null}
        <span className={styles.label}>{children}</span>
      </button>
    );
  },
);

interface IconButtonProps extends ComponentPropsWithoutRef<'button'> {
  /** 无障碍标签（必填，图标按钮无可见文本） */
  'aria-label': string;
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { variant = 'ghost', size = 'md', className, children, type = 'button', ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={clsx(styles.button, styles.iconButton, className)}
        data-variant={variant}
        data-size={size}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
