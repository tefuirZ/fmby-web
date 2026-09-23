import styles from './longtail-shared/ManageShared.module.css';
import { FeedbackState, BatchProgressPanel } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import {
  CopyToast,
  RegistrationCodeHeader,
  RegistrationCodeEditor,
  RegistrationCodeBatchSection,
  RegistrationCodeActionDialogs,
} from './registration-codes/components';
import { useRegistrationCodesPageState } from './registration-codes/hooks/useRegistrationCodesPageState';
import {
  buildCreatePayload,
  buildUpdateBatchPayload,
  getCodeStatusAction,
} from './registration-codes/formUtils';
import { ManagePaidFeatureGuard } from './ManagePaidFeatureGuard';

export function ManageRegistrationCodesPageContent() {
  const {
    codesQuery,
    librariesQuery,
    roleTemplatesQuery,
    copyToast,
    batches,
    allCodes,
    totalAvailableCodes,
    totalUsedCodes,
    totalRestrictedCodes,
    banner,
    actionErrorMessage,
    formState,
    setFormState,
    editingBatch,
    isEditModalOpen,
    resetEditorState,
    libraries,
    roleTemplates,
    createPending,
    updatePending,
    updateBatchMutation,
    createMutation,
    batchSummaries,
    filteredBatches,
    expandedBatchIds,
    selectedBatchIds,
    libraryNameMap,
    searchKeyword,
    setSearchKeyword,
    statusFilter,
    setStatusFilter,
    selectedBatches,
    toggleBatchExpanded,
    toggleBatchSelected,
    copyCodes,
    startBatchEditing,
    setBanner,
    setCopyErrorMessage,
    setPendingAction,
    setSelectedBatchIds,
    setBatchDeleteConfirmOpen,
    pendingAction,
    pendingStatusAction,
    deleteMutation,
    updateStatusMutation,
    batchDeleteConfirmOpen,
    batchDeleteMutation,
    runBatchDeleteBatches,
    batchRunner,
    retryBatchDelete,
  } = useRegistrationCodesPageState();

  if (codesQuery.isPending) {
    return (
      <FeedbackState
        variant="loading"
        title="正在加载注册码管理"
        description="正在同步批次统计、注册码明细和默认媒体库。"
      />
    );
  }

  if (codesQuery.isError) {
    return (
      <FeedbackState
        variant="error"
        title="注册码列表加载失败"
        description={getErrorMessage(codesQuery.error)}
        action={
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => codesQuery.refetch()}
          >
            重试
          </button>
        }
      />
    );
  }

  return (
    <div className={styles.page}>
      <CopyToast toast={copyToast} />

      <RegistrationCodeHeader
        batchCount={batches.length}
        codeCount={allCodes.length}
        totalAvailableCodes={totalAvailableCodes}
        totalUsedCodes={totalUsedCodes}
        totalRestrictedCodes={totalRestrictedCodes}
        banner={banner}
        actionErrorMessage={actionErrorMessage}
      />

      <RegistrationCodeEditor
        formState={formState}
        setFormState={setFormState}
        editingBatch={editingBatch}
        isEditModalOpen={isEditModalOpen}
        onEditModalClose={resetEditorState}
        libraries={libraries}
        librariesLoading={librariesQuery.isPending}
        librariesError={librariesQuery.error}
        roleTemplates={roleTemplates}
        roleTemplatesLoading={roleTemplatesQuery.isPending}
        roleTemplatesError={roleTemplatesQuery.error}
        createPending={createPending}
        updatePending={updatePending}
        editActionError={updateBatchMutation.error}
        onCreate={() => {
          setBanner(null);
          setCopyErrorMessage(null);
          createMutation.mutate(buildCreatePayload(formState));
        }}
        onUpdate={() => {
          if (!editingBatch) return;
          setBanner(null);
          setCopyErrorMessage(null);
          updateBatchMutation.mutate({
            batchId: editingBatch.id,
            payload: buildUpdateBatchPayload(formState),
          });
        }}
      />

      <RegistrationCodeBatchSection
        batchSummaries={batchSummaries}
        batches={batches}
        filteredCount={filteredBatches.length}
        expandedBatchIds={expandedBatchIds}
        selectedBatchIds={selectedBatchIds}
        libraryNameMap={libraryNameMap}
        searchKeyword={searchKeyword}
        setSearchKeyword={setSearchKeyword}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        selectedBatches={selectedBatches}
        onToggleExpanded={toggleBatchExpanded}
        onToggleSelected={toggleBatchSelected}
        onCopyAll={(batch) => copyCodes([batch], 'all')}
        onCopyAvailable={(batch) => copyCodes([batch], 'available')}
        onEdit={startBatchEditing}
        onStatusAction={(record) => {
          setBanner(null);
          setCopyErrorMessage(null);
          setPendingAction({ kind: 'status', record });
        }}
        onDelete={(record) => {
          setBanner(null);
          setCopyErrorMessage(null);
          setPendingAction({ kind: 'delete', record });
        }}
        onClearSelection={() => setSelectedBatchIds([])}
        onCopySelectedAll={() => copyCodes(selectedBatches, 'all')}
        onCopySelectedAvailable={() => copyCodes(selectedBatches, 'available')}
        onBatchDelete={() => {
          setBanner(null);
          setCopyErrorMessage(null);
          setBatchDeleteConfirmOpen(true);
        }}
      />

      <RegistrationCodeActionDialogs
        pendingAction={pendingAction}
        pendingStatusAction={pendingStatusAction}
        actionPending={deleteMutation.isPending || updateStatusMutation.isPending}
        actionError={
          pendingAction?.kind === 'delete' && deleteMutation.isError
            ? deleteMutation.error
            : pendingAction?.kind === 'status' && updateStatusMutation.isError
              ? updateStatusMutation.error
              : undefined
        }
        onPendingOpenChange={(open) => {
          if (open) return;
          if (deleteMutation.isPending || updateStatusMutation.isPending) return;
          setPendingAction(null);
        }}
        onConfirmPendingAction={(confirmation) => {
          if (!pendingAction) return;
          if (pendingAction.kind === 'delete') {
            deleteMutation.mutate({ codeId: pendingAction.record.id, confirmation });
            return;
          }
          const action = getCodeStatusAction(pendingAction.record);
          if (!action) return;
          updateStatusMutation.mutate({
            codeId: pendingAction.record.id,
            status: action.nextStatus,
            confirmation,
          });
        }}
        batchDeleteOpen={batchDeleteConfirmOpen}
        batchDeleteCount={selectedBatches.length}
        batchDeletePending={batchDeleteMutation.isPending}
        batchDeleteError={batchDeleteMutation.isError ? batchDeleteMutation.error : undefined}
        onBatchDeleteOpenChange={(open) => {
          if (open) return;
          if (batchDeleteMutation.isPending) return;
          setBatchDeleteConfirmOpen(false);
        }}
        onConfirmBatchDelete={(confirmation) => {
          setBatchDeleteConfirmOpen(false);
          void runBatchDeleteBatches(confirmation);
        }}
      />

      {batchRunner.items.length > 0 ? (
        <BatchProgressPanel
          items={batchRunner.items}
          actionLabel="删除注册码批次"
          onDismiss={batchRunner.dismiss}
          onRetryItem={(id) => void retryBatchDelete(id)}
        />
      ) : null}
    </div>
  );
}

export default ManageRegistrationCodesPage;

/** 付费守卫：注册码管理属于收费能力入口（照 V1 对位，feature='registration-codes'）。 */
export function ManageRegistrationCodesPage() {
  return (
    <ManagePaidFeatureGuard
      feature="registration-codes"
      title="当前套餐未开通注册码管理"
      description="访问注册码页时会先被 direct guard 拦住；后端仍是最终门禁真相。"
    >
      <ManageRegistrationCodesPageContent />
    </ManagePaidFeatureGuard>
  );
}
