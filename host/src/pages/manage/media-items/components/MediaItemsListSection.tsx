/** 资源列表区（错误/空态 + 表格/卡片 + 分页）（V1F 拆分）。 */

import type { Dispatch, SetStateAction } from 'react';
import { BatchActionBar, BatchProgressPanel, FeedbackState, InlineBanner, SensitiveActionDialog } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import sharedStyles from '../../longtail-shared/ManageShared.module.css';
import listStyles from '../../ManageMediaItemsPage.module.css';
import { ManageSectionCard } from '../../longtail-shared/components';
import type { ManageMediaItemListRecord } from '@fmby/v2-shared/contracts/manage/media-items';
import type { DangerousActionRequest } from '@fmby/v2-shared/contracts/manage';
import type { PendingSourceDeleteState } from '../types';
import { getSourceStatusLabel } from '../formUtils';
import { MediaItemListTable } from './MediaItemListTable';
import { MediaItemCardGrid } from './MediaItemCardGrid';

interface SelectionShape {
  selected: string[];
  headerState: 'checked' | 'indeterminate' | 'unchecked';
  toggle: (id: string, checked: boolean, opts?: { shiftKey?: boolean }) => void;
  selectAll: () => void;
  clearVisible: () => void;
  clear: () => void;
}

interface BatchRunnerShape {
  items: { id: string; label: string; status: string }[];
  dismiss: () => void;
}

interface MediaItemsListSectionProps {
  items: ManageMediaItemListRecord[];
  page: number;
  totalPages: number;
  pageSize: number;
  error: unknown;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
  pendingSourceDelete: PendingSourceDeleteState | null;
  resolveDeletePending: boolean;
  resolveDeleteItemId?: string;
  deletePending: boolean;
  onRequestDelete: (item: ManageMediaItemListRecord) => void;
  selection: SelectionShape;
  batchRunner: BatchRunnerShape;
  batchDeleteConfirmOpen: boolean;
  setBatchDeleteConfirmOpen: (open: boolean) => void;
  onConfirmBatchDelete: () => void;
  onRetrySourceDelete: (id: string) => void;
  onConfirmSourceDelete: (confirmation: DangerousActionRequest) => void;
  onPendingSourceDeleteDismiss: () => void;
  deleteSourceError: unknown;
  setPage: Dispatch<SetStateAction<number>>;
}

export function MediaItemsListSection({
  items,
  page,
  totalPages,
  pageSize,
  error,
  hasActiveFilters,
  onResetFilters,
  pendingSourceDelete,
  resolveDeletePending,
  resolveDeleteItemId,
  deletePending,
  onRequestDelete,
  selection,
  batchRunner,
  batchDeleteConfirmOpen,
  setBatchDeleteConfirmOpen,
  onConfirmBatchDelete,
  onRetrySourceDelete,
  onConfirmSourceDelete,
  onPendingSourceDeleteDismiss,
  deleteSourceError,
  setPage,
}: MediaItemsListSectionProps) {
  return (
    <>
      <ManageSectionCard
        title="资源列表"
        description="列表只展示海报、状态与覆盖摘要；查看与编辑请进入资源详情页。"
        actions={<span className={sharedStyles.metaText}>默认按最近更新时间倒序</span>}
      >
        {error ? (
          <InlineBanner
            variant="error"
            title="刷新资源列表失败"
            description={getErrorMessage(error)}
          />
        ) : null}

        {items.length === 0 ? (
          <FeedbackState
            variant="empty"
            title="当前条件下没有资源"
            description="没有匹配的资源，换个关键词或放宽筛选条件试试。"
            action={
              hasActiveFilters ? (
                <button className={sharedStyles.primaryButton} type="button" onClick={onResetFilters}>
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
              resolveDeletePending={resolveDeletePending}
              resolveDeleteItemId={resolveDeleteItemId}
              deletePending={deletePending}
              onRequestDelete={onRequestDelete}
              selectedIds={selection.selected}
              headerState={selection.headerState}
              onToggleRow={(id, checked, opts) => selection.toggle(id, checked, opts)}
              onSelectAll={selection.selectAll}
              onClearVisible={selection.clearVisible}
            />

            <MediaItemCardGrid
              items={items}
              pendingSourceDelete={pendingSourceDelete}
              resolveDeletePending={resolveDeletePending}
              resolveDeleteItemId={resolveDeleteItemId}
              deletePending={deletePending}
              onRequestDelete={onRequestDelete}
            />

            <div className={listStyles.paginationBar}>
              <div className={sharedStyles.metaText}>
                每页 {pageSize} 条，当前显示 {items.length} 条
              </div>
              <div className={listStyles.paginationActions}>
                <button
                  className={sharedStyles.ghostButton}
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  上一页
                </button>
                <span className={listStyles.paginationLabel}>
                  第 {page} / {totalPages} 页
                </span>
                <button
                  className={sharedStyles.ghostButton}
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                >
                  下一页
                </button>
              </div>
            </div>
          </>
        )}
      </ManageSectionCard>

      {batchRunner.items.length > 0 ? (
        <BatchProgressPanel
          items={batchRunner.items as never}
          actionLabel="删除媒体源"
          onDismiss={batchRunner.dismiss}
          onRetryItem={(id) => void onRetrySourceDelete(id)}
        />
      ) : null}

      <BatchActionBar
        count={selection.selected.length}
        onClear={selection.clear}
        hint="逐条删除唯一媒体源；多来源或无来源的资源会列为失败项，可进详情页处理。"
      >
        <button
          className={listStyles.smallDangerButton}
          type="button"
          onClick={() => setBatchDeleteConfirmOpen(true)}
        >
          批量删除媒体源
        </button>
      </BatchActionBar>

      <SensitiveActionDialog
        open={batchDeleteConfirmOpen}
        actionKey="delete-media-item-source"
        title={`批量删除 ${selection.selected.length} 条资源的媒体源`}
        description="逐条删除：仅含唯一来源的资源会被删除；多来源/无来源资源列为失败项。"
        impact={selection.selected.map(
          (id) => `· ${items.find((i) => i.id === id)?.title ?? `#${id}`}`,
        )}
        confirmLabel="确认批量删除"
        onOpenChange={(open) => {
          if (!open) setBatchDeleteConfirmOpen(false);
        }}
        onConfirm={onConfirmBatchDelete}
      />

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
        errorMessage={deleteSourceError ? getErrorMessage(deleteSourceError) : undefined}
        confirmLabel="删除媒体源"
        pending={deletePending}
        onOpenChange={(open) => {
          if (!open) onPendingSourceDeleteDismiss();
        }}
        onConfirm={onConfirmSourceDelete}
      />
    </>
  );
}
