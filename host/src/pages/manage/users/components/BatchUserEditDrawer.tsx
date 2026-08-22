import type {
  ManageMountRecord,
  ManageSourcePathGrantInput,
  ManageUserRecord,
  ManageUserRole,
  UserStatus,
} from '@/domains/manage';
import type React from 'react';
import { Drawer } from '@/shared/ui';
import styles from '../../longtail-shared/ManageShared.module.css';
import { SourceGrantEditor } from '../../longtail-shared/source-governance-fields';
import { ROLE_OPTIONS, type UserBatchEditFormState } from '../types';
import { getUserStatusLabel } from '../formUtils';

interface BatchUserEditDrawerProps {
  open: boolean;
  selectedUsers: ManageUserRecord[];
  formState: UserBatchEditFormState;
  setFormState: React.Dispatch<React.SetStateAction<UserBatchEditFormState>>;
  mounts: ManageMountRecord[];
  mountsLoading: boolean;
  mountsError?: string;
  pending: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

function summarizeSelection(users: ManageUserRecord[]) {
  if (users.length <= 3) {
    return users.map((user) => user.displayName || user.username).join('、');
  }
  return `${users
    .slice(0, 3)
    .map((user) => user.displayName || user.username)
    .join('、')} 等 ${users.length} 个账号`;
}

export function BatchUserEditDrawer({
  open,
  selectedUsers,
  formState,
  setFormState,
  mounts,
  mountsLoading,
  mountsError,
  pending,
  onClose,
  onSubmit,
}: BatchUserEditDrawerProps) {
  const mountOptions = mounts.map((mount) => ({
    id: mount.id,
    name: mount.name,
    pathLabel: mount.pathLabel,
  }));
  const hasChanges =
    formState.applyRole || formState.applyStatus || formState.applySourceGrants;

  return (
    <Drawer
      open={open}
      title={`批量编辑 ${selectedUsers.length} 个账号`}
      description="只会修改你勾选的字段，没勾选的内容一律不动，避免误伤。"
      eyebrow="批量操作"
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <div className={styles.fieldGroup}>
        <article className={styles.entityCard}>
          <span className={styles.mutedText}>本次会影响</span>
          <strong>{selectedUsers.length} 个账号</strong>
          <span className={styles.mutedText}>{summarizeSelection(selectedUsers)}</span>
        </article>

        <article className={styles.entityCard}>
          <label className={styles.inlineMeta}>
            <span className={styles.primaryText}>批量改系统角色</span>
            <input
              className={styles.checkbox}
              type="checkbox"
              checked={formState.applyRole}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  applyRole: event.target.checked,
                }))
              }
            />
          </label>
          <span className={styles.mutedText}>
            用来统一调整普通用户 / 受限用户 / 管理员。模板页里的用户模板暂时还不是运行时权限组。
          </span>
          {formState.applyRole ? (
            <label className={styles.label}>
              系统角色
              <select
                className={styles.select}
                value={formState.role}
                disabled={pending}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    role: event.target.value as ManageUserRole,
                  }))
                }
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </article>

        <article className={styles.entityCard}>
          <label className={styles.inlineMeta}>
            <span className={styles.primaryText}>批量改账号状态</span>
            <input
              className={styles.checkbox}
              type="checkbox"
              checked={formState.applyStatus}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  applyStatus: event.target.checked,
                }))
              }
            />
          </label>
          <span className={styles.mutedText}>
            停用会同时吊销活跃会话。为了避免把自己锁死，当前登录账号不会参加批量状态变更。
          </span>
          {formState.applyStatus ? (
            <label className={styles.label}>
              账号状态
              <select
                className={styles.select}
                value={formState.status}
                disabled={pending}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    status: event.target.value as UserStatus,
                  }))
                }
              >
                <option value="active">{getUserStatusLabel('active')}</option>
                <option value="pending">{getUserStatusLabel('pending')}</option>
                <option value="locked">{getUserStatusLabel('locked')}</option>
                <option value="disabled">{getUserStatusLabel('disabled')}</option>
              </select>
            </label>
          ) : null}
        </article>

        <article className={styles.entityCard}>
          <label className={styles.inlineMeta}>
            <span className={styles.primaryText}>重设来源路径授权</span>
            <input
              className={styles.checkbox}
              type="checkbox"
              checked={formState.applySourceGrants}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  applySourceGrants: event.target.checked,
                }))
              }
            />
          </label>
          <span className={styles.mutedText}>
            勾上后会整体替换所选账号的来源路径授权。留空保存就表示清空来源路径规则，回退到旧媒体库授权兜底。
          </span>
          {formState.applySourceGrants ? (
            mountsLoading ? (
              <div className={styles.emptyInlineState}>正在加载数据源列表…</div>
            ) : mountsError ? (
              <div className={styles.emptyInlineState}>{mountsError}</div>
            ) : (
              <SourceGrantEditor
                title="来源路径授权"
                description="按数据源 + 路径前缀统一替换，适合批量给 VIP / SVIP 一组账号收口同一套目录。"
                mounts={mountOptions}
                value={formState.sourceGrants}
                disabled={pending}
                onChange={(next) =>
                  setFormState((current) => ({
                    ...current,
                    sourceGrants: next as ManageSourcePathGrantInput[],
                  }))
                }
              />
            )
          ) : null}
        </article>

        <div className={styles.buttonRow}>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={onClose}
            disabled={pending}
          >
            取消
          </button>
          <button
            className={styles.primaryButton}
            type="button"
            onClick={onSubmit}
            disabled={pending || !hasChanges}
          >
            {pending ? '保存中...' : '继续确认'}
          </button>
        </div>
      </div>
    </Drawer>
  );
}
