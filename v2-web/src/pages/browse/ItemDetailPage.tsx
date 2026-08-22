import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useSession } from '@/shared/session/SessionProvider';
import { FeedbackState } from '@/shared/ui';
import { getErrorMessage } from '@/shared/utils/error';
import { buildPosterBadgeModel } from './PosterBadges';
import styles from './styles/shared.module.css';
import { useItemDetailQueries } from './item-detail/hooks';
import { mergeTechnicalInfo, buildTechnicalCards, pickPreferredSeasonId } from './item-detail/formUtils';
import {
  ItemDetailHero,
  ItemDetailEpisodeSection,
  ItemDetailTechnicalSection,
  ItemDetailPeopleSection,
  ItemDetailAdminShortcuts,
  ItemDetailRelatedSection,
} from './item-detail/components';

export function ItemDetailPage() {
  const { itemId } = useParams();
  const { hasCapability } = useSession();
  const isAdmin = hasCapability('manage:access');
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>();
  const [item, setItem] = useState<import('@/domains/item').ItemDetailResponse>();

  const { itemQuery, selectedSeasonQuery, technicalFallbackQuery } = useItemDetailQueries(
    itemId,
    selectedSeasonId,
    item,
  );

  useEffect(() => {
    if (itemQuery.data) {
      setItem(itemQuery.data);
    }
  }, [itemQuery.data]);

  const retryDetail = () => {
    void itemQuery.refetch();
  };
  const seasonOptions =
    item?.kind === 'series' ? item.children.filter((child) => child.kind === 'season') : [];
  const directEpisodeOptions = item?.children.filter((child) => child.kind === 'episode') ?? [];

  useEffect(() => {
    if (!item || item.kind !== 'series') {
      setSelectedSeasonId(undefined);
      return;
    }

    const preferredSeasonId = pickPreferredSeasonId(item, seasonOptions);
    setSelectedSeasonId((current) => {
      if (current && seasonOptions.some((season) => season.id === current)) {
        return current;
      }
      return preferredSeasonId;
    });
  }, [item, seasonOptions]);

  const episodeOptions =
    item?.kind === 'season'
      ? directEpisodeOptions
      : item?.kind === 'series'
        ? selectedSeasonQuery.data?.children.filter((child) => child.kind === 'episode') ?? directEpisodeOptions
        : [];
  const effectiveTechnical = item
    ? mergeTechnicalInfo(item.technical, technicalFallbackQuery.data?.technical)
    : undefined;
  const effectiveSourceStatusLabel = item
    ? item.sourceStatusLabel ?? technicalFallbackQuery.data?.sourceStatusLabel
    : undefined;
  const technicalCards =
    item && effectiveTechnical
      ? buildTechnicalCards(effectiveTechnical, effectiveSourceStatusLabel)
      : [];
  const hasEpisodeSelector = item?.kind === 'series' || item?.kind === 'season';
  const hasPeopleSection = item ? item.directorPeople.length > 0 || item.actors.length > 0 : false;
  const hasTechnicalSection = item
    ? technicalCards.length > 0 ||
      effectiveTechnical?.videoStreams.length ||
      effectiveTechnical?.audioStreams.length ||
      effectiveTechnical?.subtitleStreams.length
    : false;
  const posterBadges = item
    ? buildPosterBadgeModel({
        kind: item.kind,
        tags: item.tags,
        featureCandidates: [
          effectiveTechnical?.dynamicRangeLabel,
          effectiveTechnical?.audioCodecLabel,
        ],
        ratingLabel: item.ratingLabel,
        resolutionLabel: effectiveTechnical?.resolutionLabel,
        year: item.year,
        itemCount: item.itemCount,
        durationSeconds: item.runtimeSeconds,
      })
    : {};

  if (!itemId) {
    return (
      <FeedbackState
        variant="error"
        title="内容不存在"
        description="当前链接缺少内容标识。"
        action={
          <Link className={styles.primaryButton} to="/">
            回首页
          </Link>
        }
      />
    );
  }

  if (itemQuery.isPending) {
    return (
      <FeedbackState
        variant="loading"
        title="正在加载详情"
        description="正在整理播放进度、技术信息和相关内容。"
      />
    );
  }

  if (itemQuery.isError) {
    return (
      <FeedbackState
        variant="error"
        title="详情加载失败"
        description={getErrorMessage(itemQuery.error)}
        action={
          <button className={styles.primaryButton} type="button" onClick={retryDetail}>
            重试
          </button>
        }
      />
    );
  }

  if (!item) {
    return (
      <FeedbackState
        variant="error"
        title="详情加载失败"
        description="服务端没有返回有效的内容详情，请稍后重试。"
        action={
          <button className={styles.primaryButton} type="button" onClick={retryDetail}>
            重试
          </button>
        }
      />
    );
  }

  return (
    <div className={styles.page}>
      <ItemDetailHero item={item} posterBadges={posterBadges} />

      <div className={styles.page}>
        {hasEpisodeSelector ? (
          <ItemDetailEpisodeSection
            item={item}
            seasonOptions={seasonOptions}
            episodeOptions={episodeOptions}
            selectedSeasonId={selectedSeasonId}
            setSelectedSeasonId={setSelectedSeasonId}
            selectedSeasonQuery={selectedSeasonQuery}
          />
        ) : null}

        {hasTechnicalSection ? (
          <ItemDetailTechnicalSection
            technicalCards={technicalCards}
            effectiveTechnical={effectiveTechnical}
          />
        ) : null}

        {hasPeopleSection ? <ItemDetailPeopleSection item={item} /> : null}

        {isAdmin ? <ItemDetailAdminShortcuts item={item} /> : null}

        <ItemDetailRelatedSection item={item} />
      </div>
    </div>
  );
}
