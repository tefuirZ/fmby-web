/** 播放页兼容性提示条（网页端兼容风险 + 内容信息补齐状态）。 */

import { AlertCircle, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import styles from '../PlayPage.module.css';

interface NoticeProps {
  icon: ReactNode;
  title: string;
  text: string;
  actions?: ReactNode;
}

export function PlaybackNotice({ icon, title, text, actions }: NoticeProps) {
  return (
    <div className={styles.playbackNotice}>
      <div className={styles.playbackNoticeIcon}>{icon}</div>
      <div className={styles.playbackNoticeBody}>
        <strong className={styles.playbackNoticeTitle}>{title}</strong>
        <p className={styles.playbackNoticeText}>{text}</p>
        {actions}
      </div>
    </div>
  );
}

/** 网页端编码兼容性风险。 */
export function CompatibilityRiskNotice({ hint }: { hint: string }) {
  return (
    <PlaybackNotice icon={<AlertCircle size={16} />} title="网页端兼容性提示" text={hint} />
  );
}

/** 详情信息补齐失败（可重试）。 */
export function DetailErrorNotice({
  message,
  onRetry,
  itemId,
}: {
  message: string;
  onRetry: () => void;
  itemId?: string;
}) {
  return (
    <PlaybackNotice
      icon={<AlertCircle size={16} />}
      title="内容信息补齐失败"
      text={message}
      actions={
        <div className={styles.externalActions}>
          <button className={styles.secondaryButton} type="button" onClick={onRetry}>
            重试详情信息
          </button>
          <Link className={styles.ghostButton} to={`/item/${itemId ?? ''}`}>
            返回详情页
          </Link>
        </div>
      }
    />
  );
}

/** 详情信息后台补齐中。 */
export function DetailLoadingNotice({ text }: { text: string }) {
  return (
    <PlaybackNotice icon={<Sparkles size={16} />} title="内容信息正在后台补齐" text={text} />
  );
}
