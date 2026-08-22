import type { Dispatch, SetStateAction } from 'react';
import type { SiteSettingsDraft } from '../types';
import { ManageSectionCard } from '../../longtail-shared/components';
import styles from '../../longtail-shared/ManageShared.module.css';

interface SiteSettingsBasicSectionProps {
  draft: SiteSettingsDraft;
  setDraft: Dispatch<SetStateAction<SiteSettingsDraft | null>>;
  setSuccess: Dispatch<SetStateAction<string | null>>;
}

export function SiteSettingsBasicSection({
  draft,
  setDraft,
  setSuccess,
}: SiteSettingsBasicSectionProps) {
  return (
    <ManageSectionCard
      title="站点信息"
      description="这些是用户在登录页或首页最容易直接看到的内容。"
    >
      <div id="site-basic" className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <label className={styles.label}>
            站点名称
            <input
              className={styles.input}
              value={draft.general.siteName}
              onChange={(event) => {
                setSuccess(null);
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        general: { ...current.general, siteName: event.target.value },
                      }
                    : current,
                );
              }}
            />
            <span className={styles.fieldHint}>会显示在登录页和浏览页顶部。</span>
          </label>
          <label className={styles.label}>
            支持联系方式
            <input
              className={styles.input}
              value={draft.general.supportContact}
              onChange={(event) => {
                setSuccess(null);
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        general: {
                          ...current.general,
                          supportContact: event.target.value,
                        },
                      }
                    : current,
                );
              }}
            />
            <span className={styles.fieldHint}>用户遇到问题时知道该联系谁。</span>
          </label>
        </div>
        <label className={styles.label}>
          首页公共文案
          <textarea
            className={styles.textarea}
            value={draft.general.publicHomepageMessage}
            onChange={(event) => {
              setSuccess(null);
              setDraft((current) =>
                current
                  ? {
                      ...current,
                      general: {
                        ...current.general,
                        publicHomepageMessage: event.target.value,
                      },
                    }
                  : current,
              );
            }}
          />
          <span className={styles.fieldHint}>适合写欢迎语、维护提示或资源站说明。</span>
        </label>
      </div>
    </ManageSectionCard>
  );
}
