import type { Dispatch, SetStateAction } from 'react';
import type { ItemDetailResponse } from '@fmby/v2-shared/contracts/browse/item';
import type { ItemDetailQueryLike } from '../hooks/useItemDetailQueries';
import type { MediaCardSummary } from '@fmby/v2-shared/contracts/browse';
import { HoverScrollArea, InlineBanner } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import detailStyles from '../../styles/detail.module.css';
import sharedStyles from '../../styles/shared.module.css';
import { EpisodeRow } from './EpisodeRow';
import { buildEpisodeSectionSummary } from '../formUtils';

interface ItemDetailEpisodeSectionProps {
  item: ItemDetailResponse;
  seasonOptions: MediaCardSummary[];
  episodeOptions: MediaCardSummary[];
  selectedSeasonId: string | undefined;
  setSelectedSeasonId: Dispatch<SetStateAction<string | undefined>>;
  selectedSeasonQuery: ItemDetailQueryLike;
}

export function ItemDetailEpisodeSection({
  item,
  seasonOptions,
  episodeOptions,
  selectedSeasonId,
  setSelectedSeasonId,
  selectedSeasonQuery,
}: ItemDetailEpisodeSectionProps) {
  return (
    <section className={detailStyles.detailInfoCard}>
      <div className={detailStyles.detailSectionHeader}>
        <div className={detailStyles.sectionHeadingStack}>
          <h2 className={sharedStyles.sectionTitle}>
            {item.kind === 'series' ? '分季与分集' : '本季分集'}
          </h2>
          <p className={sharedStyles.sectionDescription}>
            {buildEpisodeSectionSummary(item, seasonOptions, episodeOptions, selectedSeasonId)}
          </p>
        </div>
        {episodeOptions.length > 0 ? (
          <span className={detailStyles.detailSectionHint}>左右滚动切换分集</span>
        ) : null}
      </div>
      {item.kind === 'series' && seasonOptions.length > 0 ? (
        <HoverScrollArea axis="x" delayMs={0} className={detailStyles.seasonSelector}>
          {seasonOptions.map((season) => (
            <button
              key={season.id}
              className={detailStyles.seasonChip}
              data-selected={selectedSeasonId === season.id}
              type="button"
              onClick={() => setSelectedSeasonId(season.id)}
            >
              <span>{season.title}</span>
              {season.itemCount ? (
                <span className={detailStyles.seasonChipMeta}>{season.itemCount} 集</span>
              ) : null}
            </button>
          ))}
        </HoverScrollArea>
      ) : null}

      {item.kind === 'series' && selectedSeasonQuery.isPending ? (
        <div className={detailStyles.episodeSelectorEmpty}>正在加载当前季度分集...</div>
      ) : null}
      {item.kind === 'series' && selectedSeasonQuery.isError ? (
        <InlineBanner
          variant="error"
          title="当前季度分集加载失败"
          description={getErrorMessage(selectedSeasonQuery.error)}
        />
      ) : null}
      {episodeOptions.length > 0 ? (
        <HoverScrollArea axis="x" delayMs={0} className={detailStyles.episodeList}>
          {episodeOptions.map((episode) => (
            <EpisodeRow key={episode.id} episode={episode} />
          ))}
        </HoverScrollArea>
      ) : (
        !(
          item.kind === 'series' &&
          (selectedSeasonQuery.isPending || selectedSeasonQuery.isError)
        ) ? (
          <div className={detailStyles.episodeSelectorEmpty}>
            还没有识别到可播放分集。
          </div>
        ) : null
      )}
    </section>
  );
}
