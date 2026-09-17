import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import type { BannerState } from '@fmby/v2-shared/ui/types';
import type { DangerousActionRequest } from '@fmby/v2-shared/contracts/manage';
import type { ManageMediaItemListRecord } from '@fmby/v2-shared/contracts/manage/media-items';
import { FeedbackState, InlineBanner } from '@fmby/v2-shared/ui';
import { useDebounce } from '@fmby/v2-shared/hooks/useDebounce';
import { useBatchSelection, useBatchRunner } from '@fmby/v2-shared/hooks';
import { queryKeys } from '@fmby/v2-shared/query';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { mediaItemsApi } from '@fmby/v2-shared/contracts/manage/media-items';
import sharedStyles from './ManagePages.module.css';
import { ManagePageHeader } from './components';
import {
  useManageMediaItemLibrariesQuery,
  useManageMediaItemsQuery,
} from './media-items/hooks';
import {
  MediaItemMetricsBoard,
  MediaItemFilters,
  MediaItemsListSection,
} from './media-items/components';
import type {
  MediaTypeFilter,
  SourceStatusFilter,
  MetadataStatusFilter,
  OverrideFilter,
  PendingSourceDeleteState,
} from './media-items/types';
import { formatSourcePreview } from './media-items/formUtils';

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
  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false);
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
  // FE-OPT-04：多选 + 批量删除媒体源（逐条：先解析唯一来源，再删；失败逐条可重试）。
  const visibleIds = useMemo(() => items.map((item) => item.id), [items]);
  const selection = useBatchSelection({ visibleIds });
  const batchRunner = useBatchRunner();

  const deleteMediaItemSourceOne = async (itemId: string) => {
    const detail = await mediaItemsApi.getMediaItemDetail(itemId);
    const sources = detail.sources;
    if (sources.length === 0) {
      throw new Error('该资源没有可删除的媒体源');
    }
    if (sources.length > 1) {
      throw new Error(`该资源关联 ${sources.length} 条来源，需进详情页指定`);
    }
    await mediaItemsApi.deleteMediaItemSource(itemId, sources[0].id, {
      confirmAction: 'delete-media-item-source',
    });
  };

  const runBatchDeleteSources = async () => {
    const targets = selection.selected.map((id) => ({
      id,
      label: items.find((item) => item.id === id)?.title ?? `#${id}`,
    }));
    selection.clear();
    await batchRunner.run(targets, deleteMediaItemSourceOne);
    await mediaItemsQuery.refetch();
  };

  const retrySourceDelete = async (id: string) => {
    await batchRunner.retryOne(id, deleteMediaItemSourceOne);
    await mediaItemsQuery.refetch();
  };
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

      <MediaItemsListSection
        items={items}
        page={page}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        error={mediaItemsQuery.isError ? mediaItemsQuery.error : undefined}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={resetFilters}
        pendingSourceDelete={pendingSourceDelete}
        resolveDeletePending={resolveDeleteTargetMutation.isPending}
        resolveDeleteItemId={resolveDeleteTargetMutation.variables?.id}
        deletePending={deleteSourceMutation.isPending}
        onRequestDelete={handleRequestSourceDelete}
        selection={selection}
        batchRunner={batchRunner}
        batchDeleteConfirmOpen={batchDeleteConfirmOpen}
        setBatchDeleteConfirmOpen={setBatchDeleteConfirmOpen}
        onConfirmBatchDelete={() => {
          setBatchDeleteConfirmOpen(false);
          void runBatchDeleteSources();
        }}
        onRetrySourceDelete={(id) => void retrySourceDelete(id)}
        onConfirmSourceDelete={handleConfirmSourceDelete}
        onPendingSourceDeleteDismiss={() => {
          deleteSourceMutation.reset();
          setPendingSourceDelete(null);
        }}
        deleteSourceError={deleteSourceMutation.isError ? deleteSourceMutation.error : undefined}
        setPage={(next) => setPage(next)}
      />
    </div>
  );
}

export default ManageMediaItemsPage;
