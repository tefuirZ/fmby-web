import { useState } from 'react';
import { Link } from 'react-router';
import { FeedbackState } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { useHistory, type HistoryTimeRange } from '@fmby/v2-shared/viewmodels';
import styles from './styles/shared.module.css';
import cardStyles from './styles/cards.module.css';
import {
  BrowsePageHeader,
  BrowseSection,
  PosterMediaCard,
  WideMediaCard,
} from './components';

export function HistoryPage() {
  const [typeFilter, setTypeFilter] = useState('all');
  const [timeRange, setTimeRange] = useState<HistoryTimeRange>('30d');
  const [stateFilter, setStateFilter] = useState<'all' | 'unfinished' | 'completed'>('all');

  // WEB-B1：取数与本地筛选上移至 viewmodel；页面只消费 { data, state, actions, error }。
  const { data, state, error, actions } = useHistory({ typeFilter, stateFilter, timeRange });

  if (state === 'loading') {
    return (
      <FeedbackState
        variant="loading"
        title="正在整理你的播放历史"
        description="继续观看、最近播放和已看完内容会按更易读的方式分组展示。"
      />
    );
  }

  if (state === 'error' || state === 'forbidden') {
    return (
      <FeedbackState
        variant="error"
        title={state === 'forbidden' ? '没有访问播放历史的权限' : '历史记录加载失败'}
        description={getErrorMessage(error)}
        action={
          <button className={styles.primaryButton} type="button" onClick={actions.retry}>
            重试
          </button>
        }
      />
    );
  }

  const { continueWatching, recentlyPlayed, completed, typeOptions } = data;
  const allItems = [...continueWatching, ...recentlyPlayed, ...completed];

  if (!data.hasAny) {
    return (
      <FeedbackState
        variant="empty"
        title="还没有播放历史"
        description="开始播放后，继续观看、最近播放和已看完内容会自动整理到这里。"
        action={
          <Link className={styles.primaryButton} to="/">
            去首页看看
          </Link>
        }
      />
    );
  }

  return (
    <div className={styles.page}>
      <BrowsePageHeader
        title="历史"
        description="优先帮你找到刚看过的、没看完的和值得继续看的内容。"
        meta={<span className={styles.metaText}>共整理出 {allItems.length} 条记录</span>}
        actions={
          <button className={styles.secondaryButton} type="button" onClick={actions.refresh}>
            刷新
          </button>
        }
      />

      <section className={styles.sectionCard}>
        <div className={styles.toolbar}>
          <div className={styles.filterGroup}>
            <select className={styles.select} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">全部类型</option>
              {typeOptions.filter((value) => value !== 'all').map((value) => (
                <option key={value} value={value}>
                  {value === 'movie'
                    ? '电影'
                    : value === 'series'
                      ? '剧集'
                      : value === 'episode'
                        ? '单集'
                        : value === 'music'
                          ? '音乐'
                          : '其他'}
                </option>
              ))}
            </select>
            <select className={styles.select} value={timeRange} onChange={(event) => setTimeRange(event.target.value as HistoryTimeRange)}>
              <option value="all">全部时间</option>
              <option value="7d">最近 7 天</option>
              <option value="30d">最近 30 天</option>
              <option value="365d">最近一年</option>
            </select>
            <select className={styles.select} value={stateFilter} onChange={(event) => setStateFilter(event.target.value as 'all' | 'unfinished' | 'completed')}>
              <option value="all">全部观看状态</option>
              <option value="unfinished">未看完</option>
              <option value="completed">已看完</option>
            </select>
          </div>
          <span className={styles.metaText}>
            当前结果：{continueWatching.length + recentlyPlayed.length + completed.length} 条
          </span>
        </div>
      </section>

      <BrowseSection title="继续观看" description="先处理那些差一点就看完的内容。">
        {continueWatching.length === 0 ? (
          <div className={styles.emptyGrid}>当前筛选条件下没有未看完的内容。</div>
        ) : (
          <div className={cardStyles.wideList}>
            {continueWatching.map((item) => (
              <WideMediaCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </BrowseSection>

      <BrowseSection title="最近播放" description="刚打开过的内容，适合快速回看。">
        {recentlyPlayed.length === 0 ? (
          <div className={styles.emptyGrid}>当前筛选条件下没有最近播放内容。</div>
        ) : (
          <div className={cardStyles.wideList}>
            {recentlyPlayed.map((item) => (
              <WideMediaCard key={item.id} item={item} primaryLabel="再次播放" />
            ))}
          </div>
        )}
      </BrowseSection>

      <BrowseSection title="已看完" description="想回味一遍或再次分享时，可以从这里重新开始。">
        {completed.length === 0 ? (
          <div className={styles.emptyGrid}>当前筛选条件下没有已看完内容。</div>
        ) : (
          <div className={cardStyles.posterGridList}>
            {completed.map((item) => (
              <PosterMediaCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </BrowseSection>
    </div>
  );
}
