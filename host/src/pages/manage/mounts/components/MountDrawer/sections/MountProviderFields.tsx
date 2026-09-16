import type { Dispatch, SetStateAction } from 'react';
import type { CredentialProbeStatus } from '@fmby/v2-shared/hooks/useCredentialProbe';
import type {
  MountFormState,
  MountFormErrors,
  MountRemoteAuthMode,
} from '../../../types';
import { isStructuredRemoteProvider } from '../../../formUtils';
import type { Pan115CreatePendingActivation } from './Pan115CreateCredentialsSection';
import { RemoteConnectionSection } from './RemoteConnectionSection';
import { WebDavS3ConnectionSection } from './WebDavS3ConnectionSection';
import { AuthModeSection } from './AuthModeSection';
import { ConfigJsonSection } from './ConfigJsonSection';
import { Pan115CreateCredentialsSection } from './Pan115CreateCredentialsSection';

interface MountProviderFieldsProps {
  formState: MountFormState;
  setFormState: Dispatch<SetStateAction<MountFormState>>;
  formErrors: MountFormErrors;
  setFormErrors: Dispatch<SetStateAction<MountFormErrors>>;
  isSaving: boolean;
  mode: 'create' | 'edit';
  setDirectoryBrowser: (value: null) => void;
  credentialProbeStatus: CredentialProbeStatus;
  credentialProbeMessage?: string;
  onAuthModeChange: (nextMode: MountRemoteAuthMode) => void;
  pan115Pending: Pan115CreatePendingActivation | null;
  onPan115PendingChange: (next: Pan115CreatePendingActivation | null) => void;
  isWebDavS3Form: boolean;
}

/**
 * 按 provider 分派的连接配置区（AList/OpenList · WebDAV/S3 · 115 · 回落 config_json）。
 *
 * create / edit 两个分支此前各写一份、逐行重复；抽出后行为不变。
 */
export function MountProviderFields({
  formState,
  setFormState,
  formErrors,
  setFormErrors,
  isSaving,
  mode,
  setDirectoryBrowser,
  credentialProbeStatus,
  credentialProbeMessage,
  onAuthModeChange,
  pan115Pending,
  onPan115PendingChange,
  isWebDavS3Form,
}: MountProviderFieldsProps) {
  if (isStructuredRemoteProvider(formState.providerType)) {
    return (
      <>
        <RemoteConnectionSection
          formState={formState}
          setFormState={setFormState}
          formErrors={formErrors}
          setFormErrors={setFormErrors}
          isSaving={isSaving}
          credentialProbeStatus={credentialProbeStatus}
          credentialProbeMessage={credentialProbeMessage}
          setDirectoryBrowser={setDirectoryBrowser}
        />
        <AuthModeSection
          formState={formState}
          setFormState={setFormState}
          formErrors={formErrors}
          setFormErrors={setFormErrors}
          isSaving={isSaving}
          onAuthModeChange={onAuthModeChange}
          setDirectoryBrowser={setDirectoryBrowser}
        />
      </>
    );
  }

  if (isWebDavS3Form) {
    return (
      <WebDavS3ConnectionSection
        formState={formState}
        setFormState={setFormState}
        formErrors={formErrors}
        setFormErrors={setFormErrors}
        isSaving={isSaving}
        setDirectoryBrowser={setDirectoryBrowser}
      />
    );
  }

  if (mode === 'create' && formState.providerType === 'pan115') {
    return (
      <Pan115CreateCredentialsSection
        pending={pan115Pending}
        onPendingChange={onPan115PendingChange}
        isSaving={isSaving}
      />
    );
  }

  return (
    <ConfigJsonSection
      formState={formState}
      setFormState={setFormState}
      formErrors={formErrors}
      setFormErrors={setFormErrors}
      isSaving={isSaving}
      mode={mode}
    />
  );
}
