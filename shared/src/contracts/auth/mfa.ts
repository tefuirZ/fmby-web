/**
 * MFA/TOTP 契约（FE-MFA-TOTP-UI；后端 `routes/auth_mfa.rs`）。
 *
 * wire 形态逐字段对拍（**不许自造**）：
 * - 状态：`{enabled, pending_confirmation, recovery_codes_remaining}`
 * - 绑定：`{secret, otpauth_url, qr_image_data_url?}`
 * - 确认/再生成：`{enabled, pending_confirmation, recovery_codes_remaining, recovery_codes[]}`
 *   ★恢复码一次性明文回显（库中只存哈希）；前端只本屏展示，不落 localStorage/URL。
 * - 停用：DELETE 带 `{current_password}` → `{ok}`
 * - 登录二因子（匿名）：`{challenge_id, code}` → `{user_id, verified}`
 *
 * 登录口（auth.rs `LoginResponse`）新增 `status`：`"ok"` | `"mfa_required"`；
 * `mfa_required` 时**不建会话**（无 user/token/cookie），前端须转 verify 流。
 */

import { httpClient } from '@fmby/v2-shared/api/client';

export interface MfaStatusRecord {
  enabled: boolean;
  pendingConfirmation: boolean;
  recoveryCodesRemaining: number;
}

export interface MfaEnrollmentRecord {
  secret: string;
  otpauthUrl: string;
  qrImageDataUrl: string | null;
}

export interface MfaRecoveryCodesRecord extends MfaStatusRecord {
  /** ★一次性明文恢复码：仅本响应可见；展示后由用户自行离线保存。 */
  recoveryCodes: string[];
}

export interface MfaVerifyRecord {
  userId: number;
  verified: boolean;
}

export const mfaApi = {
  /** GET /api/auth/mfa/totp —— 当前 MFA 状态（登录态）。 */
  async status(): Promise<MfaStatusRecord> {
    const raw = await httpClient.get<{
      enabled: boolean;
      pending_confirmation: boolean;
      recovery_codes_remaining: number;
    }>('/api/auth/mfa/totp');
    return {
      enabled: raw.enabled,
      pendingConfirmation: raw.pending_confirmation,
      recoveryCodesRemaining: raw.recovery_codes_remaining,
    };
  },

  /** POST /api/auth/mfa/totp —— 发起绑定（返回 secret + otpauth URL + 可选二维码）。 */
  async enroll(): Promise<MfaEnrollmentRecord> {
    const raw = await httpClient.post<{
      secret: string;
      otpauth_url: string;
      qr_image_data_url?: string | null;
    }>('/api/auth/mfa/totp');
    return {
      secret: raw.secret,
      otpauthUrl: raw.otpauth_url,
      qrImageDataUrl: raw.qr_image_data_url ?? null,
    };
  },

  /** POST /api/auth/mfa/totp/confirm —— 首次验证码确认并**一次性**下发恢复码。 */
  async confirm(payload: { code: string }): Promise<MfaRecoveryCodesRecord> {
    const raw = await httpClient.post<{
      enabled: boolean;
      pending_confirmation: boolean;
      recovery_codes_remaining: number;
      recovery_codes: string[];
    }>('/api/auth/mfa/totp/confirm', { body: { code: payload.code } });
    return {
      enabled: raw.enabled,
      pendingConfirmation: raw.pending_confirmation,
      recoveryCodesRemaining: raw.recovery_codes_remaining,
      recoveryCodes: raw.recovery_codes,
    };
  },

  /** POST /api/auth/mfa/totp/recovery-codes —— 重新生成恢复码（旧码作废）。 */
  async regenerateRecoveryCodes(): Promise<MfaRecoveryCodesRecord> {
    const raw = await httpClient.post<{
      enabled: boolean;
      pending_confirmation: boolean;
      recovery_codes_remaining: number;
      recovery_codes: string[];
    }>('/api/auth/mfa/totp/recovery-codes');
    return {
      enabled: raw.enabled,
      pendingConfirmation: raw.pending_confirmation,
      recoveryCodesRemaining: raw.recovery_codes_remaining,
      recoveryCodes: raw.recovery_codes,
    };
  },

  /** DELETE /api/auth/mfa/totp —— 停用（需当前密码确认）。 */
  async disable(payload: { currentPassword: string }): Promise<{ ok: boolean }> {
    return httpClient.delete<{ ok: boolean }>('/api/auth/mfa/totp', {
      body: { current_password: payload.currentPassword },
    });
  },

  /** POST /api/auth/mfa/totp/verify —— 登录二因子（匿名，凭 challenge_id）。 */
  async verify(payload: { challengeId: string; code: string }): Promise<MfaVerifyRecord> {
    const raw = await httpClient.post<{ user_id: number; verified: boolean }>(
      '/api/auth/mfa/totp/verify',
      { body: { challenge_id: payload.challengeId, code: payload.code } },
    );
    return { userId: raw.user_id, verified: raw.verified };
  },
};
