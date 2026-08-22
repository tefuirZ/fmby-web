import type { Dispatch, SetStateAction } from 'react';
import { ManageSectionCard } from '../../../../components';
import type { MountFormState, MountFormErrors, MountDrawerMode } from '../../../types';
import { renderFieldError } from '../../../formUtils';
import styles from '../../../../ManagePages.module.css';

interface ConfigJsonSectionProps {
  formState: MountFormState;
  setFormState: Dispatch<SetStateAction<MountFormState>>;
  formErrors: MountFormErrors;
  setFormErrors: Dispatch<SetStateAction<MountFormErrors>>;
  isSaving: boolean;
  mode: MountDrawerMode;
}

export function ConfigJsonSection({
  formState,
  setFormState,
  formErrors,
  setFormErrors,
  isSaving,
  mode,
}: ConfigJsonSectionProps) {
  return (
    <ManageSectionCard
      title="配置 JSON"
      description={mode === 'create' ? '可写 endpoint、凭据或其他 provider 专属配置字段。' : '编辑时会整体提交当前 config_json 内容。'}
    >
      <label className={styles.label}>
        config_json
        <textarea
          className={`${styles.textarea} ${formErrors.configJsonText ? styles.inputInvalid : ''}`}
          value={formState.configJsonText}
          onChange={(event) => {
            setFormErrors((prev) => ({ ...prev, configJsonText: undefined }));
            setFormState((prev) => ({ ...prev, configJsonText: event.target.value }));
          }}
          placeholder='{"endpoint":"https://example.com","token":"***"}'
          disabled={isSaving}
        />
        {renderFieldError(formErrors.configJsonText)}
      </label>
    </ManageSectionCard>
  );
}
