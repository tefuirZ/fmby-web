import { useDeferredValue, useEffect, useState } from 'react';
import type { RegistrationCodeBatchRecord, RegistrationCodeStatus } from '@fmby/v2-shared/contracts/manage';
import type { BannerState } from '@fmby/v2-shared/ui/types';
import { Dialog } from '@fmby/v2-shared/ui';
import { FeedbackState } from '@fmby/v2-shared/ui';
import { InlineBanner } from '@fmby/v2-shared/ui';
import { SensitiveActionDialog } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from './longtail-shared/ManageShared.module.css';
import { ManagePageHeader, ManageSectionCard } from './longtail-shared/components';
import {
  useRegistrationCodesQuery,
  useLibrariesQuery,
  useRegistrationCodeMutations,
} from './registration-codes/hooks';
import { useRoleTemplatesQuery } from './role-templates/hooks';
import {
  RegistrationCodeMetricsBoard,
  RegistrationCodeFilters,
  RegistrationCodeForm,
  RegistrationCodeList,
  RegistrationCodeBatchActionsBar,
  CopyToast,
} from './registration-codes/components';
import {
  createInitialFormState,
  buildFormStateFromBatch,
  buildCreatePayload,
  buildUpdateBatchPayload,
  getCodeStatusAction,
  isCodeAvailable,
  collectCopyableCodes,
} from './registration-codes/formUtils';
import type {
  RegistrationCodeFormState,
  CopyToastState,
  PendingCodeAction,
  RegistrationCodeBatchSummary,
} from './registration-codes/types';

