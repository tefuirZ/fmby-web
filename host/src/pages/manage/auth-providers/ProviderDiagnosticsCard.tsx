/**
 * 单提供方配置自检（FE-PARITY-AUTH-PROVIDERS）。
 *
 * POST /api/manage/auth-providers/{provider}/diagnostics
 * 场景枚举走后端 snake_case 词（`validate_config` / `send_test_email` / ...）。
 *
 * 结果三态：success / warning / failed 均呈现；失败透传后端 message。
 * 产物（authorize_url / callback_url / deep_link_url）按场景按需显示。
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authProvidersApi } from '@fmby/v2-shared/contracts/manage/authProviders';
import type { AuthProviderDiagnosticScenario } from '@fmby/v2-shared/contracts/manage/authProviders';
import { InlineBanner, StatusBadge } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from '@/pages/manage/longtail-shared/ManageShared.module.css';
import { ManageSectionCard } from '@/pages/manage/longtail-shared/components';

const SCENARIOS: Array<{ value: AuthProviderDiagnosticScenario; label: string }> = [
  { value: 'validate_config', label: '校验配置' },
  { value: 'smtp_connect', label: 'SMTP 连通性' },
  { value: 'send_test_email', label: '发送测试邮件' },
  { value: 'template_preview', label: '邮件模板预览' },
  { value: 'google_authorize_url', label: 'Google 授权链接' },
  { value: 'telegram_get_me', label: 'Telegram 身份' },
  { value: 'telegram_deep_link', label: 'Telegram 深链' },
];

interface ProviderDiagnosticsCardProps {
  provider: string;
  displayName: string;
}

export function ProviderDiagnosticsCard({ provider, displayName }: ProviderDiagnosticsCardProps) {
  const [scenario, setScenario] = useState<AuthProviderDiagnosticScenario>('validate_config');
  const [testEmail, setTestEmail] = useState('');

  const diagnosticsMutation = useMutation({
    mutationFn: () =>
      authProvidersApi.runDiagnostics(provider, {
        scenario,
        testEmail: testEmail.trim() || undefined,
      }),
  });

  const result = diagnosticsMutation.data;

  return (
    <ManageSectionCard
      title={`自检：${displayName || provider}`}
      description="按场景做一次配置自检；不改动线上配置。"
    >
      {diagnosticsMutation.isError ? (
        <InlineBanner
          variant="error"
          title="自检失败"
          description={getErrorMessage(diagnosticsMutation.error)}
        />
      ) : null}

      <div className={styles.fieldRow}>
        <label className={styles.label}>
          场景
          <select
            className={styles.select}
            value={scenario}
            onChange={(e) => setScenario(e.target.value as AuthProviderDiagnosticScenario)}
          >
            {SCENARIOS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {scenario === 'send_test_email' ? (
          <label className={styles.label}>
            测试收件邮箱
            <input
              className={styles.input}
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="不填则用当前登录账号邮箱"
            />
          </label>
        ) : null}
      </div>

      <div className={styles.buttonRow}>
        <button
          className={styles.secondaryButton}
          type="button"
          disabled={diagnosticsMutation.isPending}
          onClick={() => diagnosticsMutation.mutate()}
        >
          {diagnosticsMutation.isPending ? '自检中…' : '开始自检'}
        </button>
      </div>

      {result ? (
        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <span className={styles.label}>结果</span>
            <StatusBadge
              label={result.status}
              variant={
                result.status === 'success'
                  ? 'success'
                  : result.status === 'warning'
                    ? 'warning'
                    : 'danger'
              }
            />
          </div>
          <div>
            <strong>{result.summary.title}</strong>：{result.summary.message}
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>步骤</th>
                  <th>状态</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                {result.steps.map((step) => (
                  <tr key={step.code}>
                    <td>{step.title}</td>
                    <td>
                      <StatusBadge
                        label={step.status}
                        variant={
                          step.status === 'success'
                            ? 'success'
                            : step.status === 'warning'
                              ? 'warning'
                              : step.status === 'skipped'
                                ? 'neutral'
                                : 'danger'
                        }
                      />
                    </td>
                    <td>{step.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.warnings.length > 0 ? (
            <div className={styles.fieldHint}>警告：{result.warnings.join('；')}</div>
          ) : null}

          {result.artifacts.authorizeUrl ? (
            <div className={styles.fieldHint}>
              授权链接：<span className={styles.mono}>{result.artifacts.authorizeUrl}</span>
            </div>
          ) : null}
          {result.artifacts.callbackUrl ? (
            <div className={styles.fieldHint}>
              回调地址：<span className={styles.mono}>{result.artifacts.callbackUrl}</span>
            </div>
          ) : null}
          {result.artifacts.deepLinkUrl ? (
            <div className={styles.fieldHint}>
              深链：<span className={styles.mono}>{result.artifacts.deepLinkUrl}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </ManageSectionCard>
  );
}
