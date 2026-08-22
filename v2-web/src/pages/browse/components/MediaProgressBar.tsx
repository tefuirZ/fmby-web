import styles from '../styles/cards.module.css';

export function MediaProgressBar({
  value,
  label,
}: {
  value: number;
  label?: string;
}) {
  return (
    <div className={styles.progressGroup}>
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
      {label ? <span className={styles.progressLabel}>{label}</span> : null}
    </div>
  );
}
