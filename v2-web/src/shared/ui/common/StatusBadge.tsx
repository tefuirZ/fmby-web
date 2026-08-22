import styles from './StatusBadge.module.css';

export type StatusBadgeVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';

interface StatusBadgeProps {
  label: string;
  variant: StatusBadgeVariant;
}

export function StatusBadge({ label, variant }: StatusBadgeProps) {
  return (
    <span className={styles.badge} data-variant={variant}>
      <span className={styles.dot} />
      {label}
    </span>
  );
}
