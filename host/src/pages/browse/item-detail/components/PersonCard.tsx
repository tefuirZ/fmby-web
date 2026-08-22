import type { ItemDetailResponse } from '@/domains/item';
import styles from '../../styles/detail.module.css';

interface PersonCardProps {
  person: ItemDetailResponse['actors'][number];
}

export function PersonCard({ person }: PersonCardProps) {
  const initials = person.name.trim().slice(0, 1) || '人';
  return (
    <div className={styles.personCard}>
      <div className={styles.personAvatar}>
        {person.thumbUrl ? (
          <img className={styles.personAvatarImage} src={person.thumbUrl} alt={person.name} />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      <div className={styles.personText}>
        <strong className={styles.personName}>{person.name}</strong>
        <span className={styles.personRole}>{person.role || '主创成员'}</span>
      </div>
    </div>
  );
}
