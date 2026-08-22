import { Link } from 'react-router';
import { usePosterUrl, generatePlaceholderColor } from '@fmby/v2-shared/hooks/usePosterUrl';
import { formatCompactDuration } from '@fmby/v2-shared/time';
import type { MediaCardSummary } from '@fmby/v2-shared/contracts/browse';
import { PosterBadges, buildPosterBadgeModel } from '../PosterBadges';
import cardStyles from '../styles/cards.module.css';
import sharedStyles from '../styles/shared.module.css';

function buildPosterDisplayTitle(item: MediaCardSummary) {
  if (item.kind === 'season') {
    return item.seasonName ?? (item.seasonNumber ? `第 ${item.seasonNumber} 季` : item.title);
  }
  return item.title;
}

function buildPosterMeta(item: MediaCardSummary) {
  if (item.kind === 'season') {
    return item.seriesName ?? item.subtitle ?? undefined;
  }
  return item.subtitle ?? item.resolutionLabel ?? formatCompactDuration(item.durationSeconds);
}

export function PosterMediaCard({ item }: { item: MediaCardSummary }) {
  const { url: posterCandidate, onError } = usePosterUrl(item.artwork);
  const image = item.availabilityNotice ? undefined : posterCandidate;
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
  const displayTitle = buildPosterDisplayTitle(item);
  const displayMeta = buildPosterMeta(item);

  return (
    <article className={cardStyles.posterCard} data-kind={item.kind}>
      <Link className={cardStyles.posterLink} to={`/item/${item.id}`}>
        <div className={cardStyles.posterImageWrap}>
          {image ? (
            <img alt={displayTitle} className={cardStyles.posterImage} src={image} onError={onError} loading="lazy" />
          ) : (
            <div
              className={cardStyles.posterArtworkFallback}
              style={{
                background: generatePlaceholderColor(displayTitle),
              }}
            >
              <span className={cardStyles.posterArtworkInitial}>{displayTitle.charAt(0)}</span>
              <span className={cardStyles.posterArtworkType}>{item.kindLabel}</span>
            </div>
          )}
          <PosterBadges
            feature={badges.feature}
            score={badges.score}
            resolution={badges.resolution}
            footer={badges.footer}
          />
          {item.progress ? (
            <div className={cardStyles.posterProgress}>
              <div className={cardStyles.posterProgressFill} style={{ width: `${item.progress.progressPercent}%` }} />
            </div>
          ) : null}
        </div>
        <div className={cardStyles.posterBody}>
          <div className={cardStyles.cardMetaRow}>
            <span className={cardStyles.microChip}>{item.kindLabel}</span>
            {item.year ? <span className={sharedStyles.metaText}>{item.year}</span> : null}
          </div>
          <h3 className={cardStyles.cardTitle}>{displayTitle}</h3>
          {item.availabilityNotice ? (
            <div className={cardStyles.cardNotice}>{item.availabilityNotice}</div>
          ) : null}
          {displayMeta ? <div className={cardStyles.cardMeta}>{displayMeta}</div> : null}
        </div>
      </Link>
    </article>
  );
}
