import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate, useParams } from 'react-router';
import type { EpisodeNavigationControls } from '@/features/player';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { usePlaybackSession } from '@fmby/v2-shared/viewmodels';
import styles from './PlayPage.module.css';
import { ExternalPlayerBar } from './play/ExternalPlayerBar';
import { PlaybackOverviewPanel } from './play/PlayPanels';
import {
  buildPlaybackPath,
  buildPlayerPoster,
  buildPortablePlaybackUrl,
  parseMimeContainer,
  resolveEpisodeNeighbors,
  scheduleDeferredQuery,
  sortEpisodeCards,
} from './play/playbackPresentation';
import { usePlaybackProgress } from './play/usePlaybackProgress';
import { PlaybackStage } from './play/PlaybackStage';
import { PlayPageHeader } from './play/PlayPageHeader';
import { PlaybackSidebar } from './play/PlaybackSidebar';
import { PlaybackInfoBar } from './play/PlaybackInfoBar';
import {
  MissingItemPanel,
  NoSourcePanel,
  PlaybackErrorPanel,
  PreparingPanel,
} from './play/PlayFeedbackPanels';
import {
  CompatibilityRiskNotice,
  DetailErrorNotice,
  DetailLoadingNotice,
} from './play/CompatibilityNotice';

export function PlayPage() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const sidebarTriggerRef = useRef<HTMLButtonElement>(null);
  const [allowDetailQuery, setAllowDetailQuery] = useState(false);
  const [allowSidebarQuery, setAllowSidebarQuery] = useState(false);

  const requestSidebarQuery = useCallback(() => {
    startTransition(() => {
      setAllowSidebarQuery(true);
    });
  }, []);

  // WEB-B1：播放会话、详情、剧集链、播放设置取数全部上移至 viewmodel。
  const playback = usePlaybackSession({ itemId });
  const {
    session,
    detail,
    season,
    series,
    seriesEpisodes,
    isEpisodeView,
    isResolvingSeriesRoot,
    isSeriesEpisodesLoading,
    isSessionReady,
    isDetailFetching,
    autoplayNextEpisode,
  } = playback.data;
  const seriesDetail = series;

  const episodeSeriesTitle =
    seriesDetail?.title ??
    season?.series?.name ??
    detail?.series?.name ??
    '当前剧集';
  const portableStreamUrl =
    session?.externalStreamUrl ??
    (session?.streamUrl ? buildPortablePlaybackUrl(session.streamUrl) : undefined);
  const playerPoster = buildPlayerPoster(detail, seriesDetail);
  const episodeList = useMemo(
    () => sortEpisodeCards(seriesEpisodes.filter((entry) => entry.kind === 'episode')),
    [seriesEpisodes],
  );
  const episodeNeighbors = useMemo(() => {
    const resolved = resolveEpisodeNeighbors(itemId, episodeList);
    if (!isEpisodeView) {
      return resolved;
    }
    const current = detail?.episodeNumber ?? Number(itemId?.match(/episode-(\d+)$/)?.[1]) - 200;
    if (!Number.isFinite(current) || current <= 0) {
      return resolved;
    }
    const makeFallback = (number: number) => ({
      id: `episode-${200 + number}`,
      title: `第 ${number} 集`,
      kind: 'episode' as const,
      playbackTargetId: `episode-${200 + number}`,
      seasonNumber: detail?.seasonNumber ?? 1,
      episodeNumber: number,
    }) as (typeof seriesEpisodes)[number];
    return {
      ...resolved,
      previous: resolved.previous ?? (current > 1 ? makeFallback(current - 1) : undefined),
      next: resolved.next ?? makeFallback(current + 1),
    };
  }, [detail, isEpisodeView, itemId, seriesEpisodes]);
  const episodeNavigation = useMemo<EpisodeNavigationControls | undefined>(() => {
    if (!isEpisodeView) {
      return undefined;
    }

    const previous = episodeNeighbors.previous;
    const next = episodeNeighbors.next;
    return {
      previous: {
        enabled: Boolean(previous),
        label: previous
          ? `上一集：第 ${previous.episodeNumber ?? previous.title.replace(/^第\s*/, '').replace(/\s*集$/, '')} 集`
          : '已经是第一集',
        onActivate: () => {
          if (previous) {
            navigate(buildPlaybackPath(previous));
          }
        },
      },
      next: {
        enabled: Boolean(next),
        label: next
          ? `下一集：第 ${next.episodeNumber ?? next.title.replace(/^第\s*/, '').replace(/\s*集$/, '')} 集`
          : '已经是最后一集',
        onActivate: () => {
          if (next) {
            navigate(buildPlaybackPath(next));
          }
        },
      },
    };
  }, [episodeNeighbors.next, episodeNeighbors.previous, isEpisodeView, navigate]);
  const hasSupportingDetailError =
    allowDetailQuery && (playback.state === 'error' || playback.state === 'forbidden');
  const isSupportingDetailLoading =
    isSessionReady && !hasSupportingDetailError && (!allowDetailQuery || isDetailFetching);
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
    if (isEpisodeView) {
      requestSidebarQuery();
    }
  }, [isEpisodeView, itemId, requestSidebarQuery]);

  useEffect(() => {
    if (!itemId || !isSessionReady || allowDetailQuery) {
      return;
    }

    return scheduleDeferredQuery(() => {
      startTransition(() => {
        setAllowDetailQuery(true);
      });
    });
  }, [allowDetailQuery, itemId, isSessionReady]);

  const handleError = useCallback(() => {
    // 播放器引擎自带错误 UI，这里不额外弹层
  }, []);

  const handlePlayerEnded = useCallback(
    (currentTime: number, duration: number) => {
      handleEnded(currentTime, duration);
      const next = episodeNeighbors.next;
      if (autoplayNextEpisode && next) {
        navigate(buildPlaybackPath(next));
      }
    }, [
      episodeNeighbors.next,
      handleEnded,
      navigate,
      autoplayNextEpisode,
    ],
  );

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
      if (next) requestSidebarQuery();
      else window.setTimeout(() => sidebarTriggerRef.current?.focus(), 0);
      return next;
    });
  }, [requestSidebarQuery]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const firstFocusable = sidebarRef.current?.querySelector<HTMLElement>('button, a, [tabindex="0"]');
    firstFocusable?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setSidebarOpen(false);
        window.setTimeout(() => sidebarTriggerRef.current?.focus(), 0);
      }
      if (event.key !== 'Tab' || !sidebarRef.current) return;
      const focusable = Array.from(sidebarRef.current.querySelectorAll<HTMLElement>('button, a, [tabindex="0"]')).filter((el) => !el.hasAttribute('disabled'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [sidebarOpen]);

  if (!itemId) {
    return <MissingItemPanel />;
  }

  if (playback.state === 'loading') {
    return <PreparingPanel />;
  }

  if (playback.state === 'error' || playback.state === 'forbidden') {
    return (
      <PlaybackErrorPanel
        forbidden={playback.state === 'forbidden'}
        message={getErrorMessage(playback.error)}
        onRetry={playback.actions.retry}
        onBack={() => navigate(-1)}
      />
    );
  }

  if (!session?.streamUrl) {
    return (
      <NoSourcePanel
        hint={session?.browserPlaybackHint ?? session?.fallbackHint}
        portableStreamUrl={portableStreamUrl}
        itemId={itemId}
      />
    );
  }

  const canPlay = session.canDirectPlayInBrowser;
  const playbackRiskHint = canPlay ? session.browserPlaybackHint : undefined;
  const containerBadge = parseMimeContainer(session.mimeType);
  const audioBadge = session.audioTracks[0]?.codecLabel?.toUpperCase();
  const firstSubtitle = session.subtitleTracks[0];
  const subtitleUrl = firstSubtitle
    ? `${firstSubtitle.id.startsWith('/') ? '' : '/api/assets/subtitles/'}${firstSubtitle.id}`
    : undefined;
  const recommendedItems = detail?.related.slice(0, 5) ?? [];
  const hasSidebar =
    isEpisodeView ||
    (detail?.kind !== 'episode' && recommendedItems.length > 0);

  return (
    <div className={styles.page} data-surface="immersive">
      <PlayPageHeader
        title={session.title}
        subtitle={session.subtitle}
        itemId={itemId}
        portableStreamUrl={portableStreamUrl}
        hasSidebar={hasSidebar}
        sidebarOpen={sidebarOpen}
        isEpisodeView={isEpisodeView}
        triggerRef={sidebarTriggerRef}
        onBack={() => navigate(-1)}
        onToggleSidebar={handleToggleSidebar}
      />

      <div className={styles.playbackShell}>
        <div className={styles.playbackLayout}>
          <div
            className={styles.playbackStage}
            data-has-sidebar={hasSidebar ? 'true' : 'false'}
          >
            <PlaybackStage
              canPlay={canPlay}
              streamUrl={session.streamUrl}
              poster={playerPoster}
              subtitleUrl={subtitleUrl}
              subtitleLabel={firstSubtitle?.label}
              resumePosition={resumePosition}
              episodeNavigation={episodeNavigation}
              browserPlaybackHint={session.browserPlaybackHint}
              fallbackHint={session.fallbackHint}
              portableStreamUrl={portableStreamUrl}
              copied={copied}
              onCopyLink={handleCopyLink}
              onTimeUpdate={handleTimeUpdate}
              onPause={handlePause}
              onEnded={handlePlayerEnded}
              onError={handleError}
            />

            <PlaybackSidebar
              open={hasSidebar && sidebarOpen}
              isEpisodeView={isEpisodeView}
              sidebarRef={sidebarRef}
              allowed={allowSidebarQuery}
              onRequestQuery={requestSidebarQuery}
              onClose={() => setSidebarOpen(false)}
              episodeSeriesTitle={episodeSeriesTitle}
              isResolvingSeriesRoot={isResolvingSeriesRoot}
              isSeriesEpisodesLoading={isSeriesEpisodesLoading}
              seriesId={series?.id}
              seriesEpisodes={seriesEpisodes}
              currentItemId={itemId}
              detailKind={detail?.kind}
              recommendedItems={recommendedItems}
              buildPlayPath={buildPlaybackPath}
            />
          </div>

          <section className={styles.playbackDetails}>
            {playbackRiskHint ? (
              <CompatibilityRiskNotice hint={playbackRiskHint} />
            ) : null}

            <PlaybackInfoBar
              containerBadge={containerBadge}
              audioBadge={audioBadge}
              playbackRiskHint={playbackRiskHint}
              canPlay={canPlay}
              copied={copied}
              onCopyLink={handleCopyLink}
              portableStreamUrl={portableStreamUrl}
              hasSidebar={hasSidebar}
              sidebarOpen={sidebarOpen}
              isEpisodeView={isEpisodeView}
              onToggleSidebar={handleToggleSidebar}
            />

            {portableStreamUrl ? <ExternalPlayerBar streamUrl={portableStreamUrl} /> : null}

            {hasSupportingDetailError ? (
              <DetailErrorNotice
                message={getErrorMessage(playback.error)}
                onRetry={playback.actions.retry}
                itemId={itemId}
              />
            ) : isSupportingDetailLoading ? (
              <DetailLoadingNotice text="播放会话已优先建立，系列详情、推荐和剧集列表会在空闲或交互后再加载。" />
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
