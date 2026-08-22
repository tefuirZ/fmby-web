import { type CSSProperties } from 'react';
import clsx from 'clsx';
import styles from './Skeleton.module.css';

interface SkeletonProps {
  /** 宽度，如 '100%'、120 */
  width?: number | string;
  /** 高度，如 16、'2em' */
  height?: number | string;
  /** 形状：文本条 / 矩形 / 圆形 */
  shape?: 'text' | 'rect' | 'circle';
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({
  width,
  height,
  shape = 'text',
  className,
  style,
}: SkeletonProps) {
  return (
    <span
      className={clsx(styles.skeleton, className)}
      data-shape={shape}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  );
}
