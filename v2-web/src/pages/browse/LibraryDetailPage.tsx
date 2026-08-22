import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { browseApi } from '@/domains/browse';
import { FeedbackState } from '@/shared/ui';
import { queryKeys } from '@/shared/query-keys';
import { getErrorMessage } from '@/shared/utils/error';
import styles from './styles/shared.module.css';
import libraryStyles from './styles/library.module.css';
import { LibraryCinemaHero, LibraryDetailMediaCard } from './components';

const LIBRARY_PAGE_SIZE = 20;
/** 超过该数量后启用简单窗口化渲染，避免长列表 DOM 全量布局 */
const WINDOWING_THRESHOLD = 100;
const windowedItemStyle: CSSProperties = {
  contentVisibility: 'auto',
  containIntrinsicSize: '340px',
};

export function LibraryDetailPage() {
  const { libraryId } = useParams();
  const [mediaType, setMediaType] = useState('all');
  const [resolution, setResolution] = useState('all');
  const [watched, setWatched] = useState('all');
  const [sort, setSort] = useState('recent');
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const libraryQuery = useInfiniteQuery({
    queryKey: queryKeys.browse.library(libraryId ?? ''),
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      browseApi.getLibraryDetail(libraryId ?? '', {
        page: pageParam,
        pageSize: LIBRARY_PAGE_SIZE,
      }),
    enabled: Boolean(libraryId),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.items.length, 0);
      if (loaded >= lastPage.total) {
        return undefined;
      }
      return allPages.length + 1;
    },
  });

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && libraryQuery.hasNextPage && !libraryQuery.isFetchingNextPage) {
          void libraryQuery.fetchNextPage();
        }
      },
      {
        rootMargin: '320px 0px',
        threshold: 0.1,
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [libraryQuery.fetchNextPage, libraryQuery.hasNextPage, libraryQuery.isFetchingNextPage]);

  const pages = libraryQuery.data?.pages ?? [];
  const data = pages[0];
  const loadedItems = useMemo(() => pages.flatMap((page) => page.items), [pages]);
  const items = useMemo(() => {
    const nextItems = [...loadedItems].filter((item) => {
      if (mediaType !== 'all' && item.kind !== mediaType) {
        return false;
      }
      if (resolution !== 'all' && item.resolutionLabel !== resolution) {
        return false;
      }
      if (watched === 'unfinished' && item.progress?.completed) {
        return false;
      }
      if (watched === 'completed' && !item.progress?.completed) {
        return false;
      }
      return true;
    });

    nextItems.sort((left, right) => {
      if (sort === 'title') {
        return left.title.localeCompare(right.title, 'zh-CN');
      }
      if (sort === 'year') {
        return (right.year ?? 0) - (left.year ?? 0);
      }
      return new Date(right.addedAt ?? 0).getTime() - new Date(left.addedAt ?? 0).getTime();
    });

    return nextItems;
  }, [loadedItems, mediaType, resolution, watched, sort]);

  if (!libraryId) {
    return (
      <FeedbackState
        variant="error"
        title="媒体库不存在"
        description="当前链接缺少媒体库标识。"
        action={
          <Link className={styles.primaryButton} to="/libraries">
            返回媒体库
          </Link>
        }
      />
    );
  }

  if (libraryQuery.isPending) {
    return (
      <FeedbackState
        variant="loading"
        title="正在加载媒体库内容"
        description="正在整理筛选项和内容列表。"
      />
    );
  }

  if (libraryQuery.isError) {
    return (
      <FeedbackState
        variant="error"
        title="媒体库内容加载失败"
        description={getErrorMessage(libraryQuery.error)}
        action={
          <button className={styles.primaryButton} type="button" onClick={() => libraryQuery.refetch()}>
            重试
          </button>
        }
      />
    );
  }

  if (!data || loadedItems.length === 0) {
    return (
      <FeedbackState
        variant="empty"
        title="这个媒体库暂时还是空的"
        description="等内容准备好后，这里会自动展示最新条目。"
        action={
          <Link className={styles.primaryButton} to="/libraries">
            返回媒体库列表
          </Link>
        }
      />
    );
  }

  const loadedLabel =
    loadedItems.length < data.total
      ? `已加载 ${loadedItems.length}/${data.total}`
      : `已展开 ${loadedItems.length} 个`;
  const useWindowing = items.length > WINDOWING_THRESHOLD;

  const isFiltered = mediaType !== 'all' || resolution !== 'all' || watched !== 'all' || sort !== 'recent';

  return (
    <div className={styles.page}>
      <LibraryCinemaHero
        library={data.library}
        items={loadedItems}
        heroSummary={data.heroSummary}
        loadedLabel={loadedLabel}
        onRefresh={() => void libraryQuery.refetch()}
      />

      <section className={libraryStyles.libraryControlPanel}>
        <div className={styles.toolbar}>
          <div className={styles.filterGroup}>
            <select className={styles.select} value={mediaType} onChange={(event) => setMediaType(event.target.value)}>
              {data.filters.mediaTypes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select className={styles.select} value={resolution} onChange={(event) => setResolution(event.target.value)}>
              {data.filters.resolutions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select className={styles.select} value={watched} onChange={(event) => setWatched(event.target.value)}>
              {data.filters.watchedStates.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select className={styles.select} value={sort} onChange={(event) => setSort(event.target.value)}>
              {data.filters.sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {isFiltered ? (
              <button
                type="button"
                className={styles.ghostButton}
                onClick={() => {
                  setMediaType('all');
                  setResolution('all');
                  setWatched('all');
                  setSort('recent');
                }}
              >
                重置筛选
              </button>
            ) : null}
          </div>
          <span className={styles.metaText}>
            当前结果：{items.length} 个
            {loadedItems.length < data.total ? ` · 已加载 ${loadedItems.length}/${data.total}` : ` · 已全部加载 ${loadedItems.length} 个`}
          </span>
        </div>
      </section>

      {items.length === 0 ? (
        <FeedbackState
          variant="empty"
          title="筛选后没有匹配内容"
          description="可以试试放宽筛选条件，看看更多条目。"
        />
      ) : (
        <div className={libraryStyles.libraryDetailGrid}>
          {items.map((item) =>
            useWindowing ? (
              <div key={item.id} style={windowedItemStyle}>
                <LibraryDetailMediaCard item={item} />
              </div>
            ) : (
              <LibraryDetailMediaCard key={item.id} item={item} />
            ),
          )}
        </div>
      )}

      <div ref={loadMoreRef} className={styles.loadMoreHintCard}>
        <div className={styles.metaText}>
          {libraryQuery.isFetchingNextPage
            ? '正在继续加载剩余内容...'
            : libraryQuery.hasNextPage
              ? '继续下滑，自动加载后续内容'
              : `这个媒体库的 ${data.total} 个条目已经全部展开了`}
        </div>
      </div>
    </div>
  );
}
