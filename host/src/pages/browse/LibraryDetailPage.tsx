import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { FeedbackState } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { useLibraryDetail } from '@fmby/v2-shared/viewmodels';
import styles from './styles/shared.module.css';
import libraryStyles from './styles/library.module.css';
import { LibraryCinemaHero } from './components';
import { VirtualizedLibraryDetailGrid } from './library-detail/VirtualizedLibraryDetailGrid';

export function LibraryDetailPage() {
  const { libraryId } = useParams();
  const [mediaType, setMediaType] = useState('all');
  const [resolution, setResolution] = useState('all');
  const [watched, setWatched] = useState('all');
  const [sort, setSort] = useState('recent');

  // WEB-B1：分页取数 + 筛选排序 + 哨兵加载全部上移至 viewmodel。
  const { data: vm, state, error, actions, loadMoreRef } = useLibraryDetail({
    libraryId,
    mediaType,
    resolution,
    watched,
    sort,
  });
  const { library, heroSummary, filters, items, loadedCount } = vm;

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

  if (state === 'loading') {
    return (
      <FeedbackState
        variant="loading"
        title="正在加载媒体库内容"
        description="正在整理筛选项和内容列表。"
      />
    );
  }

  if (state === 'error' || state === 'forbidden') {
    return (
      <FeedbackState
        variant="error"
        title={state === 'forbidden' ? '没有访问该媒体库的权限' : '媒体库内容加载失败'}
        description={getErrorMessage(error)}
        action={
          <button className={styles.primaryButton} type="button" onClick={actions.refresh}>
            重试
          </button>
        }
      />
    );
  }

  if (!library || loadedCount === 0) {
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
    loadedCount < vm.totalItems
      ? `已加载 ${loadedCount}/${vm.totalItems}`
      : `已展开 ${loadedCount} 个`;
  const isFiltered = mediaType !== 'all' || resolution !== 'all' || watched !== 'all' || sort !== 'recent';

  return (
    <div className={styles.page}>
      <LibraryCinemaHero
        library={library}
        items={items}
        heroSummary={heroSummary}
        loadedLabel={loadedLabel}
        onRefresh={actions.refresh}
      />

      <section className={libraryStyles.libraryControlPanel}>
        <div className={styles.toolbar}>
          <div className={styles.filterGroup}>
            <select className={styles.select} value={mediaType} onChange={(event) => setMediaType(event.target.value)}>
              {filters?.mediaTypes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select className={styles.select} value={resolution} onChange={(event) => setResolution(event.target.value)}>
              {filters?.resolutions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select className={styles.select} value={watched} onChange={(event) => setWatched(event.target.value)}>
              {filters?.watchedStates.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select className={styles.select} value={sort} onChange={(event) => setSort(event.target.value)}>
              {filters?.sortOptions.map((option) => (
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
            {loadedCount < vm.totalItems ? ` · 已加载 ${loadedCount}/${vm.totalItems}` : ` · 已全部加载 ${loadedCount} 个`}
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
        <VirtualizedLibraryDetailGrid
          items={items}
          onNearTail={actions.loadMore}
        />
      )}

      <div ref={loadMoreRef} className={styles.loadMoreHintCard}>
        <div className={styles.metaText}>
          {vm.isFetchingNextPage
            ? '正在继续加载剩余内容...'
            : vm.hasNextPage
              ? '继续下滑，自动加载后续内容'
              : `这个媒体库的 ${vm.totalItems} 个条目已经全部展开了`}
        </div>
      </div>
    </div>
  );
}
