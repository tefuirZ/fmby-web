import type { Dispatch, SetStateAction } from 'react';
import type { ServerSessionPolicySettings } from '@/domains/settings';
import type { SiteSettingsDraft } from '../types';
import { minutesFromSeconds, secondsFromMinutes } from '../formUtils';
import { ManageSectionCard } from '../../longtail-shared/components';
import styles from '../../longtail-shared/ManageShared.module.css';

interface SiteSettingsSessionSectionProps {
  draft: SiteSettingsDraft;
  setDraft: Dispatch<SetStateAction<SiteSettingsDraft | null>>;
  setSuccess: Dispatch<SetStateAction<string | null>>;
}

export function SiteSettingsSessionSection({
  draft,
  setDraft,
  setSuccess,
}: SiteSettingsSessionSectionProps) {
  return (
    <ManageSectionCard
      title="会话时长"
      description="控制登录多久过期，以及管理员会不会把自己挤下线。"
    >
      <div id="site-session" className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <label className={styles.label}>
            用户会话时长（分钟）
            <input
              className={styles.input}
              type="number"
              min={30}
              value={minutesFromSeconds(draft.sessionPolicy.userSessionTtlSeconds)}
              onChange={(event) => {
                setSuccess(null);
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        sessionPolicy: {
                          ...current.sessionPolicy,
                          userSessionTtlSeconds: secondsFromMinutes(
                            Number(event.target.value),
                            30,
                          ),
                        },
                      }
                    : current,
                );
              }}
            />
          </label>
          <label className={styles.label}>
            管理员会话时长（分钟）
            <input
              className={styles.input}
              type="number"
              min={15}
              value={minutesFromSeconds(draft.sessionPolicy.adminSessionTtlSeconds)}
              onChange={(event) => {
                setSuccess(null);
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        sessionPolicy: {
                          ...current.sessionPolicy,
                          adminSessionTtlSeconds: secondsFromMinutes(
                            Number(event.target.value),
                            15,
                          ),
                        },
                      }
                    : current,
                );
              }}
            />
          </label>
        </div>

        <div className={styles.fieldRow}>
          <label className={styles.label}>
            记住登录天数
            <input
              className={styles.input}
              type="number"
              min={1}
              value={draft.sessionPolicy.rememberMeTtlDays}
              onChange={(event) => {
                setSuccess(null);
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        sessionPolicy: {
                          ...current.sessionPolicy,
                          rememberMeTtlDays: Number(event.target.value) || 1,
                        },
                      }
                    : current,
                );
              }}
            />
          </label>
          <label className={styles.label}>
            令牌轮换策略
            <select
              className={styles.select}
              disabled={!draft.sessionPolicy.tokenRotationEnabled}
              value={draft.sessionPolicy.tokenRotationPolicy}
              onChange={(event) => {
                setSuccess(null);
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        sessionPolicy: {
                          ...current.sessionPolicy,
                          tokenRotationPolicy:
                            event.target
                              .value as ServerSessionPolicySettings['tokenRotationPolicy'],
                        },
                      }
                    : current,
                );
              }}
            >
              <option value="always">每次刷新都轮换</option>
              <option value="daily">每天轮换</option>
              <option value="risk-only">仅风险场景轮换</option>
            </select>
          </label>
        </div>

        <div id="site-compat" className={styles.fieldGroup}>
          <label className={styles.checkboxRow}>
            <input
              className={styles.checkbox}
              type="checkbox"
              checked={draft.sessionPolicy.tokenRotationEnabled}
              onChange={(event) => {
                setSuccess(null);
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        sessionPolicy: {
                          ...current.sessionPolicy,
                          tokenRotationEnabled: event.target.checked,
                        },
                      }
                    : current,
                );
              }}
            />
            <div className={styles.stackText}>
              <strong>启用令牌轮换</strong>
              <span className={styles.mutedText}>
                开启后，登录凭据会按策略自动更新，更安全。
              </span>
            </div>
          </label>
          <label className={styles.checkboxRow}>
            <input
              className={styles.checkbox}
              type="checkbox"
              checked={draft.sessionPolicy.compatLegacySessionFallbackEnabled}
              onChange={(event) => {
                setSuccess(null);
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        sessionPolicy: {
                          ...current.sessionPolicy,
                          compatLegacySessionFallbackEnabled: event.target.checked,
                        },
                      }
                    : current,
                );
              }}
            />
            <div className={styles.stackText}>
              <strong>允许旧设备继续走旧登录方式</strong>
              <span className={styles.mutedText}>
                兼容性更稳，但建议只在确实有老客户端时再开。
              </span>
            </div>
          </label>
          <label className={styles.checkboxRow}>
            <input
              className={styles.checkbox}
              type="checkbox"
              checked={draft.sessionPolicy.singleSessionForAdmins}
              onChange={(event) => {
                setSuccess(null);
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        sessionPolicy: {
                          ...current.sessionPolicy,
                          singleSessionForAdmins: event.target.checked,
                        },
                      }
                    : current,
                );
              }}
            />
            <div className={styles.stackText}>
              <strong>管理员只保留一个登录会话</strong>
              <span className={styles.mutedText}>
                新登录会把旧的管理员会话顶掉，适合更严的管理环境。
              </span>
            </div>
          </label>
        </div>
      </div>
    </ManageSectionCard>
  );
}
