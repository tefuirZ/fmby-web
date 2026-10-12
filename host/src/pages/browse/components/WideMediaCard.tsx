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
      {/* P0-3（fe01）：缩略图链接此前**无图时彻底无名**（fallback 是无文本的空 div，
          <Link> 拿不到可访问名）→ ariaSnapshot 报 5 条无名控件。补 aria-label 具名，
          并给 fallback 打 aria-hidden（纯装饰，不参与朗读）。 */}
      <Link
        className={cardStyles.wideThumbLink}
        to={`/item/${item.id}`}
        aria-label={item.title}
      >
        {image ? (
          <img alt="" className={cardStyles.wideThumb} src={image} loading="lazy" decoding="async" />
        ) : (
          <div className={cardStyles.imageFallback} aria-hidden="true">暂无封面</div>
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
