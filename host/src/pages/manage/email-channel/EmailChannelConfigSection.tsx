/**
 * 邮件通道 · SMTP 与投递配置表单（① 的表单区）。
 *
 * 拆自 ManageEmailChannelPage（component-size 门禁：>400 行新组件 FAIL）。
 * 字段/控件/默认照契约 EMAIL-WEB-UI ①：password 只写留空=不改。
 */

import type { Dispatch, SetStateAction } from 'react';
import type {
  EmailChannelDraft,
  EmailResetDelivery,
  EmailSecurity,
} from '@fmby/v2-shared/contracts/settings';
import { InlineBanner } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { ManageSectionCard } from '../longtail-shared/components';
import styles from '../longtail-shared/ManageShared.module.css';

const SECURITY_OPTIONS: { value: EmailSecurity; label: string }[] = [
  { value: 'starttls', label: 'STARTTLS' },
  { value: 'tls', label: 'TLS（隐式）' },
  { value: 'plain', label: '明文（不推荐）' },
];

const DELIVERY_OPTIONS: { value: EmailResetDelivery; label: string }[] = [
  { value: 'code', label: '验证码（A）' },
  { value: 'link', label: '重置链接（B）' },
  { value: 'password', label: '直接发新密码（C）' },
];

function parseNumber(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

interface EmailChannelConfigSectionProps {
  draft: EmailChannelDraft;
  setDraft: Dispatch<SetStateAction<EmailChannelDraft | null>>;
  banner: string | null;
  saveError: unknown;
  savePending: boolean;
  onSave: () => void;
  setBanner: Dispatch<SetStateAction<string | null>>;
}

export function EmailChannelConfigSection({
  draft,
  setDraft,
  banner,
  saveError,
  savePending,
  onSave,
  setBanner,
}: EmailChannelConfigSectionProps) {
  return (
    <ManageSectionCard
      title="SMTP 与重置投递配置"
      description="password 留空表示保持不变；其余字段保存时一并提交。"
    >
      {banner ? <InlineBanner variant="success" title={banner} /> : null}
      {saveError ? (
        <InlineBanner
          variant="error"
          title="保存失败"
          description={getErrorMessage(saveError)}
        />
      ) : null}

      <form
        className={styles.fieldGroup}
        onSubmit={(event) => {
          event.preventDefault();
          setBanner(null);
          onSave();
        }}
      >
        <div className={styles.fieldRow}>
          <label className={styles.label}>
            SMTP 主机（host）
            <input
              className={styles.input}
              value={draft.host}
              placeholder="smtp.example.com"
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, host: event.target.value } : current,
                )
              }
            />
          </label>
          <label className={styles.label}>
            SMTP 端口（port）
            <input
              className={styles.input}
              type="number"
              value={draft.port}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, port: parseNumber(event.target.value, 587) } : current,
                )
              }
            />
            <span className={styles.fieldHint}>默认 587。</span>
          </label>
        </div>

        <label className={styles.label}>
          TLS 模式（security）
          <select
            className={styles.input}
            value={draft.security}
            onChange={(event) =>
              setDraft((current) =>
                current
                  ? { ...current, security: event.target.value as EmailSecurity }
                  : current,
              )
            }
          >
            {SECURITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className={styles.fieldRow}>
          <label className={styles.label}>
            登录名（username，可空）
            <input
              className={styles.input}
              value={draft.username}
              placeholder="留空 = 免认证"
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, username: event.target.value } : current,
                )
              }
            />
          </label>
          <label className={styles.label}>
            密码（password，只写）
            <input
              className={styles.input}
              type="password"
              autoComplete="new-password"
              value={draft.password}
              placeholder="留空 = 不修改"
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, password: event.target.value } : current,
                )
              }
            />
            <span className={styles.fieldHint}>
              只写字段：已配置的凭据显示为「已配置」，明文永不回传。
            </span>
          </label>
        </div>

        <label className={styles.label}>
          发件地址（from_address）
          <input
            className={styles.input}
            value={draft.fromAddress}
            placeholder="no-reply@example.com"
            onChange={(event) =>
              setDraft((current) =>
                current ? { ...current, fromAddress: event.target.value } : current,
              )
            }
          />
        </label>

        <label className={styles.label}>
          密码重置投递形态（reset_delivery）
          <select
            className={styles.input}
            value={draft.resetDelivery}
            onChange={(event) =>
              setDraft((current) =>
                current
                  ? { ...current, resetDelivery: event.target.value as EmailResetDelivery }
                  : current,
              )
            }
          >
            {DELIVERY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className={styles.fieldHint}>
            code=验证码回填；link=发送重置链接；password=直接发随机新密码（首登强制改密）。
          </span>
        </label>

        <div className={styles.fieldRow}>
          <label className={styles.label}>
            验证码位数（code_len，4–12）
            <input
              className={styles.input}
              type="number"
              min={4}
              max={12}
              value={draft.codeLen}
              onChange={(event) =>
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        codeLen: Math.min(12, Math.max(4, parseNumber(event.target.value, 6))),
                      }
                    : current,
                )
              }
            />
          </label>
          <label className={styles.label}>
            验证码有效期（code_ttl_minutes）
            <input
              className={styles.input}
              type="number"
              value={draft.codeTtlMinutes}
              onChange={(event) =>
                setDraft((current) =>
                  current
                    ? { ...current, codeTtlMinutes: parseNumber(event.target.value, 10) }
                    : current,
                )
              }
            />
          </label>
          <label className={styles.label}>
            链接/新密码有效期（link_ttl_minutes）
            <input
              className={styles.input}
              type="number"
              value={draft.linkTtlMinutes}
              onChange={(event) =>
                setDraft((current) =>
                  current
                    ? { ...current, linkTtlMinutes: parseNumber(event.target.value, 15) }
                    : current,
                )
              }
            />
          </label>
        </div>

        <label className={styles.label}>
          邮件模板（html_template，可空=内置）
          <textarea
            className={styles.textarea}
            rows={6}
            value={draft.htmlTemplate}
            placeholder="留空使用内置模板；占位符：{{siteName}} {{logo}} {{code}} {{link}} {{password}} {{expiresAt}} {{action}} {{resetPath}}"
            onChange={(event) =>
              setDraft((current) =>
                current ? { ...current, htmlTemplate: event.target.value } : current,
              )
            }
          />
        </label>

        <div className={styles.buttonRow}>
          <button className={styles.primaryButton} type="submit" disabled={savePending}>
            {savePending ? '保存中…' : '保存配置'}
          </button>
        </div>
      </form>
    </ManageSectionCard>
  );
}
