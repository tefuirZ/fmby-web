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
import type { User } from '@fmby/v2-shared/types';
import { authApi } from './api';

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

/**
 * 登录二因子的**会话收口**结果（#289）。
 *
 * 后端 `verify` 只回 `{user_id, verified}` —— 它不回 capabilities。面板此前自行拼
 * `capabilities: []` ⇒ MFA 后前端权限视图恒空且不自愈。故 verify 成功（后端已建会
 * 话、cookie 已下发）后**按契约补拉 `/auth/me`** 取真实权限。
 *
 * `user === null` 一律表示「不进认证态」（码错 / 权限面拉不到 / 串号），fail-closed。
 */
export interface MfaVerifySessionRecord {
  verified: boolean;
  user: User | null;
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

  /**
   * 登录二因子**收口**：verify → 补拉 `/auth/me` → 组装 User（#289）。
   *
   * 与 `authApi.login` 同口径：capabilities **只**来自后端 `/auth/me`，
   * 绝不置空 / 从用户名推断；拉不到就 `user: null`（fail-closed，不进认证态）。
   *
   * 后端 `auth.rs::MeResponse` 不返回 roles ⇒ 恒空 fail-closed；
   * 用户名仍走登录时本地缓存（与 getSession 同纪律，拿不到即空串）。
   */
  async verifyForSession(payload: {
    challengeId: string;
    code: string;
  }): Promise<MfaVerifySessionRecord> {
    const { userId, verified } = await mfaApi.verify(payload);
    // 码错 ⇒ 后端未建会话；不碰 /auth/me，不进认证态。
    if (!verified) return { verified: false, user: null };

    let session: User;
    try {
      // ponytail: 直接复用 authApi.getSession()（已含「me → mapMeResponse →
      // 用户名取本地缓存」全链路），不在此重写第二份 capabilities 组装；
      // 上限=若将来 MFA 需要额外字段，改 getSession 一处即可。
      session = await authApi.getSession();
    } catch {
      // 权限面拿不到 ⇒ 不进认证态（与 login() 的 fail-closed 同口径）。
      return { verified: true, user: null };
    }

    // 防串号：/auth/me 的主体必须与 verify 的 user_id 一致，否则 fail-closed。
    if (session.id !== String(userId)) return { verified: true, user: null };

    return { verified: true, user: session };
  },
};
