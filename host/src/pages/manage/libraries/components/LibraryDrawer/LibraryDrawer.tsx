import type { Dispatch, SetStateAction } from 'react';
import type {
  ManageLibraryDetailRecord,
  ManageMountRecord,
  ManageUserRecord,
  CreateManageLibraryRequest,
} from '@/domains/manage';
import { FeedbackState } from '@/shared/ui';
import { InlineBanner } from '@/shared/ui';
import { SideDrawer } from '@/shared/ui';
import type { BannerState } from '@/shared/types/ui';
import { getErrorMessage } from '@/shared/utils/error';
import styles from '../../../ManagePages.module.css';
import { buildPendingLibraryDeleteState, buildCreateLibraryPayload, getDrawerDescription, getDrawerTitle, validateLibraryForm } from '../../formUtils';
import type { LibraryDrawerState, LibraryFormState, PendingLibraryDeleteState } from '../../types';
import type { QueryShape, MutationShape } from './types';
import { useLibraryDrawerState } from './hooks';
import {
  LibraryDrawerBasicSection,
  LibraryDrawerSourceBindingsSection,
  LibraryDrawerGrantSection,
  LibraryDrawerViewOverviewSection,
  LibraryDrawerViewBindingsSection,
  LibraryDrawerViewSourcesSection,
  LibraryDrawerViewGrantsSection,
  LibraryDrawerViewScanTasksSection,
  LibraryDrawerCreateActions,
  LibraryDrawerEditActions,
  LibraryDrawerDeletePanel,
} from './sections';

interface LibraryDrawerProps {
  drawerState: LibraryDrawerState | null;
  libraryDetailQuery: QueryShape<ManageLibraryDetailRecord>;
  mountsQuery: QueryShape<{ items: ManageMountRecord[] }>;
  usersQuery: QueryShape<{ items: ManageUserRecord[] }>;
  formState: LibraryFormState;
  setFormState: Dispatch<SetStateAction<LibraryFormState>>;
  grantKeyword: string;
  setGrantKeyword: (value: string) => void;
  isSaving: boolean;
  isDeleting: boolean;
  createLibraryMutation: MutationShape<CreateManageLibraryRequest>;
  updateLibraryMutation: MutationShape<{ libraryId: string; form: LibraryFormState }>;
  triggerLibraryScanMutation: MutationShape<string>;
  setPendingDelete: (value: PendingLibraryDeleteState | null) => void;
  setBanner: (value: BannerState | null) => void;
  setDrawerState: (state: LibraryDrawerState | null) => void;
  onClose: () => void;
}

