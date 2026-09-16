import type {
  ManageMountRecord,
  ManageUserDetailRecord,
  RoleTemplateRecord,
} from '@fmby/v2-shared/contracts/manage';
import type React from 'react';
import { FeedbackState } from '@fmby/v2-shared/ui';
import { InlineBanner } from '@fmby/v2-shared/ui';
import { Drawer } from '@fmby/v2-shared/ui';
import { StatusBadge } from '@fmby/v2-shared/ui';
import { formatDateTime } from '@fmby/v2-shared/time';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from '../../longtail-shared/ManageShared.module.css';
import { getManageStatusVariant } from '../../longtail-shared/components';
import type { UserDrawerState, UserFormState } from '../types';
import { UserCreateForm } from './UserCreateForm';
import { UserEditForm } from './UserEditForm';
import {
  getDrawerDescription,
  getDrawerTitle,
  getUserAccountKindLabel,
  getUserStatusLabel,
  normalizeFormText,
  parseOptionalDateTimeLocal,
  parseOptionalPositiveInt,
} from '../formUtils';

interface MutationShape<TVars> {
  isPending: boolean;
  mutate: (vars: TVars) => void;
}

interface UserDetailQueryShape {
  data: ManageUserDetailRecord | undefined;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
}

interface UserDrawerProps {
  drawerState: UserDrawerState | null;
  userDetailQuery: UserDetailQueryShape;
  formState: UserFormState;
  setFormState: React.Dispatch<React.SetStateAction<UserFormState>>;
  mounts: ManageMountRecord[];
  mountsLoading: boolean;
  mountsError?: string;
  roleTemplates?: RoleTemplateRecord[];
  roleTemplatesLoading?: boolean;
  roleTemplatesError?: string;
  createUserMutation: MutationShape<import('@fmby/v2-shared/contracts/manage').CreateManageUserRequest>;
  updateUserMutation: MutationShape<{ userId: string; payload: import('@fmby/v2-shared/contracts/manage').UpdateManageUserRequest }>;
  setDrawerState: (state: UserDrawerState | null) => void;
  onResetPassword: (user: ManageUserDetailRecord) => void;
  onClose: () => void;
}

