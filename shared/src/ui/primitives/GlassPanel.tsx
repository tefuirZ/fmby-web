import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import clsx from 'clsx';
import styles from './GlassPanel.module.css';

interface GlassPanelProps extends ComponentPropsWithoutRef<'div'> {
  /**
   * blur：backdrop-filter 玻璃（仅用于低频大面板）
   * flat：仅半透明底（性能预算：网格 / 列表行必须用 flat）
   */
  variant?: 'blur' | 'flat';
}

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  function GlassPanel({ variant = 'flat', className, children, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={clsx(styles.panel, className)}
        data-variant={variant}
        {...rest}
      >
        {children}
      </div>
    );
  },
);
