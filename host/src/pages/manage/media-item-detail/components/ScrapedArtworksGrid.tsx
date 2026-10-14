import type { ManageMediaItemDetailRecord } from '@fmby/v2-shared/contracts/manage/media-items';
import sharedStyles from '../../ManagePages.module.css';
import { formatOptional, formatResolution, getArtworkKindLabel, isWideArtwork } from '../formatters';
import styles from '../MediaItemDetail.module.css';
import { ArtImage } from './ArtImage';

interface ScrapedArtworksGridProps {
  scrapedArtworks: ManageMediaItemDetailRecord['scrapedArtworks'];
}

/** 「刮削图片」栅格：刮削源返回的候选，只读。 */
export function ScrapedArtworksGrid({ scrapedArtworks }: ScrapedArtworksGridProps) {
  return (
    <div className={sharedStyles.stackText}>
      <span className={styles.kicker}>刮削图片</span>
      {scrapedArtworks.length === 0 ? (
        <div className={sharedStyles.emptyInlineState}>
          刮削源还没有返回可用的图片候选。
        </div>
      ) : (
        <div className={styles.assetGrid}>
          {scrapedArtworks.map((artwork) => (
            <div className={styles.assetCard} key={`${artwork.kind}-${artwork.url}`}>
              <ArtImage
                alt={`刮削${getArtworkKindLabel(artwork.kind)}`}
                compact
                placeholder="图片无法加载"
                src={artwork.url}
                wide={isWideArtwork(artwork.kind)}
              />
              <div className={styles.assetBody}>
                <div className={styles.badgeRow}>
                  <span className={sharedStyles.chip}>
                    {getArtworkKindLabel(artwork.kind)}
                  </span>
                </div>
                <span className={styles.assetMeta}>
                  {formatResolution(artwork.width, artwork.height)} · 语言{' '}
                  {formatOptional(artwork.language)}
                </span>
              </div>
              <div className={styles.assetActions}>
                <a
                  className={sharedStyles.smallButton}
                  href={artwork.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  查看原图
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
