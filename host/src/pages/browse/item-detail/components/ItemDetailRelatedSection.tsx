import type { ItemDetailResponse } from '@fmby/v2-shared/contracts/browse/item';
import { PosterMediaCard } from '../../components';
import detailStyles from '../../styles/detail.module.css';
import sharedStyles from '../../styles/shared.module.css';

interface ItemDetailRelatedSectionProps {
  item: ItemDetailResponse;
}

export function ItemDetailRelatedSection({ item }: ItemDetailRelatedSectionProps) {
  return (
    <section className={detailStyles.detailRelatedCard}>
      <h2 className={sharedStyles.sectionTitle}>相关内容</h2>
      {item.related.length === 0 ? (
        <div className={sharedStyles.emptyGrid}>还没有可推荐的相关内容。</div>
      ) : (
        <div className={detailStyles.detailRelatedGrid}>
          {item.related.map((related) => (
            <PosterMediaCard key={related.id} item={related} />
          ))}
        </div>
      )}
    </section>
  );
}
