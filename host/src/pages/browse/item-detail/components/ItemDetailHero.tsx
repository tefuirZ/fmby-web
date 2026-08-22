import { useState } from 'react';
import { Link } from 'react-router';
import type { ItemDetailResponse } from '@fmby/v2-shared/contracts/browse/item';
import { usePosterUrl, useBackdropUrl, generatePlaceholderColor } from '@fmby/v2-shared/hooks/usePosterUrl';
import { PosterBadges, buildPosterBadgeModel } from '../../PosterBadges';
import { MediaProgressBar, SmallStat } from '../../components';
import { InlineBanner } from '@fmby/v2-shared/ui';
import { formatDateTime, formatDuration } from '@fmby/v2-shared/time';
import detailStyles from '../../styles/detail.module.css';
import cardStyles from '../../styles/cards.module.css';
import sharedStyles from '../../styles/shared.module.css';

interface ItemDetailHeroProps {
  item: ItemDetailResponse;
  posterBadges: ReturnType<typeof buildPosterBadgeModel>;
}

export function ItemDetailHero({ item, posterBadges }: ItemDetailHeroProps) {
  const { url: backdrop } = useBackdropUrl(item.artwork);
  const { url: poster, onError: onPosterError } = usePosterUrl(item.artwork);
  const [posterFailed, setPosterFailed] = useState(false);
  const playbackItemId = item.playbackTargetId ?? item.id;

  return (
    <section className={detailStyles.detailHero}>
      <div
        className={detailStyles.detailBackdrop}
        style={backdrop ? { backgroundImage: `url(${backdrop})` } : undefined}
      />
      <div className={detailStyles.detailLayout}>
        <div className={detailStyles.detailPosterColumn}>
          <div className={detailStyles.detailPosterWrap}>
            {poster && !posterFailed ? (
              <img
                alt={item.title}
                className={detailStyles.detailPoster}
                src={poster}
                onError={() => {
                  onPosterError();
                  setPosterFailed(true);
                }}
              />
            ) : (
              <div
                className={detailStyles.detailPosterFallback}
                style={{ background: generatePlaceholderColor(item.title) }}
              >
                {item.title.charAt(0)}
              </div>
            )}
            <PosterBadges
              feature={posterBadges.feature}
              score={posterBadges.score}
              resolution={posterBadges.resolution}
              footer={posterBadges.footer}
            />
          </div>
        </div>
        <div className={detailStyles.detailCopy}>
          <div className={sharedStyles.eyebrow}>{item.kindLabel}</div>
          <h1 className={detailStyles.detailTitle}>{item.title}</h1>
          {item.originalTitle && item.originalTitle !== item.title ? (
            <div className={detailStyles.detailSubtitle}>{item.originalTitle}</div>
          ) : null}
          {item.tagline ? <div className={detailStyles.detailSubtitle}>{item.tagline}</div> : null}
          <div className={detailStyles.detailMeta}>
            {item.meta.map((entry) => (
              <span key={entry} className={cardStyles.metaChip}>
                {entry}
              </span>
            ))}
          </div>
          <div className={detailStyles.detailButtonRow}>
            <Link className={sharedStyles.primaryButton} to={`/play/${playbackItemId}`}>
              {item.primaryActionLabel}
            </Link>
            {item.library?.id ? (
              <Link className={sharedStyles.secondaryButton} to={`/libraries/${item.library.id}`}>
                {item.secondaryActionLabel ?? '查看所在媒体库'}
              </Link>
            ) : null}
          </div>
          {item.progress ? (
            <MediaProgressBar
              value={item.progress.progressPercent}
              label={
                item.progress.remainingLabel ??
                `已观看 ${Math.round(item.progress.progressPercent)}%`
              }
            />
          ) : null}
          {!item.canPlay ? (
            <InlineBanner
              variant="warning"
              title="当前内容暂时无法直接播放"
              description="可以先查看技术信息，或稍后再试。"
            />
          ) : null}
          <p className={detailStyles.detailSummary}>{item.description}</p>
          {item.genres.length > 0 || item.tags.length > 0 ? (
            <div className={detailStyles.detailTagRow}>
              {[...item.genres, ...item.tags].map((tag) => (
                <span key={tag} className={detailStyles.detailTag}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          <div className={cardStyles.smallStatsGrid}>
            <SmallStat label="时长" value={formatDuration(item.runtimeSeconds)} icon="time" />
            <SmallStat label="评分" value={item.ratingLabel ?? '未提供'} icon="score" />
            <SmallStat label="最近播放" value={formatDateTime(item.lastPlayedAt)} />
            <SmallStat label="最近入库" value={formatDateTime(item.addedAt)} />
          </div>
        </div>
      </div>
    </section>
  );
}
