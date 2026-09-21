/**
 * 邮件通道配置页（EMAIL-CHANNEL / WEB-EMAIL-UI ① ②）。
 *
 * ① 配置表单：host/port/security/username/password(只写)/from_address/
 *    reset_delivery/code_len/code_ttl_minutes/link_ttl_minutes/html_template，
 *    并回显只读徽标 configured。
 * ② 发送测试邮件按钮：成功显示「已发送至 {to}」；失败显示后端 fail-closed 文案，
 *    前端绝不伪造「已发送」。
 *
 * 照 ManageTelegramPage 范式：GET 载入回显（密码不回显），PUT 提交（password 留空=不改）。
 * 后端未装配（500/FMBY_SECRET_BOX_KEY 不可用）页面 fail-closed 显示「邮件通道服务未启用」。
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  emailChannelApi,
  mapEmailChannelToDraft,
  type EmailChannelDraft,
  type EmailChannelSettings,
  type EmailResetDelivery,
  type EmailSecurity,
} from '@fmby/v2-shared/contracts/settings';
import { isServiceUnwiredError } from '@fmby/v2-shared/contracts/manage/peripherals';
import { FeedbackState, InlineBanner, StatusBadge } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { queryKeys } from '@fmby/v2-shared/query';
import styles from './longtail-shared/ManageShared.module.css';
import { ManagePageHeader, ManageSectionCard } from './longtail-shared/components';

const emailChannelKey = queryKeys.settings.emailChannel();

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

function settingsToDraft(settings: EmailChannelSettings): EmailChannelDraft {
  return mapEmailChannelToDraft(settings);
}

function parseNumber(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function ManageEmailChannelPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<EmailChannelDraft | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [testTo, setTestTo] = useState('');
  const [testBanner, setTestBanner] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null,
  );

  const settingsQuery = useQuery({
    queryKey: emailChannelKey,
    queryFn: async () => {
      try {
        return await emailChannelApi.getEmailChannel();
      } catch (err) {
        if (isServiceUnwiredError(err)) {
          return null;
        }
        throw err;
      }
    },
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setDraft(settingsToDraft(settingsQuery.data));
    }
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!draft) {
        throw new Error('配置草稿尚未就绪');
      }
      return emailChannelApi.putEmailChannel(draft);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(emailChannelKey, saved);
      setDraft(settingsToDraft(saved));
      setBanner('邮件通道配置已保存。密码未填写时保持不变。');
    },
  });

  const testMutation = useMutation({
    mutationFn: () => emailChannelApi.testEmail(testTo),
    onSuccess: (res) => {
      // ② 成功：显示后端回传的收件地址（绝不自己编造「已发送」）
      setTestBanner({ kind: 'success', text: `已发送至 ${res.to}` });
    },
    onError: (err) => {
      // ② fail-closed：直接显示后端文案，不降级成「已发送」
      setTestBanner({ kind: 'error', text: getErrorMessage(err) });
    },
  });

  if (settingsQuery.isPending) {
    return (
      <FeedbackState
        variant="loading"
        title="正在读取邮件通道"
        description="正在拉取 SMTP 配置与发送条件状态。"
      />
    );
  }

  if (settingsQuery.isError) {
    const error = settingsQuery.error;
    const unwired = isServiceUnwiredError(error);
    return (
      <div className={styles.page}>
        <ManagePageHeader
          title="邮件通道（Email）"
          description="配置 SMTP 发信与密码重置投递方式。"
        />
        <ManageSectionCard title={unwired ? '邮件通道服务未启用' : '邮件通道读取失败'}>
          <InlineBanner
            variant={unwired ? 'warning' : 'error'}
            title={unwired ? '邮件通道服务未启用' : '读取失败'}
            description={
              unwired
                ? '邮件通道服务未装配（FMBY_SECRET_BOX_KEY 不可用），配置端口暂不可用。请先部署密钥链后再配置。'
                : getErrorMessage(error)
            }
          />
        </ManageSectionCard>
      </div>
    );
  }

  const settingsUnavailable = settingsQuery.data === null;
  const configured = settingsQuery.data?.configured ?? false;

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="邮件通道（Email）"
        description="配置 SMTP 发信与密码重置投递方式。Bot Token / 密码走密钥链，本页不展示明文。"
        meta={
          <StatusBadge
            label={configured ? '已具备发送条件' : '尚未具备发送条件'}
            variant={configured ? 'success' : 'danger'}
          />
        }
      />

      {settingsUnavailable || !draft ? (
        <ManageSectionCard
          title="配置端口未装配"
          description="GET/PUT /api/settings/server/email 由本卡冻结，后端写端口另行开卡。"
        >
          <InlineBanner
            variant="info"
            title="等待后端装配"
            description="配置端点尚未提供。页面不以空表单冒充已保存配置。"
          />
        </ManageSectionCard>
      ) : (
        <ManageSectionCard
          title="SMTP 与重置投递配置"
          description="password 留空表示保持不变；其余字段保存时一并提交。"
        >
          {banner ? <InlineBanner variant="success" title={banner} /> : null}
          {saveMutation.isError ? (
            <InlineBanner
              variant="error"
              title="保存失败"
              description={getErrorMessage(saveMutation.error)}
            />
          ) : null}

          <form
            className={styles.fieldGroup}
            onSubmit={(event) => {
              event.preventDefault();
              setBanner(null);
              saveMutation.mutate();
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
                      current
                        ? { ...current, port: parseNumber(event.target.value, 587) }
                        : current,
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
                      ? {
                          ...current,
                          resetDelivery: event.target.value as EmailResetDelivery,
                        }
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
                            codeLen: Math.min(
                              12,
                              Math.max(4, parseNumber(event.target.value, 6)),
                            ),
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
                        ? {
                            ...current,
                            codeTtlMinutes: parseNumber(event.target.value, 10),
                          }
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
                        ? {
                            ...current,
                            linkTtlMinutes: parseNumber(event.target.value, 15),
                          }
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
              <button
                className={styles.primaryButton}
                type="submit"
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? '保存中…' : '保存配置'}
              </button>
            </div>
          </form>
        </ManageSectionCard>
      )}

      {!settingsUnavailable ? (
        <ManageSectionCard
          title="发送测试邮件"
          description="用当前配置真发一封（含品牌名 + logo）。配置缺失或未装配时失败会原样提示，不会显示「已发送」。"
        >
          {testBanner ? (
            <InlineBanner
              variant={testBanner.kind === 'success' ? 'success' : 'error'}
              title={testBanner.kind === 'success' ? '测试邮件已发送' : '测试邮件发送失败'}
              description={testBanner.text}
            />
          ) : null}
          <div className={styles.fieldRow}>
            <label className={styles.label}>
              收件人（可选，缺省自寄发件地址）
              <input
                className={styles.input}
                value={testTo}
                placeholder="留空 = 发送至 from_address"
                onChange={(event) => setTestTo(event.target.value)}
              />
            </label>
          </div>
          <div className={styles.buttonRow}>
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={testMutation.isPending}
              onClick={() => testMutation.mutate()}
            >
              {testMutation.isPending ? '发送中…' : '发送测试邮件'}
            </button>
          </div>
        </ManageSectionCard>
      ) : null}
    </div>
  );
}

export default ManageEmailChannelPage;
