import { useDeferredValue, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import type { BannerState } from '@/shared/types/ui';
import type { DangerousActionRequest } from '@/domains/manage';
import type { ManageMediaItemListRecord } from '@/domains/manage/media-items';
import { FeedbackState } from '@/shared/ui';
import { SensitiveActionDialog } from '@/shared/ui';
import { InlineBanner } from '@/shared/ui';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { queryKeys } from '@/shared/query-keys';
import { getErrorMessage } from '@/shared/utils/error';
import { mediaItemsApi } from '@/domains/manage/media-items';
import sharedStyles from './ManagePages.module.css';
import styles from './ManageMediaItemsPage.module.css';
import { ManagePageHeader, ManageSectionCard } from './components';
import {
  useManageMediaItemLibrariesQuery,
  useManageMediaItemsQuery,
} from './media-items/hooks';
import {
  MediaItemMetricsBoard,
  MediaItemFilters,
  MediaItemListTable,
  MediaItemCardGrid,
} from './media-items/components';
import type {
  MediaTypeFilter,
  SourceStatusFilter,
  MetadataStatusFilter,
  OverrideFilter,
  PendingSourceDeleteState,
} from './media-items/types';
import { formatSourcePreview, getSourceStatusLabel } from './media-items/formUtils';

const PAGE_SIZE = 20;

export function ManageMediaItemsPage() {
  const [keyword, setKeyword] = useState('');
  const [libraryId, setLibraryId] = useState('all');
  const [mediaType, setMediaType] = useState<MediaTypeFilter>('all');
  const [sourceStatus, setSourceStatus] = useState<SourceStatusFilter>('all');
  const [metadataStatus, setMetadataStatus] = useState<MetadataStatusFilter>('all');
  const [overrideFilter, setOverrideFilter] = useState<OverrideFilter>('all');
  const [page, setPage] = useState(1);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [pendingSourceDelete, setPendingSourceDelete] =
    useState<PendingSourceDeleteState | null>(null);
  const queryClient = useQueryClient();

  const debouncedKeyword = useDebounce(keyword.trim(), 240);
  const deferredKeyword = useDeferredValue(debouncedKeyword);

  useEffect(() => {
    setPage(1);
  }, [deferredKeyword, libraryId, mediaType, sourceStatus, metadataStatus, overrideFilter]);

  const query = {
    page,
    pageSize: PAGE_SIZE,
    keyword: deferredKeyword || undefined,
    libraryId: libraryId !== 'all' ? libraryId : undefined,
    mediaType: mediaType !== 'all' ? mediaType : undefined,
    sourceStatus: sourceStatus !== 'all' ? sourceStatus : undefined,
    metadataStatus: metadataStatus !== 'all' ? metadataStatus : undefined,
    hasLocalOverride:
      overrideFilter === 'all' ? undefined : overrideFilter === 'only',
    sortBy: 'updated_at',
    sortOrder: 'desc' as const,
  };

  const mediaItemsQuery = useManageMediaItemsQuery(query);
  const librariesQuery = useManageMediaItemLibrariesQuery();

  const deleteSourceMutation = useMutation({
    mutationFn: ({
      target,
      confirmation,
    }: {
      target: PendingSourceDeleteState;
      confirmation: DangerousActionRequest;
    }) =>
      mediaItemsApi.deleteMediaItemSource(
        target.itemId,
        target.sourceId,
        confirmation,
      ),
    onSuccess: async (_, variables) => {
      const { target } = variables;
      setPendingSourceDelete(null);
      setBanner({
        variant: 'success',
        title: '媒体源已删除',
        description: `已删除《${target.itemTitle}》下的来源：${target.mountName}`,
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.manage.mediaItems.all(),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.manage.mediaItems.detail(target.itemId),
      });
    },
  });

  const resolveDeleteTargetMutation = useMutation({
    mutationFn: async (item: ManageMediaItemListRecord) => {
      const detail = await mediaItemsApi.getMediaItemDetail(item.id);
      return { item, detail };
    },
    onSuccess: ({ item, detail }) => {
      const sources = detail.sources;
      if (sources.length === 0) {
        setBanner({
          variant: 'warning',
          title: '当前资源没有媒体源记录',
          description: `《${item.title}》现在没有可删的来源，列表页不能继续删除。`,
        });
        return;
      }

      if (sources.length > 1) {
        const preview = sources
          .slice(0, 2)
          .map(formatSourcePreview)
          .join('；');
        setBanner({
          variant: 'warning',
          title: '这条资源挂了多条媒体源',
          description: `《${item.title}》当前关联 ${sources.length} 条来源，列表页没法替你盲删。${preview ? `来源示例：${preview}。` : ''}请进详情页挑具体来源再删。`,
        });
        return;
      }

      const source = sources[0];
      deleteSourceMutation.reset();
      setPendingSourceDelete({
        itemId: detail.item.id,
        itemTitle: detail.item.title,
        sourceId: source.id,
        mountName: source.mountName,
        filePath: source.filePath,
        sourceStatus: source.sourceStatus,
      });
    },
    onError: (error, item) => {
      setBanner({
        variant: 'error',
        title: '读取媒体源失败',
        description: `《${item.title}》：${getErrorMessage(error)}`,
      });
    },
  });

  const items = mediaItemsQuery.data?.items ?? [];
  const total = mediaItemsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasActiveFilters =
    keyword.trim() !== '' ||
    libraryId !== 'all' ||
    mediaType !== 'all' ||
    sourceStatus !== 'all' ||
    metadataStatus !== 'all' ||
    overrideFilter !== 'all';

  const localOverrideCount = items.filter((item) => item.hasLocalOverride).length;
  const playableCount = items.filter((item) => item.sourceStatus === 'playable').length;
  const metadataIssueCount = items.filter((item) => item.metadataStatus !== 'success').length;
  const assetReadyCount = items.filter((item) => item.hasPoster || item.hasSubtitle).length;

  const resetFilters = () => {
    setKeyword('');
    setLibraryId('all');
    setMediaType('all');
    setSourceStatus('all');
    setMetadataStatus('all');
    setOverrideFilter('all');
  };

  const handleRequestSourceDelete = (item: ManageMediaItemListRecord) => {
    setBanner(null);
    setPendingSourceDelete(null);
    deleteSourceMutation.reset();
    resolveDeleteTargetMutation.reset();
    resolveDeleteTargetMutation.mutate(item);
  };

  const handleConfirmSourceDelete = (confirmation: DangerousActionRequest) => {
    if (!pendingSourceDelete) {
      return;
    }
    deleteSourceMutation.mutate({
      target: pendingSourceDelete,
      confirmation,
    });
  };

  if (mediaItemsQuery.isPending && !mediaItemsQuery.data) {
    return (
      <FeedbackState
        variant="loading"
        title="正在加载资源列表"
        description="正在拉取媒体项、覆盖状态和元数据状态。"
      />
    );
  }

  if (mediaItemsQuery.isError && !mediaItemsQuery.data) {
    return (
      <FeedbackState
        variant="error"
        title="资源列表加载失败"
        description={getErrorMessage(mediaItemsQuery.error)}
        action={
          <button
            className={sharedStyles.primaryButton}
            type="button"
            onClick={() => mediaItemsQuery.refetch()}
          >
            重试
          </button>
        }
      />
    );
  }

  return (
    <div className={sharedStyles.page}>
      <ManagePageHeader
        title="资源管理"
        description="检索、筛选媒体资源，查看识别与刮削状态，进入详情页管理元数据、封面与字幕。"
        meta={
          <span className={sharedStyles.metaText}>
            共 {total} 条资源，当前第 {page} / {totalPages} 页
          </span>
        }
        actions={
          <button
            className={sharedStyles.secondaryButton}
            type="button"
            onClick={() => mediaItemsQuery.refetch()}
          >
            <RefreshCw size={16} />
            刷新列表
          </button>
        }
      />

      {banner ? (
        <InlineBanner
          variant={banner.variant}
          title={banner.title}
          description={banner.description}
        />
      ) : null}

      <MediaItemMetricsBoard
        total={total}
        localOverrideCount={localOverrideCount}
        playableCount={playableCount}
        metadataIssueCount={metadataIssueCount}
        assetReadyCount={assetReadyCount}
      />

      <MediaItemFilters
        keyword={keyword}
        setKeyword={setKeyword}
        libraryId={libraryId}
        setLibraryId={setLibraryId}
        mediaType={mediaType}
        setMediaType={setMediaType}
        sourceStatus={sourceStatus}
        setSourceStatus={setSourceStatus}
        metadataStatus={metadataStatus}
        setMetadataStatus={setMetadataStatus}
        overrideFilter={overrideFilter}
        setOverrideFilter={setOverrideFilter}
        librariesQuery={librariesQuery}
        itemsCount={items.length}
        total={total}
        localOverrideCount={items.filter((item) => item.hasLocalOverride).length}
        isFetching={mediaItemsQuery.isFetching}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={resetFilters}
      />

      <ManageSectionCard
        title="资源列表"
        description="列表只展示海报、状态与覆盖摘要；查看与编辑请进入资源详情页。"
        actions={
          <span className={sharedStyles.metaText}>
            默认按最近更新时间倒序
          </span>
        }
      >
        {mediaItemsQuery.isError ? (
          <InlineBanner
            variant="error"
            title="刷新资源列表失败"
            description={getErrorMessage(mediaItemsQuery.error)}
          />
        ) : null}

        {items.length === 0 ? (
          <FeedbackState
            variant="empty"
            title="当前条件下没有资源"
            description="没有匹配的资源，换个关键词或放宽筛选条件试试。"
            action={
              hasActiveFilters ? (
                <button
                  className={sharedStyles.primaryButton}
                  type="button"
                  onClick={resetFilters}
                >
                  重置筛选
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <MediaItemListTable
              items={items}
              pendingSourceDelete={pendingSourceDelete}
              resolveDeletePending={resolveDeleteTargetMutation.isPending}
              resolveDeleteItemId={resolveDeleteTargetMutation.variables?.id}
              deletePending={deleteSourceMutation.isPending}
              onRequestDelete={handleRequestSourceDelete}
            />

            <MediaItemCardGrid
              items={items}
              pendingSourceDelete={pendingSourceDelete}
              resolveDeletePending={resolveDeleteTargetMutation.isPending}
              resolveDeleteItemId={resolveDeleteTargetMutation.variables?.id}
              deletePending={deleteSourceMutation.isPending}
              onRequestDelete={handleRequestSourceDelete}
            />

            <div className={styles.paginationBar}>
              <div className={sharedStyles.metaText}>
                每页 {PAGE_SIZE} 条，当前显示 {items.length} 条
              </div>
              <div className={styles.paginationActions}>
                <button
                  className={sharedStyles.ghostButton}
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  上一页
                </button>
                <span className={styles.paginationLabel}>
                  第 {page} / {totalPages} 页
                </span>
                <button
                  className={sharedStyles.ghostButton}
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                >
                  下一页
                </button>
              </div>
            </div>
          </>
        )}
      </ManageSectionCard>

      <SensitiveActionDialog
        open={pendingSourceDelete !== null}
        actionKey="delete-media-item-source"
        title={pendingSourceDelete ? `删除媒体源：${pendingSourceDelete.itemTitle}` : ''}
        description="删除后当前资源会失去这条来源记录；如果它是最后一个来源，这条资源会暂时没有可播源。"
        impact={
          pendingSourceDelete
            ? [
                `来源挂载：${pendingSourceDelete.mountName}`,
                `源文件：${pendingSourceDelete.filePath}`,
                `当前来源状态：${getSourceStatusLabel(pendingSourceDelete.sourceStatus)}`,
                '探测任务和探测快照会一起清掉；如果仍被播放会话引用，后端会拒绝删除。',
              ]
            : undefined
        }
        errorMessage={
          pendingSourceDelete && deleteSourceMutation.isError
            ? getErrorMessage(deleteSourceMutation.error)
            : undefined
        }
        confirmLabel="删除媒体源"
        pending={deleteSourceMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            deleteSourceMutation.reset();
            setPendingSourceDelete(null);
          }
        }}
        onConfirm={handleConfirmSourceDelete}
      />
    </div>
  );
}

export default ManageMediaItemsPage;
