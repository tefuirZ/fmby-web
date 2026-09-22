import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { type ManageLibraryType } from '@fmby/v2-shared/contracts/manage';
import { FeedbackState } from '@fmby/v2-shared/ui';
import { SensitiveActionDialog } from '@fmby/v2-shared/ui';
import { InlineBanner } from '@fmby/v2-shared/ui';
import styles from './ManagePages.module.css';
import { ManagePageHeader, MetricCard } from './components';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import type { BannerState } from '@fmby/v2-shared/ui/types';
import { matchKeyword } from '@fmby/v2-shared/search/matchKeyword';
import {
  type LibraryDrawerState,
  type LibraryFormState,
  type LibraryHealthStatus,
  type PendingLibraryDeleteState,
} from './libraries/types';
import {
  buildDeleteImpact,
  buildLibraryFormState,
  createEmptyLibraryForm,
} from './libraries/formUtils';
import {
  useLibrariesQuery,
  useLibraryDetailQuery,
  useMountsPickerQuery,
  useUsersPickerQuery,
  useLibraryMutations,
} from './libraries/hooks';
import { moveLibraryIds } from './libraries/hooks/libraryOrder';
import { LibraryTable, LibraryDrawer } from './libraries/components';

export function ManageLibrariesPage() {
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LibraryHealthStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ManageLibraryType>('all');
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [drawerState, setDrawerState] = useState<LibraryDrawerState | null>(null);
  const [formState, setFormState] = useState<LibraryFormState>(() => createEmptyLibraryForm());
  const [grantKeyword, setGrantKeyword] = useState('');
  const [pendingDelete, setPendingDelete] = useState<PendingLibraryDeleteState | null>(null);
  const deferredKeyword = useDeferredValue(keyword.trim());

  const librariesQuery = useLibrariesQuery();
  const libraryDetailQuery = useLibraryDetailQuery(drawerState);
  const mountsQuery = useMountsPickerQuery(drawerState !== null);
  const usersQuery = useUsersPickerQuery(drawerState !== null);
  const { createLibraryMutation, updateLibraryMutation, deleteLibraryMutation, triggerLibraryScanMutation, reorderLibrariesMutation } =
    useLibraryMutations({ setBanner, setDrawerState, setPendingDelete });

  useEffect(() => {
    if (drawerState?.mode === 'edit' && libraryDetailQuery.data) {
      setFormState(buildLibraryFormState(libraryDetailQuery.data));
    }
  }, [drawerState?.mode, libraryDetailQuery.data]);

  const libraries = librariesQuery.data?.items ?? [];
  const isSaving = createLibraryMutation.isPending || updateLibraryMutation.isPending;
  const isDeleting = deleteLibraryMutation.isPending;
  const isReordering = reorderLibrariesMutation.isPending;

  const filteredLibraries = useMemo(() => {
    return libraries.filter((library) => {
      const matchesKeyword =
        matchKeyword(
          deferredKeyword,
          library.name,
          library.description,
          library.typeLabel,
          ...library.sourceNames,
          ...library.actualSourceNames,
        );
      const matchesStatus = statusFilter === 'all' || library.status === statusFilter;
      const matchesType = typeFilter === 'all' || library.libraryType === typeFilter;
      return matchesKeyword && matchesStatus && matchesType;
    });
  }, [deferredKeyword, libraries, statusFilter, typeFilter]);

  if (librariesQuery.isPending) {
    return <FeedbackState variant="loading" title="正在加载媒体库管理页" description="正在整理媒体库状态、内容数量和最近更新时间。" />;
  }
  if (librariesQuery.isError) {
    return (
      <FeedbackState
        variant="error"
        title="媒体库管理页加载失败"
        description={getErrorMessage(librariesQuery.error)}
        action={<button className={styles.primaryButton} type="button" onClick={() => librariesQuery.refetch()}>重试</button>}
      />
    );
  }

  const healthyCount = libraries.filter((item) => item.status === 'healthy').length;
  const attentionCount = libraries.filter((item) => item.status === 'attention').length;
  const criticalCount = libraries.filter((item) => item.status === 'critical').length;
  const totalItems = libraries.reduce((sum, item) => sum + item.itemCount, 0);

  const openCreateDrawer = () => {
    setBanner(null);
    setGrantKeyword('');
    setFormState(createEmptyLibraryForm());
    setDrawerState({ mode: 'create' });
  };

  const openLibraryDrawer = (libraryId: string, mode: Extract<LibraryDrawerState['mode'], 'view' | 'edit'>) => {
    setBanner(null);
    setGrantKeyword('');
    if (mode === 'edit' && libraryDetailQuery.data?.library.id === libraryId) {
      setFormState(buildLibraryFormState(libraryDetailQuery.data));
    } else if (mode === 'edit') {
      setFormState(createEmptyLibraryForm());
    }
    setDrawerState({ mode, libraryId });
  };

  const closeDrawer = () => {
    if (isSaving) return;
    setFormState(createEmptyLibraryForm());
    setDrawerState(null);
    setGrantKeyword('');
  };

  const requestDelete = (target: PendingLibraryDeleteState) => {
    deleteLibraryMutation.reset();
    setPendingDelete(target);
  };

  // FE-LIBRARY-ORDER-UI：点击上/下移 → 本地在完整列表顺序中交换该库与邻项
  // → 乐观重排（reorderLibrariesMutation 的 onMutate 立即改缓存）→ 后台 PUT /order 校验。
  const handleMoveLibrary = (libraryId: string, step: -1 | 1) => {
    const fullIds = libraries.map((library) => library.id);
    const nextIds = moveLibraryIds(fullIds, libraryId, step);
    if (nextIds === fullIds) return;
    reorderLibrariesMutation.mutate(nextIds);
  };

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="媒体库"
        description="集中管理媒体库的来源绑定、授权范围与内容可见性。"
        meta={<span className={styles.metaText}>共 {libraries.length} 个媒体库</span>}
        actions={
          <>
            <button className={styles.primaryButton} type="button" onClick={openCreateDrawer}>新建媒体库</button>
            <button className={styles.secondaryButton} type="button" onClick={() => librariesQuery.refetch()}>刷新</button>
          </>
        }
      />

      {banner ? <InlineBanner variant={banner.variant} title={banner.title} description={banner.description} /> : null}

      <section className={styles.metricsGrid}>
        <MetricCard label="正常" value={healthyCount} status="healthy" />
        <MetricCard label="需关注" value={attentionCount} status="attention" />
        <MetricCard label="异常" value={criticalCount} status="critical" />
        <MetricCard label="内容总数" value={totalItems} status="healthy" />
      </section>

      <LibraryTable
        libraries={libraries}
        filteredLibraries={filteredLibraries}
        keyword={keyword}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        onKeywordChange={setKeyword}
        onStatusFilterChange={setStatusFilter}
        onTypeFilterChange={setTypeFilter}
        onOpenView={(id) => openLibraryDrawer(id, 'view')}
        onOpenEdit={(id) => openLibraryDrawer(id, 'edit')}
        onRequestDelete={(library) =>
          requestDelete({
            library,
            sourceBindingCount: library.sourceNames.length,
          })
        }
        onCreateClick={openCreateDrawer}
        onMoveLibrary={handleMoveLibrary}
        reorderPending={isReordering}
      />

      <LibraryDrawer
        drawerState={drawerState}
        libraryDetailQuery={libraryDetailQuery}
        mountsQuery={mountsQuery}
        usersQuery={usersQuery}
        formState={formState}
        setFormState={setFormState}
        grantKeyword={grantKeyword}
        setGrantKeyword={setGrantKeyword}
        isSaving={isSaving}
        isDeleting={isDeleting}
        createLibraryMutation={createLibraryMutation}
        updateLibraryMutation={updateLibraryMutation}
        triggerLibraryScanMutation={triggerLibraryScanMutation}
        setPendingDelete={setPendingDelete}
        setBanner={setBanner}
        setDrawerState={setDrawerState}
        onClose={closeDrawer}
      />

      <SensitiveActionDialog
        open={pendingDelete !== null}
        actionKey="delete-library"
        title={pendingDelete ? `删除媒体库：${pendingDelete.library.name}` : ''}
        description="删除媒体库后，当前来源绑定和前台可见性会立即从列表移除；其媒体资源与关联记录将由后台异步清理（可能耗时，期间仍可能短暂可见），清理完成前请勿重复操作。"
        impact={pendingDelete ? buildDeleteImpact(pendingDelete) : undefined}
        errorMessage={
          pendingDelete && deleteLibraryMutation.isError
            ? getErrorMessage(deleteLibraryMutation.error)
            : undefined
        }
        confirmLabel="删除媒体库"
        onOpenChange={(open) => {
          if (!open) {
            deleteLibraryMutation.reset();
            setPendingDelete(null);
          }
        }}
        onConfirm={(confirmation) => {
          if (!pendingDelete) return;
          deleteLibraryMutation.mutate({
            libraryId: pendingDelete.library.id,
            confirmation,
          });
        }}
        pending={isDeleting}
      />
    </div>
  );
}

export default ManageLibrariesPage;
