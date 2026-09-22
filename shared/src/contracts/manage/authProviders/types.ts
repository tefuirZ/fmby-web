/**
 * 登录提供方配置契约类型（FE-PARITY-AUTH-PROVIDERS）。
 *
 * 真源：`crates/fmby-v2-http/src/routes/manage_auth_providers.rs:98/109/124`
 * DTO：`crates/fmby-v2-application/src/auth/auth_provider_config.rs` + `.../diagnostics.rs`
 *
 * 能力门：三条均 `MANAGE_SETTINGS`；文件内 `require_confirmed` **0 次**
 *   → 契约层不带 `params:{confirmed:true}`。
 *
 * ★wire 方向（同 microsoft，别写反）：
 * - **写入**用 camelCase canonical（`#[serde(rename="allowLogin", alias="allow_login")]`）。
 * - **读取**响应是 snake_case。
 * - 诊断 scenario/status 枚举是 **snake_case**（`#[serde(rename_all="snake_case")]`）。
 */

/** 单个提供方配置视图（GET 响应；脱敏，密钥只报哪些字段已配置）。 */
export interface AuthProviderConfigViewRecord {
  provider: string;
  displayName: string;
  enabled: boolean;
  configured: boolean;
  allowLogin: boolean;
  allowBinding: boolean;
  allowPasswordReset: boolean;
  /** 公开配置（非敏感，原样呈现）。 */
  publicConfig: unknown;
  /** 已配置的密钥字段名列表（不含值；未配置的字段不在此列）。 */
  secretFieldsConfigured: string[];
  updatedAt: string;
}

/** GET / PUT /api/manage/auth-providers 响应。 */
export interface AuthProviderConfigsViewRecord {
  items: AuthProviderConfigViewRecord[];
}

/**
 * 单个提供方写配置（PUT 入参；camelCase canonical）。
 *
 * ★凭据安全：secretConfig 属敏感值，仅在本请求体中出现一次；
 *   前端不得落 localStorage / URL / console（沿用 FE-CRUD-SECURITY-AUDIT 口径）。
 */
export interface AuthProviderConfigWriteInput {
  provider: string;
  enabled: boolean;
  allowLogin: boolean;
  allowBinding: boolean;
  allowPasswordReset: boolean;
  publicConfig?: unknown;
  /** 合并写入的密钥配置；不传 = 不改动既有密钥。 */
  secretConfig?: unknown;
  /** true = 清空已存密钥。 */
  clearSecretConfig?: boolean;
}

/** 诊断场景（snake_case wire）。 */
export type AuthProviderDiagnosticScenario =
  | 'validate_config'
  | 'smtp_connect'
  | 'send_test_email'
  | 'template_preview'
  | 'google_authorize_url'
  | 'telegram_get_me'
  | 'telegram_deep_link';

export type AuthProviderDiagnosticStatus = 'success' | 'warning' | 'failed';
export type AuthProviderDiagnosticStepStatus =
  | 'success'
  | 'warning'
  | 'failed'
  | 'skipped';

export interface AuthProviderDiagnosticStep {
  code: string;
  title: string;
  status: AuthProviderDiagnosticStepStatus;
  message: string;
  retryable: boolean;
  startedAt: string;
  finishedAt: string;
}

/** 诊断产物（各场景按需给出，缺省字段后端 skip_serializing）。 */
export interface AuthProviderDiagnosticArtifacts {
  callbackUrl?: string;
  authorizeUrl?: string;
  deepLinkUrl?: string;
}

export interface AuthProviderDiagnosticResponse {
  runId: string;
  provider: string;
  scenario: AuthProviderDiagnosticScenario;
  status: AuthProviderDiagnosticStatus;
  summary: { title: string; message: string };
  steps: AuthProviderDiagnosticStep[];
  artifacts: AuthProviderDiagnosticArtifacts;
  warnings: string[];
  requestId: string | null;
  testedAt: string;
}

/** POST /api/manage/auth-providers/{provider}/diagnostics 入参。 */
export interface AuthProviderDiagnosticInput {
  /** 缺省 `validate_config`。 */
  scenario?: AuthProviderDiagnosticScenario;
  /** 未落库的草稿配置（自检草稿，不改线上配置）。 */
  draftConfig?: AuthProviderConfigWriteInput;
  testEmail?: string;
  templateContext?: unknown;
}
