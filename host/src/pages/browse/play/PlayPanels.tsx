import type { CSSProperties, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';

import type { MediaCardSummary } from '@/domains/browse';
import type { ItemDetailResponse } from '@/domains/item';
import { generatePlaceholderColor, usePosterUrl } from '@/shared/hooks/usePosterUrl';

import styles from '../PlayPage.module.css';
import { PosterBadges, buildPosterBadgeModel } from '../PosterBadges';
import {
  buildEpisodeListArtwork,
  buildOverviewArtwork,
  buildOverviewMeta,
  buildPlaybackPath,
} from './playbackPresentation';

export function DeferredSidebarPrompt({
  actionLabel,
  description,
  onClick,
}: {
  actionLabel: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <div className={styles.sidebarEmpty}>
      <p>{description}</p>
      <button className={styles.secondaryButton} type="button" onClick={onClick}>
        {actionLabel}
      </button>
    </div>
  );
}

export function PlaybackOverviewPanel({
  item,
  seriesItem,
}: {
  item: ItemDetailResponse;
  seriesItem?: ItemDetailResponse;
}) {
  const displayItem = item.kind === 'episode' && seriesItem ? seriesItem : item;
  const { url, onError } = usePosterUrl(buildOverviewArtwork(item, seriesItem));
  const detailTargetId =
    item.kind === 'episode' ? seriesItem?.id ?? item.series?.id ?? item.id : displayItem.id;
  const overviewBadges = buildPosterBadgeModel({
    kind: displayItem.kind,
    tags: displayItem.tags,
    featureCandidates: [
      displayItem.technical.dynamicRangeLabel,
      displayItem.technical.audioCodecLabel,
    ],
    ratingLabel: displayItem.ratingLabel,
    resolutionLabel: displayItem.technical.resolutionLabel,
    year: displayItem.year,
    itemCount: displayItem.itemCount,
    durationSeconds: displayItem.runtimeSeconds,
  });
  const meta = buildOverviewMeta(displayItem);
  const contextLabel =
    item.kind === 'episode'
      ? [item.series?.name, item.season?.name, item.title]
          .filter((entry): entry is string => Boolean(entry))
          .join(' · ') || '正在播放'
      : displayItem.kindLabel;

  return (
    <section className={styles.overviewPanel}>
      <div className={styles.overviewPosterColumn}>
        <div className={styles.overviewPosterWrap}>
          {url ? (
            <img
              alt={displayItem.title}
              className={styles.overviewPoster}
              src={url}
              loading="lazy"
              onError={onError}
            />
          ) : (
            <div
              className={styles.overviewPosterFallback}
              style={{ background: generatePlaceholderColor(displayItem.title) }}
            >
              {displayItem.title.charAt(0)}
            </div>
          )}
          <PosterBadges
            feature={overviewBadges.feature}
            score={overviewBadges.score}
            resolution={overviewBadges.resolution}
            footer={overviewBadges.footer}
          />
        </div>
      </div>
      <div className={styles.overviewBody}>
        <span className={styles.overviewEyebrow}>{contextLabel || '当前播放'}</span>
        <h2 className={styles.overviewTitle}>{displayItem.title}</h2>
        {meta.length > 0 ? (
          <div className={styles.overviewMetaRow}>
            {meta.map((entry) => (
              <span key={entry} className={styles.overviewMetaChip}>
                {entry}
              </span>
            ))}
          </div>
        ) : null}
        <p className={styles.overviewDescription}>
          {displayItem.description?.trim() || '暂时还没有剧情简介。'}
        </p>
        <div className={styles.overviewActions}>
          <Link className={styles.primaryButton} to={`/item/${detailTargetId}`}>
            {item.kind === 'episode' ? '查看剧集详情' : '查看完整详情'}
          </Link>
          {item.kind === 'episode' && item.season?.id ? (
            <Link className={styles.secondaryButton} to={`/item/${item.season.id}`}>
              查看本季
            </Link>
          ) : displayItem.library?.id ? (
            <Link
              className={styles.secondaryButton}
              to={`/libraries/${displayItem.library.id}`}
            >
              查看所在媒体库
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function SidebarSection({
  title,
  description,
  children,
  fillHeight = false,
  style,
}: {
  title: string;
  description: string;
  children: ReactNode;
  fillHeight?: boolean;
  style?: CSSProperties;
}) {
  return (
    <section
      style={style}
      className={`${styles.sidebarSection} ${fillHeight ? styles.sidebarSectionFill : ''}`}
    >
      <div className={styles.sidebarSectionHeader}>
        <h2 className={styles.sidebarSectionTitle}>{title}</h2>
        <p className={styles.sidebarSectionDescription}>{description}</p>
      </div>
      {children}
    </section>
  );
}

export function SidebarMediaCard({
  item,
  actionLabel,
  to,
}: {
  item: MediaCardSummary;
  actionLabel: string;
  to: string;
}) {
  const { url, onError } = usePosterUrl(buildEpisodeListArtwork(item));
  const badges = buildPosterBadgeModel({
    kind: item.kind,
    badge: item.badge,
    tags: item.tags,
    ratingLabel: item.ratingLabel,
    resolutionLabel: item.resolutionLabel,
    year: item.year,
    itemCount: item.itemCount,
    durationSeconds: item.durationSeconds,
  });

  return (
    <article className={styles.sidebarMediaCard}>
      <Link className={styles.sidebarPosterLink} to={`/item/${item.id}`}>
        <div className={styles.sidebarPosterWrap}>
          {url ? (
            <img
              alt={item.title}
              className={styles.sidebarPoster}
              src={url}
              loading="lazy"
              onError={onError}
            />
          ) : (
            <div
              className={styles.sidebarPosterFallback}
              style={{ background: generatePlaceholderColor(item.title) }}
            >
              {item.title.charAt(0)}
            </div>
          )}
          <PosterBadges
            feature={badges.feature}
            score={badges.score}
            resolution={badges.resolution}
            footer={badges.footer}
          />
        </div>
      </Link>
      <div className={styles.sidebarMediaBody}>
        <span className={styles.sidebarMediaEyebrow}>
          {item.subtitle ?? item.kindLabel}
        </span>
        <Link className={styles.sidebarMediaTitleLink} to={`/item/${item.id}`}>
          {item.title}
        </Link>
        <div className={styles.sidebarMediaMeta}>{buildCompactMediaMeta(item)}</div>
        <Link className={styles.sidebarActionLink} to={to}>
          {actionLabel}
          <ChevronRight size={14} />
        </Link>
      </div>
    </article>
  );
}

export function EpisodeQueueItem({
  item,
}: {
  item: MediaCardSummary;
}) {
  const { url, onError } = usePosterUrl(buildEpisodeListArtwork(item));
  const badges = buildPosterBadgeModel({
    kind: item.kind,
    badge: item.badge,
    tags: item.tags,
    ratingLabel: item.ratingLabel,
    resolutionLabel: item.resolutionLabel,
    year: item.year,
    itemCount: item.itemCount,
    durationSeconds: item.durationSeconds,
  });

  return (
    <Link className={styles.episodeQueueItem} to={buildPlaybackPath(item)}>
      <div className={styles.episodeQueuePosterWrap}>
        {url ? (
          <img
            alt={item.title}
            className={styles.episodeQueuePoster}
            src={url}
            loading="lazy"
            onError={onError}
          />
        ) : (
          <div
            className={styles.episodeQueuePosterFallback}
            style={{ background: generatePlaceholderColor(item.title) }}
          >
            {item.title.charAt(0)}
          </div>
        )}
        <PosterBadges
          feature={badges.feature}
          score={badges.score}
          resolution={badges.resolution}
          footer={badges.footer}
        />
      </div>
      <div className={styles.episodeQueueBody}>
        <span className={styles.episodeQueueLabel}>{item.subtitle ?? '剧集'}</span>
        <strong className={styles.episodeQueueTitle}>{item.title}</strong>
        <span className={styles.episodeQueueMeta}>{buildCompactMediaMeta(item, '点击播放')}</span>
      </div>
      <ChevronRight size={14} className={styles.episodeQueueChevron} />
    </Link>
  );
}

function buildCompactMediaMeta(item: MediaCardSummary, fallback = '继续往下看') {
  return (
    [item.year ? String(item.year) : undefined, item.resolutionLabel]
      .filter((entry): entry is string => Boolean(entry))
      .join(' · ') || fallback
  );
}
