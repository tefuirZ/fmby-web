import type { ReactNode } from 'react';
import styles from '../styles/shared.module.css';

interface BrowseSectionProps {
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: 'card' | 'shelf';
  children: ReactNode;
}

export function BrowseSection({
  title,
  description,
  action,
  variant = 'card',
  children,
}: BrowseSectionProps) {
  return (
    <section className={`${styles.sectionCard} ${variant === 'shelf' ? styles.sectionShelf : ''}`}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>{title}</h2>
          {description ? <p className={styles.sectionDescription}>{description}</p> : null}
        </div>
        {action ? <div className={styles.sectionAction}>{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
