import { useDeferredValue, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { FeedbackState } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { useCollectionsList } from '@fmby/v2-shared/viewmodels';
import styles from './styles/shared.module.css';

/**
 * 用户面合集列表页（FE-USER-COLLECTIONS-LIST-PAGE-2）。
 *
 * 数据面：`GET /api/collections`（session + BROWSE；Hidden 由后端过滤）。
 * 分页由路由 query `page` 承载（1-based）；翻页即导航，可分享/可回退。
 * 检索参数暂无（后端 COLLECTIONS-LIST-SEARCH 在途），不给假搜索框。
 */
const PAGE_SIZE = 20;

export function CollectionsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  // 防抖范式（照 useSearchOverlay：页面持原始值，viewmodel 收 deferred 值）。
  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '');
  const search = useDeferredValue(searchInput.trim());

  const vm = useCollectionsList({ page, pageSize: PAGE_SIZE, search });
  const { items, total, pageSize, hasMore } = vm.data;
  const totalPages = useMemo(
    () => (total === 0 ? 1 : Math.ceil(total / pageSize)),
    [total, pageSize],
  );

  if (vm.state === 'loading') {
    return (
      <FeedbackState
        variant="loading"
        title="正在加载合集"
        description="正在整理可浏览的合集。"
      />
    );
  }

  if (vm.state === 'error' || vm.state === 'forbidden') {
    return (
      <FeedbackState
        variant="error"
        title={vm.state === 'forbidden' ? '没有浏览合集的权限' : '合集加载失败'}
        description={getErrorMessage(vm.error)}
        action={
          <button className={styles.primaryButton} type="button" onClick={vm.actions.refresh}>
            重试
          </button>
        }
      />
    );
  }

  const gotoPage = (next: number) => {
    const clamped = Math.min(Math.max(1, next), totalPages);
    setSearchParams(clamped > 1 ? { page: String(clamped) } : {});
  };

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <div className={styles.eyebrow}>Collections</div>
          <h1 className={styles.pageTitle}>合集</h1>
          <p className={styles.pageDescription}>
            共 {total.toLocaleString('zh-CN')} 个合集；点进任意合集查看成员明细。
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.secondaryButton} type="button" onClick={vm.actions.refresh}>
            刷新
          </button>
        </div>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.filterGroup}>
          {/* FE-A11Y-KEYBOARD-AUDIT：placeholder 不足以作为可访问名 ⇒ 补 aria-label */}
          <input
            className={styles.input}
            aria-label="按合集名检索"
            placeholder="按合集名检索"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
              if (page > 1) setSearchParams({});
            }}
          />
        </div>
      </div>
      {items.length === 0 ? (
        <FeedbackState
          variant="empty"
          title="还没有可浏览的合集"
          description="等管理员建好合集后，这里会出现合集入口。"
        />
      ) : (
        <>
          <div className={styles.activeFilterRow}>
            {search ? <span className={styles.filterChip}>检索「{search}」</span> : null}
            <span className={styles.filterChip}>
              第 {page} / {totalPages} 页
            </span>
            <span className={styles.filterChip}>每页 {pageSize}</span>
          </div>
          <div className={styles.mediaRail}>
            {items.map((collection) => (
              <Link
                key={collection.id}
                className={styles.posterRailItem}
                to={`/collections/${collection.id}`}
              >
                <strong>{collection.title}</strong>
                {collection.overview ? (
                  <span className={styles.metaText}>{collection.overview}</span>
                ) : null}
              </Link>
            ))}
          </div>
          {totalPages > 1 ? (
            <div className={styles.buttonRow}>
              <button
                className={styles.ghostButton}
                type="button"
                disabled={page <= 1}
                onClick={() => gotoPage(page - 1)}
              >
                上一页
              </button>
              <span className={styles.metaText}>
                {page} / {totalPages}
              </span>
              <button
                className={styles.ghostButton}
                type="button"
                disabled={!hasMore}
                onClick={() => gotoPage(page + 1)}
              >
                下一页
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}