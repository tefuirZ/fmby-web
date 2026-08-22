import {
  startTransition,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { itemApi } from '@/domains/item';
import { playbackApi } from '@/domains/playback';
import { VideoPlayer } from '@/features/player';
import { HoverScrollArea } from '@/shared/ui';
import { queryKeys } from '@/shared/query-keys';
import { getErrorMessage } from '@/shared/utils/error';
import styles from './PlayPage.module.css';
import { ExternalPlayerBar } from './play/ExternalPlayerBar';
import {
  DeferredSidebarPrompt,
  EpisodeQueueItem,
  PlaybackOverviewPanel,
  SidebarMediaCard,
  SidebarSection,
} from './play/PlayPanels';
import {
  buildPlaybackPath,
  buildPlayerPoster,
  buildPortablePlaybackUrl,
  parseMimeContainer,
  scheduleDeferredQuery,
} from './play/playbackPresentation';
import { usePlaybackProgress } from './play/usePlaybackProgress';

export function PlayPage() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [allowDetailQuery, setAllowDetailQuery] = useState(false);
  const [allowSidebarQuery, setAllowSidebarQuery] = useState(false);

  const requestSidebarQuery = useCallback(() => {
    startTransition(() => {
      setAllowSidebarQuery(true);
    });
  }, []);

  const sessionQuery = useQuery({
    queryKey: queryKeys.playback.info(itemId ?? ''),
    queryFn: () => playbackApi.createSession(itemId ?? ''),
    enabled: Boolean(itemId),
    retry: false,
  });

  const itemQuery = useQuery({
    queryKey: queryKeys.playback.item(itemId ?? ''),
    queryFn: () => itemApi.getDetail(itemId ?? ''),
    enabled: Boolean(itemId) && sessionQuery.isSuccess && allowDetailQuery,
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const seasonQuery = useQuery({
    queryKey: queryKeys.playback.season(itemQuery.data?.season?.id),
    queryFn: () => itemApi.getDetail(itemQuery.data?.season?.id ?? ''),
    enabled:
      allowSidebarQuery &&
      itemQuery.data?.kind === 'episode' &&
      Boolean(itemQuery.data?.season?.id) &&
      !itemQuery.data?.series?.id,
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const seriesRootId = itemQuery.data?.series?.id || seasonQuery.data?.series?.id;

  const seriesQuery = useQuery({
    queryKey: queryKeys.playback.series(seriesRootId),
    queryFn: () => itemApi.getDetail(seriesRootId ?? ''),
    enabled:
      allowSidebarQuery && itemQuery.data?.kind === 'episode' && Boolean(seriesRootId),
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const seriesEpisodesQuery = useQuery({
    queryKey: queryKeys.playback.seriesEpisodes(seriesRootId),
    queryFn: () => itemApi.getDescendants(seriesRootId ?? '', 2000),
    enabled:
      allowSidebarQuery && itemQuery.data?.kind === 'episode' && Boolean(seriesRootId),
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const session = sessionQuery.data;
  const detail = itemQuery.data;
  const seriesDetail = seriesQuery.data;
  const isEpisodeView = detail?.kind === 'episode';
  const isResolvingSeriesRoot =
    isEpisodeView && Boolean(detail?.season?.id) && !seriesRootId && seasonQuery.isPending;
  const isSeriesEpisodesLoading =
    isEpisodeView &&
    Boolean(seriesRootId) &&
    (seriesEpisodesQuery.isPending || seriesEpisodesQuery.isFetching);
  const episodeSeriesTitle =
    seriesDetail?.title ??
    seasonQuery.data?.series?.name ??
    detail?.series?.name ??
    '当前剧集';
  const portableStreamUrl =
    session?.externalStreamUrl ??
    (session?.streamUrl ? buildPortablePlaybackUrl(session.streamUrl) : undefined);
  const playerPoster = buildPlayerPoster(detail, seriesDetail);
  const seriesEpisodes = (seriesEpisodesQuery.data ?? []).filter(
    (entry) => entry.kind === 'episode' && entry.id !== itemId,
  );
  const hasSupportingDetailError = allowDetailQuery && itemQuery.isError;
  const isSupportingDetailLoading =
    sessionQuery.isSuccess &&
    !hasSupportingDetailError &&
    (!allowDetailQuery || itemQuery.isPending || itemQuery.isFetching);
  const {
    resumePosition,
    handleTimeUpdate,
    handlePause,
    handleEnded,
  } = usePlaybackProgress({
    itemId,
    sessionId: session?.sessionId,
    resumePositionSeconds: session?.resumePositionSeconds,
  });

  useEffect(() => {
    setAllowDetailQuery(false);
    setAllowSidebarQuery(false);
    setSidebarOpen(false);
  }, [itemId]);

  useEffect(() => {
    if (!itemId || !sessionQuery.isSuccess || allowDetailQuery) {
      return;
    }

    return scheduleDeferredQuery(() => {
      startTransition(() => {
        setAllowDetailQuery(true);
      });
    });
  }, [allowDetailQuery, itemId, sessionQuery.isSuccess]);

  const handleError = useCallback(() => {
    // 播放器引擎自带错误 UI，这里不额外弹层
  }, []);

  const handleCopyLink = useCallback(() => {
    if (!portableStreamUrl) return;
    void navigator.clipboard.writeText(portableStreamUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [portableStreamUrl]);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((current) => {
      const next = !current;
      if (next) {
        requestSidebarQuery();
      }
      return next;
    });
  }, [requestSidebarQuery]);

  if (!itemId) {
    return (
      <div className={styles.errorPanel}>
        <div className={styles.panelCard}>
          <h1>播放器无法打开</h1>
          <p className={styles.metaText}>当前链接缺少内容标识。</p>
          <div className={styles.panelActions}>
            <Link className={styles.primaryButton} to="/">
              回首页
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (sessionQuery.isPending) {
    return (
      <div className={styles.loadingPanel}>
        <div className={styles.panelCard}>
          <h1>正在准备播放</h1>
          <p className={styles.metaText}>正在创建播放会话并获取播放地址...</p>
        </div>
      </div>
    );
  }

  if (sessionQuery.isError) {
    return (
      <div className={styles.errorPanel}>
        <div className={styles.panelCard}>
          <h1>暂时无法开始播放</h1>
          <p className={styles.metaText}>{getErrorMessage(sessionQuery.error)}</p>
          <div className={styles.panelActions}>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={() => sessionQuery.refetch()}
            >
              重试
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => navigate(-1)}
            >
              返回上一页
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!session?.streamUrl) {
    return (
      <div className={styles.errorPanel}>
        <div className={styles.panelCard}>
          <h1>当前版本暂无可用播放源</h1>
          <p className={styles.metaText}>
            {session?.browserPlaybackHint ??
              session?.fallbackHint ??
              '请稍后重试或改用外部播放器。'}
          </p>
          <div className={styles.panelActions}>
            {portableStreamUrl ? (
              <a
                className={styles.primaryButton}
                href={portableStreamUrl}
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLink size={15} />
                使用外部播放器
              </a>
            ) : null}
            <Link className={styles.secondaryButton} to={`/item/${itemId}`}>
              返回详情页
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const firstSubtitle = session.subtitleTracks[0];
  const subtitleUrl = firstSubtitle
    ? `${window.location.origin}${
        firstSubtitle.id.startsWith('/') ? '' : '/api/assets/subtitles/'
      }${firstSubtitle.id}`
    : undefined;
  const canPlay = session.canDirectPlayInBrowser;
  const playbackRiskHint = canPlay ? session.browserPlaybackHint : undefined;
  const containerBadge = parseMimeContainer(session.mimeType);
  const audioBadge = session.audioTracks[0]?.codecLabel?.toUpperCase();
  const recommendedItems = detail?.related.slice(0, 5) ?? [];
  const hasSidebar =
    isEpisodeView ||
    (detail?.kind !== 'episode' && recommendedItems.length > 0);

  return (
    <div className={styles.page} data-surface="immersive">
      <header className={styles.pageHeader}>
        <button
          className={styles.iconButton}
          type="button"
          onClick={() => navigate(-1)}
          aria-label="返回"
        >
          <ArrowLeft size={17} />
        </button>
        <div className={styles.titleBlock}>
          <strong className={styles.title}>{session.title}</strong>
          {session.subtitle ? (
            <span className={styles.subtitle}>{session.subtitle}</span>
          ) : null}
        </div>
        <div className={styles.headerRight}>
          <Link className={styles.ghostButton} to={`/item/${itemId}`}>
            详情
          </Link>
          {portableStreamUrl ? (
            <a
              className={styles.secondaryButton}
              href={portableStreamUrl}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink size={14} />
              外部播放
            </a>
          ) : null}
          {hasSidebar ? (
            <button className={styles.secondaryButton} type="button" onClick={handleToggleSidebar}>
              {sidebarOpen ? '关闭队列' : isEpisodeView ? '剧集队列' : '相关推荐'}
            </button>
          ) : null}
        </div>
      </header>

      <div className={styles.playbackShell}>
        <div className={styles.playbackLayout}>
          <div
            className={styles.playbackStage}
            data-has-sidebar={hasSidebar ? 'true' : 'false'}
          >
            <section className={styles.playbackMain}>
              <div className={styles.videoWrap}>
                <div className={styles.videoBox}>
                  {canPlay ? (
                    <VideoPlayer
                      className={styles.playerInner}
                      url={session.streamUrl}
                      poster={playerPoster}
                      subtitleUrl={subtitleUrl}
                      subtitleLabel={firstSubtitle?.label}
                      resumePosition={resumePosition}
                      autoplay
                      onTimeUpdate={handleTimeUpdate}
                      onPause={handlePause}
                      onEnded={handleEnded}
                      onError={handleError}
                    />
                  ) : (
                    <div className={styles.incompatOverlay}>
                      <div className={styles.incompatIcon}>
                        <AlertCircle size={26} />
                      </div>
                      <h2 className={styles.incompatTitle}>
                        此格式无法在浏览器中直接播放
                      </h2>
                      <p className={styles.incompatHint}>
                        {session.browserPlaybackHint ??
                          '当前版本的编码格式不受浏览器支持（如 HEVC、AC3、MKV 等），请使用外部播放器或支持转码的客户端播放。'}
                      </p>
                      <div className={styles.incompatActions}>
                        {portableStreamUrl ? (
                          <a
                            className={styles.primaryButton}
                            href={portableStreamUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <ExternalLink size={14} />
                            在外部播放器中打开
                          </a>
                        ) : null}
                        <button
                          className={styles.secondaryButton}
                          type="button"
                          onClick={handleCopyLink}
                        >
                          {copied ? <Check size={14} /> : <Copy size={14} />}
                          {copied ? '已复制' : '复制播放链接'}
                        </button>
                        {portableStreamUrl ? (
                          <a
                            className={styles.ghostButton}
                            href={portableStreamUrl}
                            rel="noreferrer"
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

            {hasSidebar && sidebarOpen ? (
              <>
                <button
                  className={styles.queueBackdrop}
                  type="button"
                  aria-label="关闭播放队列"
                  onClick={() => setSidebarOpen(false)}
                />
                <aside
                  className={`${styles.sidebarColumn} ${styles.sidebarDrawer}`}
                  aria-label={isEpisodeView ? '剧集队列' : '相关推荐'}
                  onFocusCapture={requestSidebarQuery}
                  onPointerEnter={requestSidebarQuery}
                >
                  {detail?.kind === 'episode' ? (
                    <SidebarSection
                      title="剧集列表"
                      description={`已列出《${episodeSeriesTitle}》全部已识别剧集。`}
                      fillHeight
                    >
                      {!allowSidebarQuery ? (
                        <DeferredSidebarPrompt
                          actionLabel="加载剧集列表"
                          description="剧集列表按需拉取，先把播放器和起播链路让出来。"
                          onClick={requestSidebarQuery}
                        />
                      ) : isResolvingSeriesRoot || isSeriesEpisodesLoading ? (
                        <div className={styles.sidebarEmpty}>正在加载本剧剧集...</div>
                      ) : !seriesRootId ? (
                        <div className={styles.sidebarEmpty}>
                          暂时无法定位当前剧集所属剧集，请稍后刷新重试。
                        </div>
                      ) : seriesEpisodesQuery.isError ? (
                        <div className={styles.sidebarEmpty}>
                          剧集列表加载失败：{getErrorMessage(seriesEpisodesQuery.error)}
                        </div>
                      ) : seriesEpisodes.length > 0 ? (
                        <HoverScrollArea
                          className={styles.episodeListScroller}
                          axis="y"
                          delayMs={50}
                        >
                          <div className={styles.episodeQueue}>
                            {seriesEpisodes.map((episode) => (
                              <EpisodeQueueItem key={episode.id} item={episode} />
                            ))}
                          </div>
                        </HoverScrollArea>
                      ) : (
                        <div className={styles.sidebarEmpty}>当前还没有识别到本剧剧集。</div>
                      )}
                    </SidebarSection>
                  ) : (
                    <SidebarSection
                      title={detail?.kind === 'movie' ? '猜你喜欢' : '延伸内容'}
                      description="别让右侧空着，顺手把相近内容接上。"
                    >
                      {!allowSidebarQuery ? (
                        <DeferredSidebarPrompt
                          actionLabel="加载延伸内容"
                          description="相关推荐延后到交互后再查，避免和起播抢资源。"
                          onClick={requestSidebarQuery}
                        />
                      ) : (
                        <div className={styles.sidebarCardList}>
                          {recommendedItems.map((item) => (
                            <SidebarMediaCard
                              key={item.id}
                              item={item}
                              actionLabel={item.playbackTargetId ? '直接播放' : '查看详情'}
                              to={
                                item.playbackTargetId
                                  ? buildPlaybackPath(item)
                                  : `/item/${item.id}`
                              }
                            />
                          ))}
                        </div>
                      )}
                    </SidebarSection>
                  )}
                </aside>
              </>
            ) : null}
          </div>

          <section className={styles.playbackDetails}>
            {playbackRiskHint ? (
              <div className={styles.playbackNotice}>
                <div className={styles.playbackNoticeIcon}>
                  <AlertCircle size={16} />
                </div>
                <div className={styles.playbackNoticeBody}>
                  <strong className={styles.playbackNoticeTitle}>网页端兼容性提示</strong>
                  <p className={styles.playbackNoticeText}>{playbackRiskHint}</p>
                </div>
              </div>
            ) : null}

            <div className={styles.infoBar}>
              <div className={styles.formatBadges}>
                {containerBadge ? (
                  <span className={styles.badge}>{containerBadge}</span>
                ) : null}
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
                  onClick={handleCopyLink}
                  title="复制视频直链"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? '已复制' : '复制链接'}
                </button>
                {portableStreamUrl ? (
                  <a
                    className={styles.secondaryButton}
                    href={portableStreamUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ExternalLink size={13} />
                    外部播放器
                  </a>
                ) : null}
                {hasSidebar ? (
                  <button className={styles.ghostButton} type="button" onClick={handleToggleSidebar}>
                    {sidebarOpen ? '收起队列' : isEpisodeView ? '打开剧集队列' : '打开相关推荐'}
                  </button>
                ) : null}
              </div>
            </div>

            {portableStreamUrl ? <ExternalPlayerBar streamUrl={portableStreamUrl} /> : null}

            {hasSupportingDetailError ? (
              <div className={styles.playbackNotice}>
                <div className={styles.playbackNoticeIcon}>
                  <AlertCircle size={16} />
                </div>
                <div className={styles.playbackNoticeBody}>
                  <strong className={styles.playbackNoticeTitle}>
                    内容信息补齐失败
                  </strong>
                  <p className={styles.playbackNoticeText}>
                    {getErrorMessage(itemQuery.error)}
                  </p>
                  <div className={styles.externalActions}>
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      onClick={() => itemQuery.refetch()}
                    >
                      重试详情信息
                    </button>
                    <Link className={styles.ghostButton} to={`/item/${itemId}`}>
                      返回详情页
                    </Link>
                  </div>
                </div>
              </div>
            ) : isSupportingDetailLoading ? (
              <div className={styles.playbackNotice}>
                <div className={styles.playbackNoticeIcon}>
                  <Sparkles size={16} />
                </div>
                <div className={styles.playbackNoticeBody}>
                  <strong className={styles.playbackNoticeTitle}>
                    内容信息正在后台补齐
                  </strong>
                  <p className={styles.playbackNoticeText}>
                    播放会话已优先建立，系列详情、推荐和剧集列表会在空闲或交互后再加载。
                  </p>
                </div>
              </div>
            ) : null}

            {detail ? (
              <PlaybackOverviewPanel item={detail} seriesItem={seriesDetail} />
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
// 播放器生命周期收口在 features/player 与 play/*，页面层只做视图拼装。
