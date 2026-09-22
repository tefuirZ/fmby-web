/**
 * 微软账号 / OAuth 契约层（FE-PARITY-MICROSOFT）。
 *
 * 端点真实来源：`crates/fmby-v2-http/src/routes/manage_microsoft.rs:47-112`（ENDPOINTS 清单）。
 *
 * ★wire 方向（务必遵守，写反即 400）：
 * - 请求体 **camelCase**（后端 `#[serde(rename = "providerType", alias="provider_type")]`
 *   的 canonical 名是 camelCase）。
 * - 响应体 **snake_case**，须映射成 camelCase 域模型。
 *
 * ★确认闸：本文件 14 条端点所在 route 文件 `require_confirmed` 出现 **0 次**；
 *   DELETE accounts/{id} 走 `dangerous_service`（MANAGE_ACCESS + MANAGE_MOUNT +
 *   DANGEROUS_ACTION），其文档明确「删除类按用户裁定不再要求 `?confirmed=true`」。
 *   → **契约层不带 params:{confirmed:true}**，二次确认只在 UI 层（ConfirmDialog）。
 */

import { httpClient } from '@fmby/v2-shared/api/client';
import type {
  CompleteMicrosoftAuthInput,
  CompleteMicrosoftAuthResult,
  CompleteMicrosoftTokenAuthInput,
  CompleteMicrosoftTokenAuthResult,
  ImportMicrosoftTokenAccountInput,
  MicrosoftAppConfigStatusRecord,
  MicrosoftAuthAccountRecord,
  MicrosoftDeleteAccountResult,
  MicrosoftDriveRecord,
  MicrosoftOAuthClientInput,
  MicrosoftSiteRecord,
  MicrosoftTokenDriveListInput,
  MicrosoftTokenSiteSearchInput,
  StartMicrosoftAuthInput,
  StartMicrosoftAuthResult,
  StartMicrosoftTokenAuthInput,
  StartMicrosoftTokenAuthResult,
} from './types';

// ─── 原始（snake_case）响应形态 ───────────────────────────────────────────────

interface RawAppConfigStatusItem {
  provider_type: string;
  client_id_configured: boolean;
  client_secret_configured: boolean;
  redirect_uri: string;
  client_id_source: string;
  token_key_status: string;
}

interface RawAppConfigStatusResponse {
  items: RawAppConfigStatusItem[];
}

interface RawAuthAccount {
  id: string;
  auth_profile_id: string;
  provider_type: string;
  tenant_id: string;
  drive_id: string;
  service_kind: string;
  oauth_client_kind: string;
  note: string | null;
  status: string;
  principal_id: string | null;
  user_principal_name: string | null;
  display_name: string | null;
  last_used_at: string | null;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error_message: string | null;
  throttled_until: string | null;
  consecutive_throttle_count: number;
  created_at: string;
  updated_at: string;
}

interface RawAuthProfilesResponse {
  items: RawAuthAccount[];
}

interface RawStartAuthResponse {
  authorization_id: string;
  auth_profile_id: string;
  provider_type: string;
  tenant_id: string;
  drive_id: string;
  service_kind: string;
  redirect_uri: string;
  authorize_url: string;
}

interface RawCompleteAuthResponse {
  authorization_id: string;
  auth_profile_id: string;
  provider_type: string;
  tenant_id: string;
  drive_id: string;
  service_kind: string;
  status: string;
  principal_id: string | null;
  user_principal_name: string | null;
  display_name: string | null;
}

interface RawStartTokenAuthResponse {
  authorization_id: string;
  provider_type: string;
  tenant_id: string;
  service_kind: string;
  redirect_uri: string;
  authorize_url: string;
  oauth_client_kind: string;
}

interface RawCompleteTokenAuthResponse {
  authorization_id: string;
  provider_type: string;
  tenant_id: string;
  service_kind: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  principal_id: string | null;
  user_principal_name: string | null;
  display_name: string | null;
  oauth_client_kind: string;
}

interface RawDriveQuota {
  total: number | null;
  used: number | null;
  remaining: number | null;
}

interface RawDrive {
  id: string;
  name: string | null;
  drive_type: string | null;
  web_url: string | null;
  quota: RawDriveQuota | null;
}

interface RawDriveListResponse {
  items: RawDrive[];
}

interface RawSite {
  id: string;
  name: string | null;
  display_name: string | null;
  web_url: string | null;
}

interface RawSiteListResponse {
  items: RawSite[];
}

interface RawDeleteAccountResult {
  ok: boolean;
  message?: string | null;
}

// ─── 映射 ────────────────────────────────────────────────────────────────────

function toRawOAuthClient(input: MicrosoftOAuthClientInput) {
  return {
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    redirectUri: input.redirectUri,
  };
}

