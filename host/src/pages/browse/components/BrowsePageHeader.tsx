import type { ReactNode } from 'react';
import styles from '../styles/shared.module.css';

interface BrowsePageHeaderProps {
  title: string;
  description: string;
  meta?: ReactNode;
  actions?: ReactNode;
}

export function BrowsePageHeader({
  title,
  description,
  meta,
  actions,
}: BrowsePageHeaderProps) {
  return (
    <header className={styles.pageHeader}>
      <div>
        <div className={styles.eyebrow}>放映厅</div>
        <h1 className={styles.pageTitle}>{title}</h1>
        <p className={styles.pageDescription}>{description}</p>
        {meta ? <div className={styles.headerMeta}>{meta}</div> : null}
      </div>
      {actions ? <div className={styles.headerActions}>{actions}</div> : null}
    </header>
  );
}
