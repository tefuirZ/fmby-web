import type { ItemDetailResponse } from '@/domains/item';
import type { TechnicalCard } from '../types';
import detailStyles from '../../styles/detail.module.css';
import sharedStyles from '../../styles/shared.module.css';
import { StreamDisclosureGroup } from './StreamDisclosureGroup';

interface ItemDetailTechnicalSectionProps {
  technicalCards: TechnicalCard[];
  effectiveTechnical: ItemDetailResponse['technical'] | undefined;
}

export function ItemDetailTechnicalSection({
  technicalCards,
  effectiveTechnical,
}: ItemDetailTechnicalSectionProps) {
  return (
    <section className={detailStyles.detailInfoCard}>
      <h2 className={sharedStyles.sectionTitle}>媒体参数</h2>
      <div className={detailStyles.detailTechnicalGrid}>
        {technicalCards.map((card) => (
          <div key={card.label} className={detailStyles.detailTechnicalPanel}>
            <span className={detailStyles.detailTechnicalPanelTitle}>{card.label}</span>
            <strong className={detailStyles.detailTechnicalPanelValue}>{card.value}</strong>
            {card.hint ? (
              <span className={detailStyles.detailTechnicalPanelHint}>{card.hint}</span>
            ) : null}
          </div>
        ))}
      </div>

      {effectiveTechnical && effectiveTechnical.videoStreams.length > 0 ? (
        <StreamDisclosureGroup
          title="视频流详情"
          streams={effectiveTechnical.videoStreams}
          type="video"
        />
      ) : null}
      {effectiveTechnical && effectiveTechnical.audioStreams.length > 0 ? (
        <StreamDisclosureGroup
          title="音频流详情"
          streams={effectiveTechnical.audioStreams}
          type="audio"
          defaultCollapsed
        />
      ) : null}
      {effectiveTechnical && effectiveTechnical.subtitleStreams.length > 0 ? (
        <StreamDisclosureGroup
          title="字幕流详情"
          streams={effectiveTechnical.subtitleStreams}
          type="subtitle"
          defaultCollapsed
        />
      ) : null}
    </section>
  );
}
