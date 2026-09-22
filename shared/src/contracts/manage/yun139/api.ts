/**
 * 139 云盘凭据契约层（FE-PARITY-YUN139）。
 *
 * 端点真源：`crates/fmby-v2-http/src/routes/yun139_accounts.rs:35/36/37/41/45/49`
 * 能力门：全部 MANAGE_MOUNT；文件内 `require_confirmed` 与 `DANGEROUS_ACTION` **均 0 次**
 *   → 契约层不带 `params:{confirmed:true}`；删除属不可逆操作，UI 层确认弹窗兜底。
 *
 * wire：请求/响应均 snake_case；qr-status 的 query 名是 **snake_case `session_id`**。
 */

import { httpClient } from '@fmby/v2-shared/api/client';
import type {
  Yun139CredentialProfile,
  Yun139CredentialProfileInput,
  Yun139OkResult,
  Yun139QrLoginResult,
  Yun139QrStatusResult,
} from './types';

interface RawQrLoginResponse {
  session_id: string;
  device_id: string;
  qr_url: string;
  qr_image: string | null;
}

interface RawQrStatusResponse {
  status: string;
}

interface RawCredentialProfile {
  id: string;
  display_name: string;
  account_identity_mask: string | null;
  status: string;
  can_refresh: boolean;
  authorization_expires_at: number | null;
  last_success_at: number | null;
  last_error_at: number | null;
  last_error_kind: string | null;
  last_error_message: string | null;
  created_at: number;
  updated_at: number;
}

interface RawCredentialProfilesResponse {
  items: RawCredentialProfile[];
}

interface RawCredentialProfileResponse {
  profile: RawCredentialProfile;
}

interface RawOkResponse {
  ok: boolean;
}

function fromProfile(r: RawCredentialProfile): Yun139CredentialProfile {
  return {
    id: r.id,
    displayName: r.display_name,
    accountIdentityMask: r.account_identity_mask,
    status: r.status,
    canRefresh: r.can_refresh,
    authorizationExpiresAt: r.authorization_expires_at,
    lastSuccessAt: r.last_success_at,
    lastErrorAt: r.last_error_at,
    lastErrorKind: r.last_error_kind,
    lastErrorMessage: r.last_error_message,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toRawProfileInput(input: Yun139CredentialProfileInput) {
  return {
    display_name: input.displayName,
    qr_session_id: input.qrSessionId,
    authorization: input.authorization,
    cookie: input.cookie,
  };
}

const BASE = '/api/manage/yun139';

export const yun139Api = {
  /** POST qr-login — 发起扫码登录。 */
  async qrLogin(): Promise<Yun139QrLoginResult> {
    const raw = await httpClient.post<RawQrLoginResponse>(`${BASE}/qr-login`);
    return {
      sessionId: raw.session_id,
      deviceId: raw.device_id,
      qrUrl: raw.qr_url,
      qrImage: raw.qr_image ?? null,
    };
  },

  /**
   * GET qr-status?session_id= — 轮询扫码状态。
   * ★query 名是 snake_case（后端只认 `session_id`），与 pan115 的 camelCase 不同。
   */
  async qrStatus(sessionId: string): Promise<Yun139QrStatusResult> {
    const raw = await httpClient.get<RawQrStatusResponse>(`${BASE}/qr-status`, {
      params: { session_id: sessionId },
    });
    return { status: raw.status };
  },

  /** GET credential-profiles — 凭据档案列表。 */
  async listCredentialProfiles(): Promise<Yun139CredentialProfile[]> {
    const raw = await httpClient.get<RawCredentialProfilesResponse>(
      `${BASE}/credential-profiles`,
    );
    return (raw.items ?? []).map(fromProfile);
  },

  /** POST credential-profiles — 创建凭据档案（扫码会话 / authorization / cookie）。 */
  async createCredentialProfile(
    input: Yun139CredentialProfileInput,
  ): Promise<Yun139CredentialProfile> {
    const raw = await httpClient.post<RawCredentialProfileResponse>(
      `${BASE}/credential-profiles`,
      { body: toRawProfileInput(input) },
    );
    return fromProfile(raw.profile);
  },

  /** POST credential-profiles/{id}/reauthorize — 凭据过期后重新授权。 */
  async reauthorizeCredentialProfile(
    profileId: string,
    input: Yun139CredentialProfileInput,
  ): Promise<Yun139CredentialProfile> {
    const raw = await httpClient.post<RawCredentialProfileResponse>(
      `${BASE}/credential-profiles/${encodeURIComponent(profileId)}/reauthorize`,
      { body: toRawProfileInput(input) },
    );
    return fromProfile(raw.profile);
  },

  /**
   * DELETE credential-profiles/{id} — 不可逆。
   * 后端无 require_confirmed → URL 不带 confirmed；UI 层确认弹窗兜底。
   */
  async deleteCredentialProfile(profileId: string): Promise<Yun139OkResult> {
    const raw = await httpClient.delete<RawOkResponse>(
      `${BASE}/credential-profiles/${encodeURIComponent(profileId)}`,
    );
    return { ok: raw.ok };
  },
};
