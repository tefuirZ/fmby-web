import type { Dispatch, SetStateAction } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  manageApi,
  type CreateRegistrationCodeRequest,
  type DangerousActionRequest,
  type RegistrationCodeBatchRecord,
  type RegistrationCodeStatus,
  type UpdateRegistrationCodeBatchRequest,
} from '@/domains/manage';
import { queryKeys } from '@/shared/query-keys';
import type { BannerState } from '@/shared/types/ui';
import { getErrorMessage } from '@/shared/utils/error';
import { buildBatchDeleteBannerState } from '../formUtils';

export interface UseRegistrationCodeMutationsCallbacks {
  onCreateSuccess?: (batch: RegistrationCodeBatchRecord) => void;
  onUpdateSuccess?: (batch: RegistrationCodeBatchRecord) => void;
  onStatusUpdateSuccess?: (status: RegistrationCodeStatus) => void;
  onDeleteSuccess?: () => void;
  onBatchDeleteSuccess?: (deletedBatchIds: string[]) => void;
  onSettledSuccess?: (message: string) => void;
  onError?: (error: Error) => void;
  setBanner?: Dispatch<SetStateAction<BannerState | null>>;
  setCopyErrorMessage?: Dispatch<SetStateAction<string | null>>;
}

export function useRegistrationCodeMutations(
  callbacks: UseRegistrationCodeMutationsCallbacks = {},
) {
  const queryClient = useQueryClient();
  const {
    onCreateSuccess,
    onUpdateSuccess,
    onStatusUpdateSuccess,
    onDeleteSuccess,
    onBatchDeleteSuccess,
    onSettledSuccess,
    onError,
    setBanner,
    setCopyErrorMessage,
  } = callbacks;

  const createMutation = useMutation({
    mutationFn: (payload: CreateRegistrationCodeRequest) =>
      manageApi.createRegistrationCode(payload),
    onSuccess: async (batch) => {
      const message =
        batch.mode === 'shared-code'
          ? '共享注册码已创建。'
          : `注册码批次已创建，共 ${batch.totalCodes} 条。`;
      
      if (setBanner) {
        setBanner({
          variant: 'success',
          title: message,
          description: '列表已重新拉取。',
        });
      }
      if (setCopyErrorMessage) {
        setCopyErrorMessage(null);
      }
      if (onSettledSuccess) {
        onSettledSuccess(message);
      }
      if (onCreateSuccess) {
        onCreateSuccess(batch);
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.manage.registrationCodes.list(),
      });
    },
    onError: (error) => {
      if (onError) {
        onError(error);
      }
      if (setBanner) {
        setBanner({
          variant: 'error',
          title: '注册码创建失败',
          description: getErrorMessage(error),
        });
      }
    },
  });

  const updateBatchMutation = useMutation({
    mutationFn: ({
      batchId,
      payload,
    }: {
      batchId: string;
      payload: UpdateRegistrationCodeBatchRequest;
    }) => manageApi.updateRegistrationCodeBatch(batchId, payload),
    onSuccess: async (batch) => {
      if (setBanner) {
        setBanner({
          variant: 'success',
          title: '注册码批次已更新。',
          description: '列表已重新拉取。',
        });
      }
      if (setCopyErrorMessage) {
        setCopyErrorMessage(null);
      }
      if (onSettledSuccess) {
        onSettledSuccess('注册码批次已更新');
      }
      if (onUpdateSuccess) {
        onUpdateSuccess(batch);
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.manage.registrationCodes.list(),
      });
    },
    onError: (error) => {
      if (onError) {
        onError(error);
      }
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({
      codeId,
      status,
      confirmation,
    }: {
      codeId: string;
      status: RegistrationCodeStatus;
      confirmation: DangerousActionRequest;
    }) =>
      manageApi.updateRegistrationCodeStatus(codeId, {
        status,
        confirmAction: confirmation.confirmAction,
        sessionConfirmation: confirmation.sessionConfirmation,
        currentPassword: confirmation.currentPassword,
      }),
    onSuccess: async (_, variables) => {
      const message =
        variables.status === 'paused' ? '注册码已停用。' : '注册码已重新启用。';
      
      if (setBanner) {
        setBanner({
          variant: 'success',
          title: message,
          description: '列表已重新拉取。',
        });
      }
      if (setCopyErrorMessage) {
        setCopyErrorMessage(null);
      }
      if (onSettledSuccess) {
        onSettledSuccess(message);
      }
      if (onStatusUpdateSuccess) {
        onStatusUpdateSuccess(variables.status);
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.manage.registrationCodes.list(),
      });
    },
    onError: (error) => {
      if (onError) {
        onError(error);
      }
      if (setBanner) {
        setBanner({
          variant: 'error',
          title: '状态更新失败',
          description: getErrorMessage(error),
        });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({
      codeId,
      confirmation,
    }: {
      codeId: string;
      confirmation: DangerousActionRequest;
    }) =>
      manageApi.deleteRegistrationCode(codeId, {
        confirmAction: confirmation.confirmAction,
        sessionConfirmation: confirmation.sessionConfirmation,
        currentPassword: confirmation.currentPassword,
      }),
    onSuccess: async () => {
      if (setBanner) {
        setBanner({
          variant: 'success',
          title: '注册码记录已删除。',
          description: '列表已重新拉取。',
        });
      }
      if (setCopyErrorMessage) {
        setCopyErrorMessage(null);
      }
      if (onSettledSuccess) {
        onSettledSuccess('注册码记录已删除');
      }
      if (onDeleteSuccess) {
        onDeleteSuccess();
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.manage.registrationCodes.list(),
      });
    },
    onError: (error) => {
      if (onError) {
        onError(error);
      }
      if (setBanner) {
        setBanner({
          variant: 'error',
          title: '删除失败',
          description: getErrorMessage(error),
        });
      }
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: ({
      batchIds,
      confirmation,
    }: {
      batchIds: string[];
      confirmation: DangerousActionRequest;
    }) =>
      manageApi.batchDeleteRegistrationCodeBatches({
        batchIds,
        confirmAction: confirmation.confirmAction,
        sessionConfirmation: confirmation.sessionConfirmation,
        currentPassword: confirmation.currentPassword,
      }),
    onSuccess: async (result) => {
      const deletedBatchIds = result.results
        .filter((item) => item.result === 'success')
        .map((item) => item.id);

      if (setBanner) {
        setBanner(buildBatchDeleteBannerState(result));
      }
      if (setCopyErrorMessage) {
        setCopyErrorMessage(null);
      }
      if (onBatchDeleteSuccess) {
        onBatchDeleteSuccess(deletedBatchIds);
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.manage.registrationCodes.list(),
      });
    },
    onError: (error) => {
      if (onError) {
        onError(error);
      }
      if (setBanner) {
        setBanner({
          variant: 'error',
          title: '批量删除失败',
          description: getErrorMessage(error),
        });
      }
    },
  });

  return {
    createMutation,
    updateBatchMutation,
    updateStatusMutation,
    deleteMutation,
    batchDeleteMutation,
  };
}
