import { useState } from 'react';
import { Link } from 'react-router';
import type { MediaCardSummary } from '@/domains/browse';
import { useBackdropUrl } from '@/shared/hooks/usePosterUrl';
import detailStyles from '../../styles/detail.module.css';
import cardStyles from '../../styles/cards.module.css';
import sharedStyles from '../../styles/shared.module.css';
import { buildEpisodeRowTitle } from '../formUtils';

interface EpisodeRowProps {
  episode: MediaCardSummary;
}

export function EpisodeRow({ episode }: EpisodeRowProps) {
  const playbackId = episode.playbackTargetId ?? episode.id;
  const { url: artworkUrl, onError } = useBackdropUrl(episode.artwork);
  const [loadFailed, setLoadFailed] = useState(false);
  const meta = [
    episode.subtitle,
    episode.resolutionLabel,
    episode.durationSeconds ? `${Math.max(1, Math.round(episode.durationSeconds / 60))} 分钟` : undefined,
  ]
    .filter((entry): entry is string => Boolean(entry))
    .join(' · ');

  return (
    <div className={detailStyles.episodeRow}>
      <Link className={detailStyles.episodeCardMedia} to={`/item/${episode.id}`}>
        {artworkUrl && !loadFailed ? (
          <img
            alt={episode.title}
            className={detailStyles.episodeCardImage}
            src={artworkUrl}
            onError={() => {
              onError();
              setLoadFailed(true);
            }}
            loading="lazy"
          />
        ) : (
          <div className={detailStyles.episodeCardFallback}>暂无剧照</div>
        )}
        <span className={detailStyles.episodeCardIndex}>
          {episode.episodeNumber ? `第 ${episode.episodeNumber} 集` : episode.kindLabel}
        </span>
        {episode.resolutionLabel ? (
          <span className={`${cardStyles.posterCornerBadge} ${cardStyles.posterBadgeTopRight} ${cardStyles.posterResolutionBadge}`}>
            {episode.resolutionLabel}
          </span>
        ) : null}
        {!episode.hasPlayableSource ? (
          <span className={`${cardStyles.posterCornerBadge} ${cardStyles.posterBadgeBottomRight} ${cardStyles.posterFeatureBadge}`}>
            当前源待恢复
          </span>
        ) : null}
        {episode.progress ? (
          <div className={cardStyles.posterProgress}>
            <div
              className={cardStyles.posterProgressFill}
              style={{ width: `${episode.progress.progressPercent}%` }}
            />
          </div>
        ) : null}
      </Link>
      <div className={detailStyles.episodeRowCopy}>
        <Link className={cardStyles.cardTitleLink} to={`/item/${episode.id}`}>
          <strong className={detailStyles.episodeRowTitle}>{buildEpisodeRowTitle(episode)}</strong>
        </Link>
        <span className={detailStyles.episodeRowMeta}>{meta || '可直接进入本集详情'}</span>
        {episode.description ? (
          <p className={detailStyles.episodeRowDescription}>{episode.description}</p>
        ) : null}
      </div>
      <div className={detailStyles.episodeRowActions}>
        <Link className={sharedStyles.secondaryButton} to={`/item/${episode.id}`}>
          详情
        </Link>
        <Link className={sharedStyles.primaryButton} to={`/play/${playbackId}`}>
          播放本集
        </Link>
      </div>
    </div>
  );
}