export function UserDrawer({
  drawerState,
  userDetailQuery,
  formState,
  setFormState,
  mounts,
  mountsLoading,
  mountsError,
  roleTemplates = [],
  roleTemplatesLoading = false,
  roleTemplatesError,
  createUserMutation,
  updateUserMutation,
  setDrawerState,
  onResetPassword,
  onClose,
}: UserDrawerProps) {
  const currentDetail = userDetailQuery.data;
  const mountOptions = mounts.map((mount) => ({
    id: mount.id,
    name: mount.name,
    pathLabel: mount.pathLabel,
  }));
  const activeRoleTemplates = roleTemplates.filter((template) => template.status === 'active');
  const selectedTemplate = roleTemplates.find(
    (template) => template.id === formState.roleTemplateId,
  );

  return (
    <Drawer
      open={drawerState !== null}
      title={getDrawerTitle(drawerState, currentDetail)}
      description={getDrawerDescription(drawerState)}
      onOpenChange={(open) => { if (!open) onClose(); }}
    >
      {drawerState?.mode === 'create' ? (
        <UserCreateForm
          formState={formState}
          onChange={setFormState}
          mountsLoading={mountsLoading}
          mountsError={mountsError}
          roleTemplatesLoading={roleTemplatesLoading}
          roleTemplatesError={roleTemplatesError}
          mountOptions={mountOptions}
          selectedTemplate={selectedTemplate}
          activeRoleTemplates={activeRoleTemplates}
          mutation={createUserMutation}
          onSubmit={() =>
            createUserMutation.mutate({
              username: formState.username,
              displayName: normalizeFormText(formState.displayName),
              email: normalizeFormText(formState.email),
              password: formState.password,
              role: formState.role,
              roleTemplateId: normalizeFormText(formState.roleTemplateId),
              status: formState.status,
              accountKind: formState.accountKind,
              maxSessions: parseOptionalPositiveInt(formState.maxSessions),
              validUntil: parseOptionalDateTimeLocal(formState.validUntil),
              maxConcurrentPlaybacks: parseOptionalPositiveInt(formState.maxConcurrentPlaybacks),
              sourceGrants: selectedTemplate ? undefined : formState.sourceGrants,
            })
          }
          onCancel={onClose}
        />

      ) : userDetailQuery.isPending ? (
        <FeedbackState variant="loading" title="正在加载用户详情" description="正在同步账号状态、角色和最近登录信息。" />
      ) : userDetailQuery.isError ? (
        <InlineBanner variant="error" title="用户详情加载失败" description={getErrorMessage(userDetailQuery.error)} />
      ) : drawerState?.mode === 'edit' && currentDetail ? (
        <UserEditForm
          formState={formState}
          onChange={setFormState}
          mountsLoading={mountsLoading}
          mountsError={mountsError}
          roleTemplatesLoading={roleTemplatesLoading}
          roleTemplatesError={roleTemplatesError}
          mountOptions={mountOptions}
          selectedTemplate={selectedTemplate}
          activeRoleTemplates={activeRoleTemplates}
          mutation={updateUserMutation}
          onSubmit={() =>
            updateUserMutation.mutate({
              userId: currentDetail.id,
              payload: {
                displayName: normalizeFormText(formState.displayName),
                email: normalizeFormText(formState.email),
                role: formState.role,
                roleTemplateId: normalizeFormText(formState.roleTemplateId),
                status: formState.status,
                accountKind: formState.accountKind,
                maxSessions: parseOptionalPositiveInt(formState.maxSessions),
                validUntil: parseOptionalDateTimeLocal(formState.validUntil),
                maxConcurrentPlaybacks: parseOptionalPositiveInt(formState.maxConcurrentPlaybacks),
                sourceGrants: selectedTemplate ? undefined : formState.sourceGrants,
              },
            })
          }
          onCancel={() => setDrawerState({ mode: 'view', userId: currentDetail.id })}
        />

      ) : currentDetail ? (
        <div className={styles.fieldGroup}>
          <div className={styles.entityGrid}>
            <article className={styles.entityCard}>
              <span className={styles.mutedText}>账号</span>
              <strong>{currentDetail.displayName || currentDetail.username}</strong>
              <span className={styles.mutedText}>@{currentDetail.username}</span>
            </article>
            <article className={styles.entityCard}>
              <span className={styles.mutedText}>状态</span>
              <StatusBadge label={getUserStatusLabel(currentDetail.status)} variant={getManageStatusVariant(currentDetail.status)} />
              <span className={styles.mutedText}>最近活跃：{formatDateTime(currentDetail.lastLoginAt)}</span>
            </article>
            <article className={styles.entityCard}>
              <span className={styles.mutedText}>角色</span>
              <strong>{currentDetail.roleLabel}</strong>
              <span className={styles.mutedText}>系统角色与用户模板快照分离</span>
            </article>
            <article className={styles.entityCard}>
              <span className={styles.mutedText}>账号类型</span>
              <strong>{getUserAccountKindLabel(currentDetail.accountKind)}</strong>
              <span className={styles.mutedText}>
                {currentDetail.accountKind === 'service'
                  ? '禁止交互式登录，可作为开放 API Token owner。'
                  : '允许交互式登录，仍可作为开放 API Token owner。'}
              </span>
            </article>
            <article className={styles.entityCard}>
              <span className={styles.mutedText}>邮箱</span>
              <strong>{currentDetail.email || '未设置'}</strong>
              <span className={styles.mutedText}>用于后续注册验证和重置密码闭环。</span>
            </article>
            <article className={styles.entityCard}>
              <span className={styles.mutedText}>登录会话</span>
              <strong>{currentDetail.maxSessions ? `${currentDetail.maxSessions} 个` : '不限制'}</strong>
              <span className={styles.mutedText}>限制认证会话数，不影响播放并发策略。</span>
            </article>
            <article className={styles.entityCard}>
              <span className={styles.mutedText}>账号有效期</span>
              <strong>{currentDetail.validUntil ? formatDateTime(currentDetail.validUntil) : '不限制'}</strong>
              <span className={styles.mutedText}>{currentDetail.mustChangePassword ? '下次登录必须改密' : '未要求下次登录改密'}</span>
            </article>
            <article className={styles.entityCard}>
              <span className={styles.mutedText}>同时播放设备</span>
              <strong>
                {currentDetail.maxConcurrentPlaybacks
                  ? `${currentDetail.maxConcurrentPlaybacks} 个`
                  : '不限制'}
              </strong>
              <span className={styles.mutedText}>超限时拒绝新播放，不影响既有播放。</span>
            </article>
            <article className={styles.entityCard}>
              <span className={styles.mutedText}>来源路径授权</span>
              <strong>{currentDetail.sourceGrants.length > 0 ? `${currentDetail.sourceGrants.length} 条` : '未单独指定'}</strong>
              <span className={styles.mutedText}>
                {currentDetail.sourceGrants.length > 0
                  ? '有明确来源路径规则时，系统会优先按来源路径授权判断。'
                  : '当前仍走旧媒体库授权兜底。'}
              </span>
            </article>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.entityCard}>
              <span className={styles.mutedText}>创建时间</span>
              <strong>{formatDateTime(currentDetail.createdAt)}</strong>
              <span className={styles.mutedText}>更新时间：{formatDateTime(currentDetail.updatedAt)}</span>
            </div>
            <div className={styles.entityCard}>
              <span className={styles.mutedText}>最近设备</span>
              <strong>{currentDetail.lastDevice || '暂无记录'}</strong>
              <span className={styles.mutedText}>{currentDetail.recentClientInfo || '没有客户端上报信息'}</span>
            </div>
          </div>
          <div className={styles.buttonRow}>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => setDrawerState({ mode: 'edit', userId: currentDetail.id })}
            >
              编辑资料
            </button>
            {currentDetail.accountKind !== 'service' && currentDetail.status !== 'pending' ? (
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => onResetPassword(currentDetail)}
              >
                重置密码
              </button>
            ) : null}
            <button className={styles.ghostButton} type="button" onClick={onClose}>关闭</button>
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}
