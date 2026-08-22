import type { Dispatch, SetStateAction } from 'react';
import type { ManageLibraryType } from '@fmby/v2-shared/contracts/manage';
import { ManageSectionCard } from '../../../../components';
import { LIBRARY_TYPE_OPTIONS, type LibraryFormState } from '../../../types';
import styles from '../../../../ManagePages.module.css';

interface LibraryDrawerBasicSectionProps {
  formState: LibraryFormState;
  setFormState: Dispatch<SetStateAction<LibraryFormState>>;
  isSaving: boolean;
}

export function LibraryDrawerBasicSection({ formState, setFormState, isSaving }: LibraryDrawerBasicSectionProps) {
  return (
    <ManageSectionCard title="基本信息" description="先定义名称、类型和基础说明。">
      <div className={styles.fieldGroup}>
        <label className={styles.label}>
          媒体库名称
          <input
            className={styles.input}
            value={formState.name}
            onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="例如：电影库"
            disabled={isSaving}
          />
        </label>
        <div className={styles.fieldRow}>
          <label className={styles.label}>
            媒体库类型
            <select
              className={styles.select}
              value={formState.libraryType}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, libraryType: event.target.value as ManageLibraryType }))
              }
              disabled={isSaving}
            >
              {LIBRARY_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className={styles.label}>
          说明
          <textarea
            className={styles.textarea}
            value={formState.description}
            onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="补充这个媒体库的用途、内容边界或运营说明。"
            disabled={isSaving}
          />
        </label>
      </div>
    </ManageSectionCard>
  );
}
