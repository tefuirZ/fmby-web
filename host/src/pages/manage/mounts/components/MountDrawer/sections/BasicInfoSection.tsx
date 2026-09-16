import type { Dispatch, SetStateAction } from 'react';
import type { ManageMountProviderType } from '@fmby/v2-shared/contracts/manage';
import { ManageSectionCard } from '../../../../components';
import { PROVIDER_OPTIONS } from '../../../types';
import type { MountFormState, MountFormErrors } from '../../../types';
import { getProviderHint, getRootPathPlaceholder, getRootPathReadonlyHint } from '../../../formUtils';
import { renderFieldError } from '../../../formRenderers';
import styles from '../../../../ManagePages.module.css';

interface BasicInfoSectionProps {
  formState: MountFormState;
  setFormState: Dispatch<SetStateAction<MountFormState>>;
  formErrors: MountFormErrors;
  setFormErrors: Dispatch<SetStateAction<MountFormErrors>>;
  isEdit: boolean;
  isSaving: boolean;
  supportsDirectoryBrowser: boolean;
  onProviderTypeChange: (providerType: ManageMountProviderType) => void;
}

export function BasicInfoSection({
  formState,
  setFormState,
  formErrors,
  setFormErrors,
  isEdit,
  isSaving,
  supportsDirectoryBrowser,
  onProviderTypeChange,
}: BasicInfoSectionProps) {
  return (
    <ManageSectionCard
      title="基本信息"
      description={getProviderHint(formState.providerType)}
    >
      <div className={styles.fieldGroup}>
        <label className={styles.label}>
          来源名称
          <input
            className={`${styles.input} ${formErrors.name ? styles.inputInvalid : ''}`}
            value={formState.name}
            onChange={(event) => {
              setFormErrors((prev) => ({ ...prev, name: undefined }));
              setFormState((prev) => ({ ...prev, name: event.target.value }));
            }}
            placeholder="例如：本地电影盘"
            disabled={isSaving}
          />
          {renderFieldError(formErrors.name)}
        </label>
        <div className={styles.fieldRow}>
          <label className={styles.label}>
            来源类型
            {isEdit ? (
              <select className={styles.select} value={formState.providerType} disabled>
                {PROVIDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            ) : (
              <select
                className={styles.select}
                value={formState.providerType}
                onChange={(event) => onProviderTypeChange(event.target.value as ManageMountProviderType)}
                disabled={isSaving}
              >
                {PROVIDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            )}
          </label>
          {supportsDirectoryBrowser ? (
            <label className={styles.label}>
              根路径
              <div className={`${styles.readonlyField} ${formErrors.rootPath ? styles.inputInvalid : ''}`}>
                {formState.rootPath || '请通过目录浏览器选择'}
              </div>
              {renderFieldError(formErrors.rootPath)}
              <span className={styles.fieldHint}>{getRootPathReadonlyHint(formState.providerType)}</span>
            </label>
          ) : (
            <label className={styles.label}>
              根路径 / 地址
              <input
                className={`${styles.input} ${formErrors.rootPath ? styles.inputInvalid : ''}`}
                value={formState.rootPath}
                onChange={(event) => {
                  setFormErrors((prev) => ({ ...prev, rootPath: undefined }));
                  setFormState((prev) => ({ ...prev, rootPath: event.target.value }));
                }}
                placeholder={getRootPathPlaceholder(formState.providerType)}
                disabled={isSaving}
              />
              {renderFieldError(formErrors.rootPath)}
            </label>
          )}
        </div>
      </div>
    </ManageSectionCard>
  );
}
