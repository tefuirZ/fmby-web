import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type DangerousActionRequest, type ManageUserAccountKind, type UserStatus } from '@fmby/v2-shared/contracts/manage';
import { manageApi } from '@fmby/v2-shared/contracts/manage';
import { useSession } from '@/session';
import { FeedbackState } from '@fmby/v2-shared/ui';
import { BatchProgressPanel } from '@fmby/v2-shared/ui';
import { useBatchRunner } from '@fmby/v2-shared/hooks';
import { InlineBanner } from '@fmby/v2-shared/ui';
import { SensitiveActionDialog } from '@fmby/v2-shared/ui';
import { queryKeys } from '@fmby/v2-shared/query';
import styles from './longtail-shared/ManageShared.module.css';
import { ManagePageHeader } from './longtail-shared/components';
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
  getRegistrationReviewAction,
} from './users/formUtils';
import { useUsersQuery, useUserDetailQuery, useUserMutations } from './users/hooks';
import {
  BatchUserEditDrawer,
  ResetUserPasswordDialog,
  UserTable,
  UserDrawer,
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
      <ManagePageHeader
        title="用户管理"
        description="补齐账号详情、创建、编辑和批量软删除闭环，删除语义先明确收口为停用账号并吊销活跃会话。"
        meta={<span className={styles.metaText}>共 {totalUsers} 个账号，当前第 {page} / {totalPages} 页</span>}
        actions={
          <>
            <button className={styles.primaryButton} type="button" onClick={() => { setBanner(null); setDrawerState({ mode: 'create' }); }}>新建用户</button>
            <button className={styles.secondaryButton} type="button" onClick={() => usersQuery.refetch()}>刷新</button>
          </>
        }
      />

      {banner ? <InlineBanner variant={banner.variant} title={banner.title} description={banner.description} /> : null}

      <UserTable
        users={users}
        total={totalUsers}
        page={page}
        pageSize={USER_PAGE_SIZE}
        totalPages={totalPages}
        isFetching={usersQuery.isFetching}
        isPageTransitioning={usersQuery.isPlaceholderData}
        currentUserId={currentUser?.id}
        keyword={keyword}
        statusFilter={statusFilter}
        accountKindFilter={accountKindFilter}
        selectedUserIds={selectedUserIds}
        onKeywordChange={(value) => {
          setKeyword(value);
          setSelectedUserIds([]);
        }}
        onStatusFilterChange={(value) => {
          setStatusFilter(value);
          setPage(1);
          setSelectedUserIds([]);
        }}
        onAccountKindFilterChange={(value) => {
          setAccountKindFilter(value);
          setPage(1);
          setSelectedUserIds([]);
        }}
        onPreviousPage={() => {
          setPage((current) => Math.max(1, current - 1));
          setSelectedUserIds([]);
        }}
        onNextPage={() => {
          setPage((current) => Math.min(totalPages, current + 1));
          setSelectedUserIds([]);
        }}
        onSelectUser={(userId, checked) =>
          setSelectedUserIds((current) =>
            checked ? Array.from(new Set([...current, userId])) : current.filter((item) => item !== userId),
          )
        }
        onSelectAll={(checked) =>
          setSelectedUserIds((current) => {
            if (checked) {
              const merged = new Set(current);
              selectableUsers.forEach((user) => merged.add(user.id));
              return Array.from(merged);
            }
            return current.filter((id) => !selectableUsers.some((user) => user.id === id));
          })
        }
        onOpenView={(id) => { setBanner(null); setDrawerState({ mode: 'view', userId: id }); }}
        onOpenEdit={(id) => { setBanner(null); setDrawerState({ mode: 'edit', userId: id }); }}
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

      {selectedUsers.length > 0 ? (
        <div className={styles.stickyBar}>
          <div className={styles.stackText}>
            <strong>已选择 {selectedUsers.length} 个账号</strong>
            <span className={styles.mutedText}>
              当前删除语义为软删除：账号会停用并吊销活跃会话，已停用账号仍可批量编辑或恢复。
              待激活注册申请请走列表里的批准/拒绝注册。
            </span>
          </div>
          <div className={styles.rowActions}>
            <button className={styles.secondaryButton} type="button" onClick={() => setSelectedUserIds([])}>清空选择</button>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => {
                setBatchEditFormState(DEFAULT_BATCH_EDIT_FORM_STATE);
                setBatchEditDrawerOpen(true);
              }}
            >
              批量编辑
            </button>
            <button
              className={styles.dangerButton}
              type="button"
              disabled={selectedSoftDeleteTargets.length === 0}
              onClick={() => setBatchDeleteConfirmOpen(true)}
            >
              {selectedSoftDeleteTargets.length === 0 ? '已处于软删除状态' : '批量删除'}
            </button>
          </div>
        </div>
      ) : null}

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

      <SensitiveActionDialog
        open={batchEditConfirmOpen}
        actionKey="batch-update-users"
        title={`批量编辑 ${selectedUsers.length} 个账号`}
        description="系统会只改你在上一层勾选的字段，未勾选的内容保持不动。"
        impact={[
          batchEditFormState.applyRole ? '会统一覆盖所选账号的系统角色。' : '不会动系统角色。',
          batchEditFormState.applyStatus ? '会统一调整账号状态；停用会直接吊销活跃会话。' : '不会动账号状态。',
          batchEditFormState.applySourceGrants ? '会整体替换来源路径授权；留空保存等于清空来源路径规则。' : '不会动来源路径授权。',
        ]}
        confirmLabel="确认批量编辑"
        onOpenChange={setBatchEditConfirmOpen}
        onConfirm={(confirmation) => {
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
        pending={batchUpdateUsersMutation.isPending}
      />

      <SensitiveActionDialog
        open={pendingAction !== null}
        actionKey={getPendingActionKey(pendingAction)}
        title={getPendingActionTitle(pendingAction)}
        description="关键账号状态调整需要二次确认，避免误操作。"
        impact={getPendingActionImpact(pendingAction)}
        confirmLabel={getPendingActionLabel(pendingAction)}
        onOpenChange={(open) => { if (!open) setPendingAction(null); }}
        onConfirm={(confirmation) => {
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
        pending={
          updateStatusMutation.isPending ||
          reviewRegistrationMutation.isPending ||
          resetUserLoginRiskMutation.isPending
        }
      />

      <SensitiveActionDialog
        open={batchDeleteConfirmOpen}
        actionKey="delete-users"
        title={`批量删除 ${selectedSoftDeleteTargets.length} 个账号`}
        description="当前删除语义为软删除：系统会停用所选账号，并同时吊销其活跃会话。"
        impact={[
          '当前登录账号和待激活注册申请不会进入批量删除。',
          selectedAlreadyDisabledCount > 0
            ? `另有 ${selectedAlreadyDisabledCount} 个已停用账号已经处于软删除状态，不会重复提交。`
            : '这次不会做物理删库。',
        ]}
        confirmLabel="确认批量删除"
        onOpenChange={setBatchDeleteConfirmOpen}
        onConfirm={(confirmation) => {
          setBatchDeleteConfirmOpen(false);
          setBanner(null);
          void runBatchSoftDelete(confirmation);
        }}
        pending={false}
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

function getPendingActionKey(action: PendingUserAction | null) {
  if (!action) return 'update-user-status';
  if (action.kind === 'registration-review') {
    return getRegistrationReviewAction(action.action).actionKey;
  }
  if (action.kind === 'login-risk-reset') return 'reset-user-login-risk';
  return 'update-user-status';
}

function getPendingActionLabel(action: PendingUserAction | null) {
  if (!action) return '确认';
  if (action.kind === 'registration-review') {
    return getRegistrationReviewAction(action.action).label;
  }
  if (action.kind === 'login-risk-reset') return '解除账号登录风控';
  return getNextUserAction(action.user).label;
}

function getPendingActionImpact(action: PendingUserAction | null) {
  if (!action) return undefined;
  if (action.kind === 'registration-review') {
    return getRegistrationReviewAction(action.action).impact;
  }
  if (action.kind === 'login-risk-reset') {
    return [
      '只解除该用户名当前失败登录窗口内的临时风控影响。',
      '不会删除失败登录、限流或锁定审计记录。',
      '不会修改账号状态、密码、角色或来源授权。',
    ];
  }
  return getNextUserAction(action.user).impact;
}

function getPendingActionTitle(action: PendingUserAction | null) {
  if (!action) return '';
  const username = action.user.displayName || action.user.username;
  return `${getPendingActionLabel(action)}：${username}`;
}

export default ManageUsersPage;
