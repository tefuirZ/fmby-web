import { Dialog } from '@fmby/v2-shared/ui';
import type { UpstreamSourceRecord } from '@fmby/v2-shared/contracts/manage/upstreams';
import styles from '../longtail-shared/ManageShared.module.css';
import {
  AUTH_METHOD_OPTIONS,
  SOURCE_TYPE_OPTIONS,
  type SourceFormState,
} from './shared';

interface SourceFormDialogProps {
  open: boolean;
  editing: UpstreamSourceRecord | null;
  formState: SourceFormState;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onFormStateChange: (next: SourceFormState) => void;
  onSubmit: () => void;
}

/** 上游源新建/编辑表单（纯展示 + 受控表单，状态与提交由调用方持有）。 */
export function SourceFormDialog({
  open,
  editing,
  formState,
  pending,
  onOpenChange,
  onFormStateChange,
  onSubmit,
}: SourceFormDialogProps) {
  const patch = (next: Partial<SourceFormState>) => onFormStateChange({ ...formState, ...next });

  return (
    <Dialog
      open={open}
      eyebrow={editing ? '编辑上游源' : '新建上游源'}
      title={editing ? `编辑：${editing.name}` : '新建上游源'}
      description="地址与认证方式必填；密码/API Key 由后端密封，读接口永不回显。"
      onOpenChange={onOpenChange}
      footer={
        <>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            取消
          </button>
          <button
            className={styles.primaryButton}
            type="button"
            onClick={onSubmit}
            disabled={pending || !formState.name.trim() || !formState.baseUrl.trim()}
          >
            {pending ? '保存中…' : editing ? '保存修改' : '创建源'}
          </button>
        </>
      }
    >
      <div className={styles.fieldGroup}>
        <label className={styles.label}>
          名称（必填）
          <input
            className={styles.input}
            value={formState.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="例如：家庭 Emby"
          />
        </label>
        <label className={styles.label}>
          地址（必填）
          <input
            className={styles.input}
            value={formState.baseUrl}
            onChange={(e) => patch({ baseUrl: e.target.value })}
            placeholder="http://192.168.1.10:8096"
          />
        </label>
        <div className={styles.fieldRow}>
          <label className={styles.label}>
            类型
            <select
              className={styles.select}
              value={formState.sourceType}
              onChange={(e) => patch({ sourceType: e.target.value })}
            >
              {SOURCE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className={styles.label}>
            认证方式
            <select
              className={styles.select}
              value={formState.authMethod}
              onChange={(e) => patch({ authMethod: e.target.value })}
            >
              {AUTH_METHOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>
        {formState.authMethod === 'UsernamePassword' ? (
          <div className={styles.fieldRow}>
            <label className={styles.label}>
              用户名
              <input
                className={styles.input}
                value={formState.username}
                onChange={(e) => patch({ username: e.target.value })}
              />
            </label>
            <label className={styles.label}>
              密码{editing ? '（留空保留既有）' : ''}
              <input
                className={styles.input}
                type="password"
                autoComplete="new-password"
                value={formState.password}
                onChange={(e) => patch({ password: e.target.value })}
              />
            </label>
          </div>
        ) : null}
        {formState.authMethod === 'ApiKey' ? (
          <label className={styles.label}>
            API Key{editing ? '（留空保留既有）' : ''}
            <input
              className={styles.input}
              type="password"
              autoComplete="new-password"
              value={formState.apiKey}
              onChange={(e) => patch({ apiKey: e.target.value })}
            />
          </label>
        ) : null}
        <div className={styles.fieldRow}>
          <label className={styles.label}>
            User-Agent（可选）
            <input
              className={styles.input}
              value={formState.userAgent}
              onChange={(e) => patch({ userAgent: e.target.value })}
            />
          </label>
          <label className={styles.label}>
            Referer（可选）
            <input
              className={styles.input}
              value={formState.referer}
              onChange={(e) => patch({ referer: e.target.value })}
            />
          </label>
        </div>
      </div>
    </Dialog>
  );
}
