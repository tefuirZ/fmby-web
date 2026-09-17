/** 注册码页状态/派生/处理器（V1F 拆分：ManageRegistrationCodesPage → 页状态 hook）。
 *
 * 与 naming-rules 的 useNamingRulesPageState 同型：状态、派生与事件处理器集中在此，
 * 页面只负责渲染。
 */

import { useDeferredValue, useEffect, useState } from 'react';
import {
  manageApi,
  type DangerousActionRequest,
  type RegistrationCodeBatchRecord,
  type RegistrationCodeStatus,
} from '@fmby/v2-shared/contracts/manage';
import type { BannerState } from '@fmby/v2-shared/ui/types';
import { useBatchRunner } from '@fmby/v2-shared/hooks';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import {
  useRegistrationCodesQuery,
  useLibrariesQuery,
  useRegistrationCodeMutations,
} from './index';
import { useRoleTemplatesQuery } from '../../role-templates/hooks';
import {
  createInitialFormState,
  buildFormStateFromBatch,
  collectCopyableCodes,
  getCodeStatusAction,
  isCodeAvailable,
} from '../formUtils';
import type {
  RegistrationCodeFormState,
  CopyToastState,
  PendingCodeAction,
  RegistrationCodeBatchSummary,
} from '../types';

export function useRegistrationCodesPageState() {
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
  const batchRunner = useBatchRunner();
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

  // FE-OPT-04：批量删批次改**逐条编排**（逐条状态 + 失败可单条重试）。
  // 后端 `POST /manage/registration-codes/batch/delete` 现为 501 stub；逐条
  // 走既有单码删除语义不可行（批次粒度），故仍以批次为目标，逐批删除 + 状态。
  const deleteRegistrationBatchOne = async (batchId: string, confirmation: DangerousActionRequest) => {
    await manageApi.batchDeleteRegistrationCodeBatches({
      batchIds: [batchId],
      confirmAction: confirmation.confirmAction,
      sessionConfirmation: confirmation.sessionConfirmation,
      currentPassword: confirmation.currentPassword,
    });
  };

  const runBatchDeleteBatches = async (confirmation: DangerousActionRequest) => {
    const targets = selectedBatches.map((batch) => ({ id: batch.id, label: batch.name || batch.id }));
    setSelectedBatchIds([]);
    await batchRunner.run(targets, (id) => deleteRegistrationBatchOne(id, confirmation));
    await codesQuery.refetch();
  };

  const retryBatchDelete = async (id: string) => {
    await batchRunner.retryOne(id, (batchId) =>
      deleteRegistrationBatchOne(batchId, { confirmAction: 'delete-registration-code-batches' } as DangerousActionRequest),
    );
    await codesQuery.refetch();
  };

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
  return {
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
  };
}
