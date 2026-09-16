/** 播放页反馈面板：缺 ID / 加载中 / 错误 / 无播放源（四类终态）。 */

import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router';
import styles from '../PlayPage.module.css';

function FeedbackPanel({
  variant,
  children,
}: {
  variant: 'loading' | 'error';
  children: ReactNode;
}) {
  return (
    <div className={variant === 'loading' ? styles.loadingPanel : styles.errorPanel}>
      <div className={styles.panelCard}>{children}</div>
    </div>
  );
}

/** 缺少内容标识。 */
export function MissingItemPanel() {
  return (
    <FeedbackPanel variant="error">
      <h1>播放器无法打开</h1>
      <p className={styles.metaText}>当前链接缺少内容标识。</p>
      <div className={styles.panelActions}>
        <Link className={styles.primaryButton} to="/">
          回首页
        </Link>
      </div>
    </FeedbackPanel>
  );
}

/** 会话创建中。 */
export function PreparingPanel() {
  return (
    <FeedbackPanel variant="loading">
      <h1>正在准备播放</h1>
      <p className={styles.metaText}>正在创建播放会话并获取播放地址...</p>
    </FeedbackPanel>
  );
}

/** 播放会话失败 / 无权限。 */
export function PlaybackErrorPanel({
  forbidden,
  message,
  onRetry,
  onBack,
}: {
  forbidden: boolean;
  message: string;
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <FeedbackPanel variant="error">
      <h1>{forbidden ? '没有播放权限' : '暂时无法开始播放'}</h1>
      <p className={styles.metaText}>{message}</p>
      <div className={styles.panelActions}>
        <button className={styles.primaryButton} type="button" onClick={onRetry}>
          重试
        </button>
        <button className={styles.secondaryButton} type="button" onClick={onBack}>
          返回上一页
        </button>
      </div>
    </FeedbackPanel>
  );
}

/** 无可用直出播放源：引导外部播放器。 */
export function NoSourcePanel({
  hint,
  portableStreamUrl,
  itemId,
}: {
  hint?: string | null;
  portableStreamUrl?: string;
  itemId?: string;
}) {
  return (
    <FeedbackPanel variant="error">
      <h1>当前版本暂无可用播放源</h1>
      <p className={styles.metaText}>{hint ?? '请稍后重试或改用外部播放器。'}</p>
      <div className={styles.panelActions}>
        {portableStreamUrl ? (
          <a
            className={styles.primaryButton}
            href={portableStreamUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <ExternalLink size={15} />
            使用外部播放器
          </a>
        ) : null}
        <Link className={styles.secondaryButton} to={`/item/${itemId ?? ''}`}>
          返回详情页
        </Link>
      </div>
    </FeedbackPanel>
  );
}
