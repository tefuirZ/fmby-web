import { useMemo } from 'react';
import { Play } from 'lucide-react';
import { Link } from 'react-router';
import { usePosterUrl, useBackdropUrl, generatePlaceholderColor } from '@/shared/hooks/usePosterUrl';
import type { MediaCardSummary } from '@/domains/browse';
import type { ArtworkSet } from '@/domains/assets';
import { buildCardProgressLabel, resolvePlayableTargetId } from './utils';
import cardStyles from '../styles/cards.module.css';
import sharedStyles from '../styles/shared.module.css';

function useWideArtworkUrl(artwork: ArtworkSet) {
  const wideArtwork = useMemo(
    () => ({
      ...artwork,
      posterUrl: undefined,
    }),
    [artwork],
  );
  return useBackdropUrl(wideArtwork);
}

export function LandscapeMediaCard({ item }: { item: MediaCardSummary }) {
  const { url: backdropCandidate, onError: onBackdropError } = useWideArtworkUrl(item.artwork);
  const { url: posterCandidate, onError: onPosterError } = usePosterUrl(item.artwork);
  const backdrop = item.availabilityNotice ? undefined : backdropCandidate;
  const poster = item.availabilityNotice ? undefined : posterCandidate;
  const image = backdrop ?? poster;
  const progressLabel = buildCardProgressLabel(item);
  const playbackTargetId = resolvePlayableTargetId(item);

  return (
    <article className={cardStyles.landscapeCard}>
      <Link className={cardStyles.landscapeMediaLink} to={playbackTargetId ? `/play/${playbackTargetId}` : `/item/${item.id}`}>
        <div className={cardStyles.landscapeImageWrap}>
          {image ? (
            <img
              alt={item.title}
              className={cardStyles.landscapeImage}
              src={image}
              onError={backdrop ? onBackdropError : onPosterError}
              loading="lazy"
            />
          ) : (
            /*
             * 无封面时的首字占位。原来内联写死 fontWeight: 700 —— 粗体是暗房里
             * 唯一一处「喊话」的字重，且内联优先级压过 CSS Module，换肤时改不动。
             * 这里撤掉字重覆盖，字重交回 .imageFallback 决定。
             */
            <div
              className={cardStyles.imageFallback}
              style={{
                background: generatePlaceholderColor(item.title),
                fontSize: '2.4rem',
              }}
            >
              {item.title.charAt(0)}
            </div>
          )}
          <div className={cardStyles.landscapeOverlay} />
          {item.progress ? (
            <div className={cardStyles.landscapeProgress}>
              <div className={cardStyles.posterProgressFill} style={{ width: `${item.progress.progressPercent}%` }} />
            </div>
          ) : null}
          <span
            className={cardStyles.landscapePlayPill}
            data-state={playbackTargetId ? 'playable' : 'unavailable'}
          >
            <Play size={14} />
            {playbackTargetId ? (item.progress ? '继续播放' : '立即播放') : '暂不可播放'}
          </span>
        </div>
      </Link>
      <div className={cardStyles.landscapeBody}>
        <div className={cardStyles.cardMetaRow}>
          <span className={cardStyles.microChip}>{item.kindLabel}</span>
          {item.year ? <span className={sharedStyles.metaText}>{item.year}</span> : null}
          {item.resolutionLabel ? <span className={sharedStyles.metaText}>{item.resolutionLabel}</span> : null}
        </div>
        <Link className={cardStyles.cardTitleLink} to={`/item/${item.id}`}>
          <h3 className={cardStyles.cardTitle}>{item.title}</h3>
        </Link>
        {item.availabilityNotice ? (
          <div className={cardStyles.cardNotice}>{item.availabilityNotice}</div>
        ) : null}
        {progressLabel ? <div className={cardStyles.cardMeta}>{progressLabel}</div> : null}
      </div>
    </article>
  );
}
