import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import clsx from 'clsx';
import styles from './GlassCard.module.css';

interface GlassCardProps extends ComponentPropsWithoutRef<'div'> {
  /** 是否带 hover 抬升反馈（海报卡 / 可点击卡片使用） */
  interactive?: boolean;
  /** 内边距档位 */
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

/**
 * 玻璃卡片：flat 半透明（无 backdrop-filter，可安全用于海报墙 / 列表网格）。
 */
export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  function GlassCard({ interactive = false, padding = 'md', className, children, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={clsx(styles.card, className)}
        data-interactive={interactive || undefined}
        data-padding={padding}
        {...rest}
      >
        {children}
      </div>
    );
  },
);
