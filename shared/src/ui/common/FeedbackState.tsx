import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Inbox, Loader2 } from 'lucide-react';
import styles from './FeedbackState.module.css';

type FeedbackVariant = 'loading' | 'empty' | 'error' | 'success' | 'warning';

interface FeedbackStateProps {
  variant: FeedbackVariant;
  title: string;
  description: string;
  action?: ReactNode;
}

function getIcon(variant: FeedbackVariant) {
  switch (variant) {
    case 'loading':
      return <Loader2 className={styles.spinner} size={24} />;
    case 'error':
      return <AlertTriangle size={24} />;
    case 'success':
      return <CheckCircle2 size={24} />;
    case 'warning':
      return <AlertTriangle size={24} />;
    case 'empty':
    default:
      return <Inbox size={24} />;
  }
}

/**
 * 读屏播报口径（FE-A11Y-KEYBOARD-AUDIT）：
 * - `error` ⇒ `role="alert"` + `aria-live="assertive"`（错误须立即播报）；
 * - 其余态 ⇒ `role="status"` + `aria-live="polite"`（加载/空/成功/警告不打断用户）。
 * ★纯属性补齐，不改视觉与交互语义。
 */
function a11yFor(variant: FeedbackVariant) {
  return variant === 'error'
    ? { role: 'alert', 'aria-live': 'assertive' as const }
    : { role: 'status', 'aria-live': 'polite' as const };
}

export function FeedbackState({
  variant,
  title,
  description,
  action,
}: FeedbackStateProps) {
  return (
    <section className={styles.panel} data-variant={variant} {...a11yFor(variant)}>
      <div className={styles.icon}>{getIcon(variant)}</div>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.description}>{description}</p>
      {action ? <div className={styles.actionSlot}>{action}</div> : null}
    </section>
  );
}