export function ManageRegistrationCodesPage() {
  const [formState, setFormState] = useState<RegistrationCodeFormState>(
    createInitialFormState,
  );
  const [editingBatch, setEditingBatch] = useState<RegistrationCodeBatchRecord | null>(
    null,
  );
  const [statusFilter, setStatusFilter] = useState<'all' | RegistrationCodeStatus>('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [expandedBatchIds, setExpandedBatchIds] = useState<string[]>([]);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [copyErrorMessage, setCopyErrorMessage] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState<CopyToastState | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingCodeAction | null>(null);
  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false);
  const deferredSearchKeyword = useDeferredValue(searchKeyword.trim().toLowerCase());

  const codesQuery = useRegistrationCodesQuery();
  const librariesQuery = useLibrariesQuery();
  // 角色模板用来给注册码一次性套用常用授权组合，加载失败不阻断发码
  const roleTemplatesQuery = useRoleTemplatesQuery();

  const {
    createMutation,
    updateBatchMutation,
    updateStatusMutation,
    deleteMutation,
    batchDeleteMutation,
  } = useRegistrationCodeMutations({
    setBanner,
    setCopyErrorMessage,
    onCreateSuccess: (batch) => {
      setFormState(createInitialFormState());
      setEditingBatch(null);
      setExpandedBatchIds((current) =>
        current.includes(batch.id) ? current : [batch.id, ...current],
      );
      setSelectedBatchIds([batch.id]);
    },
    onUpdateSuccess: (batch) => {
      setFormState(createInitialFormState());
      setEditingBatch(null);
      setExpandedBatchIds((current) =>
        current.includes(batch.id) ? current : [batch.id, ...current],
      );
    },
    onStatusUpdateSuccess: () => {
      setPendingAction(null);
    },
    onDeleteSuccess: () => {
      setPendingAction(null);
      if (editingBatch) {
        resetEditorState();
      }
    },
    onBatchDeleteSuccess: (deletedBatchIds) => {
      setBatchDeleteConfirmOpen(false);
      if (deletedBatchIds.length > 0) {
        setSelectedBatchIds((current) =>
          current.filter((batchId) => !deletedBatchIds.includes(batchId)),
        );
        setExpandedBatchIds((current) =>
          current.filter((batchId) => !deletedBatchIds.includes(batchId)),
        );
        if (editingBatch && deletedBatchIds.includes(editingBatch.id)) {
          resetEditorState();
        }
      }
    },
  });

  function resetEditorState() {
    updateBatchMutation.reset();
    setCopyErrorMessage(null);
    setEditingBatch(null);
    setFormState(createInitialFormState());
  }

  useEffect(() => {
    if (!copyToast) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCopyToast(null);
    }, 4200);

    return () => window.clearTimeout(timer);
  }, [copyToast]);

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

  const batches = codesQuery.data?.items ?? [];
  const allCodes = batches.flatMap((batch) => batch.items);
  const libraries = librariesQuery.data?.items ?? [];
  const roleTemplates = roleTemplatesQuery.data?.items ?? [];
  const libraryNameMap = new Map(libraries.map((library) => [library.id, library.name]));

  const filteredBatches = batches.filter((batch) => {
    if (
      statusFilter !== 'all' &&
      !batch.items.some((item) => item.status === statusFilter)
    ) {
      return false;
    }

    if (!deferredSearchKeyword) {
      return true;
    }

    const haystack = [
      batch.name,
      batch.createdByName,
      ...batch.items.flatMap((item) => [
        item.code,
        item.roleTemplateLabel,
        item.createdByName,
        ...item.defaultLibraries.map(
          (libraryId) => libraryNameMap.get(libraryId) ?? libraryId,
        ),
      ]),
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(deferredSearchKeyword);
  });

  const batchSummaries: RegistrationCodeBatchSummary[] = filteredBatches.map((batch) => {
    const roleLabels = Array.from(
      new Set(batch.items.map((item) => item.roleTemplateLabel)),
    );
    const libraryLabels = Array.from(
      new Set(
        batch.items.flatMap((item) =>
          item.defaultLibraries.map(
            (libraryId) => libraryNameMap.get(libraryId) ?? libraryId,
          ),
        ),
      ),
    );
    return { batch, roleLabels, libraryLabels };
  });

  const selectedBatches = batches.filter((batch) =>
    selectedBatchIds.includes(batch.id),
  );

  const actionError =
    createMutation.error ??
    updateStatusMutation.error ??
    deleteMutation.error ??
    batchDeleteMutation.error;
  const actionErrorMessage = copyErrorMessage
    ? copyErrorMessage
    : actionError
      ? getErrorMessage(actionError)
      : null;
  const pendingStatusAction =
    pendingAction?.kind === 'status'
      ? getCodeStatusAction(pendingAction.record)
      : null;
  const createPending = createMutation.isPending;
  const updatePending = updateBatchMutation.isPending;
  const totalAvailableCodes = allCodes.filter(isCodeAvailable).length;
  const totalUsedCodes = allCodes.filter((item) => item.usageCount > 0).length;
  const totalRestrictedCodes = allCodes.filter(
    (item) =>
      item.status === 'paused' || item.status === 'expired' || item.status === 'used-up',
  ).length;
  const isEditModalOpen = editingBatch !== null;

  async function copyCodes(
    targetBatches: RegistrationCodeBatchRecord[],
    mode: 'all' | 'available',
  ) {
    try {
      const codes = collectCopyableCodes(targetBatches, mode);
      if (codes.length === 0) {
        setCopyErrorMessage(
          mode === 'available'
            ? '所选批次里没有仍可继续使用的注册码。'
            : '所选批次里没有可复制的注册码。',
        );
        return;
      }

      if (!navigator.clipboard?.writeText) {
        throw new Error('当前环境不支持剪贴板写入');
      }

      await navigator.clipboard.writeText(codes.join('\n'));
      setCopyErrorMessage(null);
      setCopyToast({
        title:
          mode === 'available'
            ? `已复制 ${codes.length} 条仍可继续使用的注册码。`
            : `已复制 ${codes.length} 条注册码。`,
        description: '剪贴板内容已经准备好，可以直接发给对应批次。',
      });
    } catch (error) {
      setCopyToast(null);
      setCopyErrorMessage(getErrorMessage(error));
    }
  }

  function toggleBatchExpanded(batchId: string) {
    setExpandedBatchIds((current) =>
      current.includes(batchId)
        ? current.filter((item) => item !== batchId)
        : [...current, batchId],
    );
  }

  function toggleBatchSelected(batchId: string) {
    setSelectedBatchIds((current) =>
      current.includes(batchId)
        ? current.filter((item) => item !== batchId)
        : [...current, batchId],
    );
  }

  function startBatchEditing(batch: RegistrationCodeBatchRecord) {
    updateBatchMutation.reset();
    setBanner(null);
    setCopyErrorMessage(null);
    setEditingBatch(batch);
    setFormState(buildFormStateFromBatch(batch));
    setExpandedBatchIds((current) =>
      current.includes(batch.id) ? current : [batch.id, ...current],
    );
  }

  return (
    <div className={styles.page}>
      <CopyToast toast={copyToast} />

      <ManagePageHeader
        title="注册码管理"
        description="批次化发码、共享码入口和单码明细都收在一个工作台里，窄屏也别再靠横向滚动硬撑。"
        meta={
          <span className={styles.metaText}>
            当前共 {batches.length} 个批次，{allCodes.length} 条注册码
          </span>
        }
      />

      <RegistrationCodeMetricsBoard
        metrics={{
          totalBatches: batches.length,
          totalCodes: allCodes.length,
          totalAvailableCodes,
          totalUsedCodes,
          totalRestrictedCodes,
        }}
      />

      {banner ? (
        <InlineBanner
          variant={banner.variant}
          title={banner.title}
          description={banner.description}
        />
      ) : null}

      {actionErrorMessage ? (
        <InlineBanner
          variant="error"
          title="注册码操作失败"
          description={actionErrorMessage}
        />
      ) : null}

      {!isEditModalOpen ? (
        <ManageSectionCard
          title="创建注册码批次"
          description="批量单次码和单码多次用统一从这里创建，后面列表按批次折叠管理。"
        >
          <RegistrationCodeForm
            mode="create"
            formState={formState}
            setFormState={setFormState}
            libraries={libraries}
            librariesLoading={librariesQuery.isPending}
            librariesError={librariesQuery.error}
            roleTemplates={roleTemplates}
            roleTemplatesLoading={roleTemplatesQuery.isPending}
            roleTemplatesError={roleTemplatesQuery.error}
            savePending={createPending}
            onSave={() => {
              setBanner(null);
              setCopyErrorMessage(null);
              createMutation.mutate(buildCreatePayload(formState));
            }}
          />
        </ManageSectionCard>
      ) : null}

      <Dialog
        open={isEditModalOpen}
        eyebrow="批次编辑"
        title={editingBatch ? `编辑批次：${editingBatch.name}` : '编辑注册码批次'}
        description={
          editingBatch?.mode === 'shared-code'
            ? '共享码批次会同时更新批次名称、共享注册码和公共授权字段。'
            : '这里按批次覆盖公共字段，不再让你对同一批码一条条改到怀疑人生。'
        }
        onOpenChange={(open) => {
          if (!open) {
            resetEditorState();
          }
        }}
      >
        <RegistrationCodeForm
          mode="edit"
          formState={formState}
          setFormState={setFormState}
          editingBatch={editingBatch}
          libraries={libraries}
          librariesLoading={librariesQuery.isPending}
          librariesError={librariesQuery.error}
          roleTemplates={roleTemplates}
          roleTemplatesLoading={roleTemplatesQuery.isPending}
          roleTemplatesError={roleTemplatesQuery.error}
          savePending={updatePending}
          editActionError={updateBatchMutation.error}
          onSave={() => {
            if (!editingBatch) {
              return;
            }
            setBanner(null);
            setCopyErrorMessage(null);
            updateBatchMutation.mutate({
              batchId: editingBatch.id,
              payload: buildUpdateBatchPayload(formState),
            });
          }}
        />
      </Dialog>

      <ManageSectionCard
        title="注册码批次"
        description="批次维度支持折叠、整批复制、多选复制和整批真删除；展开后再处理单条注册码。"
        actions={
          <RegistrationCodeFilters
            searchKeyword={searchKeyword}
            setSearchKeyword={setSearchKeyword}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
          />
        }
      >
        {filteredBatches.length === 0 ? (
          <div className={styles.emptyInlineState}>
            {batches.length === 0
              ? '还没有任何注册码批次，先创建一个。'
              : '当前筛选条件下没有匹配结果。'}
          </div>
        ) : (
          <RegistrationCodeList
            batchSummaries={batchSummaries}
            expandedBatchIds={expandedBatchIds}
            selectedBatchIds={selectedBatchIds}
            libraryNameMap={libraryNameMap}
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
          />
        )}
      </ManageSectionCard>

      <RegistrationCodeBatchActionsBar
        selectedBatches={selectedBatches}
        onClearSelection={() => setSelectedBatchIds([])}
        onCopyAll={() => copyCodes(selectedBatches, 'all')}
        onCopyAvailable={() => copyCodes(selectedBatches, 'available')}
        onBatchDelete={() => {
          setBanner(null);
          setCopyErrorMessage(null);
          setBatchDeleteConfirmOpen(true);
        }}
      />

      <SensitiveActionDialog
        open={pendingAction !== null}
        actionKey={
          pendingAction?.kind === 'delete'
            ? 'delete-registration-code'
            : 'update-registration-code-status'
        }
        title={
          pendingAction?.kind === 'delete'
            ? `删除注册码：${pendingAction.record.code}`
            : pendingAction
              ? `${pendingStatusAction?.label ?? '更新状态'}：${pendingAction.record.code}`
              : ''
        }
        description={
          pendingAction?.kind === 'delete'
            ? '删除后会直接移除这条注册码记录；如果这是批次最后一条码，该空批次也会被一并清理。'
            : '注册码状态变更会直接影响新用户的注册入口。'
        }
        impact={
          pendingAction?.kind === 'delete'
            ? [
                '仅未使用的注册码允许真删除。',
                '删除后列表会立即消失，无法再通过该码注册。',
              ]
            : pendingStatusAction?.impact
        }
        errorMessage={
          pendingAction?.kind === 'delete' && deleteMutation.isError
            ? getErrorMessage(deleteMutation.error)
            : pendingAction?.kind === 'status' && updateStatusMutation.isError
              ? getErrorMessage(updateStatusMutation.error)
              : undefined
        }
        confirmLabel={
          pendingAction?.kind === 'delete'
            ? '确认删除'
            : pendingStatusAction?.label ?? '确认'
        }
        pending={deleteMutation.isPending || updateStatusMutation.isPending}
        onOpenChange={(open) => {
          if (open) {
            return;
          }
          if (deleteMutation.isPending || updateStatusMutation.isPending) {
            return;
          }
          setPendingAction(null);
        }}
        onConfirm={(confirmation) => {
          if (!pendingAction) {
            return;
          }

          if (pendingAction.kind === 'delete') {
            deleteMutation.mutate({
              codeId: pendingAction.record.id,
              confirmation,
            });
            return;
          }

          const action = getCodeStatusAction(pendingAction.record);
          if (!action) {
            return;
          }

          updateStatusMutation.mutate({
            codeId: pendingAction.record.id,
            status: action.nextStatus,
            confirmation,
          });
        }}
      />

      <SensitiveActionDialog
        open={batchDeleteConfirmOpen}
        actionKey="delete-registration-code-batches"
        title={`批量删除 ${selectedBatches.length} 个注册码批次`}
        description="系统会按批次执行真删除，批次里只要有任意一条注册码已经被使用，这一整批都会被跳过。"
        impact={[
          '仅整批删除，不支持在这里勾选批次内单条注册码做批量删。',
          '删除成功的批次会从列表和复制选择里立即移除。',
        ]}
        errorMessage={
          batchDeleteMutation.isError
            ? getErrorMessage(batchDeleteMutation.error)
            : undefined
        }
        confirmLabel="确认批量删除"
        pending={batchDeleteMutation.isPending}
        onOpenChange={(open) => {
          if (open) {
            return;
          }
          if (batchDeleteMutation.isPending) {
            return;
          }
          setBatchDeleteConfirmOpen(false);
        }}
        onConfirm={(confirmation) => {
          batchDeleteMutation.mutate({
            batchIds: selectedBatchIds,
            confirmation,
          });
        }}
      />
    </div>
  );
}

export default ManageRegistrationCodesPage;
