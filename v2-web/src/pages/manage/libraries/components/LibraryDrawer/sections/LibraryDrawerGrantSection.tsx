import type { Dispatch, SetStateAction } from 'react';
import type { ManageUserRecord } from '@/domains/manage';
import { ManageSectionCard } from '../../../../components';
import type { LibraryDrawerState, LibraryFormState } from '../../../types';
import styles from '../../../../ManagePages.module.css';

interface LibraryDrawerGrantSectionProps {
  drawerState: LibraryDrawerState | null;
  formState: LibraryFormState;
  setFormState: Dispatch<SetStateAction<LibraryFormState>>;
  grantKeyword: string;
  setGrantKeyword: (value: string) => void;
  isSaving: boolean;
  usersQuery: {
    isPending: boolean;
  };
  users: ManageUserRecord[];
  filteredGrantUsers: ManageUserRecord[];
  selectedGrantChips: Array<{ id: string; label: string }>;
}

export function LibraryDrawerGrantSection({
  drawerState,
  formState,
  setFormState,
  grantKeyword,
  setGrantKeyword,
  isSaving,
  usersQuery,
  users,
  filteredGrantUsers,
  selectedGrantChips,
}: LibraryDrawerGrantSectionProps) {
  const handleToggleGrantUser = (userId: string) => {
    setFormState((prev) => ({
      ...prev,
      grantUserIds: prev.grantUserIds.includes(userId)
        ? prev.grantUserIds.filter((item) => item !== userId)
        : [...prev.grantUserIds, userId],
    }));
  };

  return (
    <ManageSectionCard
      title="访问授权"
      description={
        drawerState?.mode === 'create'
          ? '勾选后表示为该用户显式授权访问当前媒体库。'
          : '保存后会整体替换该媒体库的显式授权用户。'
      }
    >
      <div className={styles.fieldGroup}>
        <label className={styles.label}>
          搜索授权用户
          <input
            className={styles.searchInput}
            value={grantKeyword}
            onChange={(event) => setGrantKeyword(event.target.value)}
            placeholder="用户名 / 显示名 / 角色"
            disabled={isSaving}
          />
        </label>
        <div className={styles.stackText}>
          <span className={styles.primaryText}>已授权 {formState.grantUserIds.length} 人</span>
          <div className={styles.chipRow}>
            {selectedGrantChips.length === 0 ? (
              <span className={styles.mutedText}>当前未配置显式授权用户。</span>
            ) : (
              selectedGrantChips.map((chip) => (
                <span key={chip.id} className={styles.chip}>
                  {chip.label}
                </span>
              ))
            )}
          </div>
        </div>
        {usersQuery.isPending ? (
          <div className={styles.emptyInlineState}>正在加载可授权用户列表…</div>
        ) : filteredGrantUsers.length === 0 ? (
          <div className={styles.emptyInlineState}>
            {users.length === 0 ? '当前没有可授权用户。' : '没有匹配的用户,试试更换搜索关键词。'}
          </div>
        ) : (
          <div className={styles.selectionGrid}>
            {filteredGrantUsers.map((user) => (
              <label key={user.id} className={styles.selectionCard}>
                <input
                  className={styles.checkbox}
                  type="checkbox"
                  checked={formState.grantUserIds.includes(user.id)}
                  onChange={() => handleToggleGrantUser(user.id)}
                  disabled={isSaving}
                />
                <span className={styles.selectionCardBody}>
                  <span className={styles.primaryText}>{user.displayName || user.username}</span>
                  <span className={styles.mutedText}>@{user.username}</span>
                  <span className={styles.mutedText}>{user.roleLabel}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    </ManageSectionCard>
  );
}
