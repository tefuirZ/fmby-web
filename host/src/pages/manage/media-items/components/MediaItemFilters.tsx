import type { Dispatch, SetStateAction } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import type {
  MediaTypeFilter,
  SourceStatusFilter,
  MetadataStatusFilter,
  OverrideFilter,
} from '../types';
import type { ManageLibrariesResponse } from '@fmby/v2-shared/contracts/manage';
import { InlineBanner } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { ManageSectionCard } from '../../components';
import sharedStyles from '../../ManagePages.module.css';
import styles from '../../ManageMediaItemsPage.module.css';

interface MediaItemFiltersProps {
  keyword: string;
  setKeyword: Dispatch<SetStateAction<string>>;
  libraryId: string;
  setLibraryId: Dispatch<SetStateAction<string>>;
  mediaType: MediaTypeFilter;
  setMediaType: Dispatch<SetStateAction<MediaTypeFilter>>;
  sourceStatus: SourceStatusFilter;
  setSourceStatus: Dispatch<SetStateAction<SourceStatusFilter>>;
  metadataStatus: MetadataStatusFilter;
  setMetadataStatus: Dispatch<SetStateAction<MetadataStatusFilter>>;
  overrideFilter: OverrideFilter;
  setOverrideFilter: Dispatch<SetStateAction<OverrideFilter>>;
  librariesQuery: UseQueryResult<ManageLibrariesResponse>;
  itemsCount: number;
  total: number;
  localOverrideCount: number;
  isFetching: boolean;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
}

export function MediaItemFilters({
  keyword,
  setKeyword,
  libraryId,
  setLibraryId,
  mediaType,
  setMediaType,
  sourceStatus,
  setSourceStatus,
  metadataStatus,
  setMetadataStatus,
  overrideFilter,
  setOverrideFilter,
  librariesQuery,
  itemsCount,
  total,
  localOverrideCount,
  isFetching,
  hasActiveFilters,
  onResetFilters,
}: MediaItemFiltersProps) {
  return (
    <>
      {librariesQuery.isError ? (
        <InlineBanner
          variant="warning"
          title="媒体库筛选项加载失败"
          description={`资源列表还能继续查，但媒体库下拉暂时不完整：${getErrorMessage(librariesQuery.error)}`}
        />
      ) : null}

      <ManageSectionCard
        title="筛选与检索"
        description="列表只保留管理员真会用到的筛选：资源归属、来源健康、元数据状态和本地覆盖态。"
      >
        <div className={styles.filterGrid}>
          <label className={sharedStyles.label}>
            <span>关键词</span>
            <div className={styles.searchField}>
              <Search className={styles.searchIcon} size={16} />
              <input
                className={`${sharedStyles.searchInput} ${styles.searchInput}`}
                type="search"
                placeholder="标题、原始标题、媒体库"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />
            </div>
          </label>

          <label className={sharedStyles.label}>
            <span>媒体库</span>
            <select
              className={sharedStyles.select}
              value={libraryId}
              onChange={(event) => setLibraryId(event.target.value)}
            >
              <option value="all">全部媒体库</option>
              {(librariesQuery.data?.items ?? []).map((library) => (
                <option key={library.id} value={library.id}>
                  {library.name}
                </option>
              ))}
            </select>
          </label>

          <label className={sharedStyles.label}>
            <span>媒体类型</span>
            <select
              className={sharedStyles.select}
              value={mediaType}
              onChange={(event) => setMediaType(event.target.value as MediaTypeFilter)}
            >
              <option value="all">全部类型</option>
              <option value="movie">电影</option>
              <option value="series">剧集</option>
              <option value="season">季</option>
              <option value="episode">单集</option>
              <option value="music">音乐</option>
              <option value="music-album">专辑</option>
              <option value="music-artist">艺术家</option>
            </select>
          </label>

          <label className={sharedStyles.label}>
            <span>来源状态</span>
            <select
              className={sharedStyles.select}
              value={sourceStatus}
              onChange={(event) => setSourceStatus(event.target.value as SourceStatusFilter)}
            >
              <option value="all">全部状态</option>
              <option value="playable">可播放</option>
              <option value="pending-validation">待校验</option>
              <option value="unreachable">不可达</option>
              <option value="unsupported">不支持</option>
              <option value="auth-expired">凭证过期</option>
              <option value="missing">状态缺失</option>
            </select>
          </label>

          <label className={sharedStyles.label}>
            <span>元数据状态</span>
            <select
              className={sharedStyles.select}
              value={metadataStatus}
              onChange={(event) => setMetadataStatus(event.target.value as MetadataStatusFilter)}
            >
              <option value="all">全部状态</option>
              <option value="success">正常</option>
              <option value="pending">等待解析</option>
              <option value="failed">解析失败</option>
              <option value="missing">缺失</option>
            </select>
          </label>

          <label className={sharedStyles.label}>
            <span>本地覆盖</span>
            <select
              className={sharedStyles.select}
              value={overrideFilter}
              onChange={(event) => setOverrideFilter(event.target.value as OverrideFilter)}
            >
              <option value="all">全部资源</option>
              <option value="only">仅看有覆盖</option>
              <option value="none">仅看无覆盖</option>
            </select>
          </label>
        </div>

        <div className={styles.filterFooter}>
          <div className={sharedStyles.chipRow}>
            <span className={sharedStyles.chip}>当前页 {itemsCount} 条</span>
            <span className={sharedStyles.chip}>总计 {total} 条</span>
            <span className={sharedStyles.chip}>
              覆盖命中 {localOverrideCount} 条
            </span>
            {isFetching ? (
              <span className={`${sharedStyles.chip} ${styles.pendingChip}`}>
                正在刷新结果
              </span>
            ) : null}
          </div>

          {hasActiveFilters ? (
            <button
              className={sharedStyles.ghostButton}
              type="button"
              onClick={onResetFilters}
            >
              清空筛选
            </button>
          ) : null}
        </div>
      </ManageSectionCard>
    </>
  );
}
