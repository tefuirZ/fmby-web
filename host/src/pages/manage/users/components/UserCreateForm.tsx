import type {
  ManageUserAccountKind,
  ManageUserRole,
  RoleTemplateRecord,
  UserStatus,
} from '@fmby/v2-shared/contracts/manage';
import { InlineBanner } from '@fmby/v2-shared/ui';
import styles from '../../longtail-shared/ManageShared.module.css';
import { ROLE_OPTIONS, type UserFormState } from '../types';
import { SourceGrantEditor, type MountOption } from '../../longtail-shared/source-governance-fields';
import { normalizePositiveIntegerText } from '../formUtils';


interface UserCreateFormProps {
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

export function UserCreateForm({
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
}: UserCreateFormProps) {

  return (
    <div className={styles.fieldGroup}>
      <div className={styles.fieldRow}>
        <label className={styles.label}>
          用户名
          <input
            className={styles.input}
            value={formState.username}
            onChange={(event) => onChange((current) => ({ ...current, username: event.target.value }))}
            placeholder="例如：operator_01"
          />
        </label>
        <label className={styles.label}>
          显示名
          <input
            className={styles.input}
            value={formState.displayName}
            onChange={(event) => onChange((current) => ({ ...current, displayName: event.target.value }))}
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
            onChange={(event) => onChange((current) => ({ ...current, email: event.target.value }))}
            placeholder="用于后续重置密码验证"
          />
        </label>
        <label className={styles.label}>
          用户模板
          <select
            className={styles.select}
            value={formState.roleTemplateId}
            onChange={(event) => onChange((current) => ({ ...current, roleTemplateId: event.target.value }))}
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
            onChange={(event) => onChange((current) => ({ ...current, password: event.target.value }))}
            placeholder="至少 8 位"
          />
        </label>
        <label className={styles.label}>
          初始状态
          <select
            className={styles.select}
            value={formState.status}
            onChange={(event) => onChange((current) => ({ ...current, status: event.target.value as UserStatus }))}
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
              onChange((current) => ({
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
            onChange={(event) => onChange((current) => ({ ...current, role: event.target.value as ManageUserRole }))}
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
                onChange((current) => ({ ...current, maxSessions: next }));
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
            onChange={(event) => onChange((current) => ({ ...current, validUntil: event.target.value }))}
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
                onChange((current) => ({ ...current, maxConcurrentPlaybacks: next }));
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
          onChange={(next) => onChange((current) => ({ ...current, sourceGrants: next }))}
        />
      )}
      <div className={styles.buttonRow}>
        <button className={styles.secondaryButton} type="button" onClick={onCancel} disabled={mutation.isPending}>取消</button>
        <button
          className={styles.primaryButton}
          type="button"
          disabled={mutation.isPending}
          onClick={onSubmit}
        >
          {mutation.isPending ? '创建中...' : '创建用户'}
        </button>
      </div>
    </div>
  );
}
