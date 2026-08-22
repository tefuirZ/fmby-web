import { FolderOpen } from 'lucide-react';
import { Link } from 'react-router';
import { formatRelativeTime } from '@/shared/utils/date';
import type { LibrarySummary } from '@/domains/browse';
import type { ArtworkSet } from '@/domains/assets';
import { buildSafeBackgroundStyle } from './utils';
import cardStyles from '../styles/cards.module.css';
import sharedStyles from '../styles/shared.module.css';

/**
 * 媒体库横图上的压暗遮罩。
 *
 * 内联写死是因为它必须和背景图拼进同一条 background-image，CSS Module
 * 接不到这个位置。取纯黑而不是任何带色相的深色 —— 暗房画布是 #000，
 * 一旦遮罩偏蓝，横图边缘就会在黑底上浮出一圈冷色。
 * 底部不做到全黑：正文那层 .libraryBody 已经自带黑渐变兜底。
 */
const BACKDROP_SCRIM = 'linear-gradient(180deg, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.92))';

function pickWideArtworkUrl(artwork: ArtworkSet): string | null {
  return artwork.bannerUrl ?? artwork.backdropUrl ?? artwork.thumbUrl ?? null;
}

export function LibraryShowcaseCard({ library }: { library: LibrarySummary }) {
  const image = pickWideArtworkUrl(library.artwork);
  return (
    <Link className={cardStyles.libraryCard} to={`/libraries/${library.id}`}>
      <div
        className={cardStyles.libraryBackdrop}
        style={image ? buildSafeBackgroundStyle(image, BACKDROP_SCRIM) : undefined}
      />
      <div className={cardStyles.libraryBody}>
        <div className={cardStyles.cardMetaRow}>
          <span className={cardStyles.microChip}>
            <FolderOpen size={12} />
            {library.typeLabel}
          </span>
          {library.accentLabel ? <span className={sharedStyles.metaText}>{library.accentLabel}</span> : null}
        </div>
        <h3 className={cardStyles.cardTitle}>{library.name}</h3>
        {library.description ? <p className={cardStyles.cardDescription}>{library.description}</p> : null}
        <div className={cardStyles.libraryStats}>
          <span>{library.itemCount.toLocaleString('zh-CN')} 个内容</span>
          <span>{formatRelativeTime(library.updatedAt)}</span>
        </div>
      </div>
    </Link>
  );
}
