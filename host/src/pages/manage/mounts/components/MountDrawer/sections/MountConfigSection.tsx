import type { Dispatch, SetStateAction } from 'react';
import { ManageSectionCard } from '../../../../components';
import { renderFieldError } from '../../../formRenderers';
import styles from '../../../../ManagePages.module.css';
import type { MountFormState, MountFormErrors } from '../../../types';

interface MountConfigSectionProps {
  formState: MountFormState;
  setFormState: Dispatch<SetStateAction<MountFormState>>;
  formErrors: MountFormErrors;
  isSaving: boolean;
}

/**
 * FE-MOUNT-CONFIG-UI：R2.3–R2.6 配置面（备注/速率/可见性/旁路三开关）。
 * 表单状态与 payload builder 均已存在（DATASOURCE-CRUD-BACKFILL-UI 回填），
 * 本节只补 UI 暴露；非法 JSON 由 mountValidation 拦截（诚实错误，不崩保存）。
 */
export function MountConfigSection({
  formState,
  setFormState,
  formErrors,
  isSaving,
}: MountConfigSectionProps) {
  const patch = (partial: Partial<MountFormState>) =>
    setFormState((prev) => ({ ...prev, ...partial }));

  return (
    <ManageSectionCard
      title="挂载配置"
      description="备注、限速与旁路资源为可选配置；留空即用后端缺省。"
    >
      <div className={styles.fieldGroup}>
        <label className={styles.label}>
          备注
          <input
            className={styles.input}
            value={formState.note}
            disabled={isSaving}
            maxLength={200}
            onChange={(event) => patch({ note: event.target.value })}
          />
        </label>
        <label className={styles.label}>
          速率配置（JSON）
          <textarea
            className={styles.input}
            rows={2}
            value={formState.rateConfigText}
            disabled={isSaving}
            placeholder={'{"limit_mb_s": 20}'}
            onChange={(event) => patch({ rateConfigText: event.target.value })}
          />
          {renderFieldError(formErrors.rateConfigText)}
        </label>
        <label className={styles.label}>
          可见性规则（JSON）
          <textarea
            className={styles.input}
            rows={2}
            value={formState.visibilityRuleText}
            disabled={isSaving}
            placeholder={'{"hidden_paths": []}'}
            onChange={(event) => patch({ visibilityRuleText: event.target.value })}
          />
          {renderFieldError(formErrors.visibilityRuleText)}
        </label>
        <div className={styles.fieldGroup}>
          <span className={styles.label}>旁路资源</span>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={formState.sidecarNfo}
              disabled={isSaving}
              onChange={(event) => patch({ sidecarNfo: event.target.checked })}
            />
            NFO
          </label>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={formState.sidecarSubtitle}
              disabled={isSaving}
              onChange={(event) => patch({ sidecarSubtitle: event.target.checked })}
            />
            字幕
          </label>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={formState.sidecarPoster}
              disabled={isSaving}
              onChange={(event) => patch({ sidecarPoster: event.target.checked })}
            />
            海报
          </label>
        </div>
      </div>
    </ManageSectionCard>
  );
}
