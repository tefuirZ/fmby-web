/** 用户页头部 + 用户表格（V1F 拆分：ManageUsersPage → 子组件）。 */

import { InlineBanner } from '@fmby/v2-shared/ui';
import type { BannerState } from '@fmby/v2-shared/ui/types';
import type { ManageUserAccountKind, ManageUserRecord, UserStatus } from '@fmby/v2-shared/contracts/manage';
import styles from '../../longtail-shared/ManageShared.module.css';
import { ManagePageHeader } from '../../longtail-shared/components';
import { UserTable } from './UserTable';

/** 分页/筛选状态与设置器（状态仍归页面所有，子组件只负责调用）。 */
export interface UsersTableControl {
  page: number;
  totalPages: number;
  keyword: string;
  statusFilter: UserStatus | 'all';
  accountKindFilter: ManageUserAccountKind | 'all';
  selectedUserIds: string[];
  selectableUsers: ManageUserRecord[];
  setKeyword: (value: string) => void;
  setStatusFilter: (value: UserStatus | 'all') => void;
  setAccountKindFilter: (value: ManageUserAccountKind | 'all') => void;
  setPage: (next: number | ((current: number) => number)) => void;
  setSelectedUserIds: (next: string[] | ((current: string[]) => string[])) => void;
}

interface UsersHeaderAndTableProps {
  control: UsersTableControl;
  totalUsers: number;
  pageSize: number;
  users: ManageUserRecord[];
  isFetching: boolean;
  isPageTransitioning: boolean;
  currentUserId?: string;
  banner: BannerState | null;
  onCreate: () => void;
  onRefresh: () => void;
  onOpenView: (id: string) => void;
  onOpenEdit: (id: string) => void;
  onResetPassword: (user: ManageUserRecord) => void;
  onToggleUserStatus: (user: ManageUserRecord) => void;
  onResetLoginRisk: (user: ManageUserRecord) => void;
  onReviewRegistration: (user: ManageUserRecord, action: 'approve' | 'reject') => void;
}

export function UsersHeaderAndTable({
  control,
  totalUsers,
  pageSize,
  users,
  isFetching,
  isPageTransitioning,
  currentUserId,
  banner,
  onCreate,
  onRefresh,
  onOpenView,
  onOpenEdit,
  onResetPassword,
  onToggleUserStatus,
  onResetLoginRisk,
  onReviewRegistration,
}: UsersHeaderAndTableProps) {
  const {
    page,
    totalPages,
    keyword,
    statusFilter,
    accountKindFilter,
    selectedUserIds,
    selectableUsers,
    setKeyword,
    setStatusFilter,
    setAccountKindFilter,
    setPage,
    setSelectedUserIds,
  } = control;

  return (
    <>
    <ManagePageHeader
      title="用户管理"
      description="补齐账号详情、创建、编辑和批量软删除闭环，删除语义先明确收口为停用账号并吊销活跃会话。"
      meta={<span className={styles.metaText}>共 {totalUsers} 个账号，当前第 {page} / {totalPages} 页</span>}
      actions={
        <>
          <button className={styles.primaryButton} type="button" onClick={onCreate}>新建用户</button>
          <button className={styles.secondaryButton} type="button" onClick={onRefresh}>刷新</button>
        </>
      }
    />

    {banner ? <InlineBanner variant={banner.variant} title={banner.title} description={banner.description} /> : null}

    <UserTable
      users={users}
      total={totalUsers}
      page={page}
      pageSize={pageSize}
      totalPages={totalPages}
      isFetching={isFetching}
      isPageTransitioning={isPageTransitioning}
      currentUserId={currentUserId}
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
      onOpenView={onOpenView}
      onOpenEdit={onOpenEdit}
      onResetPassword={onResetPassword}
      onToggleUserStatus={onToggleUserStatus}
      onResetLoginRisk={onResetLoginRisk}
      onReviewRegistration={onReviewRegistration}
    />
    </>
  );
}
