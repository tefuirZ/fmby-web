import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type DangerousActionRequest, type ManageUserAccountKind, type UserStatus } from '@fmby/v2-shared/contracts/manage';
import { manageApi } from '@fmby/v2-shared/contracts/manage';
import { useSession } from '@/session';
import { FeedbackState } from '@fmby/v2-shared/ui';
import { BatchProgressPanel } from '@fmby/v2-shared/ui';
import { useBatchRunner } from '@fmby/v2-shared/hooks';
import { queryKeys } from '@fmby/v2-shared/query';
import styles from './longtail-shared/ManageShared.module.css';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import type { BannerState } from '@fmby/v2-shared/ui/types';
import {
  type PendingUserAction,
  type ResetPasswordDialogState,
  type UserDrawerState,
  type UserFormState,
  DEFAULT_BATCH_EDIT_FORM_STATE,
  DEFAULT_FORM_STATE,
} from './users/types';
import {
  buildUserFormState,
  canSelectUserForBatchAction,
  getNextUserAction,
} from './users/formUtils';
import { useUsersQuery, useUserDetailQuery, useUserMutations } from './users/hooks';
import {
  BatchUserEditDrawer,
  ResetUserPasswordDialog,
  UserDrawer,
  UserActionDialogs,
  UserSelectionBar,
  UsersHeaderAndTable,
  getPendingActionImpact,
  getPendingActionKey,
  getPendingActionLabel,
  getPendingActionTitle,
} from './users/components';

const USER_PAGE_SIZE = 100;

