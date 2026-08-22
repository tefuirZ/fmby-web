import type {
  ManageUserAccountKind,
  ManageMountRecord,
  ManageUserDetailRecord,
  ManageUserRole,
  RoleTemplateRecord,
  UserStatus,
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
import { ROLE_OPTIONS, type UserDrawerState, type UserFormState } from '../types';
import { SourceGrantEditor } from '../../longtail-shared/source-governance-fields';
import {
  getDrawerDescription,
  getDrawerTitle,
  getUserAccountKindLabel,
  getUserStatusLabel,
  normalizeFormText,
  normalizePositiveIntegerText,
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
        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <label className={styles.label}>
              用户名
              <input
                className={styles.input}
                value={formState.username}
                onChange={(event) => setFormState((current) => ({ ...current, username: event.target.value }))}
                placeholder="例如：operator_01"
              />
            </label>
            <label className={styles.label}>
              显示名
              <input
                className={styles.input}
                value={formState.displayName}
                onChange={(event) => setFormState((current) => ({ ...current, displayName: event.target.value }))}
                placeholder="用于管理页展示"
              />
            </label>
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.label}>
              邮箱
              <input
                className={styles.input}
                type="email"
                value={formState.email}
                onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
                placeholder="用于后续重置密码验证"
              />
            </label>
            <label className={styles.label}>
              用户模板
              <select
                className={styles.select}
                value={formState.roleTemplateId}
                onChange={(event) => setFormState((current) => ({ ...current, roleTemplateId: event.target.value }))}
                disabled={roleTemplatesLoading}
              >
                <option value="">不套用模板</option>
                {activeRoleTemplates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
              <span className={styles.fieldHint}>模板只作为本次创建的默认授权和限制快照，不会持续绑定。</span>
            </label>
          </div>
          {roleTemplatesError ? (
            <InlineBanner variant="warning" title="用户模板加载失败" description={roleTemplatesError} />
          ) : null}
          {selectedTemplate ? (
            <InlineBanner
              variant="info"
              title={`将套用模板：${selectedTemplate.name}`}
              description={`默认媒体库 ${selectedTemplate.defaultLibraries.length} 个，来源路径 ${selectedTemplate.sourceGrants.length} 条，登录会话 ${selectedTemplate.defaultMaxSessions ?? '不限制'}，同时播放 ${selectedTemplate.defaultMaxConcurrentPlaybacks ?? '不限制'}。显式填写的字段优先。`}
            />
          ) : null}
          <div className={styles.fieldRow}>
            <label className={styles.label}>
              初始密码
              <input
                className={styles.input}
                type="password"
                value={formState.password}
                onChange={(event) => setFormState((current) => ({ ...current, password: event.target.value }))}
                placeholder="至少 8 位"
              />
            </label>
            <label className={styles.label}>
              初始状态
              <select
                className={styles.select}
                value={formState.status}
                onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value as UserStatus }))}
              >
                <option value="active">正常</option>
                <option value="pending">待激活</option>
                <option value="locked">已锁定</option>
                <option value="disabled">已停用</option>
              </select>
            </label>
            <label className={styles.label}>
              账号类型
              <select
                className={styles.select}
                value={formState.accountKind}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    accountKind: event.target.value as ManageUserAccountKind,
                  }))
                }
              >
                <option value="human">人工账号</option>
                <option value="service">服务账号</option>
              </select>
              <span className={styles.fieldHint}>服务账号不能交互式登录，主要用于开放 API Token owner。</span>
            </label>
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.label}>
              角色
              <select
                className={styles.select}
                value={formState.role}
                onChange={(event) => setFormState((current) => ({ ...current, role: event.target.value as ManageUserRole }))}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className={styles.label}>
              最大登录会话数
              <input
                className={styles.input}
                inputMode="numeric"
                value={formState.maxSessions}
                onChange={(event) => {
                  const next = normalizePositiveIntegerText(event.target.value);
                  if (next !== undefined) {
                    setFormState((current) => ({ ...current, maxSessions: next }));
                  }
                }}
                placeholder="留空表示不限制"
              />
              <span className={styles.fieldHint}>限制 WebUI / API 登录会话数，不是播放设备数。</span>
            </label>
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.label}>
              有效期截止
              <input
                className={styles.input}
                type="datetime-local"
                value={formState.validUntil}
                onChange={(event) => setFormState((current) => ({ ...current, validUntil: event.target.value }))}
              />
              <span className={styles.fieldHint}>留空表示不限制账号有效期。显示与填写按 Asia/Shanghai。</span>
            </label>
            <label className={styles.label}>
              同时播放设备上限
              <input
                className={styles.input}
                inputMode="numeric"
                value={formState.maxConcurrentPlaybacks}
                onChange={(event) => {
                  const next = normalizePositiveIntegerText(event.target.value);
                  if (next !== undefined) {
                    setFormState((current) => ({ ...current, maxConcurrentPlaybacks: next }));
                  }
                }}
                placeholder="留空表示不限制"
              />
              <span className={styles.fieldHint}>限制活跃播放会话，不限制登录会话。</span>
            </label>
          </div>
          {mountsLoading ? (
            <div className={styles.emptyInlineState}>正在加载数据源列表…</div>
          ) : mountsError ? (
            <InlineBanner variant="warning" title="数据源列表加载失败" description={mountsError} />
          ) : (
            <SourceGrantEditor
              title="来源路径授权"
              description="留空表示先不指定来源路径，系统继续按旧媒体库授权兜底。要精细控制哪块目录可见，就在这里加。"
              mounts={mountOptions}
              value={formState.sourceGrants}
              onChange={(next) => setFormState((current) => ({ ...current, sourceGrants: next }))}
            />
          )}
          <div className={styles.buttonRow}>
            <button className={styles.secondaryButton} type="button" onClick={onClose} disabled={createUserMutation.isPending}>取消</button>
            <button
              className={styles.primaryButton}
              type="button"
              disabled={createUserMutation.isPending}
              onClick={() =>
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
            >
              {createUserMutation.isPending ? '创建中...' : '创建用户'}
            </button>
          </div>
        </div>
      ) : userDetailQuery.isPending ? (
        <FeedbackState variant="loading" title="正在加载用户详情" description="正在同步账号状态、角色和最近登录信息。" />
      ) : userDetailQuery.isError ? (
        <InlineBanner variant="error" title="用户详情加载失败" description={getErrorMessage(userDetailQuery.error)} />
      ) : drawerState?.mode === 'edit' && currentDetail ? (
        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <label className={styles.label}>
              用户名
              <input className={styles.input} value={formState.username} disabled />
            </label>
            <label className={styles.label}>
              系统角色
              <select
                className={styles.select}
                value={formState.role}
                onChange={(event) => setFormState((current) => ({ ...current, role: event.target.value as ManageUserRole }))}
                disabled={updateUserMutation.isPending}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <span className={styles.fieldHint}>这里只改系统角色；模板页里的“用户模板”目前还不是运行时事实权限组。</span>
            </label>
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.label}>
              显示名
              <input
                className={styles.input}
                value={formState.displayName}
                onChange={(event) => setFormState((current) => ({ ...current, displayName: event.target.value }))}
                placeholder="留空将只显示用户名"
              />
            </label>
            <label className={styles.label}>
              邮箱
              <input
                className={styles.input}
                type="email"
                value={formState.email}
                onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
                placeholder="用于后续重置密码验证"
                disabled={updateUserMutation.isPending}
              />
            </label>
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.label}>
              套用用户模板
              <select
                className={styles.select}
                value={formState.roleTemplateId}
                onChange={(event) => setFormState((current) => ({ ...current, roleTemplateId: event.target.value }))}
                disabled={updateUserMutation.isPending || roleTemplatesLoading}
              >
                <option value="">不套用模板</option>
                {activeRoleTemplates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
              <span className={styles.fieldHint}>保存时一次性覆盖模板媒体库、来源路径和默认限制；不会持续绑定。</span>
            </label>
            <label className={styles.label}>
              状态
              <input className={styles.input} value={getUserStatusLabel(formState.status)} disabled />
              <span className={styles.fieldHint}>账号启停会吊销会话，继续走列表里的停用 / 恢复按钮，不在这里偷偷改。</span>
            </label>
          </div>
          {roleTemplatesError ? (
            <InlineBanner variant="warning" title="用户模板加载失败" description={roleTemplatesError} />
          ) : null}
          {selectedTemplate ? (
            <InlineBanner
              variant="warning"
              title={`保存时会套用模板：${selectedTemplate.name}`}
              description={`会替换为模板媒体库 ${selectedTemplate.defaultLibraries.length} 个、来源路径 ${selectedTemplate.sourceGrants.length} 条；空白的会话数、有效期和播放上限会使用模板默认值。`}
            />
          ) : null}
          <label className={styles.label}>
            账号类型
            <select
              className={styles.select}
              value={formState.accountKind}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  accountKind: event.target.value as ManageUserAccountKind,
                }))
              }
              disabled={updateUserMutation.isPending}
            >
              <option value="human">人工账号</option>
              <option value="service">服务账号</option>
            </select>
            <span className={styles.fieldHint}>切为服务账号后会禁用交互式登录并吊销现有 Web 会话。</span>
          </label>
          <div className={styles.fieldRow}>
            <label className={styles.label}>
              最大登录会话数
              <input
                className={styles.input}
                inputMode="numeric"
                value={formState.maxSessions}
                onChange={(event) => {
                  const next = normalizePositiveIntegerText(event.target.value);
                  if (next !== undefined) {
                    setFormState((current) => ({ ...current, maxSessions: next }));
                  }
                }}
                placeholder="留空表示不限制"
                disabled={updateUserMutation.isPending}
              />
              <span className={styles.fieldHint}>留空保存会清空账号级登录会话限制。</span>
            </label>
            <label className={styles.label}>
              有效期截止
              <input
                className={styles.input}
                type="datetime-local"
                value={formState.validUntil}
                onChange={(event) => setFormState((current) => ({ ...current, validUntil: event.target.value }))}
                disabled={updateUserMutation.isPending}
              />
              <span className={styles.fieldHint}>留空保存会清空账号有效期；显示与填写按 Asia/Shanghai。</span>
            </label>
          </div>
          <label className={styles.label}>
            同时播放设备上限
            <input
              className={styles.input}
              inputMode="numeric"
              value={formState.maxConcurrentPlaybacks}
              onChange={(event) => {
                const next = normalizePositiveIntegerText(event.target.value);
                if (next !== undefined) {
                  setFormState((current) => ({ ...current, maxConcurrentPlaybacks: next }));
                }
              }}
              placeholder="留空表示不限制"
              disabled={updateUserMutation.isPending}
            />
            <span className={styles.fieldHint}>超过上限时拒绝新播放，不会踢掉已经播放中的设备。</span>
          </label>
          {mountsLoading ? (
            <div className={styles.emptyInlineState}>正在加载数据源列表…</div>
          ) : mountsError ? (
            <InlineBanner variant="warning" title="数据源列表加载失败" description={mountsError} />
          ) : (
            <SourceGrantEditor
              title="来源路径授权"
              description={selectedTemplate ? '已选择用户模板，本次保存会使用模板来源路径授权；如需手工覆盖，请先取消模板。' : '只要给了来源路径，这个用户的实际可见/可播就会优先按这里收口。留空表示继续用旧媒体库授权兜底。'}
              mounts={mountOptions}
              value={formState.sourceGrants}
              onChange={(next) => setFormState((current) => ({ ...current, sourceGrants: next }))}
              disabled={updateUserMutation.isPending || Boolean(selectedTemplate)}
            />
          )}
          <div className={styles.buttonRow}>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => setDrawerState({ mode: 'view', userId: currentDetail.id })}
              disabled={updateUserMutation.isPending}
            >
              取消
            </button>
            <button
              className={styles.primaryButton}
              type="button"
              disabled={updateUserMutation.isPending}
              onClick={() =>
                updateUserMutation.mutate({
                  userId: currentDetail.id,
                  payload: {
                    displayName: normalizeFormText(formState.displayName) ?? null,
                    email: normalizeFormText(formState.email) ?? null,
                    role: formState.role,
                    roleTemplateId: normalizeFormText(formState.roleTemplateId),
                    accountKind: formState.accountKind,
                    maxSessions:
                      formState.maxSessions.trim() === ''
                        ? selectedTemplate ? undefined : null
                        : parseOptionalPositiveInt(formState.maxSessions),
                    validUntil:
                      formState.validUntil.trim() === ''
                        ? selectedTemplate ? undefined : null
                        : parseOptionalDateTimeLocal(formState.validUntil),
                    maxConcurrentPlaybacks:
                      formState.maxConcurrentPlaybacks.trim() === ''
                        ? selectedTemplate ? undefined : null
                        : parseOptionalPositiveInt(formState.maxConcurrentPlaybacks),
                    sourceGrants: selectedTemplate ? undefined : formState.sourceGrants,
                  },
                })
              }
            >
              {updateUserMutation.isPending ? '保存中...' : '保存修改'}
            </button>
          </div>
        </div>
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
