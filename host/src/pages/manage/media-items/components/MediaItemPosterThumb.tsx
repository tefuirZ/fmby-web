import { useState } from 'react';
import styles from '../../ManageMediaItemsPage.module.css';

interface MediaItemPosterThumbProps {
  title: string;
  typeLabel: string;
  posterUrl?: string;
}

export function MediaItemPosterThumb({
  title,
  typeLabel,
  posterUrl,
}: MediaItemPosterThumbProps) {
  const [failed, setFailed] = useState(false);
  const initials = title.trim().slice(0, 2) || typeLabel.slice(0, 1);

  if (!posterUrl || failed) {
    return (
      <div className={styles.posterFallback} aria-hidden="true">
        <span>{initials}</span>
      </div>
    );
  }

  return (
    <img
      alt={`${title} 海报`}
      className={styles.posterImage}
      src={posterUrl}
      onError={() => setFailed(true)}
    />
  );
}
