import type { Dispatch, SetStateAction } from 'react';
import { ManageSectionCard } from '../../../../components';
import type { MountFormState, MountFormErrors } from '../../../types';
import { MOUNT_CONFIG_FIELDS } from '../../../mountConfigFields';
import { renderFieldError } from '../../../formRenderers';
import styles from '../../../../ManagePages.module.css';

interface MountConfigSectionProps {
  formState: MountFormState;
  setFormState: Dispatch<SetStateAction<MountFormState>>;
  formErrors: MountFormErrors;
  setFormErrors: Dispatch<SetStateAction<MountFormErrors>>;
  isSaving: boolean;
}

/**
 * 挂载配置六字段输入面（FE-MOUNT-CONFIG-UI，R2.3–R2.6）。
 *
 * 表单状态/payload 早已备好这六个字段（DATASOURCE-CRUD-BACKFILL-UI 回填 +
 * buildCreate/UpdateMountPayload），唯独没有输入面——本节补齐。渲染消费
 * MOUNT_CONFIG_FIELDS 描述符（与单测同一来源，label/formKey/取值不漂移）。
 */
export function MountConfigSection({
  formState,
  setFormState,
  formErrors,
  setFormErrors,
  isSaving,
}: MountConfigSectionProps) {
  return (
    <ManageSectionCard
      title="挂载配置"
      description="备注、速率限制、可见性规则与旁路资源开关；留空的 JSON 文本框表示清除对应配置。"
    >
      <div className={styles.fieldGroup}>
        {MOUNT_CONFIG_FIELDS.map((field) =>
          field.kind === 'text' ? (
            <label key={field.formKey} className={styles.label}>
              {field.label}
              <input
                className={`${styles.input} ${
                  field.errorKey && formErrors[field.errorKey] ? styles.inputInvalid : ''
                }`}
                value={field.value(formState)}
                onChange={(event) => {
                  const key = field.errorKey;
                  if (key) {
                    setFormErrors((prev) => ({ ...prev, [key]: undefined }));
                  }
                  setFormState((prev) => ({ ...prev, [field.formKey]: event.target.value }));
                }}
                placeholder={field.placeholder}
                disabled={isSaving}
              />
              {field.description ? (
                <span className={styles.mutedText}>{field.description}</span>
              ) : null}
              {field.errorKey ? renderFieldError(formErrors[field.errorKey]) : null}
            </label>
          ) : (
            <label key={field.formKey} className={styles.selectionCard}>
              <input
                className={styles.checkbox}
                type="checkbox"
                checked={field.value(formState)}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, [field.formKey]: event.target.checked }))
                }
                disabled={isSaving}
              />
              <span className={styles.selectionCardBody}>
                <span className={styles.primaryText}>{field.label}</span>
                <span className={styles.mutedText}>{field.description}</span>
              </span>
            </label>
          ),
        )}
      </div>
    </ManageSectionCard>
  );
}
