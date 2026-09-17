import type { Dispatch, SetStateAction } from 'react';
import { ManageSectionCard } from '../../../../components';
import type { MountFormState, MountFormErrors } from '../../../types';
import {
  STORED_CREDENTIAL_PLACEHOLDER,
  hasStoredSealedRef,
  isS3Provider,
  isWebDavProvider,
  isValidHttpUrl,
} from '../../../formUtils';
import { renderFieldError } from '../../../formRenderers';
import styles from '../../../../ManagePages.module.css';

interface WebDavS3ConnectionSectionProps {
  formState: MountFormState;
  setFormState: Dispatch<SetStateAction<MountFormState>>;
  formErrors: MountFormErrors;
  setFormErrors: Dispatch<SetStateAction<MountFormErrors>>;
  isSaving: boolean;
  setDirectoryBrowser: (value: null) => void;
}

/**
 * WebDAV / S3 连接配置（WEBDAV-S3-FE）。
 *
 * 字段口径以后端 WEBDAV-S3-ENABLE §3.1 为准：
 * - WebDAV：url（服务地址）+ 可选 username/password；
 * - S3：endpoint + bucket（必填）+ 可选 region / access_key / secret_key。
 *
 * ⚠️ 凭据字段（password / access_key / secret_key）为后端敏感键。前端当前
 * 无密封端点可取 `__sealed:` 引用，故以明文提交，**依赖后端 MOUNT-CRED-SEAL
 * 卡在 bridge 侧密封后落库**。详见 formUtils.buildWebDavS3Config 注释。
 */
export function WebDavS3ConnectionSection({
  formState,
  setFormState,
  formErrors,
  setFormErrors,
  isSaving,
  setDirectoryBrowser,
}: WebDavS3ConnectionSectionProps) {
  const isS3 = isS3Provider(formState.providerType);
  const isWebDav = isWebDavProvider(formState.providerType);
  if (!isS3 && !isWebDav) {
    return null;
  }

  const patch = (next: Partial<MountFormState['remoteConfig']>) =>
    setFormState((prev) => ({ ...prev, remoteConfig: { ...prev.remoteConfig, ...next } }));

  const clearEndpointError = () => {
    setFormErrors((prev) => ({ ...prev, endpoint: undefined, browse: undefined }));
    setDirectoryBrowser(null);
  };

  return (
    <ManageSectionCard
      title="连接配置"
      description={
        isS3
          ? 'S3 兼容来源：服务地址与 bucket 必填；凭据可留空（走 IAM role 或公开桶）。'
          : 'WebDAV 来源：服务地址必填；凭据可留空（匿名 WebDAV 合法）。'
      }
    >
      <div className={styles.fieldGroup}>
        <label className={styles.label}>
          服务地址（必填）
          <input
            className={`${styles.input} ${formErrors.endpoint ? styles.inputInvalid : ''}`}
            value={formState.remoteConfig.endpoint}
            onChange={(event) => {
              clearEndpointError();
              patch({ endpoint: event.target.value });
            }}
            placeholder={isS3 ? 'https://s3.example.com' : 'https://dav.example.com'}
            disabled={isSaving}
          />
          {renderFieldError(formErrors.endpoint)}
          {formState.remoteConfig.endpoint.trim() !== '' &&
          !isValidHttpUrl(formState.remoteConfig.endpoint) ? (
            <span className={styles.fieldHint}>必须是 http:// 或 https:// 开头的合法 URL。</span>
          ) : null}
        </label>

        {isS3 ? (
          <>
            <label className={styles.label}>
              Bucket（必填）
              <input
                className={`${styles.input} ${formErrors.bucket ? styles.inputInvalid : ''}`}
                value={formState.remoteConfig.bucket}
                onChange={(event) => {
                  setFormErrors((prev) => ({ ...prev, bucket: undefined }));
                  patch({ bucket: event.target.value });
                }}
                placeholder="my-media-bucket"
                disabled={isSaving}
              />
              {renderFieldError(formErrors.bucket)}
            </label>
            <label className={styles.label}>
              Key 前缀（可选，等价于根路径）
              <input
                className={styles.input}
                value={formState.remoteConfig.prefix}
                onChange={(event) => {
                  setFormErrors((prev) => ({ ...prev, rootPath: undefined }));
                  patch({ prefix: event.target.value });
                }}
                placeholder="media/movies"
                disabled={isSaving}
              />
              <span className={styles.fieldHint}>
                也可用下方目录浏览器选择；保存时归一为无前导「/」的 key 前缀。
              </span>
            </label>
            <label className={styles.label}>
              Region（可选）
              <input
                className={styles.input}
                value={formState.remoteConfig.region}
                onChange={(event) => patch({ region: event.target.value })}
                placeholder="us-east-1"
                disabled={isSaving}
              />
            </label>
            <div className={styles.fieldRow}>
              <label className={styles.label}>
                Access Key（可选）
                <input
                  className={styles.input}
                  type="password"
                  autoComplete="new-password"
                  value={formState.remoteConfig.accessKey}
                  onChange={(event) => patch({ accessKey: event.target.value })}
                  placeholder={
                    hasStoredSealedRef(formState.remoteConfig.accessKeySealedRef)
                      ? STORED_CREDENTIAL_PLACEHOLDER
                      : undefined
                  }
                  disabled={isSaving}
                />
                {renderFieldError(formErrors.accessKey)}
              </label>
              <label className={styles.label}>
                Secret Key（可选）
                <input
                  className={styles.input}
                  type="password"
                  autoComplete="new-password"
                  value={formState.remoteConfig.secretKey}
                  onChange={(event) => patch({ secretKey: event.target.value })}
                  placeholder={
                    hasStoredSealedRef(formState.remoteConfig.secretKeySealedRef)
                      ? STORED_CREDENTIAL_PLACEHOLDER
                      : undefined
                  }
                  disabled={isSaving}
                />
                {renderFieldError(formErrors.secretKey)}
              </label>
            </div>
          </>
        ) : (
          <div className={styles.fieldRow}>
            <label className={styles.label}>
              用户名（可选）
              <input
                className={styles.input}
                value={formState.remoteConfig.username}
                onChange={(event) => patch({ username: event.target.value })}
                disabled={isSaving}
              />
            </label>
            <label className={styles.label}>
              密码（可选）
              <input
                className={styles.input}
                type="password"
                autoComplete="new-password"
                value={formState.remoteConfig.password}
                onChange={(event) => patch({ password: event.target.value })}
                placeholder={
                  hasStoredSealedRef(formState.remoteConfig.passwordSealedRef)
                    ? STORED_CREDENTIAL_PLACEHOLDER
                    : undefined
                }
                disabled={isSaving}
              />
              {renderFieldError(formErrors.password)}
            </label>
          </div>
        )}
      </div>
    </ManageSectionCard>
  );
}
