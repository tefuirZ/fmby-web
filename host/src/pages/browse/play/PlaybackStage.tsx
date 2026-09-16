/** 播放页视频舞台：播放器本体 + 不兼容兜底层（V1F 拆分：PlayPage → 子组件）。 */

import { AlertCircle, Check, Copy, ExternalLink } from 'lucide-react';
import { VideoPlayer, type EpisodeNavigationControls } from '@/features/player';
import styles from '../PlayPage.module.css';

interface PlaybackStageProps {
  canPlay: boolean;
  streamUrl: string;
  poster?: string;
  subtitleUrl?: string;
  subtitleLabel?: string;
  resumePosition: number;
  episodeNavigation?: EpisodeNavigationControls;
  browserPlaybackHint?: string | null;
  fallbackHint?: string | null;
  portableStreamUrl?: string;
  copied: boolean;
  onCopyLink: () => void;
  onTimeUpdate: (currentTime: number, duration: number) => void;
  onPause: (currentTime: number, duration: number) => void;
  onEnded: (currentTime: number, duration: number) => void;
  onError: (error: unknown) => void;
}

export function PlaybackStage({
  canPlay,
  streamUrl,
  poster,
  subtitleUrl,
  subtitleLabel,
  resumePosition,
  episodeNavigation,
  browserPlaybackHint,
  fallbackHint,
  portableStreamUrl,
  copied,
  onCopyLink,
  onTimeUpdate,
  onPause,
  onEnded,
  onError,
}: PlaybackStageProps) {
  return (
    <section className={styles.playbackMain}>
      <div className={styles.videoWrap}>
        <div className={styles.videoBox}>
          {canPlay ? (
            <VideoPlayer
              className={styles.playerInner}
              url={streamUrl}
              poster={poster}
              subtitleUrl={subtitleUrl}
              subtitleLabel={subtitleLabel}
              resumePosition={resumePosition}
              episodeNavigation={episodeNavigation}
              autoplay
              onTimeUpdate={onTimeUpdate}
              onPause={onPause}
              onEnded={onEnded}
              onError={onError}
            />
          ) : (
            <div className={styles.incompatOverlay}>
              <div className={styles.incompatIcon}>
                <AlertCircle size={26} />
              </div>
              <h2 className={styles.incompatTitle}>此格式无法在浏览器中直接播放</h2>
              <p className={styles.incompatHint}>
                {browserPlaybackHint ??
                  fallbackHint ??
                  '当前版本的编码格式不受浏览器支持（如 HEVC、AC3、MKV 等），请使用外部播放器打开原始直出地址。'}
              </p>
              <div className={styles.incompatActions}>
                {portableStreamUrl ? (
                  <a
                    className={styles.primaryButton}
                    href={portableStreamUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <ExternalLink size={14} />
                    在外部播放器中打开
                  </a>
                ) : null}
                <button className={styles.secondaryButton} type="button" onClick={onCopyLink}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? '已复制' : '复制播放链接'}
                </button>
                {portableStreamUrl ? (
                  <a
                    className={styles.ghostButton}
                    href={portableStreamUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                    title="在浏览器新标签中打开视频流"
                  >
                    <ExternalLink size={14} />
                    新标签打开
                  </a>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
