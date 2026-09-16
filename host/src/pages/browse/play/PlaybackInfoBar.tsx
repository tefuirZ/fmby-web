/** 播放页信息条：格式徽标 + 外部操作（复制/外部播放器/队列开关）。 */

import { Check, Copy, ExternalLink } from 'lucide-react';
import styles from '../PlayPage.module.css';

interface PlaybackInfoBarProps {
  containerBadge?: string | null;
  audioBadge?: string | null;
  playbackRiskHint?: string | null;
  canPlay: boolean;
  copied: boolean;
  onCopyLink: () => void;
  portableStreamUrl?: string;
  hasSidebar: boolean;
  sidebarOpen: boolean;
  isEpisodeView: boolean;
  onToggleSidebar: () => void;
}

export function PlaybackInfoBar({
  containerBadge,
  audioBadge,
  playbackRiskHint,
  canPlay,
  copied,
  onCopyLink,
  portableStreamUrl,
  hasSidebar,
  sidebarOpen,
  isEpisodeView,
  onToggleSidebar,
}: PlaybackInfoBarProps) {
  return (
    <div className={styles.infoBar}>
      <div className={styles.formatBadges}>
        {containerBadge ? <span className={styles.badge}>{containerBadge}</span> : null}
        {audioBadge ? <span className={styles.badge}>{audioBadge}</span> : null}
        {playbackRiskHint ? (
          <span className={`${styles.badge} ${styles.badgeNotice}`}>兼容性待确认</span>
        ) : !canPlay ? (
          <span className={`${styles.badge} ${styles.badgeWarn}`}>不兼容</span>
        ) : null}
      </div>
      <div className={styles.externalActions}>
        <button
          className={styles.ghostButton}
          type="button"
          onClick={onCopyLink}
          title="复制视频直链"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? '已复制' : '复制链接'}
        </button>
        {portableStreamUrl ? (
          <a
            className={styles.secondaryButton}
            href={portableStreamUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <ExternalLink size={13} />
            外部播放器
          </a>
        ) : null}
        {hasSidebar ? (
          <button className={styles.ghostButton} type="button" onClick={onToggleSidebar}>
            {sidebarOpen ? '收起队列' : isEpisodeView ? '打开剧集队列' : '打开相关推荐'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