export function LibraryDrawer({
  drawerState,
  libraryDetailQuery,
  mountsQuery,
  usersQuery,
  formState,
  setFormState,
  grantKeyword,
  setGrantKeyword,
  isSaving,
  isDeleting,
  createLibraryMutation,
  updateLibraryMutation,
  triggerLibraryScanMutation,
  setPendingDelete,
  setBanner,
  setDrawerState,
  onClose,
}: LibraryDrawerProps) {
  const currentDetail = libraryDetailQuery.data;
  const isDrawerOpen = drawerState !== null;
  const mounts = mountsQuery.data?.items ?? [];
  const users = usersQuery.data?.items ?? [];

  const { filteredGrantUsers, selectedGrantChips, hasActiveScanTask, isTriggeringScan } = useLibraryDrawerState({
    currentDetail,
    users,
    formState,
    grantKeyword,
    triggerLibraryScanIsPending: triggerLibraryScanMutation.isPending,
  });

  const handleSaveLibrary = () => {
    const validationMessage = validateLibraryForm(formState);
    if (validationMessage) {
      setBanner({ variant: 'error', title: '表单校验未通过', description: validationMessage });
      return;
    }
    if (drawerState?.mode === 'create') {
      createLibraryMutation.mutate(buildCreateLibraryPayload(formState));
      return;
    }
    if (drawerState?.mode === 'edit' && drawerState.libraryId) {
      updateLibraryMutation.mutate({ libraryId: drawerState.libraryId, form: formState });
    }
  };

  return (
    <SideDrawer
      open={isDrawerOpen}
      title={getDrawerTitle(drawerState, currentDetail)}
      description={getDrawerDescription(drawerState)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {drawerState?.mode === 'create' ? (
        <>
          {mountsQuery.isError ? (
            <InlineBanner
              variant="warning"
              title="数据源加载失败"
              description="你仍然可以创建空媒体库，但如果要绑定数据源，请先修复数据源查询。"
            />
          ) : null}
          {usersQuery.isError ? (
            <InlineBanner
              variant="warning"
              title="用户列表加载失败"
              description="当前无法在抽屉内精确管理授权用户，保存后可以稍后再编辑补齐。"
            />
          ) : null}
          <LibraryDrawerBasicSection formState={formState} setFormState={setFormState} isSaving={isSaving} />
          <LibraryDrawerSourceBindingsSection
            mode="create"
            formState={formState}
            setFormState={setFormState}
            mounts={mounts}
            isSaving={isSaving}
          />
          <LibraryDrawerGrantSection
            drawerState={drawerState}
            formState={formState}
            setFormState={setFormState}
            grantKeyword={grantKeyword}
            setGrantKeyword={setGrantKeyword}
            isSaving={isSaving}
            usersQuery={usersQuery}
            users={users}
            filteredGrantUsers={filteredGrantUsers}
            selectedGrantChips={selectedGrantChips}
          />
          <LibraryDrawerCreateActions isSaving={isSaving} onClose={onClose} onSave={handleSaveLibrary} />
        </>
      ) : drawerState?.mode === 'edit' && libraryDetailQuery.isPending && !libraryDetailQuery.data ? (
        <FeedbackState
          variant="loading"
          title="正在加载媒体库详情"
          description="正在读取来源绑定、授权范围和最近状态。"
        />
      ) : drawerState?.mode === 'edit' && libraryDetailQuery.isError ? (
        <FeedbackState
          variant="error"
          title="媒体库详情加载失败"
          description={getErrorMessage(libraryDetailQuery.error)}
          action={
            <button className={styles.primaryButton} type="button" onClick={() => libraryDetailQuery.refetch()}>
              重试
            </button>
          }
        />
      ) : drawerState?.mode === 'edit' ? (
        <>
          {mountsQuery.isError ? (
            <InlineBanner
              variant="warning"
              title="数据源加载失败"
              description="编辑保存前建议先恢复数据源查询，否则你无法准确调整来源绑定。"
            />
          ) : null}
          {usersQuery.isError ? (
            <InlineBanner
              variant="warning"
              title="用户列表加载失败"
              description="当前无法在抽屉内准确调整授权用户，请稍后重试。"
            />
          ) : null}
          <LibraryDrawerBasicSection formState={formState} setFormState={setFormState} isSaving={isSaving} />
          <LibraryDrawerSourceBindingsSection
            mode="edit"
            formState={formState}
            setFormState={setFormState}
            mounts={mounts}
            isSaving={isSaving}
          />
          <LibraryDrawerGrantSection
            drawerState={drawerState}
            formState={formState}
            setFormState={setFormState}
            grantKeyword={grantKeyword}
            setGrantKeyword={setGrantKeyword}
            isSaving={isSaving}
            usersQuery={usersQuery}
            users={users}
            filteredGrantUsers={filteredGrantUsers}
            selectedGrantChips={selectedGrantChips}
          />
          {currentDetail ? (
            <LibraryDrawerDeletePanel
              isDeleting={isDeleting}
              isSaving={isSaving}
              onDelete={() => setPendingDelete(buildPendingLibraryDeleteState(currentDetail))}
            />
          ) : null}
          <LibraryDrawerEditActions
            currentDetail={currentDetail}
            isSaving={isSaving}
            setFormState={setFormState}
            setDrawerState={setDrawerState}
            onClose={onClose}
            onSave={handleSaveLibrary}
          />
        </>
      ) : libraryDetailQuery.isPending ? (
        <FeedbackState
          variant="loading"
          title="正在加载媒体库详情"
          description="正在读取来源绑定、授权范围和最近状态。"
        />
      ) : libraryDetailQuery.isError ? (
        <FeedbackState
          variant="error"
          title="媒体库详情加载失败"
          description={getErrorMessage(libraryDetailQuery.error)}
          action={
            <button className={styles.primaryButton} type="button" onClick={() => libraryDetailQuery.refetch()}>
              重试
            </button>
          }
        />
      ) : currentDetail ? (
        <>
          {currentDetail.sourceBindings.length === 0 ? (
            <InlineBanner
              variant={currentDetail.library.actualSourceNames.length > 0 ? 'warning' : 'info'}
              title={
                currentDetail.library.actualSourceNames.length > 0
                  ? '这个媒体库当前没有来源绑定，但库内仍有实际媒体来源'
                  : '这个媒体库还没有绑定来源'
              }
              description={
                currentDetail.library.actualSourceNames.length > 0
                  ? `可以直接在详情抽屉里补齐来源绑定。当前库内资源实际来自：${currentDetail.library.actualSourceNames.join('、')}`
                  : '可以直接在详情抽屉里进入编辑模式补齐来源绑定。'
              }
            />
          ) : null}
          <LibraryDrawerViewOverviewSection
            currentDetail={currentDetail}
            setFormState={setFormState}
            setDrawerState={setDrawerState}
            triggerLibraryScanMutation={triggerLibraryScanMutation}
            isTriggeringScan={isTriggeringScan}
            hasActiveScanTask={hasActiveScanTask}
          />
          <LibraryDrawerViewBindingsSection currentDetail={currentDetail} />
          <LibraryDrawerViewSourcesSection currentDetail={currentDetail} />
          <LibraryDrawerViewGrantsSection currentDetail={currentDetail} />
          <LibraryDrawerViewScanTasksSection currentDetail={currentDetail} />

          <LibraryDrawerDeletePanel
            isDeleting={isDeleting}
            onDelete={() => setPendingDelete(buildPendingLibraryDeleteState(currentDetail))}
          />
        </>
      ) : null}
    </SideDrawer>
  );
}
