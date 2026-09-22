/**
 * 微软账号 / OAuth 契约类型（FE-PARITY-MICROSOFT）。
 *
 * 真实后端：`crates/fmby-v2-http/src/routes/manage_microsoft.rs`（注册 24 端点，#1–#24）
 * DTO：`crates/fmby-v2-http/src/state/microsoft_accounts.rs`
 *
 * ★wire 方向不对称（必须按此实现，写反即 400）：
 * - **响应恒 snake_case**（如 `auth_profile_id` / `user_principal_name`）。
 * - **请求体恒 camelCase**，因为后端用
 *   `#[serde(rename = "providerType", alias = "provider_type")]`
 *   —— canonical 名是 camelCase，snake_case 只是 alias。故 POST body 必须发 camelCase。
 */

/** 应用凭据配置状态项（GET auth/config-status）。 */
export interface MicrosoftAppConfigStatusRecord {
  /** `global` / `china_21vianet` 等（后端 provider_type 透传）。 */
  providerType: string;
  clientIdConfigured: boolean;
  clientSecretConfigured: boolean;
  redirectUri: string;
  clientIdSource: string;
  /** 令牌加密键状态（如 `ready` / `missing`）。 */
  tokenKeyStatus: string;
}

/** 微软授权账号（多个读端点共用的 DTO）。 */
export interface MicrosoftAuthAccountRecord {
  id: string;
  authProfileId: string;
  providerType: string;
  tenantId: string;
  driveId: string;
  serviceKind: string;
  oauthClientKind: string;
  /** 备注；后端字段也可能叫 remark（alias）。 */
  note: string | null;
  status: string;
  principalId: string | null;
  userPrincipalName: string | null;
  displayName: string | null;
  lastUsedAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  throttledUntil: string | null;
  consecutiveThrottleCount: number;
  createdAt: string;
  updatedAt: string;
}

/** 自定义 OAuth 客户端凭据（请求体用，camelCase canonical）。 */
export interface MicrosoftOAuthClientInput {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
}

/** POST auth/start 入参。 */
export interface StartMicrosoftAuthInput {
  providerType: string;
  tenantId: string;
  driveId: string;
  serviceKind: string;
  oauthClient?: MicrosoftOAuthClientInput;
  authProfileId?: string;
  note?: string;
}

/** POST auth/start 响应（含跳转授权 URL）。 */
export interface StartMicrosoftAuthResult {
  authorizationId: string;
  authProfileId: string;
  providerType: string;
  tenantId: string;
  driveId: string;
  serviceKind: string;
  redirectUri: string;
  /** 管理员需打开此 URL 完成授权；前端只展示/跳转，不改写。 */
  authorizeUrl: string;
}

/** POST auth/complete 入参（粘贴回调 URL）。 */
export interface CompleteMicrosoftAuthInput {
  authorizationId: string;
  callbackUrl: string;
}

/** POST auth/complete 响应。 */
export interface CompleteMicrosoftAuthResult {
  authorizationId: string;
  authProfileId: string;
  providerType: string;
  tenantId: string;
  driveId: string;
  serviceKind: string;
  status: string;
  principalId: string | null;
  userPrincipalName: string | null;
  displayName: string | null;
}

/** POST auth/token/start 入参。 */
export interface StartMicrosoftTokenAuthInput {
  providerType: string;
  serviceKind: string;
  oauthClient?: MicrosoftOAuthClientInput;
}

/** POST auth/token/start 响应。 */
export interface StartMicrosoftTokenAuthResult {
  authorizationId: string;
  providerType: string;
  tenantId: string;
  serviceKind: string;
  redirectUri: string;
  authorizeUrl: string;
  oauthClientKind: string;
}

/** POST auth/token/complete 入参。 */
export interface CompleteMicrosoftTokenAuthInput {
  authorizationId: string;
  callbackUrl: string;
}

/**
 * POST auth/token/complete 响应。
 *
 * ★安全口径（与 FE-CRUD-SECURITY-AUDIT 一致）：本对象含 access_token / refresh_token，
 * 属一次性凭据。前端**只**用它即时回填 steps/import 表单，
 * 严禁写入 localStorage / URL / console；刷新即失效，不持久化。
 */
export interface CompleteMicrosoftTokenAuthResult {
  authorizationId: string;
  providerType: string;
  tenantId: string;
  serviceKind: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  principalId: string | null;
  userPrincipalName: string | null;
  displayName: string | null;
  oauthClientKind: string;
}

/** POST auth/token/drives 入参（可按 site 过滤）。 */
export interface MicrosoftTokenDriveListInput {
  providerType: string;
  accessToken?: string;
  refreshToken?: string;
  siteId?: string;
  oauthClient?: MicrosoftOAuthClientInput;
}

export interface MicrosoftDriveQuotaRecord {
  total: number | null;
  used: number | null;
  remaining: number | null;
}

export interface MicrosoftDriveRecord {
  id: string;
  name: string | null;
  driveType: string | null;
  webUrl: string | null;
  quota: MicrosoftDriveQuotaRecord | null;
}

/** POST auth/token/sites 入参（搜索 SharePoint 站点）。 */
export interface MicrosoftTokenSiteSearchInput {
  providerType: string;
  accessToken?: string;
  refreshToken?: string;
  /** 搜索关键字（必填）。 */
  q: string;
  oauthClient?: MicrosoftOAuthClientInput;
}

export interface MicrosoftSiteRecord {
  id: string;
  name: string | null;
  displayName: string | null;
  webUrl: string | null;
}

/** POST auth/token/import 入参（以令牌直接导入账号）。 */
export interface ImportMicrosoftTokenAccountInput {
  providerType: string;
  serviceKind: string;
  accessToken?: string;
  refreshToken?: string;
  tenantId?: string;
  driveId: string;
  authProfileId?: string;
  siteId?: string;
  oauthClient?: MicrosoftOAuthClientInput;
}

/** 账号启用/停用/恢复/改备注的返回形态（同 MicrosoftAuthAccountDto）。 */
export type MicrosoftAccountMutationResult = MicrosoftAuthAccountRecord;

/** DELETE accounts/{id} 返回（ManageActionResultDto）。 */
export interface MicrosoftDeleteAccountResult {
  ok: boolean;
  message: string | null;
}
