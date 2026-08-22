import { Clock3, Star } from 'lucide-react';
import styles from '../styles/cards.module.css';

export function SmallStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: 'time' | 'score';
}) {
  return (
    <div className={styles.smallStat}>
      <span className={styles.smallStatLabel}>
        {icon === 'time' ? <Clock3 size={14} /> : icon === 'score' ? <Star size={14} /> : null}
        {label}
      </span>
      <strong>{value}</strong>
    </div>
  );
}
