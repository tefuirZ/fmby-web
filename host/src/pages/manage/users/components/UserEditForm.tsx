/** 用户编辑表单（V1F 拆分：UserDrawer → 子组件）。 */

import type { ManageUserAccountKind, ManageUserRole, RoleTemplateRecord } from '@fmby/v2-shared/contracts/manage';
import { getUserStatusLabel } from '../formUtils';
import { InlineBanner } from '@fmby/v2-shared/ui';
import styles from '../../longtail-shared/ManageShared.module.css';
import { ROLE_OPTIONS, type UserFormState } from '../types';
import { SourceGrantEditor, type MountOption } from '../../longtail-shared/source-governance-fields';
import { normalizePositiveIntegerText } from '../formUtils';

interface UserEditFormProps {
  formState: UserFormState;
  onChange: (updater: (current: UserFormState) => UserFormState) => void;
  mountsLoading: boolean;
  mountsError?: string;
  roleTemplatesLoading?: boolean;
  roleTemplatesError?: string;
  mountOptions: MountOption[];
  selectedTemplate: RoleTemplateRecord | undefined;
  activeRoleTemplates: RoleTemplateRecord[];
  mutation: { isPending: boolean; error?: unknown };
  onSubmit: () => void;
  onCancel: () => void;
}

export function UserEditForm({
  formState,
  onChange,
  mountsLoading,
  mountsError,
  roleTemplatesLoading,
  roleTemplatesError,
  mountOptions,
  selectedTemplate,
  activeRoleTemplates,
  mutation,
  onSubmit,
  onCancel,
}: UserEditFormProps) {
  return (
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
            onChange={(event) => onChange((current) => ({ ...current, role: event.target.value as ManageUserRole }))}
            disabled={mutation.isPending}
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
            onChange={(event) => onChange((current) => ({ ...current, displayName: event.target.value }))}
            placeholder="留空将只显示用户名"
          />
        </label>
        <label className={styles.label}>
          邮箱
          <input
            className={styles.input}
            type="email"
            value={formState.email}
            onChange={(event) => onChange((current) => ({ ...current, email: event.target.value }))}
            placeholder="用于后续重置密码验证"
            disabled={mutation.isPending}
          />
        </label>
      </div>
      <div className={styles.fieldRow}>
        <label className={styles.label}>
          套用用户模板
          <select
            className={styles.select}
            value={formState.roleTemplateId}
            onChange={(event) => onChange((current) => ({ ...current, roleTemplateId: event.target.value }))}
            disabled={mutation.isPending || roleTemplatesLoading}
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
            onChange((current) => ({
              ...current,
              accountKind: event.target.value as ManageUserAccountKind,
            }))
          }
          disabled={mutation.isPending}
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
                onChange((current) => ({ ...current, maxSessions: next }));
              }
            }}
            placeholder="留空表示不限制"
            disabled={mutation.isPending}
          />
          <span className={styles.fieldHint}>留空保存会清空账号级登录会话限制。</span>
        </label>
        <label className={styles.label}>
          有效期截止
          <input
            className={styles.input}
            type="datetime-local"
            value={formState.validUntil}
            onChange={(event) => onChange((current) => ({ ...current, validUntil: event.target.value }))}
            disabled={mutation.isPending}
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
              onChange((current) => ({ ...current, maxConcurrentPlaybacks: next }));
            }
          }}
          placeholder="留空表示不限制"
          disabled={mutation.isPending}
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
          onChange={(next) => onChange((current) => ({ ...current, sourceGrants: next }))}
          disabled={mutation.isPending || Boolean(selectedTemplate)}
        />
      )}
      <div className={styles.buttonRow}>
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={onCancel}
          disabled={mutation.isPending}
        >
          取消
        </button>
        <button
          className={styles.primaryButton}
          type="button"
          disabled={mutation.isPending}
          onClick={() =>
            onSubmit()
          }
        >
          {mutation.isPending ? '保存中...' : '保存修改'}
        </button>
      </div>
    </div>
  );
}
