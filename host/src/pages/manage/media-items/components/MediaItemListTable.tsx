import { Link } from 'react-router';
import { Trash2 } from 'lucide-react';
import type { ManageMediaItemListRecord } from '@fmby/v2-shared/contracts/manage/media-items';
import type { PendingSourceDeleteState } from '../types';
import { StatusBadge } from '@fmby/v2-shared/ui';
import { formatDateTime, formatRelativeTime } from '@fmby/v2-shared/time';
import {
  getSourceStatusLabel,
  getSourceStatusVariant,
  getMetadataStatusLabel,
  getMetadataStatusVariant,
  buildOverrideSummary,
  buildOwnershipSummary,
  buildItemCode,
} from '../formUtils';
import { MediaItemPosterThumb } from './MediaItemPosterThumb';
import sharedStyles from '../../ManagePages.module.css';
import styles from '../../ManageMediaItemsPage.module.css';

interface MediaItemListTableProps {
  items: ManageMediaItemListRecord[];
  pendingSourceDelete: PendingSourceDeleteState | null;
  resolveDeletePending: boolean;
  resolveDeleteItemId?: string;
  deletePending: boolean;
  onRequestDelete: (item: ManageMediaItemListRecord) => void;
}

export function MediaItemListTable({
  items,
  pendingSourceDelete,
  resolveDeletePending,
  resolveDeleteItemId,
  deletePending,
  onRequestDelete,
}: MediaItemListTableProps) {
  return (
    <div className={`${sharedStyles.tableWrap} ${styles.desktopTable}`}>
      <table className={sharedStyles.table}>
        <thead>
          <tr>
            <th>资源</th>
            <th>状态</th>
            <th>本地覆盖</th>
            <th>最近更新</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <div className={styles.itemCell}>
                  <div className={styles.posterFrame}>
                    <MediaItemPosterThumb
                      title={item.title}
                      typeLabel={item.typeLabel}
                      posterUrl={item.posterUrl}
                    />
                  </div>

                  <div className={styles.itemCopy}>
                    <div className={styles.itemTitleRow}>
                      <span className={styles.itemTitle}>{item.title}</span>
                      <span className={sharedStyles.chip}>{item.typeLabel}</span>
                    </div>
                    <div className={styles.itemSubtitle}>
                      {item.originalTitle ?? '未提供原始标题'}
                    </div>
                    <div className={styles.itemContextLine}>
                      归属 {buildOwnershipSummary(item)}
                    </div>
                    <div className={styles.itemMetaLine}>
                      <span>{item.year ?? '年份待补'}</span>
                      {buildItemCode(item) ? (
                        <span>{buildItemCode(item)}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <div className={styles.statusStack}>
                  <StatusBadge
                    label={getSourceStatusLabel(item.sourceStatus)}
                    variant={getSourceStatusVariant(item.sourceStatus)}
                  />
                  <StatusBadge
                    label={getMetadataStatusLabel(item.metadataStatus)}
                    variant={getMetadataStatusVariant(item.metadataStatus)}
                  />
                </div>
              </td>
              <td>
                <div className={styles.overrideStack}>
                  <StatusBadge
                    label={item.hasLocalOverride ? '有本地覆盖' : '无本地覆盖'}
                    variant={item.hasLocalOverride ? 'info' : 'neutral'}
                  />
                  <span className={sharedStyles.mutedText}>
                    {buildOverrideSummary(item)}
                  </span>
                  <div className={sharedStyles.chipRow}>
                    <span className={sharedStyles.chip}>
                      海报 {item.hasPoster ? '已就绪' : '缺失'}
                    </span>
                    <span className={sharedStyles.chip}>
                      字幕 {item.hasSubtitle ? '已发现' : '暂无'}
                    </span>
                  </div>
                </div>
              </td>
              <td>
                <div className={sharedStyles.stackText}>
                  <span>{formatRelativeTime(item.updatedAt)}</span>
                  <span className={sharedStyles.mutedText}>
                    最近扫描 {formatDateTime(item.lastScanAt)}
                  </span>
                </div>
              </td>
              <td>
                <div className={styles.actionGroup}>
                  <Link
                    className={sharedStyles.smallButton}
                    to={`/manage/media/items/${item.id}`}
                  >
                    查看详情
                  </Link>
                  <button
                    className={styles.smallDangerButton}
                    type="button"
                    disabled={
                      (resolveDeletePending && resolveDeleteItemId === item.id) ||
                      (deletePending && pendingSourceDelete?.itemId === item.id)
                    }
                    onClick={() => onRequestDelete(item)}
                  >
                    <Trash2 size={16} />
                    {deletePending && pendingSourceDelete?.itemId === item.id
                      ? '删除中…'
                      : resolveDeletePending && resolveDeleteItemId === item.id
                        ? '定位来源…'
                        : '删除媒体源'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
