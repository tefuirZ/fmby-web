import { useMemo } from 'react';
import { generatePlaceholderColor, useBackdropUrl } from '@/shared/hooks/usePosterUrl';
import type { MediaCardSummary } from '@/domains/browse';
import styles from '../styles/cinema-hero.module.css';

/**
 * 聚光轮播的单帧背景：只用横图（banner/backdrop/thumb），
 * 无横图时用标题散列色做氛围渐变，绝不硬裁竖版海报。
 */
export function CinemaHeroBackdrop({ item, active }: { item: MediaCardSummary; active: boolean }) {
  const wideArtwork = useMemo(
    () => ({
      ...item.artwork,
      posterUrl: undefined,
    }),
    [item.artwork],
  );
  const { url, onError } = useBackdropUrl(wideArtwork);

  return (
    <div className={styles.backdropSlide} data-active={active ? 'true' : 'false'} aria-hidden="true">
      {url ? (
        <img className={styles.backdropImage} src={url} alt="" onError={onError} />
      ) : (
        <div className={styles.backdropAmbient} style={{ background: generatePlaceholderColor(item.title) }} />
      )}
    </div>
  );
}
