import type { Dispatch, SetStateAction } from 'react';
import { ManageSectionCard } from '../../../../components';
import type { MountFormState, MountFormErrors, MountRemoteAuthMode } from '../../../types';
import { renderFieldError } from '../../../formUtils';
import styles from '../../../../ManagePages.module.css';

interface AuthModeSectionProps {
  formState: MountFormState;
  setFormState: Dispatch<SetStateAction<MountFormState>>;
  formErrors: MountFormErrors;
  setFormErrors: Dispatch<SetStateAction<MountFormErrors>>;
  isSaving: boolean;
  onAuthModeChange: (mode: MountRemoteAuthMode) => void;
  setDirectoryBrowser: (value: null) => void;
}

export function AuthModeSection({
  formState,
  setFormState,
  formErrors,
  setFormErrors,
  isSaving,
  onAuthModeChange,
  setDirectoryBrowser,
}: AuthModeSectionProps) {
  return (
    <ManageSectionCard title="认证方式" description="支持账号密码与 token 两种方案；如果上游允许游客访问，两种模式都可以留空凭据。">
      <div className={styles.selectionGrid}>
        <label className={`${styles.selectionCard} ${formState.remoteConfig.authMode === 'username-password' ? styles.selectionCardActive : ''}`}>
          <input
            className={styles.checkbox}
            type="radio"
            name="remote-auth-mode"
            checked={formState.remoteConfig.authMode === 'username-password'}
            onChange={() => onAuthModeChange('username-password')}
            disabled={isSaving}
          />
          <span className={styles.selectionCardBody}>
            <span className={styles.primaryText}>账号 + 密码</span>
            <span className={styles.mutedText}>后端会在需要时登录上游，再用返回的授权 token 访问目录与文件。</span>
          </span>
        </label>
        <label className={`${styles.selectionCard} ${formState.remoteConfig.authMode === 'token' ? styles.selectionCardActive : ''}`}>
          <input
            className={styles.checkbox}
            type="radio"
            name="remote-auth-mode"
            checked={formState.remoteConfig.authMode === 'token'}
            onChange={() => onAuthModeChange('token')}
            disabled={isSaving}
          />
          <span className={styles.selectionCardBody}>
            <span className={styles.primaryText}>Token</span>
            <span className={styles.mutedText}>直接使用现有授权 token 访问上游，不再额外保存账号密码。</span>
          </span>
        </label>
      </div>

      {formState.remoteConfig.authMode === 'token' ? (
        <label className={styles.label}>
          Token
          <input
            className={`${styles.input} ${formErrors.token ? styles.inputInvalid : ''}`}
            type="password"
            value={formState.remoteConfig.token}
            onChange={(event) => {
              setFormErrors((prev) => ({ ...prev, token: undefined, browse: undefined }));
              setDirectoryBrowser(null);
              setFormState((prev) => ({ ...prev, remoteConfig: { ...prev.remoteConfig, token: event.target.value } }));
            }}
            placeholder="输入上游返回的授权 token，留空则按游客访问"
            disabled={isSaving}
          />
          {renderFieldError(formErrors.token)}
        </label>
      ) : (
        <div className={styles.fieldRow}>
          <label className={styles.label}>
            用户名
            <input
              className={`${styles.input} ${formErrors.username ? styles.inputInvalid : ''}`}
              value={formState.remoteConfig.username}
              onChange={(event) => {
                setFormErrors((prev) => ({ ...prev, username: undefined, browse: undefined }));
                setDirectoryBrowser(null);
                setFormState((prev) => ({ ...prev, remoteConfig: { ...prev.remoteConfig, username: event.target.value } }));
              }}
              placeholder="管理员账号或具备浏览权限的账号，留空则按游客访问"
              disabled={isSaving}
            />
            {renderFieldError(formErrors.username)}
          </label>
          <label className={styles.label}>
            密码
            <input
              className={`${styles.input} ${formErrors.password ? styles.inputInvalid : ''}`}
              type="password"
              value={formState.remoteConfig.password}
              onChange={(event) => {
                setFormErrors((prev) => ({ ...prev, password: undefined, browse: undefined }));
                setDirectoryBrowser(null);
                setFormState((prev) => ({ ...prev, remoteConfig: { ...prev.remoteConfig, password: event.target.value } }));
              }}
              placeholder="对应账号密码"
              disabled={isSaving}
            />
            {renderFieldError(formErrors.password)}
          </label>
        </div>
      )}
    </ManageSectionCard>
  );
}
