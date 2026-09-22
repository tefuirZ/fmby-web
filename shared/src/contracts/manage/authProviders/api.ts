/**
 * 登录提供方配置契约层（FE-PARITY-AUTH-PROVIDERS）。
 *
 * 端点真源：`crates/fmby-v2-http/src/routes/manage_auth_providers.rs:98/109/124`
 * 能力门：三条均 `MANAGE_SETTINGS`；`require_confirmed` 0 次 → 不带 confirmed=true。
 *
 * ★wire：写用 camelCase canonical，读用 snake_case，枚举 snake_case。
 */

import { httpClient } from '@fmby/v2-shared/api/client';
import type {
  AuthProviderConfigViewRecord,
  AuthProviderConfigWriteInput,
  AuthProviderConfigsViewRecord,
  AuthProviderDiagnosticInput,
  AuthProviderDiagnosticResponse,
  AuthProviderDiagnosticStatus,
} from './types';

interface RawConfigView {
  provider: string;
  display_name: string;
  enabled: boolean;
  configured: boolean;
  allow_login: boolean;
  allow_binding: boolean;
  allow_password_reset: boolean;
  public_config: unknown;
  secret_fields_configured: string[];
  updated_at: string;
}

interface RawConfigsView {
  items: RawConfigView[];
}

interface RawDiagnosticStep {
  code: string;
  title: string;
  status: string;
  message: string;
  retryable: boolean;
  started_at: string;
  finished_at: string;
}

interface RawDiagnosticResponse {
  run_id: string;
  provider: string;
  scenario: string;
  status: string;
  summary: { title: string; message: string };
  steps: RawDiagnosticStep[];
  artifacts: { callback_url?: string; authorize_url?: string; deep_link_url?: string };
  warnings: string[];
  request_id: string | null;
  tested_at: string;
}

function fromConfigView(r: RawConfigView): AuthProviderConfigViewRecord {
  return {
    provider: r.provider,
    displayName: r.display_name,
    enabled: r.enabled,
    configured: r.configured,
    allowLogin: r.allow_login,
    allowBinding: r.allow_binding,
    allowPasswordReset: r.allow_password_reset,
    publicConfig: r.public_config,
    secretFieldsConfigured: r.secret_fields_configured ?? [],
    updatedAt: r.updated_at,
  };
}

/** 写入形态：camelCase canonical（后端 alias 也收 snake_case，但 canonical 是 camel）。 */
function toRawWrite(input: AuthProviderConfigWriteInput) {
  return {
    provider: input.provider,
    enabled: input.enabled,
    allowLogin: input.allowLogin,
    allowBinding: input.allowBinding,
    allowPasswordReset: input.allowPasswordReset,
    publicConfig: input.publicConfig,
    secretConfig: input.secretConfig,
    clearSecretConfig: input.clearSecretConfig,
  };
}

const BASE = '/api/manage/auth-providers';

export const authProvidersApi = {
  /** GET — 列出各 provider 配置（脱敏；密钥只报已配置字段名）。 */
  async listConfigs(): Promise<AuthProviderConfigsViewRecord> {
    const raw = await httpClient.get<RawConfigsView>(BASE);
    return { items: (raw.items ?? []).map(fromConfigView) };
  },

  /** PUT — 保存配置（patch 合并 + 密封落库），返回保存后的脱敏视图。 */
  async replaceConfigs(
    items: AuthProviderConfigWriteInput[],
  ): Promise<AuthProviderConfigsViewRecord> {
    const raw = await httpClient.put<RawConfigsView>(BASE, {
      body: { items: items.map(toRawWrite) },
    });
    return { items: (raw.items ?? []).map(fromConfigView) };
  },

  /**
   * POST /{provider}/diagnostics — 配置自检。
   * scenario 缺省走 `validate_config`（后端 `#[default]`）。
   */
  async runDiagnostics(
    provider: string,
    input: AuthProviderDiagnosticInput = {},
  ): Promise<AuthProviderDiagnosticResponse> {
    const raw = await httpClient.post<RawDiagnosticResponse>(
      `${BASE}/${encodeURIComponent(provider)}/diagnostics`,
      {
        body: {
          scenario: input.scenario,
          draftConfig: input.draftConfig ? toRawWrite(input.draftConfig) : undefined,
          testEmail: input.testEmail,
          templateContext: input.templateContext,
        },
      },
    );
    return {
      runId: raw.run_id,
      provider: raw.provider,
      scenario: raw.scenario as AuthProviderDiagnosticResponse['scenario'],
      status: raw.status as AuthProviderDiagnosticStatus,
      summary: raw.summary,
      steps: (raw.steps ?? []).map((s) => ({
        code: s.code,
        title: s.title,
        status: s.status as AuthProviderDiagnosticResponse['steps'][number]['status'],
        message: s.message,
        retryable: s.retryable,
        startedAt: s.started_at,
        finishedAt: s.finished_at,
      })),
      artifacts: {
        callbackUrl: raw.artifacts?.callback_url,
        authorizeUrl: raw.artifacts?.authorize_url,
        deepLinkUrl: raw.artifacts?.deep_link_url,
      },
      warnings: raw.warnings ?? [],
      requestId: raw.request_id ?? null,
      testedAt: raw.tested_at,
    };
  },
};
