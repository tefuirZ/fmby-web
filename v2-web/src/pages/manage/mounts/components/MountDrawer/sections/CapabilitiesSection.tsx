import type { Dispatch, SetStateAction } from 'react';
import type { ManageStorageCapabilitiesState } from '@/domains/manage';
import { ManageSectionCard } from '../../../../components';
import { CAPABILITY_OPTIONS } from '../../../types';
import type { MountFormState } from '../../../types';
import styles from '../../../../ManagePages.module.css';

interface CapabilitiesSectionProps {
  formState: MountFormState;
  setFormState: Dispatch<SetStateAction<MountFormState>>;
  isSaving: boolean;
  description: string;
}

export function CapabilitiesSection({
  formState,
  setFormState,
  isSaving,
  description,
}: CapabilitiesSectionProps) {
  const handleToggleCapability = (key: keyof ManageStorageCapabilitiesState) => {
    setFormState((prev) => ({
      ...prev,
      capabilities: { ...prev.capabilities, [key]: !prev.capabilities[key] },
    }));
  };

  return (
    <ManageSectionCard title="能力声明" description={description}>
      <div className={styles.selectionGrid}>
        {CAPABILITY_OPTIONS.map((capability) => (
          <label key={capability.key} className={styles.selectionCard}>
            <input
              className={styles.checkbox}
              type="checkbox"
              checked={formState.capabilities[capability.key]}
              onChange={() => handleToggleCapability(capability.key)}
              disabled={isSaving}
            />
            <span className={styles.selectionCardBody}>
              <span className={styles.primaryText}>{capability.label}</span>
              <span className={styles.mutedText}>{capability.description}</span>
            </span>
          </label>
        ))}
      </div>
    </ManageSectionCard>
  );
}
