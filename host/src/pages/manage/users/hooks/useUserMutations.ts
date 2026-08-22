import {
  type BatchUpdateManageUsersRequest,
  manageApi,
  type CreateManageUserRequest,
  type DangerousActionRequest,
  type ResetUserPasswordRequest,
  type UpdateManageUserRequest,
  type UserStatus,
} from '@/domains/manage';
import { useCrudMutation } from '@/shared/hooks/useCrudMutation';
import { queryKeys } from '@/shared/query-keys';
import type { BannerState } from '@/shared/types/ui';
import { getErrorMessage } from '@/shared/utils/error';
import type { PendingUserAction, UserDrawerState } from '../types';

export interface UseUserMutationsCallbacks {
  setBanner: (state: BannerState | null) => void;
  setDrawerState: (state: UserDrawerState | null) => void;
  setPendingAction: (action: PendingUserAction | null) => void;
  setBatchEditDrawerOpen: (open: boolean) => void;
  setBatchDeleteConfirmOpen: (open: boolean) => void;
  setBatchEditConfirmOpen: (open: boolean) => void;
  closeResetPasswordDialog: () => void;
  resetBatchEditForm: () => void;
  setSelectedUserIds: (ids: string[]) => void;
}

export function useUserMutations({
  setBanner,
  setDrawerState,
  setPendingAction,
  setBatchEditDrawerOpen,
  setBatchDeleteConfirmOpen,
  setBatchEditConfirmOpen,
  closeResetPasswordDialog,
  resetBatchEditForm,
  setSelectedUserIds,
}: UseUserMutationsCallbacks) {
  const userListAndDetailsKeys = [
    queryKeys.manage.users.all(),
    queryKeys.manage.users.detail(),
  ];

  const updateStatusMutation = useCrudMutation({
    mutationFn: ({
      userId,
      status,
      confirmation,
    }: {
      userId: string;
      status: UserStatus;
      confirmation: DangerousActionRequest;
    }) =>
      manageApi.updateUserStatus(userId, {
        status,
        confirmAction: confirmation.confirmAction,
        sessionConfirmation: confirmation.sessionConfirmation,
        currentPassword: confirmation.currentPassword,
      }),
    invalidateKeys: userListAndDetailsKeys,
    onSuccess: (_, variables) => {
      setBanner({
        variant: 'success',
        title: variables.status === 'disabled' ? '用户已停用' : '用户已恢复',
        description: '列表数据已重新同步。',
      });
      setPendingAction(null);
    },
    onError: (error) => {
      setBanner({ variant: 'error', title: '用户状态更新失败', description: getErrorMessage(error) });
    },
  });

  const reviewRegistrationMutation = useCrudMutation({
    mutationFn: ({
      userId,
      action,
      confirmation,
    }: {
      userId: string;
      action: 'approve' | 'reject';
      confirmation: DangerousActionRequest;
    }) => {
      const payload = {
        confirmAction: confirmation.confirmAction,
        sessionConfirmation: confirmation.sessionConfirmation,
        currentPassword: confirmation.currentPassword,
      };
      return action === 'approve'
        ? manageApi.approveUserRegistration(userId, payload)
        : manageApi.rejectUserRegistration(userId, payload);
    },
    invalidateKeys: userListAndDetailsKeys,
    updateCache: ({ queryClient, result }) => {
      queryClient.setQueryData(queryKeys.manage.users.detail(result.id), result);
    },
    onSuccess: (_detail, variables) => {
      setBanner({
        variant: 'success',
        title:
          variables.action === 'approve'
            ? '注册申请已批准'
            : '注册申请已拒绝',
        description:
          variables.action === 'approve'
            ? '用户现在可以使用注册时设置的密码登录。'
            : '账号已停用，无法继续登录。',
      });
      setPendingAction(null);
    },
    onError: (error) => {
      setBanner({
        variant: 'error',
        title: '注册审批失败',
        description: getErrorMessage(error),
      });
    },
  });

  const createUserMutation = useCrudMutation({
    mutationFn: (payload: CreateManageUserRequest) => manageApi.createUser(payload),
    invalidateKeys: [queryKeys.manage.users.all()],
    updateCache: ({ queryClient, result }) => {
      queryClient.setQueryData(queryKeys.manage.users.detail(result.id), result);
    },
    onSuccess: (detail) => {
      setDrawerState({ mode: 'view', userId: detail.id });
      setBanner({ variant: 'success', title: '用户已创建', description: '账号、角色、模板快照和初始限制已经落库。' });
    },
    onError: (error) => {
      setBanner({ variant: 'error', title: '用户创建失败', description: getErrorMessage(error) });
    },
  });

  const updateUserMutation = useCrudMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: UpdateManageUserRequest }) =>
      manageApi.updateUser(userId, payload),
    invalidateKeys: (detail) => [
      queryKeys.manage.users.all(),
      queryKeys.manage.users.detail(detail.id),
    ],
    updateCache: ({ queryClient, result }) => {
      queryClient.setQueryData(queryKeys.manage.users.detail(result.id), result);
    },
    onSuccess: (detail) => {
      setDrawerState({ mode: 'view', userId: detail.id });
      setBanner({ variant: 'success', title: '用户资料已更新', description: '系统角色、账号限制、模板快照和来源路径授权已经同步刷新。' });
    },
    onError: (error) => {
      setBanner({ variant: 'error', title: '用户资料更新失败', description: getErrorMessage(error) });
    },
  });

  const batchDeleteMutation = useCrudMutation({
    mutationFn: ({
      userIds,
      confirmation,
    }: {
      userIds: string[];
      confirmation: DangerousActionRequest;
    }) =>
      manageApi.batchDeleteUsers({
        userIds,
        confirmAction: confirmation.confirmAction,
        sessionConfirmation: confirmation.sessionConfirmation,
        currentPassword: confirmation.currentPassword,
      }),
    invalidateKeys: userListAndDetailsKeys,
    onSuccess: (result) => {
      const skippedCount = result.results.filter((item) => item.result !== 'success').length;
      setBanner({
        variant:
          result.updatedCount > 0 && skippedCount === 0 ? 'success' : 'warning',
        title:
          result.updatedCount > 0
            ? `已软删除 ${result.updatedCount} 个账号`
            : '批量删除未产生变更',
        description:
          skippedCount > 0
            ? `另有 ${skippedCount} 个账号被跳过，请检查是否已停用、权限不足或包含当前登录账号。`
            : '所选账号已停用，活跃会话也一并吊销。',
      });
      setBatchDeleteConfirmOpen(false);
      setSelectedUserIds([]);
    },
    onError: (error) => {
      setBanner({
        variant: 'error',
        title: '批量删除失败',
        description: getErrorMessage(error),
      });
    },
  });

  const batchUpdateUsersMutation = useCrudMutation({
    mutationFn: (payload: BatchUpdateManageUsersRequest) =>
      manageApi.batchUpdateUsers(payload),
    invalidateKeys: userListAndDetailsKeys,
    onSuccess: (result, variables) => {
      const skippedCount = result.results.filter((item) => item.result !== 'success').length;
      const updatedAreas = [
        variables.role ? '系统角色' : null,
        variables.status ? '账号状态' : null,
        variables.sourceGrants ? '来源路径授权' : null,
      ].filter(Boolean).join('、');
      setBanner({
        variant:
          result.updatedCount > 0 && skippedCount === 0 ? 'success' : 'warning',
        title:
          result.updatedCount > 0
            ? `已批量更新 ${result.updatedCount} 个账号`
            : '批量编辑未产生变更',
        description:
          skippedCount > 0
            ? `已更新 ${updatedAreas || '所选项'}，另有 ${skippedCount} 个账号被跳过，请检查是否包含当前登录账号或管理员账号。`
            : `${updatedAreas || '所选项'}已经同步刷新。`,
      });
      setBatchEditDrawerOpen(false);
      setBatchEditConfirmOpen(false);
      resetBatchEditForm();
      setSelectedUserIds([]);
    },
    onError: (error) => {
      setBanner({
        variant: 'error',
        title: '批量编辑失败',
        description: getErrorMessage(error),
      });
    },
  });

  const resetUserLoginRiskMutation = useCrudMutation({
    mutationFn: ({
      userId,
      confirmation,
    }: {
      userId: string;
      confirmation: DangerousActionRequest;
    }) =>
      manageApi.resetUserLoginRisk(userId, {
        confirmAction: confirmation.confirmAction,
        sessionConfirmation: confirmation.sessionConfirmation,
        currentPassword: confirmation.currentPassword,
      }),
    invalidateKeys: [
      queryKeys.manage.auditLogs(),
      queryKeys.manage.users.all(),
      queryKeys.manage.users.detail(),
    ],
    onSuccess: () => {
      setBanner({
        variant: 'success',
        title: '用户登录风控已解除',
        description: '已从当前时间重新计算该用户名的失败登录窗口；历史失败审计记录仍然保留。',
      });
      setPendingAction(null);
    },
    onError: (error) => {
      setBanner({
        variant: 'error',
        title: '解除登录风控失败',
        description: getErrorMessage(error),
      });
    },
  });

  const resetUserPasswordMutation = useCrudMutation({
    mutationFn: ({
      userId,
      payload,
    }: {
      userId: string;
      payload: ResetUserPasswordRequest;
    }) => manageApi.resetUserPassword(userId, payload),
    invalidateKeys: [
      queryKeys.manage.auditLogs(),
      queryKeys.manage.users.all(),
      queryKeys.manage.users.detail(),
    ],
    onSuccess: () => {
      setBanner({
        variant: 'success',
        title: '用户密码已重置',
        description: '新密码已经写入；除非已勾选强制改密，否则用户可直接使用新密码登录。',
      });
      closeResetPasswordDialog();
    },
    onError: (error) => {
      setBanner({
        variant: 'error',
        title: '重置用户密码失败',
        description: getErrorMessage(error),
      });
    },
  });

  return {
    updateStatusMutation,
    reviewRegistrationMutation,
    createUserMutation,
    updateUserMutation,
    batchUpdateUsersMutation,
    batchDeleteMutation,
    resetUserLoginRiskMutation,
    resetUserPasswordMutation,
  };
}
