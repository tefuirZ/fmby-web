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

export function FeedbackState({
  variant,
  title,
  description,
  action,
}: FeedbackStateProps) {
  return (
    <section className={styles.panel} data-variant={variant}>
      <div className={styles.icon}>{getIcon(variant)}</div>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.description}>{description}</p>
      {action ? <div className={styles.actionSlot}>{action}</div> : null}
    </section>
  );
}
