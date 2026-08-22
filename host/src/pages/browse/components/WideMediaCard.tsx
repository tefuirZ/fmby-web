import { Clock3, Play } from 'lucide-react';
import { Link } from 'react-router';
import { StatusBadge } from '@fmby/v2-shared/ui';
import { formatRelativeTime } from '@fmby/v2-shared/time';
import type { MediaCardSummary } from '@fmby/v2-shared/contracts/browse';
import type { ArtworkSet } from '@fmby/v2-shared/contracts/assets';
import { MediaProgressBar } from './MediaProgressBar';
import { buildMediaMeta, buildCardProgressLabel, resolvePlayableTargetId } from './utils';
import cardStyles from '../styles/cards.module.css';
import sharedStyles from '../styles/shared.module.css';

function pickWideArtworkUrl(artwork: ArtworkSet): string | null {
  return artwork.bannerUrl ?? artwork.backdropUrl ?? artwork.thumbUrl ?? null;
}

export function WideMediaCard({
  item,
  primaryLabel = '继续播放',
}: {
  item: MediaCardSummary;
  primaryLabel?: string;
}) {
  const image = item.availabilityNotice ? undefined : pickWideArtworkUrl(item.artwork);
  const progressLabel = buildCardProgressLabel(item);
  const playbackTargetId = resolvePlayableTargetId(item);

  return (
    <article className={cardStyles.wideCard}>
      <Link className={cardStyles.wideThumbLink} to={`/item/${item.id}`}>
        {image ? (
          <img alt={item.title} className={cardStyles.wideThumb} src={image} />
        ) : (
          <div className={cardStyles.imageFallback}>暂无封面</div>
        )}
      </Link>
      <div className={cardStyles.wideBody}>
        <div className={cardStyles.cardMetaRow}>
          <StatusBadge
            label={item.kindLabel}
            variant={item.progress?.completed ? 'success' : item.progress ? 'warning' : 'info'}
          />
          {item.lastPlayedAt ? (
            <span className={sharedStyles.metaText}>
              <Clock3 size={14} />
              {formatRelativeTime(item.lastPlayedAt)}
            </span>
          ) : null}
        </div>
        <Link className={cardStyles.cardTitleLink} to={`/item/${item.id}`}>
          <h3 className={cardStyles.cardTitle}>{item.title}</h3>
        </Link>
        <div className={cardStyles.cardMeta}>{buildMediaMeta(item).join(' · ')}</div>
        {item.description ? <p className={cardStyles.cardDescription}>{item.description}</p> : null}
        {item.availabilityNotice ? (
          <div className={cardStyles.cardNotice}>{item.availabilityNotice}</div>
        ) : null}
        {item.progress ? (
          <MediaProgressBar value={item.progress.progressPercent} label={progressLabel} />
        ) : null}
        <div className={sharedStyles.buttonRow}>
          {playbackTargetId ? (
            <Link className={sharedStyles.primaryButton} to={`/play/${playbackTargetId}`}>
              <Play size={16} />
              {item.progress ? primaryLabel : '立即播放'}
            </Link>
          ) : (
            <span className={sharedStyles.ghostButton} aria-disabled="true">
              暂不可播放
            </span>
          )}
          <Link className={sharedStyles.ghostButton} to={`/item/${item.id}`}>
            查看详情
          </Link>
        </div>
      </div>
    </article>
  );
}
