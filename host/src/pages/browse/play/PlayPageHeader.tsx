/** 播放页顶部条：返回 + 标题 + 右侧操作（详情 / 外部播放 / 队列开关）。 */

import type { RefObject } from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Link } from 'react-router';
import styles from '../PlayPage.module.css';

interface PlayPageHeaderProps {
  title?: string;
  subtitle?: string | null;
  itemId?: string;
  portableStreamUrl?: string;
  hasSidebar: boolean;
  sidebarOpen: boolean;
  isEpisodeView: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onBack: () => void;
  onToggleSidebar: () => void;
}

export function PlayPageHeader({
  title,
  subtitle,
  itemId,
  portableStreamUrl,
  hasSidebar,
  sidebarOpen,
  isEpisodeView,
  triggerRef,
  onBack,
  onToggleSidebar,
}: PlayPageHeaderProps) {
  return (
    <header className={styles.pageHeader}>
      <button className={styles.iconButton} type="button" onClick={onBack} aria-label="返回">
        <ArrowLeft size={17} />
      </button>
      <div className={styles.titleBlock}>
        <strong className={styles.title}>{title}</strong>
        {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
      </div>
      <div className={styles.headerRight}>
        <Link className={styles.ghostButton} to={`/item/${itemId ?? ''}`}>
          详情
        </Link>
        {portableStreamUrl ? (
          <a
            className={styles.secondaryButton}
            href={portableStreamUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <ExternalLink size={14} />
            外部播放
          </a>
        ) : null}
        {hasSidebar ? (
          <button
            ref={triggerRef}
            className={styles.secondaryButton}
            type="button"
            aria-expanded={sidebarOpen}
            aria-controls="playback-sidebar"
            onClick={onToggleSidebar}
          >
            {sidebarOpen ? '关闭队列' : isEpisodeView ? '剧集队列' : '相关推荐'}
          </button>
        ) : null}
      </div>
    </header>
  );
}
