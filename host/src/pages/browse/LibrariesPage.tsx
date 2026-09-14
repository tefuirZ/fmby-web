import { useMemo, useState } from 'react';
import { FeedbackState } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { matchKeyword } from '@fmby/v2-shared/search/matchKeyword';
import { useLibraryList } from '@fmby/v2-shared/viewmodels';
import styles from './styles/shared.module.css';
import cardStyles from './styles/cards.module.css';
import libraryStyles from './styles/library.module.css';
import { LibraryShowcaseCard } from './components';

export function LibrariesPage() {
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const deferredKeyword = useMemo(() => keyword.trim(), [keyword]);

  // WEB-B1：取数与派生上移至 viewmodel；页面只消费 { data, state, actions, error }。
  const { data, state, error, actions } = useLibraryList({ keyword, typeFilter });
  const { libraries, typeOptions, totalItems, typeCount, latestLibrary } = data;
  const filteredLibraries = useMemo(() => {
    return libraries.filter((library) => {
      const matchesKeyword = matchKeyword(
        deferredKeyword,
        library.name,
        library.description,
        library.typeLabel,
      );
      const matchesType = typeFilter === 'all' || library.typeLabel === typeFilter;
      return matchesKeyword && matchesType;
    });
  }, [deferredKeyword, libraries, typeFilter]);
  const activeFilterCount = Number(Boolean(deferredKeyword)) + Number(typeFilter !== 'all');
  const clearFilters = () => {
    setKeyword('');
    setTypeFilter('all');
  };

  if (state === 'loading') {
    return (
      <FeedbackState
        variant="loading"
        title="正在加载媒体库"
        description="正在整理你可以浏览的内容空间。"
      />
    );
  }

  if (state === 'error' || state === 'forbidden') {
    return (
      <FeedbackState
        variant="error"
        title={state === 'forbidden' ? '没有访问媒体库的权限' : '媒体库加载失败'}
        description={getErrorMessage(error)}
        action={
          <button className={styles.primaryButton} type="button" onClick={actions.refresh}>
            重试
          </button>
        }
      />
    );
  }

  if (libraries.length === 0) {
    return (
      <FeedbackState
        variant="empty"
        title="还没有可浏览的媒体库"
        description="等管理员准备好内容后，这里会出现不同的内容入口。"
      />
    );
  }

  return (
    <div className={styles.page}>
      <section className={libraryStyles.libraryDirectoryHero}>
        <div className={libraryStyles.libraryDirectoryBackdrop} />
        <div className={libraryStyles.libraryDirectoryContent}>
          <div className={libraryStyles.libraryDirectoryCopy}>
            <div className={styles.eyebrow}>Media Library</div>
            <h1 className={styles.pageTitle}>媒体库大厅</h1>
            <p className={styles.pageDescription}>
              先看库，再进片。电影、剧集、音乐和合集都用入口卡呈现，减少列表感，保留流媒体的浏览节奏。
            </p>
            <div className={styles.activeFilterRow}>
              <span className={styles.filterChip}>全部内容 {totalItems.toLocaleString('zh-CN')}</span>
              <span className={styles.filterChip}>库类型 {typeCount}</span>
              {latestLibrary ? <span className={styles.filterChip}>最近更新：{latestLibrary.name}</span> : null}
            </div>
          </div>
          <div className={libraryStyles.libraryDirectoryStats}>
            <div className={libraryStyles.libraryDirectoryStat}>
              <span>媒体库</span>
              <strong>{libraries.length}</strong>
            </div>
            <div className={libraryStyles.libraryDirectoryStat}>
              <span>内容总数</span>
              <strong>{totalItems.toLocaleString('zh-CN')}</strong>
            </div>
            <div className={libraryStyles.libraryDirectoryStat}>
              <span>匹配结果</span>
              <strong>{filteredLibraries.length}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className={libraryStyles.libraryControlPanel}>
        <div className={styles.toolbar}>
          <div className={styles.filterGroup}>
            <input
              className={styles.input}
              placeholder="搜索媒体库名称、简介，支持拼音首字母"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
            <select className={styles.select} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">全部类型</option>
              {typeOptions.filter((item) => item !== 'all').map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.buttonRow}>
            {activeFilterCount > 0 ? (
              <button className={styles.ghostButton} type="button" onClick={clearFilters}>
                清空筛选
              </button>
            ) : null}
            <button className={styles.secondaryButton} type="button" onClick={actions.refresh}>
              刷新
            </button>
          </div>
        </div>
      </section>

      {filteredLibraries.length === 0 ? (
        <FeedbackState
          variant="empty"
          title="没有找到匹配的媒体库"
          description="试试换个关键词，或清空筛选条件。"
        />
      ) : (
        <div className={cardStyles.libraryGrid}>
          {filteredLibraries.map((library) => (
            <LibraryShowcaseCard key={library.id} library={library} />
          ))}
        </div>
      )}
    </div>
  );
}
