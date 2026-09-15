import { Activity, Film, Monitor, Play, Smartphone, Tv, UserCheck, XCircle } from 'lucide-react';
import type { SessionRecord } from '@fmby/v2-shared/contracts/manage';
import styles from '../ManageOverviewCockpit.module.css';

interface LivePlaybackStreamsProps {
  sessions: SessionRecord[];
  onRevokeSession?: (sessionId: string) => void;
  isRevoking?: boolean;
}

export function LivePlaybackStreams({
  sessions,
  onRevokeSession,
  isRevoking = false,
}: LivePlaybackStreamsProps) {
  // 筛选出当前活跃/在线的会话
  const activeSessions = sessions.filter((s) => s.status === 'active' || s.current);

  const getDeviceIcon = (clientName?: string, deviceName?: string) => {
    const text = `${clientName || ''} ${deviceName || ''}`.toLowerCase();
    if (text.includes('tv') || text.includes('apple tv') || text.includes('box') || text.includes('kodi')) {
      return <Tv size={13} />;
    }
    if (text.includes('phone') || text.includes('mobile') || text.includes('android') || text.includes('ios') || text.includes('iphone') || text.includes('ipad')) {
      return <Smartphone size={13} />;
    }
    return <Monitor size={13} />;
  };

  return (
    <section className={styles.cockpitCard}>
      <div className={styles.cockpitCardHeader}>
        <div className={styles.cardTitleWrap}>
          <span className={styles.cardTitleIcon}>
            <Activity size={18} />
          </span>
          <h2 className={styles.cardTitle}>实时推流与在线播放</h2>
          <span className={styles.cardSubtitle}>（{activeSessions.length} 个在线会话）</span>
        </div>
        <div className={styles.cardHeaderActions}>
          <span className={`${styles.pulseDot} ${activeSessions.length > 0 ? styles.healthy : styles.attention}`} />
        </div>
      </div>

      {activeSessions.length === 0 ? (
        <div className={styles.radarContainer}>
          <div className={styles.radarScope}>
            <div className={styles.radarRingInner} />
            <div className={styles.radarCenterDot} />
            <div className={styles.radarBeam} />
          </div>
          <div className={styles.radarTitle}>当前无在线推流会话</div>
          <p className={styles.radarHint}>
            声纳监听中 · 当有客户端（网页端、Infuse、VidHub、Apple TV 等）发起直链播放时，将实时呈现在此。
          </p>
        </div>
      ) : (
        <div className={styles.streamsList}>
          {activeSessions.map((session) => {
            const isPlaying = Boolean(session.nowPlaying?.mediaTitle);
            const nowPlaying = session.nowPlaying;

            return (
              <article key={session.id} className={styles.streamCard}>
                {/* 封面海报或播放图标 */}
                <div className={styles.streamPosterWrap}>
                  {nowPlaying?.posterUrl ? (
                    <img
                      src={nowPlaying.posterUrl}
                      alt={nowPlaying.mediaTitle}
                      className={styles.streamPoster}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className={styles.streamPosterFallback}>
                      {isPlaying ? (
                        <Film size={20} style={{ color: 'var(--manage-cyan)', opacity: 0.85 }} />
                      ) : (
                        <Play size={20} style={{ opacity: 0.45 }} />
                      )}
                    </div>
                  )}
                </div>

                <div className={styles.streamContent}>
                  {/* 用户信息与推流状态标签 */}
                  <div className={styles.streamUserRow}>
                    <div className={styles.streamUserBadge}>
                      <UserCheck size={14} style={{ color: 'var(--manage-cyan)' }} />
                      <span>{session.userName}</span>
                      {session.current ? (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(当前管理登录)</span>
                      ) : null}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {/* 本项目架构为纯直链服务，无转码引擎，全量标识直链推流或在线待机 */}
                      {isPlaying ? (
                        <span className={styles.directPlayBadge}>
                          <Play size={12} />
                          直链推流 (Direct Play)
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(255, 255, 255, 0.06)',
                            color: 'var(--text-secondary)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                          }}
                        >
                          在线会话
                        </span>
                      )}

                      {onRevokeSession && !session.current ? (
                        <button
                          type="button"
                          title="强行终止此会话"
                          disabled={isRevoking}
                          onClick={() => onRevokeSession(session.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-muted)',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <XCircle size={15} style={{ color: 'var(--danger)' }} />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* 核心大标题：正在播放展示真实媒体名，未在播放展示在线待命 */}
                  <div className={styles.streamMediaTitle}>
                    {isPlaying ? (
                      <>
                        <span>{nowPlaying?.mediaTitle}</span>
                        {nowPlaying?.episodeTitle ? (
                          <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginLeft: '8px', fontWeight: 'normal' }}>
                            {nowPlaying.episodeTitle}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '13.5px', fontWeight: 500 }}>
                        在线待命中（媒体库浏览）
                      </span>
                    )}
                  </div>

                  {/* 客户端真实上报信息（第三方接口如 Infuse/Apple TV/网页端透传字段）与 IP */}
                  <div className={styles.streamMetaRow}>
                    <span className={styles.streamMetaItem}>
                      {getDeviceIcon(session.clientName, session.deviceName)}
                      <strong>{session.clientName || '未知客户端'}</strong>
                      {session.deviceName ? ` · ${session.deviceName}` : ''}
                    </span>

                    {session.ipAddress ? (
                      <span className={styles.streamMetaItem}>
                        IP: {session.ipAddress}
                      </span>
                    ) : null}

                    <span className={styles.streamMetaItem}>
                      最近活动：{new Date(session.lastActiveAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* 播放进度（仅在有媒体播放时展示真实进度） */}
                  {isPlaying && typeof nowPlaying?.progressPercent === 'number' ? (
                    <div className={styles.streamProgressWrap}>
                      <div className={styles.streamProgressBar}>
                        <div
                          className={styles.streamProgressFill}
                          style={{ width: `${nowPlaying.progressPercent}%` }}
                        />
                      </div>
                      <span className={styles.streamProgressText}>{nowPlaying.progressPercent}%</span>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
