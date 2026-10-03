import { useParams } from 'react-router';
import { FeedbackState } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { BROWSE_PAGE_SIZE, useBrowsePagedList } from '@fmby/v2-shared/viewmodels';
import type { BrowsePagedListKind } from '@fmby/v2-shared/viewmodels';
import { PosterMediaCard } from './components';
import styles from './styles/shared.module.css';
import cardStyles from './styles/cards.module.css';

interface BrowsePagedListPageProps {
  kind: BrowsePagedListKind;
}

const META: Record<
  BrowsePagedListKind,
  { eyebrow: string; title: string; description: string; empty: string; path: string }
> = {
  resume: {
    eyebrow: 'Continue Watching',
    title: '继续观看',
    description: '从上次中断的地方继续播放。',
    empty: '暂无观看中的内容',
    path: '/continue-watching',
  },
  'recently-added': {
    eyebrow: 'Recently Added',
    title: '最近添加',
    description: '最新入库的内容，按加入时间排序。',
    empty: '暂无最近添加的内容',
    path: '/recently-added',
  },
};

/**
 * 继续观看 / 最近添加 独立分页列表页（FE-CONTINUE-WATCHING）。
 *
 * 数据面：`GET /api/browse/resume` / `GET /api/browse/recently-added`
 * （session + BROWSE；keyset cursor 分页，哨兵触底自动加载）。
 * 路由由 App router 传入（`/continue-watching`、`/recently-added`）。
 */
export function BrowsePagedListPage({ kind }: BrowsePagedListPageProps) {
  const meta = META[kind];
  const params = useParams<{ libraryId?: string }>();
  const libraryId = kind === 'recently-added' ? params.libraryId : undefined;

  const vm = useBrowsePagedList({ kind, libraryId });
  const { items } = vm.data;

  if (vm.state === 'loading') {
    return (
      <FeedbackState
        variant="loading"
        title={`正在加载${meta.title}`}
        description="正在整理可浏览的内容。"
      />
    );
  }

  if (vm.state === 'error' || vm.state === 'forbidden') {
    return (
      <FeedbackState
        variant="error"
        title={vm.state === 'forbidden' ? `没有浏览${meta.title}的权限` : `${meta.title}加载失败`}
        description={getErrorMessage(vm.error)}
        action={
          <button className={styles.primaryButton} type="button" onClick={vm.actions.refresh}>
            重试
          </button>
        }
      />
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <div className={styles.eyebrow}>{meta.eyebrow}</div>
          <h1 className={styles.pageTitle}>{meta.title}</h1>
          <p className={styles.pageDescription}>{meta.description}</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.secondaryButton} type="button" onClick={vm.actions.refresh}>
            刷新
          </button>
        </div>
      </header>

      {items.length === 0 ? (
        <FeedbackState variant="empty" title={meta.empty} description="等有内容后这里会出现条目。" />
      ) : (
        <>
          <div className={styles.activeFilterRow}>
            <span className={styles.filterChip}>已加载 {items.length}</span>
          </div>
          <div className={cardStyles.libraryGrid}>
            {items.map((item) => (
              <PosterMediaCard key={item.id} item={item} />
            ))}
          </div>
          {vm.data.hasMore ? (
            <div ref={vm.loadMoreRef} className={styles.loadMoreHintCard}>
              {BROWSE_PAGE_SIZE > 0 ? '加载更多…' : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/** 路由薄包装（lazy 挂载固定 kind，避免 router 对元素型 Component 的版本差异）。 */
export function ContinueWatchingPage() {
  return <BrowsePagedListPage kind="resume" />;
}

export function RecentlyAddedPage() {
  return <BrowsePagedListPage kind="recently-added" />;
}
