import { useMemo } from 'react';
import { Search } from 'lucide-react';
import type { ManageUserAccountKind, ManageUserRecord, UserStatus } from '@fmby/v2-shared/contracts/manage';
import { StatusBadge } from '@fmby/v2-shared/ui';
import { formatDateTime } from '@fmby/v2-shared/time';
import styles from '../../longtail-shared/ManageShared.module.css';
import { EmptyTableRow, ManageSectionCard, getManageStatusVariant } from '../../longtail-shared/components';
import {
  canSelectUserForBatchAction,
  describeSourceGrantSummary,
  getNextUserAction,
  getUserAccountKindLabel,
  getUserStatusLabel,
} from '../formUtils';
import type { UserRegistrationReviewAction } from '../types';

interface UserTableProps {
  users: ManageUserRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  isFetching: boolean;
  isPageTransitioning: boolean;
  currentUserId?: string;
  keyword: string;
  statusFilter: 'all' | UserStatus;
  accountKindFilter: 'all' | ManageUserAccountKind;
  selectedUserIds: string[];
  onKeywordChange: (value: string) => void;
  onStatusFilterChange: (value: 'all' | UserStatus) => void;
  onAccountKindFilterChange: (value: 'all' | ManageUserAccountKind) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onSelectUser: (userId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onOpenView: (userId: string) => void;
  onOpenEdit: (userId: string) => void;
  onResetPassword: (user: ManageUserRecord) => void;
  onToggleUserStatus: (user: ManageUserRecord) => void;
  onResetLoginRisk: (user: ManageUserRecord) => void;
  onReviewRegistration: (
    user: ManageUserRecord,
    action: UserRegistrationReviewAction,
  ) => void;
}

export function UserTable({
  users,
  total,
  page,
  pageSize,
  totalPages,
  isFetching,
  isPageTransitioning,
  currentUserId,
  keyword,
  statusFilter,
  accountKindFilter,
  selectedUserIds,
  onKeywordChange,
  onStatusFilterChange,
  onAccountKindFilterChange,
  onPreviousPage,
  onNextPage,
  onSelectUser,
  onSelectAll,
  onOpenView,
  onOpenEdit,
  onResetPassword,
  onToggleUserStatus,
  onResetLoginRisk,
  onReviewRegistration,
}: UserTableProps) {
  const selectableUsers = useMemo(
    () =>
      users.filter(
        (user) => canSelectUserForBatchAction(user, currentUserId),
      ),
    [currentUserId, users],
  );
  const allSelectableChecked =
    selectableUsers.length > 0 && selectableUsers.every((user) => selectedUserIds.includes(user.id));
  const hasFilters =
    keyword.trim().length > 0 ||
    statusFilter !== 'all' ||
    accountKindFilter !== 'all';

  return (
    <ManageSectionCard title="账号列表" description="支持搜索、详情抽屉、系统角色调整、来源路径授权和批量编辑。">
      <div className={styles.toolbar}>
        <div className={styles.filterGroup}>
          <label className={styles.label}>
            搜索用户
            <div className={styles.inlineMeta}>
              <Search size={16} />
              <input
                className={styles.searchInput}
                value={keyword}
                onChange={(event) => onKeywordChange(event.target.value)}
                placeholder="用户名 / 显示名 / 角色 / 来源路径"
              />
            </div>
          </label>
          <label className={styles.label}>
            状态
            <select
              className={styles.select}
              value={statusFilter}
              onChange={(event) => onStatusFilterChange(event.target.value as 'all' | UserStatus)}
            >
              <option value="all">全部状态</option>
              <option value="active">正常</option>
              <option value="pending">待激活</option>
              <option value="disabled">已停用</option>
              <option value="locked">已锁定</option>
            </select>
          </label>
          <label className={styles.label}>
            类型
            <select
              className={styles.select}
              value={accountKindFilter}
              onChange={(event) =>
                onAccountKindFilterChange(
                  event.target.value as 'all' | ManageUserAccountKind,
                )
              }
            >
              <option value="all">全部类型</option>
              <option value="human">人工账号</option>
              <option value="service">服务账号</option>
            </select>
          </label>
        </div>
        <span className={styles.tableHint}>
          当前页 {users.length} 条 / 共 {total} 条{isFetching ? '，正在刷新' : ''}
        </span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>
                <input
                  className={styles.checkbox}
                  type="checkbox"
                  checked={allSelectableChecked}
                  onChange={(event) => onSelectAll(event.target.checked)}
                  aria-label="选择当前页中的全部可批量操作账号"
                />
              </th>
              <th>账号</th>
              <th>角色</th>
              <th>类型</th>
              <th>状态</th>
              <th>来源授权</th>
              <th>创建时间</th>
              <th>最近登录</th>
              <th>最近设备</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <EmptyTableRow
                colSpan={10}
                title={
                  isPageTransitioning
                    ? '正在加载当前页'
                    : hasFilters
                      ? '当前筛选无结果'
                      : '暂无用户'
                }
                description={
                  isPageTransitioning
                    ? '新页数据返回前不会保留上一页可操作账号。'
                    : hasFilters
                      ? '尝试放宽搜索关键词或切换状态筛选。'
                      : '待后端返回用户管理数据后展示。'
                }
              />
            ) : (
              users.map((user) => {
                const nextAction = getNextUserAction(user);
                const checked = selectedUserIds.includes(user.id);
                const isCurrentUser = user.id === currentUserId;
                const isPendingActivation = user.status === 'pending';
                const isInteractiveHuman = user.accountKind === 'human';
                const canBatchSelect = canSelectUserForBatchAction(user, currentUserId);
                return (
                  <tr key={user.id}>
                    <td>
                      <input
                        className={styles.checkbox}
                        type="checkbox"
                        checked={checked}
                        disabled={!canBatchSelect}
                        onChange={(event) => onSelectUser(user.id, event.target.checked)}
                        aria-label={`选择用户 ${user.username}`}
                      />
                    </td>
                    <td>
                      <div className={styles.stackText}>
                        <button className={styles.ghostButton} type="button" onClick={() => onOpenView(user.id)}>
                          {user.displayName || user.username}
                        </button>
                        <span className={styles.mutedText}>@{user.username}</span>
                      </div>
                    </td>
                    <td className={styles.nowrap}>{user.roleLabel}</td>
                    <td className={styles.nowrap}>{getUserAccountKindLabel(user.accountKind)}</td>
                    <td className={styles.nowrap}>
                      <StatusBadge label={getUserStatusLabel(user.status)} variant={getManageStatusVariant(user.status)} />
                    </td>
                    <td>{describeSourceGrantSummary(user)}</td>
                    <td className={styles.nowrap}>{formatDateTime(user.createdAt)}</td>
                    <td className={styles.nowrap}>{formatDateTime(user.lastLoginAt)}</td>
                    <td className={styles.nowrap}>{user.lastDevice || '—'}</td>
                    <td className={styles.actionsCell}>
                      <div className={styles.tableActionRow}>
                        <button className={styles.smallButton} type="button" onClick={() => onOpenView(user.id)}>详情</button>
                        <button className={styles.smallButton} type="button" onClick={() => onOpenEdit(user.id)}>编辑</button>
                        {!isPendingActivation && isInteractiveHuman ? (
                          <button
                            className={styles.smallButton}
                            type="button"
                            onClick={() => onResetPassword(user)}
                          >
                            重置密码
                          </button>
                        ) : null}
                        {!isPendingActivation && isInteractiveHuman ? (
                          <button
                            className={styles.smallButton}
                            type="button"
                            onClick={() => onResetLoginRisk(user)}
                          >
                            解除账号风控
                          </button>
                        ) : null}
                        {isPendingActivation ? (
                          <>
                            <button
                              className={styles.smallButton}
                              type="button"
                              disabled={isCurrentUser}
                              onClick={() => onReviewRegistration(user, 'approve')}
                            >
                              批准注册
                            </button>
                            <button
                              className={styles.smallDangerButton}
                              type="button"
                              disabled={isCurrentUser}
                              onClick={() => onReviewRegistration(user, 'reject')}
                            >
                              拒绝注册
                            </button>
                          </>
                        ) : (
                          <button
                            className={
                              user.status === 'disabled'
                                ? styles.smallButton
                                : styles.smallDangerButton
                            }
                            type="button"
                            disabled={isCurrentUser}
                            onClick={() => onToggleUserStatus(user)}
                          >
                            {isCurrentUser ? '当前账号' : nextAction.label}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.paginationBar}>
        <span className={styles.metaText}>
          每页 {pageSize} 条，当前显示 {users.length} 条
        </span>
        <div className={styles.paginationActions}>
          <button
            className={styles.ghostButton}
            type="button"
            disabled={page <= 1}
            onClick={onPreviousPage}
          >
            上一页
          </button>
          <span className={styles.paginationLabel}>第 {page} / {totalPages} 页</span>
          <button
            className={styles.ghostButton}
            type="button"
            disabled={page >= totalPages}
            onClick={onNextPage}
          >
            下一页
          </button>
        </div>
      </div>
    </ManageSectionCard>
  );
}
