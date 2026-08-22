import styles from '../styles/shared.module.css';

export function BrowseLoadingState() {
  return (
    <div className={styles.page}>
      <div className={styles.skeletonHero} />
      <div className={styles.skeletonSection}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className={styles.skeletonWideCard} />
        ))}
      </div>
      <div className={styles.skeletonGrid}>
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className={styles.skeletonPosterCard} />
        ))}
      </div>
    </div>
  );
}
