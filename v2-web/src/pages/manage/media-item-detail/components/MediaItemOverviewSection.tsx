import { Link } from 'react-router';
import type { ManageMediaItemDetailRecord } from '@/domains/manage/media-items';
import { StatusBadge } from '@/shared/ui';
import { formatDateTime, formatRelativeTime } from '@/shared/utils/date';
import sharedStyles from '../../ManagePages.module.css';
import { ManageSectionCard } from '../../components';
import {
  getMetadataStatusLabel,
  getMetadataStatusVariant,
  getSourceStatusLabel,
  getSourceStatusVariant,
} from '../../media-items/formUtils';
import {
  EM_DASH,
  formatList,
  formatOptional,
  formatRating,
  getMountStatusLabel,
  getMountStatusVariant,
} from '../formatters';
import styles from '../MediaItemDetail.module.css';
import { ArtImage } from './ArtImage';

interface MediaItemOverviewSectionProps {
  detail: ManageMediaItemDetailRecord;
}

/**
 * 「基础信息与封面」段落。
 *
 * 这里只做展示，不放任何写操作：管理员进详情页第一眼要能判断
 * 这条资源是谁、归属哪里、当前健康不健康，编辑动作留给下面的段落。
 */
export function MediaItemOverviewSection({ detail }: MediaItemOverviewSectionProps) {
  const { item, effectiveMetadata } = detail;

  const ownership = [item.libraryName, item.seriesTitle, item.seasonTitle]
    .filter((entry): entry is string => Boolean(entry && entry.trim() !== ''))
    .join(' / ');

  const episodeCode =
    item.seasonNumber !== undefined && item.episodeNumber !== undefined
      ? `S${String(item.seasonNumber).padStart(2, '0')}E${String(item.episodeNumber).padStart(2, '0')}`
      : item.seasonNumber !== undefined
        ? `S${String(item.seasonNumber).padStart(2, '0')}`
        : undefined;

  const facts: { label: string; value: string }[] = [
    { label: '媒体库', value: formatOptional(item.libraryName) },
    { label: '资源类型', value: formatOptional(item.typeLabel) },
    { label: '年份', value: formatOptional(item.year) },
    { label: '首播日期', value: formatOptional(effectiveMetadata.premiered) },
    { label: '归属层级', value: ownership === '' ? EM_DASH : ownership },
    { label: '剧集编号', value: formatOptional(episodeCode) },
    { label: '排序标题', value: formatOptional(effectiveMetadata.sortTitle) },
    { label: '社区评分', value: formatRating(effectiveMetadata.communityRating) },
    { label: '类型标签', value: formatList(effectiveMetadata.genres) },
    { label: '导演', value: formatList(effectiveMetadata.directors) },
    { label: '制作方', value: formatList(effectiveMetadata.studios) },
    {
      label: '演职员',
      value:
        effectiveMetadata.actors.length > 0
          ? effectiveMetadata.actors
              .slice(0, 6)
              .map((actor) => (actor.role ? `${actor.name}（${actor.role}）` : actor.name))
              .join('、') +
            (effectiveMetadata.actors.length > 6
              ? ` 等 ${effectiveMetadata.actors.length} 人`
              : '')
          : EM_DASH,
    },
    {
      label: '外部编号',
      value:
        effectiveMetadata.externalIds.length > 0
          ? effectiveMetadata.externalIds
              .map((entry) => `${entry.provider}:${entry.id}`)
              .join('、')
          : EM_DASH,
    },
    { label: '创建时间', value: formatDateTime(item.createdAt) },
    { label: '最近更新', value: formatDateTime(item.updatedAt) },
    { label: '最近扫描', value: formatDateTime(item.lastScanAt) },
  ];

  return (
    <ManageSectionCard
      title="基础信息与封面"
      description="资源身份、归属层级与当前生效的元数据摘要，全部取自服务端最新记录。"
      actions={
        <Link className={sharedStyles.smallButton} to={`/item/${item.id}`}>
          在前台查看
        </Link>
      }
    >
      <div className={styles.identity}>
        <div className={styles.identityArt}>
          <ArtImage
            alt={`${item.title} 海报`}
            placeholder="暂无海报"
            src={item.posterUrl}
          />
          <div className={styles.artSecondaryRow}>
            <div className={styles.artSecondary}>
              <ArtImage
                alt={`${item.title} 背景图`}
                compact
                placeholder="暂无背景图"
                src={item.backdropUrl}
                wide
              />
              <span className={styles.artCaption}>背景图</span>
            </div>
            <div className={styles.artSecondary}>
              <ArtImage
                alt={`${item.title} 缩略图`}
                compact
                placeholder="暂无缩略图"
                src={item.thumbUrl}
                wide
              />
              <span className={styles.artCaption}>缩略图</span>
            </div>
          </div>
        </div>

        <div className={styles.identityBody}>
          <div className={styles.badgeRow}>
            <StatusBadge
              label={getSourceStatusLabel(item.sourceStatus)}
              variant={getSourceStatusVariant(item.sourceStatus)}
            />
            <StatusBadge
              label={getMountStatusLabel(item.mountStatus)}
              variant={getMountStatusVariant(item.mountStatus)}
            />
            <StatusBadge
              label={getMetadataStatusLabel(item.metadataStatus)}
              variant={getMetadataStatusVariant(item.metadataStatus)}
            />
            <StatusBadge
              label={item.hasLocalOverride ? '存在本地覆盖' : '无本地覆盖'}
              variant={item.hasLocalOverride ? 'info' : 'neutral'}
            />
          </div>

          <div className={styles.badgeRow}>
            <span className={sharedStyles.chip}>
              元数据覆盖 {item.hasLocalMetadataOverride ? '已启用' : '未启用'}
            </span>
            <span className={sharedStyles.chip}>
              图片覆盖 {item.hasLocalArtworkOverride ? '已启用' : '未启用'}
            </span>
            <span className={sharedStyles.chip}>
              字幕覆盖 {item.hasLocalSubtitleOverride ? '已启用' : '未启用'}
            </span>
            <span className={sharedStyles.metaText}>
              更新于 {formatRelativeTime(item.updatedAt)}
            </span>
          </div>

          <div className={sharedStyles.stackText}>
            <span className={styles.kicker}>剧情简介</span>
            <p className={styles.overviewText}>
              {effectiveMetadata.overview?.trim() ||
                item.overview?.trim() ||
                '这条资源还没有可展示的简介内容。'}
            </p>
          </div>

          <div className={sharedStyles.detailSummaryGrid}>
            {facts.map((fact) => (
              <div className={sharedStyles.detailCard} key={fact.label}>
                <span className={sharedStyles.detailCardLabel}>{fact.label}</span>
                <span className={sharedStyles.detailCardValue}>{fact.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ManageSectionCard>
  );
}
