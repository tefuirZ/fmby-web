import { Trash2 } from 'lucide-react';
import type { ManageMediaItemDetailRecord } from '@fmby/v2-shared/contracts/manage/media-items';
import { StatusBadge } from '@fmby/v2-shared/ui';
import { formatDateTime } from '@fmby/v2-shared/time';
import sharedStyles from '../../ManagePages.module.css';
import {
  formatFileSize,
  formatOperator,
  formatResolution,
  getArtworkKindLabel,
  isWideArtwork,
} from '../formatters';
import styles from '../MediaItemDetail.module.css';
import type { MediaItemMutations } from '../types';
import { ArtImage } from './ArtImage';

interface ArtworkOverridesGridProps {
  artworkOverrides: ManageMediaItemDetailRecord['artworkOverrides'];
  deleteArtworkMutation: MediaItemMutations['deleteArtworkMutation'];
  onRequestDelete: (payload: { overrideId: string; kindLabel: string; filename: string }) => void;
}

/** 「自定义封面」栅格：管理员上传的本地覆盖，可删。 */
export function ArtworkOverridesGrid({
  artworkOverrides,
  deleteArtworkMutation,
  onRequestDelete,
}: ArtworkOverridesGridProps) {
  return (
    <div className={sharedStyles.stackText}>
      <span className={styles.kicker}>自定义封面</span>
      {artworkOverrides.length === 0 ? (
        <div className={sharedStyles.emptyInlineState}>
          还没有上传过自定义图片，前台使用的是刮削结果或随文件的图片。
        </div>
      ) : (
        <div className={styles.assetGrid}>
          {artworkOverrides.map((artwork) => {
            const kindLabel = getArtworkKindLabel(artwork.artworkKind);
            const isDeleting =
              deleteArtworkMutation.isPending &&
              deleteArtworkMutation.variables?.overrideId === artwork.id;

            return (
              <div className={styles.assetCard} key={artwork.id}>
                <ArtImage
                  alt={`${kindLabel}：${artwork.originalFilename}`}
                  compact
                  placeholder="图片无法加载"
                  src={artwork.url}
                  wide={isWideArtwork(artwork.artworkKind)}
                />
                <div className={styles.assetBody}>
                  <div className={styles.badgeRow}>
                    <span className={sharedStyles.chip}>{kindLabel}</span>
                    <StatusBadge
                      label={artwork.isActive ? '生效中' : '未生效'}
                      variant={artwork.isActive ? 'success' : 'neutral'}
                    />
                  </div>
                  <span className={styles.assetName}>{artwork.originalFilename}</span>
                  <span className={styles.assetMeta}>
                    {formatResolution(artwork.width, artwork.height)} ·{' '}
                    {formatFileSize(artwork.sizeBytes)} · {artwork.mimeType}
                  </span>
                  <span className={styles.assetMeta}>
                    由{' '}
                    {formatOperator(
                      artwork.createdByDisplayName,
                      artwork.createdByUsername,
                      artwork.createdBy,
                    )}{' '}
                    上传于 {formatDateTime(artwork.createdAt)}
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
                  <button
                    className={sharedStyles.smallDangerButton}
                    disabled={isDeleting}
                    type="button"
                    onClick={() =>
                      onRequestDelete({
                        overrideId: artwork.id,
                        kindLabel,
                        filename: artwork.originalFilename,
                      })
                    }
                  >
                    <Trash2 size={14} />
                    {isDeleting ? '删除中…' : '删除'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