function fromAccount(r: RawAuthAccount): MicrosoftAuthAccountRecord {
  return {
    id: r.id,
    authProfileId: r.auth_profile_id,
    providerType: r.provider_type,
    tenantId: r.tenant_id,
    driveId: r.drive_id,
    serviceKind: r.service_kind,
    oauthClientKind: r.oauth_client_kind,
    note: r.note,
    status: r.status,
    principalId: r.principal_id,
    userPrincipalName: r.user_principal_name,
    displayName: r.display_name,
    lastUsedAt: r.last_used_at,
    lastSuccessAt: r.last_success_at,
    lastErrorAt: r.last_error_at,
    lastErrorMessage: r.last_error_message,
    throttledUntil: r.throttled_until,
    consecutiveThrottleCount: r.consecutive_throttle_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function fromDrive(r: RawDrive): MicrosoftDriveRecord {
  return {
    id: r.id,
    name: r.name,
    driveType: r.drive_type,
    webUrl: r.web_url,
    quota: r.quota
      ? { total: r.quota.total, used: r.quota.used, remaining: r.quota.remaining }
      : null,
  };
}

function fromSite(r: RawSite): MicrosoftSiteRecord {
  return {
    id: r.id,
    name: r.name,
    displayName: r.display_name,
    webUrl: r.web_url,
  };
}

// ─── API ─────────────────────────────────────────────────────────────────────

const BASE = '/api/manage/microsoft/auth';

export const microsoftApi = {
  /** #1 GET config-status — 自建应用凭据配置状态。 */
  async getAppConfigStatus(): Promise<MicrosoftAppConfigStatusRecord[]> {
    const raw = await httpClient.get<RawAppConfigStatusResponse>(`${BASE}/config-status`);
    return (raw.items ?? []).map((item) => ({
      providerType: item.provider_type,
      clientIdConfigured: item.client_id_configured,
      clientSecretConfigured: item.client_secret_configured,
      redirectUri: item.redirect_uri,
      clientIdSource: item.client_id_source,
      tokenKeyStatus: item.token_key_status,
    }));
  },

  /** #2 GET profiles — 已授权账号列表。 */
  async listAuthProfiles(): Promise<MicrosoftAuthAccountRecord[]> {
    const raw = await httpClient.get<RawAuthProfilesResponse>(`${BASE}/profiles`);
    return (raw.items ?? []).map(fromAccount);
  },

  /** #3 POST start — 发起授权码流，返回 authorize_url。 */
  async startAuth(input: StartMicrosoftAuthInput): Promise<StartMicrosoftAuthResult> {
    const raw = await httpClient.post<RawStartAuthResponse>(`${BASE}/start`, {
      body: {
        providerType: input.providerType,
        tenantId: input.tenantId,
        driveId: input.driveId,
        serviceKind: input.serviceKind,
        oauthClient: input.oauthClient ? toRawOAuthClient(input.oauthClient) : undefined,
        authProfileId: input.authProfileId,
        note: input.note,
      },
    });
    return {
      authorizationId: raw.authorization_id,
      authProfileId: raw.auth_profile_id,
      providerType: raw.provider_type,
      tenantId: raw.tenant_id,
      driveId: raw.drive_id,
      serviceKind: raw.service_kind,
      redirectUri: raw.redirect_uri,
      authorizeUrl: raw.authorize_url,
    };
  },

  /** #4 POST complete — 用回调 URL 完成授权码流。 */
  async completeAuth(input: CompleteMicrosoftAuthInput): Promise<CompleteMicrosoftAuthResult> {
    const raw = await httpClient.post<RawCompleteAuthResponse>(`${BASE}/complete`, {
      body: {
        authorizationId: input.authorizationId,
        callbackUrl: input.callbackUrl,
      },
    });
    return {
      authorizationId: raw.authorization_id,
      authProfileId: raw.auth_profile_id,
      providerType: raw.provider_type,
      tenantId: raw.tenant_id,
      driveId: raw.drive_id,
      serviceKind: raw.service_kind,
      status: raw.status,
      principalId: raw.principal_id,
      userPrincipalName: raw.user_principal_name,
      displayName: raw.display_name,
    };
  },

  /** #5 POST token/start — 发起 token 流。 */
  async startTokenAuth(input: StartMicrosoftTokenAuthInput): Promise<StartMicrosoftTokenAuthResult> {
    const raw = await httpClient.post<RawStartTokenAuthResponse>(`${BASE}/token/start`, {
      body: {
        providerType: input.providerType,
        serviceKind: input.serviceKind,
        oauthClient: input.oauthClient ? toRawOAuthClient(input.oauthClient) : undefined,
      },
    });
    return {
      authorizationId: raw.authorization_id,
      providerType: raw.provider_type,
      tenantId: raw.tenant_id,
      serviceKind: raw.service_kind,
      redirectUri: raw.redirect_uri,
      authorizeUrl: raw.authorize_url,
      oauthClientKind: raw.oauth_client_kind,
    };
  },

  /**
   * #6 POST token/complete — 换取令牌。
   * ★返回含 access_token/refresh_token：一次性凭据，UI 层严禁持久化。
   */
  async completeTokenAuth(
    input: CompleteMicrosoftTokenAuthInput,
  ): Promise<CompleteMicrosoftTokenAuthResult> {
    const raw = await httpClient.post<RawCompleteTokenAuthResponse>(`${BASE}/token/complete`, {
      body: {
        authorizationId: input.authorizationId,
        callbackUrl: input.callbackUrl,
      },
    });
    return {
      authorizationId: raw.authorization_id,
      providerType: raw.provider_type,
      tenantId: raw.tenant_id,
      serviceKind: raw.service_kind,
      accessToken: raw.access_token,
      refreshToken: raw.refresh_token,
      expiresAt: raw.expires_at,
      principalId: raw.principal_id,
      userPrincipalName: raw.user_principal_name,
      displayName: raw.display_name,
      oauthClientKind: raw.oauth_client_kind,
    };
  },

  /** #7 POST token/drives — 用令牌列举可用 drive。 */
  async listTokenDrives(input: MicrosoftTokenDriveListInput): Promise<MicrosoftDriveRecord[]> {
    const raw = await httpClient.post<RawDriveListResponse>(`${BASE}/token/drives`, {
      body: {
        providerType: input.providerType,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        siteId: input.siteId,
        oauthClient: input.oauthClient ? toRawOAuthClient(input.oauthClient) : undefined,
      },
    });
    return (raw.items ?? []).map(fromDrive);
  },

  /** #8 POST token/sites — 用令牌搜索 SharePoint 站点。 */
  async searchTokenSites(input: MicrosoftTokenSiteSearchInput): Promise<MicrosoftSiteRecord[]> {
    const raw = await httpClient.post<RawSiteListResponse>(`${BASE}/token/sites`, {
      body: {
        providerType: input.providerType,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        q: input.q,
        oauthClient: input.oauthClient ? toRawOAuthClient(input.oauthClient) : undefined,
      },
    });
    return (raw.items ?? []).map(fromSite);
  },

  /** #9 POST token/import — 以令牌直接导入账号。 */
  async importTokenAccount(input: ImportMicrosoftTokenAccountInput): Promise<MicrosoftAuthAccountRecord> {
    const raw = await httpClient.post<RawAuthAccount>(`${BASE}/token/import`, {
      body: {
        providerType: input.providerType,
        serviceKind: input.serviceKind,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        tenantId: input.tenantId,
        driveId: input.driveId,
        authProfileId: input.authProfileId,
        siteId: input.siteId,
        oauthClient: input.oauthClient ? toRawOAuthClient(input.oauthClient) : undefined,
      },
    });
    return fromAccount(raw);
  },

  /** #10 POST accounts/{id}/enable。 */
  async enableAccount(accountId: string): Promise<MicrosoftAuthAccountRecord> {
    const raw = await httpClient.post<RawAuthAccount>(
      `${BASE}/accounts/${encodeURIComponent(accountId)}/enable`,
    );
    return fromAccount(raw);
  },

  /** #11 POST accounts/{id}/disable。 */
  async disableAccount(accountId: string): Promise<MicrosoftAuthAccountRecord> {
    const raw = await httpClient.post<RawAuthAccount>(
      `${BASE}/accounts/${encodeURIComponent(accountId)}/disable`,
    );
    return fromAccount(raw);
  },

  /** #12 POST accounts/{id}/recover — 恢复异常账号。 */
  async recoverAccount(accountId: string): Promise<MicrosoftAuthAccountRecord> {
    const raw = await httpClient.post<RawAuthAccount>(
      `${BASE}/accounts/${encodeURIComponent(accountId)}/recover`,
    );
    return fromAccount(raw);
  },

  /** #13 POST accounts/{id}/note — 更新备注。 */
  async updateAccountNote(accountId: string, note: string): Promise<MicrosoftAuthAccountRecord> {
    const raw = await httpClient.post<RawAuthAccount>(
      `${BASE}/accounts/${encodeURIComponent(accountId)}/note`,
      { body: { note } },
    );
    return fromAccount(raw);
  },

  /**
   * #14 DELETE accounts/{id} — 危险操作（需 DANGEROUS_ACTION 能力）。
   * 后端不要求 confirmed=true → **URL 不带 confirmed**；UI 层用确认弹窗兜底。
   */
  async deleteAccount(accountId: string): Promise<MicrosoftDeleteAccountResult> {
    const raw = await httpClient.delete<RawDeleteAccountResult>(
      `${BASE}/accounts/${encodeURIComponent(accountId)}`,
    );
    return { ok: raw.ok, message: raw.message ?? null };
  },
};
