import { useEffect, useMemo, useState } from 'react';
import {
  isServiceUnwiredError,
  type ManagedCollectionRecord,
} from '@fmby/v2-shared/contracts/manage/peripherals';
import { FeedbackState, InlineBanner } from '@fmby/v2-shared/ui';
import { useBatchSelection, useBatchRunner } from '@fmby/v2-shared/hooks';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from './longtail-shared/ManageShared.module.css';
import { ManagePageHeader, ManageSectionCard } from './longtail-shared/components';
import { useCollectionDetailQuery, useCollectionMutations, useCollectionsQuery } from './collections/hooks';
import { CollectionListTable } from './collections/components/CollectionListTable';
import {
  CollectionFormDialog,
  type CollectionFormState,
} from './collections/components/CollectionFormDialog';
import { CollectionBatchActions } from './collections/components/CollectionBatchActions';
import {
  buildFormStateFromRecord,
  createInitialFormState,
} from './collections/components/labels';

export function ManageCollectionsPage() {
  const collectionsQuery = useCollectionsQuery();
  const [editingRecord, setEditingRecord] = useState<ManagedCollectionRecord | null>(null);
  const [formState, setFormState] = useState<CollectionFormState>(createInitialFormState);
  const [formOpen, setFormOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ManagedCollectionRecord | null>(null);
  const [pendingMemberDelete, setPendingMemberDelete] = useState<{ collectionId: string; boundItemId: string | null; memberTitle: string } | null>(null);
  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false);

  const mutations = useCollectionMutations({
      onSuccess: (message) => {
        setBanner(message);
      },
    });
  const {
    createMutation,
    updateMutation,
    deleteMutation,
    deleteMemberMutation,
    removeMemberMutation,
    reorderMemberMutation,
    reorderCollectionsMutation,
    patchMemberMutation,
  } = mutations;

  const detailQuery = useCollectionDetailQuery(expandedId);

  useEffect(() => {
    if (!banner) {
      return;
    }
    const timer = window.setTimeout(() => setBanner(null), 4200);
    return () => window.clearTimeout(timer);
  }, [banner]);

  const collections = collectionsQuery.data ?? [];

  // FE-OPT-04：多选 + 批量删除（hooks 必须在任何 early-return 之前，遵守 Hooks 规则）。
  const visibleIds = useMemo(() => collections.map((c) => c.id), [collections]);
  const selection = useBatchSelection({ visibleIds });
  const runner = useBatchRunner();

  const collectionsRefLabel = (id: string) =>
    collections.find((c) => c.id === id)?.title ?? `#${id}`;

  const deleteCollectionOne = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  const runBatchDelete = async () => {
    const targets = selection.selected.map((id) => ({
      id,
      label: collections.find((c) => c.id === id)?.title ?? `#${id}`,
    }));
    selection.clear();
    await runner.run(targets, deleteCollectionOne);
  };

  const retryCollectionDelete = async (id: string) => {
    await runner.retryOne(id, deleteCollectionOne);
  };

  const retryAllCollectionDeletes = async () => {
    await runner.retryFailed(deleteCollectionOne);
  };

  if (collectionsQuery.isPending) {
    return (
      <FeedbackState
        variant="loading"
        title="正在加载收藏合集"
        description="正在同步合集列表与来源形态。"
      />
    );
  }

  if (collectionsQuery.isError) {
    if (isServiceUnwiredError(collectionsQuery.error)) {
      return (
        <div className={styles.page}>
          <ManagePageHeader
            title="收藏合集管理"
            description="手工合集的创建、改名与上下线都在这里；豆瓣同步与预设合集只读维护。"
          />
          <ManageSectionCard
            title="合集端口未装配"
            description="GET /api/manage/collections 当前不可用。"
          >
            <InlineBanner
              variant="info"
              title="等待后端装配"
              description="合集管理端点尚未提供或端口未注入。本页不伪造空合集列表。"
            />
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => void collectionsQuery.refetch()}
            >
              重新检测
            </button>
          </ManageSectionCard>
        </div>
      );
    }
    return (
      <FeedbackState
        variant="error"
        title="收藏合集加载失败"
        description={getErrorMessage(collectionsQuery.error)}
        action={
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => collectionsQuery.refetch()}
          >
            重试
          </button>
        }
      />
    );
  }

  const manualCount = collections.filter((c) => c.sourceKind === 'manual').length;
  const hiddenCount = collections.filter((c) => c.visibility === 'Hidden').length;

  const actionError =
    createMutation.error ?? updateMutation.error ?? deleteMutation.error ?? deleteMemberMutation.error ?? removeMemberMutation.error ?? reorderMemberMutation.error ?? reorderCollectionsMutation.error ?? patchMemberMutation.error;
  const formPending = createMutation.isPending || updateMutation.isPending;

  function openCreate() {
    setEditingRecord(null);
    setFormState(createInitialFormState());
    setFormOpen(true);
  }

  function openEdit(record: ManagedCollectionRecord) {
    setEditingRecord(record);
    setFormState(buildFormStateFromRecord(record));
    setFormOpen(true);
  }

  function submitForm() {
    const input = {
      title: formState.title.trim(),
      overview: formState.overview.trim() || undefined,
      posterUrl: formState.posterUrl.trim() || undefined,
      visibility: formState.visibility,
    };
    if (editingRecord) {
      updateMutation.mutate({ id: editingRecord.id, input });
    } else {
      createMutation.mutate(input);
    }
  }

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="收藏合集管理"
        description="手工合集的创建、改名与上下线都在这里；豆瓣同步与预设合集只读维护。"
        meta={
          <span className={styles.metaText}>
            当前共 {collections.length} 个合集，其中手工创建 {manualCount} 个、隐藏 {hiddenCount} 个
          </span>
        }
        actions={
          <button className={styles.primaryButton} type="button" onClick={openCreate}>
            新建合集
          </button>
        }
      />

      {banner ? (
        <InlineBanner variant="success" title={banner} description="操作已写回服务端。" />
      ) : null}

      {actionError ? (
        <InlineBanner
          variant="error"
          title="合集操作失败"
          description={getErrorMessage(actionError)}
        />
      ) : null}

      <CollectionListTable
        collections={collections}
        detailQuery={detailQuery}
        selection={selection}
        expandedId={expandedId}
        setExpandedId={setExpandedId}
        setPendingDelete={setPendingDelete}
        setPendingMemberDelete={setPendingMemberDelete}
        setBanner={setBanner}
        onEdit={openEdit}
        mutations={mutations}
      />

      <CollectionFormDialog
        open={formOpen}
        editing={editingRecord !== null}
        editingTitle={editingRecord?.title}
        formState={formState}
        pending={formPending}
        onClose={() => setFormOpen(false)}
        onSubmit={submitForm}
        onFormStateChange={setFormState}
      />

      <CollectionBatchActions
        runnerItems={runner.items}
        onDismiss={runner.dismiss}
        onRetryItem={(id) => void retryCollectionDelete(id)}
        onRetryFailed={() => void retryAllCollectionDeletes()}
        selectedCount={selection.selected.length}
        onClearSelection={selection.clear}
        onRequestBatchDelete={() => setBatchDeleteConfirmOpen(true)}
        batchDeleteOpen={batchDeleteConfirmOpen}
        onBatchDeleteOpenChange={(open) => {
          if (!open) setBatchDeleteConfirmOpen(false);
        }}
        onConfirmBatchDelete={() => {
          setBatchDeleteConfirmOpen(false);
          void runBatchDelete();
        }}
        batchDeleteImpact={selection.selected.map((id) => `· ${collectionsRefLabel(id)}`)}
        pendingDeleteTitle={pendingDelete?.title ?? null}
        deletePending={deleteMutation.isPending}
        deleteError={deleteMutation.isError ? deleteMutation.error : undefined}
        onDeleteOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setPendingDelete(null);
        }}
        onConfirmDelete={() => {
          if (pendingDelete) {
            deleteMutation.mutate(pendingDelete.id);
            setPendingDelete(null);
          }
        }}
        pendingMemberTitle={pendingMemberDelete?.memberTitle ?? null}
        memberDeletePending={removeMemberMutation.isPending}
        memberDeleteError={removeMemberMutation.isError ? removeMemberMutation.error : undefined}
        onMemberDeleteOpenChange={(open) => {
          if (!open && !removeMemberMutation.isPending) setPendingMemberDelete(null);
        }}
        onConfirmMemberDelete={() => {
          if (pendingMemberDelete) {
            removeMemberMutation.mutate({
              collectionId: pendingMemberDelete.collectionId,
              input: { itemId: pendingMemberDelete.boundItemId ?? '' },
            });
            setPendingMemberDelete(null);
          }
        }}
      />
    </div>
  );
}

export default ManageCollectionsPage;
