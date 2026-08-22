import type { Dispatch, SetStateAction } from 'react';
import type { ServerSecuritySettings } from '@fmby/v2-shared/contracts/settings';
import { ResetIpLoginRiskPanel } from './ResetIpLoginRiskPanel';
import type { SiteSettingsDraft } from '../types';
import { minutesFromSeconds, secondsFromMinutes } from '../formUtils';
import { ManageSectionCard } from '../../longtail-shared/components';
import styles from '../../longtail-shared/ManageShared.module.css';

interface SiteSettingsSecuritySectionProps {
  draft: SiteSettingsDraft;
  setDraft: Dispatch<SetStateAction<SiteSettingsDraft | null>>;
  setSuccess: Dispatch<SetStateAction<string | null>>;
}

export function SiteSettingsSecuritySection({
  draft,
  setDraft,
  setSuccess,
}: SiteSettingsSecuritySectionProps) {
  return (
    <ManageSectionCard
      title="登录安全"
      description="站点级登录风控集中在这里配置，账号锁定和 IP 限流分开生效。"
    >
      <div id="site-security" className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <label className={styles.label}>
            登录模式
            <select
              className={styles.select}
              value={draft.security.loginMode}
              onChange={(event) => {
                setSuccess(null);
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        security: {
                          ...current.security,
                          loginMode: event.target.value as ServerSecuritySettings['loginMode'],
                        },
                      }
                    : current,
                );
              }}
            >
              <option value="password">仅密码</option>
              <option value="password+otp">密码 + 二次校验</option>
            </select>
            <span className={styles.fieldHint}>
              该选项决定站点记录的登录认证强度：「仅密码」只校验账号密码，「密码 + 二次校验」把站点标记为登录需要额外一步验证。切换后建议先用一个测试账号完整走一遍登录，确认无误再对全站放开。
            </span>
          </label>
          <label className={styles.label}>
            危险操作确认
            <select
              className={styles.select}
              value={draft.security.sensitiveActionConfirmation}
              onChange={(event) => {
                setSuccess(null);
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        security: {
                          ...current.security,
                          sensitiveActionConfirmation:
                            event.target
                              .value as ServerSecuritySettings['sensitiveActionConfirmation'],
                        },
                      }
                    : current,
                );
              }}
            >
              <option value="none">不额外确认</option>
              <option value="session">确认当前会话</option>
              <option value="password">重新输入密码</option>
            </select>
            <span className={styles.fieldHint}>
              推荐至少保留会话确认，别让误删一路点到底。
            </span>
          </label>
        </div>

        <label className={styles.checkboxRow}>
          <input
            className={styles.checkbox}
            type="checkbox"
            checked={draft.security.loginRateLimitEnabled}
            onChange={(event) => {
              setSuccess(null);
              setDraft((current) =>
                current
                  ? {
                      ...current,
                      security: {
                        ...current.security,
                        loginRateLimitEnabled: event.target.checked,
                      },
                    }
                  : current,
              );
            }}
          />
          <div className={styles.stackText}>
            <strong>IP 登录限流</strong>
            <span className={styles.mutedText}>
              按来源 IP 统计失败登录，用来压住同一出口的高频暴力尝试。
            </span>
          </div>
        </label>
        <div className={styles.fieldRow}>
          <label className={styles.label}>
            IP 限流阈值（次）
            <input
              className={styles.input}
              type="number"
              min={1}
              disabled={!draft.security.loginRateLimitEnabled}
              value={draft.security.loginRateLimitMaxAttempts}
              onChange={(event) => {
                setSuccess(null);
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        security: {
                          ...current.security,
                          loginRateLimitMaxAttempts: Number(event.target.value) || 1,
                        },
                      }
                    : current,
                );
              }}
            />
          </label>
          <label className={styles.label}>
            IP 限流窗口（分钟）
            <input
              className={styles.input}
              type="number"
              min={1}
              disabled={!draft.security.loginRateLimitEnabled}
              value={minutesFromSeconds(draft.security.loginRateLimitWindowSeconds)}
              onChange={(event) => {
                setSuccess(null);
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        security: {
                          ...current.security,
                          loginRateLimitWindowSeconds: secondsFromMinutes(
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
        <ResetIpLoginRiskPanel
          wrapperClassName={styles.ipRiskResetPanel}
          fieldClassName={styles.label}
          inputClassName={styles.input}
          hintClassName={styles.fieldHint}
          buttonClassName={styles.secondaryButton}
          onSuccess={setSuccess}
        />

        <label className={styles.checkboxRow}>
          <input
            className={styles.checkbox}
            type="checkbox"
            checked={draft.security.failedLoginLockoutEnabled}
            onChange={(event) => {
              setSuccess(null);
              setDraft((current) =>
                current
                  ? {
                      ...current,
                      security: {
                        ...current.security,
                        failedLoginLockoutEnabled: event.target.checked,
                      },
                    }
                  : current,
              );
            }}
          />
          <div className={styles.stackText}>
            <strong>账号失败锁定</strong>
            <span className={styles.mutedText}>
              按用户名统计失败登录，不会因为同 IP 下其它账号输错而连坐。
            </span>
          </div>
        </label>
        <div className={styles.fieldRow}>
          <label className={styles.label}>
            锁定阈值（次）
            <input
              className={styles.input}
              type="number"
              min={1}
              disabled={!draft.security.failedLoginLockoutEnabled}
              value={draft.security.failedLoginLockoutThreshold}
              onChange={(event) => {
                setSuccess(null);
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        security: {
                          ...current.security,
                          failedLoginLockoutThreshold: Number(event.target.value) || 1,
                        },
                      }
                    : current,
                );
              }}
            />
          </label>
          <label className={styles.label}>
            锁定时长（分钟）
            <input
              className={styles.input}
              type="number"
              min={1}
              disabled={!draft.security.failedLoginLockoutEnabled}
              value={minutesFromSeconds(draft.security.failedLoginLockoutSeconds)}
              onChange={(event) => {
                setSuccess(null);
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        security: {
                          ...current.security,
                          failedLoginLockoutSeconds: secondsFromMinutes(
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

        <label className={styles.checkboxRow}>
          <input
            className={styles.checkbox}
            type="checkbox"
            checked={draft.security.requireCurrentPasswordForProfileChange}
            onChange={(event) => {
              setSuccess(null);
              setDraft((current) =>
                current
                  ? {
                      ...current,
                      security: {
                        ...current.security,
                        requireCurrentPasswordForProfileChange: event.target.checked,
                      },
                    }
                  : current,
              );
            }}
          />
          <div className={styles.stackText}>
            <strong>修改个人资料时要求当前密码</strong>
            <span className={styles.mutedText}>
              能减少账号被接管后被静默改资料的风险。
            </span>
          </div>
        </label>
      </div>
    </ManageSectionCard>
  );
}