export function ManageUsersPage() {
  const { user: currentUser } = useSession();
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');
  const [accountKindFilter, setAccountKindFilter] = useState<'all' | ManageUserAccountKind>('all');
  const [page, setPage] = useState(1);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingUserAction | null>(null);
  const [drawerState, setDrawerState] = useState<UserDrawerState | null>(null);
  const [formState, setFormState] = useState<UserFormState>(DEFAULT_FORM_STATE);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const batchRunner = useBatchRunner();
  const [batchEditDrawerOpen, setBatchEditDrawerOpen] = useState(false);
  const [batchEditConfirmOpen, setBatchEditConfirmOpen] = useState(false);
  const [batchEditFormState, setBatchEditFormState] = useState(DEFAULT_BATCH_EDIT_FORM_STATE);
  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false);
  const [resetPasswordDialog, setResetPasswordDialog] =
    useState<ResetPasswordDialogState | null>(null);
  const deferredKeyword = useDeferredValue(keyword.trim());

  const usersQuery = useUsersQuery({
    page,
    pageSize: USER_PAGE_SIZE,
    search: deferredKeyword || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
    accountKind: accountKindFilter === 'all' ? undefined : accountKindFilter,
  });
  const userDetailQuery = useUserDetailQuery(drawerState);
  const mountsQuery = useQuery({
    queryKey: queryKeys.manage.mounts.list(),
    queryFn: () => manageApi.getMounts(),
    staleTime: 60_000,
  });
  const roleTemplatesQuery = useQuery({
    queryKey: queryKeys.manage.roleTemplates.list(),
    queryFn: () => manageApi.getRoleTemplates(),
    staleTime: 60_000,
  });
  const {
    updateStatusMutation,
    reviewRegistrationMutation,
    createUserMutation,
    updateUserMutation,
    batchUpdateUsersMutation,
    resetUserLoginRiskMutation,
    resetUserPasswordMutation,
  } = useUserMutations({
    setBanner,
    setDrawerState,
    setPendingAction,
    setBatchEditDrawerOpen,
    setBatchEditConfirmOpen,
    setBatchDeleteConfirmOpen,
    closeResetPasswordDialog: () => setResetPasswordDialog(null),
    resetBatchEditForm: () => setBatchEditFormState(DEFAULT_BATCH_EDIT_FORM_STATE),
    setSelectedUserIds,
  });

  useEffect(() => {
    if (drawerState?.mode === 'create') { setFormState(DEFAULT_FORM_STATE); return; }
    if (drawerState?.mode === 'edit' && userDetailQuery.data) {
      setFormState(buildUserFormState(userDetailQuery.data));
    }
  }, [drawerState?.mode, userDetailQuery.data]);

  const users = usersQuery.isPlaceholderData ? [] : (usersQuery.data?.items ?? []);
  const totalUsers = usersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalUsers / USER_PAGE_SIZE));

  useEffect(() => {
    setPage(1);
    setSelectedUserIds([]);
  }, [accountKindFilter, deferredKeyword, statusFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
      setSelectedUserIds([]);
    }
  }, [page, totalPages]);

  const selectedUsers = useMemo(
    () =>
      users.filter(
        (user) =>
          selectedUserIds.includes(user.id) &&
          canSelectUserForBatchAction(user, currentUser?.id),
      ),
    [currentUser?.id, selectedUserIds, users],
  );
  const selectedSoftDeleteTargets = useMemo(
    () => selectedUsers.filter((user) => user.status !== 'disabled'),
    [selectedUsers],
  );
  const selectedAlreadyDisabledCount =
    selectedUsers.length - selectedSoftDeleteTargets.length;
  const selectableUsers = useMemo(
    () =>
      users.filter(
        (user) => canSelectUserForBatchAction(user, currentUser?.id),
      ),
    [currentUser?.id, users],
  );

  // FE-OPT-04：批量软删除改为**逐条编排**（逐条状态 + 失败可单条重试）。
  // 后端 `PATCH /manage/users/{id}/status` 与 `POST /manage/users/batch/*` 现均为 501
  // stub；逐条编排在真实端点落地后即生效，且当下能把未实现如实呈现为逐条 fail。
  const softDeleteUserOne = async (userId: string, confirmation: DangerousActionRequest) => {
    await manageApi.updateUserStatus(userId, {
      status: 'disabled',
      confirmAction: confirmation.confirmAction || 'disable-users',
      sessionConfirmation: confirmation.sessionConfirmation,
      currentPassword: confirmation.currentPassword,
    });
  };

  const runBatchSoftDelete = async (confirmation: DangerousActionRequest) => {
    const targets = selectedSoftDeleteTargets.map((user) => ({
      id: user.id,
      label: user.displayName || user.username,
    }));
    const targetsWithConfirm = targets;
    setSelectedUserIds([]);
    await batchRunner.run(targetsWithConfirm, (id) => softDeleteUserOne(id, confirmation));
    await usersQuery.refetch();
  };

  const retrySoftDelete = async (id: string) => {
    await batchRunner.retryOne(id, (userId) =>
      softDeleteUserOne(userId, {
        confirmAction: 'disable-users',
      } as DangerousActionRequest),
    );
    await usersQuery.refetch();
  };

  if (usersQuery.isPending) {
    return <FeedbackState variant="loading" title="正在加载用户列表" description="正在同步用户角色、状态和最近登录设备。" />;
  }
  if (usersQuery.isError) {
    return (
      <FeedbackState
        variant="error"
        title="用户列表加载失败"
        description={getErrorMessage(usersQuery.error)}
        action={<button className={styles.primaryButton} onClick={() => usersQuery.refetch()}>重试</button>}
      />
    );
  }

  return (
    <div className={styles.page}>
      <UsersHeaderAndTable
        control={{
          page, totalPages, keyword, statusFilter, accountKindFilter,
          selectedUserIds, selectableUsers,
          setKeyword, setStatusFilter, setAccountKindFilter, setPage, setSelectedUserIds,
        }}
        totalUsers={totalUsers}
        pageSize={USER_PAGE_SIZE}
        users={users}
        isFetching={usersQuery.isFetching}
        isPageTransitioning={usersQuery.isPlaceholderData}
        currentUserId={currentUser?.id}
        banner={banner}
        onCreate={() => {
          setBanner(null);
          setDrawerState({ mode: 'create' });
        }}
        onRefresh={() => usersQuery.refetch()}
        onOpenView={(id) => {
          setBanner(null);
          setDrawerState({ mode: 'view', userId: id });
        }}
        onOpenEdit={(id) => {
          setBanner(null);
          setDrawerState({ mode: 'edit', userId: id });
        }}
        onResetPassword={(user) => {
          setBanner(null);
          setResetPasswordDialog({ user });
        }}
        onToggleUserStatus={(user) => {
          if (user.id === currentUser?.id) {
            setBanner({
              variant: 'warning',
              title: '当前登录账号不能在这里停用',
              description: '为了避免把管理端自己锁死，当前账号状态只能保持启用。',
            });
            return;
          }
          setBanner(null);
          setPendingAction({ kind: 'status', user });
        }}
        onResetLoginRisk={(user) => {
          setBanner(null);
          setPendingAction({ kind: 'login-risk-reset', user });
        }}
        onReviewRegistration={(user, action) => {
          setBanner(null);
          setPendingAction({ kind: 'registration-review', user, action });
        }}
      />

      <UserSelectionBar
        selectedCount={selectedUsers.length}
        softDeleteTargetCount={selectedSoftDeleteTargets.length}
        onClearSelection={() => setSelectedUserIds([])}
        onOpenBatchEdit={() => {
          setBatchEditFormState(DEFAULT_BATCH_EDIT_FORM_STATE);
          setBatchEditDrawerOpen(true);
        }}
        onRequestBatchDelete={() => setBatchDeleteConfirmOpen(true)}
      />

      <UserDrawer
        drawerState={drawerState}
        userDetailQuery={userDetailQuery}
        formState={formState}
        setFormState={setFormState}
        mounts={mountsQuery.data?.items ?? []}
        mountsLoading={mountsQuery.isPending}
        mountsError={mountsQuery.isError ? getErrorMessage(mountsQuery.error) : undefined}
        roleTemplates={roleTemplatesQuery.data?.items ?? []}
        roleTemplatesLoading={roleTemplatesQuery.isPending}
        roleTemplatesError={roleTemplatesQuery.isError ? getErrorMessage(roleTemplatesQuery.error) : undefined}
        createUserMutation={createUserMutation}
        updateUserMutation={updateUserMutation}
        setDrawerState={setDrawerState}
        onResetPassword={(user) => {
          setBanner(null);
          setResetPasswordDialog({ user });
        }}
        onClose={() => setDrawerState(null)}
      />

      <ResetUserPasswordDialog
        user={resetPasswordDialog?.user ?? null}
        pending={resetUserPasswordMutation.isPending}
        error={resetUserPasswordMutation.error}
        onOpenChange={(open) => {
          if (!open && !resetUserPasswordMutation.isPending) {
            setResetPasswordDialog(null);
          }
        }}
        onConfirm={({ userId, newPassword, forceChange, confirmation }) => {
          resetUserPasswordMutation.mutate({
            userId,
            payload: {
              newPassword,
              forceChange,
              confirmAction: confirmation.confirmAction,
              sessionConfirmation: confirmation.sessionConfirmation,
              currentPassword: confirmation.currentPassword,
            },
          });
        }}
      />

      <BatchUserEditDrawer
        open={batchEditDrawerOpen}
        selectedUsers={selectedUsers}
        formState={batchEditFormState}
        setFormState={setBatchEditFormState}
        mounts={mountsQuery.data?.items ?? []}
        mountsLoading={mountsQuery.isPending}
        mountsError={mountsQuery.isError ? getErrorMessage(mountsQuery.error) : undefined}
        pending={batchUpdateUsersMutation.isPending}
        onClose={() => setBatchEditDrawerOpen(false)}
        onSubmit={() => setBatchEditConfirmOpen(true)}
      />


      <UserActionDialogs
        batchEditOpen={batchEditConfirmOpen}
        onBatchEditOpenChange={setBatchEditConfirmOpen}
        selectedCount={selectedUsers.length}
        batchEditFormState={batchEditFormState}
        batchEditPending={batchUpdateUsersMutation.isPending}
        onConfirmBatchEdit={(confirmation) => {
          batchUpdateUsersMutation.mutate({
            userIds: selectedUsers.map((user) => user.id),
            role: batchEditFormState.applyRole ? batchEditFormState.role : undefined,
            status: batchEditFormState.applyStatus ? batchEditFormState.status : undefined,
            sourceGrants: batchEditFormState.applySourceGrants
              ? batchEditFormState.sourceGrants
              : undefined,
            confirmAction: confirmation.confirmAction,
            sessionConfirmation: confirmation.sessionConfirmation,
            currentPassword: confirmation.currentPassword,
          });
        }}
        pendingAction={pendingAction}
        onPendingOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
        onConfirmPendingAction={(confirmation) => {
          if (!pendingAction) return;
          if (pendingAction.kind === 'registration-review') {
            reviewRegistrationMutation.mutate({
              userId: pendingAction.user.id,
              action: pendingAction.action,
              confirmation,
            });
            return;
          }
          if (pendingAction.kind === 'login-risk-reset') {
            resetUserLoginRiskMutation.mutate({
              userId: pendingAction.user.id,
              confirmation,
            });
            return;
          }
          const nextAction = getNextUserAction(pendingAction.user);
          updateStatusMutation.mutate({
            userId: pendingAction.user.id,
            status: nextAction.status,
            confirmation,
          });
        }}
        pendingActionPending={
          updateStatusMutation.isPending ||
          reviewRegistrationMutation.isPending ||
          resetUserLoginRiskMutation.isPending
        }
        actionKey={getPendingActionKey(pendingAction)}
        actionTitle={getPendingActionTitle(pendingAction)}
        actionLabel={getPendingActionLabel(pendingAction)}
        actionImpact={getPendingActionImpact(pendingAction)}
        batchDeleteOpen={batchDeleteConfirmOpen}
        onBatchDeleteOpenChange={setBatchDeleteConfirmOpen}
        softDeleteTargetCount={selectedSoftDeleteTargets.length}
        alreadyDisabledCount={selectedAlreadyDisabledCount}
        onConfirmBatchDelete={(confirmation) => {
          setBatchDeleteConfirmOpen(false);
          setBanner(null);
          void runBatchSoftDelete(confirmation);
        }}
      />

      {batchRunner.items.length > 0 ? (
        <BatchProgressPanel
          items={batchRunner.items}
          actionLabel="停用账号"
          onDismiss={batchRunner.dismiss}
          onRetryItem={(id) => void retrySoftDelete(id)}
        />
      ) : null}
    </div>
  );
}


export default ManageUsersPage;
