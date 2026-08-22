import type { Dispatch, SetStateAction } from 'react';
import type { CredentialProbeStatus } from '@fmby/v2-shared/hooks/useCredentialProbe';
import { ManageSectionCard } from '../../../../components';
import type { MountFormState, MountFormErrors } from '../../../types';
import { renderFieldError, renderCredentialProbeStatus } from '../../../formUtils';
import styles from '../../../../ManagePages.module.css';

interface RemoteConnectionSectionProps {
  formState: MountFormState;
  setFormState: Dispatch<SetStateAction<MountFormState>>;
  formErrors: MountFormErrors;
  setFormErrors: Dispatch<SetStateAction<MountFormErrors>>;
  isSaving: boolean;
  credentialProbeStatus: CredentialProbeStatus;
  credentialProbeMessage?: string;
  setDirectoryBrowser: (value: null) => void;
}

export function RemoteConnectionSection({
  formState,
  setFormState,
  formErrors,
  setFormErrors,
  isSaving,
  credentialProbeStatus,
  credentialProbeMessage,
  setDirectoryBrowser,
}: RemoteConnectionSectionProps) {
  return (
    <ManageSectionCard title="连接配置" description="服务地址与认证方式会写入当前来源的 config_json；如果上游开放游客访问，凭据也可以留空。">
      <div className={styles.fieldGroup}>
        <label className={styles.label}>
          服务地址
          <input
            className={`${styles.input} ${formErrors.endpoint ? styles.inputInvalid : ''}`}
            value={formState.remoteConfig.endpoint}
            onChange={(event) => {
              setFormErrors((prev) => ({ ...prev, endpoint: undefined, browse: undefined }));
              setDirectoryBrowser(null);
              setFormState((prev) => ({ ...prev, remoteConfig: { ...prev.remoteConfig, endpoint: event.target.value } }));
            }}
            placeholder="https://alist.example.com"
            disabled={isSaving}
          />
          {renderFieldError(formErrors.endpoint)}
        </label>
        {renderCredentialProbeStatus(credentialProbeStatus, credentialProbeMessage)}
      </div>
    </ManageSectionCard>
  );
}
