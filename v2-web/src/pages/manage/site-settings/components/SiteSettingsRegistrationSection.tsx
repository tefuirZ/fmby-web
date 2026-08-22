import type { Dispatch, SetStateAction } from 'react';
import type { SiteSettingsDraft } from '../types';
import { ManageSectionCard } from '../../longtail-shared/components';
import styles from '../../longtail-shared/ManageShared.module.css';

interface SiteSettingsRegistrationSectionProps {
  draft: SiteSettingsDraft;
  setDraft: Dispatch<SetStateAction<SiteSettingsDraft | null>>;
  setSuccess: Dispatch<SetStateAction<string | null>>;
}

export function SiteSettingsRegistrationSection({
  draft,
  setDraft,
  setSuccess,
}: SiteSettingsRegistrationSectionProps) {
  return (
    <ManageSectionCard
      title="注册与公告"
      description="控制用户能不能注册，以及是否要展示维护提醒。"
    >
      <div id="site-registration" className={styles.fieldGroup}>
        <label className={styles.checkboxRow}>
          <input
            className={styles.checkbox}
            type="checkbox"
            checked={draft.general.allowRegistration}
            onChange={(event) => {
              setSuccess(null);
              setDraft((current) =>
                current
                  ? {
                      ...current,
                      general: {
                        ...current.general,
                        allowRegistration: event.target.checked,
                      },
                    }
                  : current,
              );
            }}
          />
          <div className={styles.stackText}>
            <strong>启用注册码注册入口</strong>
            <span className={styles.mutedText}>
              开启后，登录页会出现"注册码注册"；关闭后只保留已有账号登录。
            </span>
          </div>
        </label>
        <label className={styles.label}>
          维护横幅
          <textarea
            className={styles.textarea}
            value={draft.general.maintenanceBanner}
            onChange={(event) => {
              setSuccess(null);
              setDraft((current) =>
                current
                  ? {
                      ...current,
                      general: {
                        ...current.general,
                        maintenanceBanner: event.target.value,
                      },
                    }
                  : current,
              );
            }}
            placeholder="可留空"
          />
          <span className={styles.fieldHint}>适合在维护、迁移或停机前提前通知用户。</span>
        </label>
      </div>
    </ManageSectionCard>
  );
}
