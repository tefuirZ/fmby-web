import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import styles from './InlineBanner.module.css';

type InlineBannerVariant = 'success' | 'error' | 'warning' | 'info';

interface InlineBannerProps {
  variant: InlineBannerVariant;
  title: string;
  description?: string;
  actions?: ReactNode;
}

function getIcon(variant: InlineBannerVariant) {
  switch (variant) {
    case 'success':
      return <CheckCircle2 size={18} />;
    case 'error':
      return <AlertTriangle size={18} />;
    case 'warning':
      return <ShieldAlert size={18} />;
    case 'info':
    default:
      return <Info size={18} />;
  }
}

export function InlineBanner({
  variant,
  title,
  description,
  actions,
}: InlineBannerProps) {
  return (
    <div className={styles.banner} data-variant={variant} role="status">
      <div className={styles.icon}>{getIcon(variant)}</div>
      <div className={styles.content}>
        <div className={styles.title}>{title}</div>
        {description ? <div className={styles.description}>{description}</div> : null}
        {actions}
      </div>
    </div>
  );
}
