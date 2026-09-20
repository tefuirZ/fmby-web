/**
 * 三方身份登录（SSO）契约类型 —— THIRDPARTY-LOGIN-FLOW 前端消费面。
 *
 * 权威来源：后端 `crates/fmby-v2-http/src/routes/identity/`（main 现状）+
 * `docs/interfaces/webui.md` 的 identity 段。前端只消费，形状偏离以彼为准。
 */

import type { User } from '../user';

/** 后端支持的 provider 全集（`AuthIdentityProviderType::all`）。 */
export type IdentityProviderType = 'google' | 'telegram' | 'email' | 'github' | 'oidc';

/** 单个 provider 的公开可用性（`GET /api/auth/identity/providers` 的 item）。 */
export interface IdentityProviderAvailability {
  provider: IdentityProviderType;
  displayName: string;
  /** 配置记录 enabled 位。 */
  enabled: boolean;
  /** 可用于登录（`record.allow_login`，Telegram 特例见后端 `provider_capabilities`）。 */
  loginEnabled: boolean;
  /** 可用于绑定。 */
  bindingEnabled: boolean;
  /** 可用于找回密码。 */
  passwordResetEnabled: boolean;
  /** 是否已完整配置（Google 需 client_id + client_secret + redirect_uri）。 */
  configured: boolean;
}

/** `login/start` 入参。 */
export interface IdentityStartInput {
  email?: string;
  redirectUri?: string;
}

/** `login/start` 结果（V1 `StartIdentityFlowResponse` 形状）。 */
export interface IdentityLoginStart {
  provider: IdentityProviderType;
  challengeId: string;
  /** `external_callback` / `enter_code` / `telegram_auto_login`。 */
  action: string;
  authorizeUrl?: string;
  deliveryStatus?: string;
  completionToken?: string;
  message?: string;
  /** RFC3339 字符串（V1 契约口径）。 */
  expiresAt: string;
}

/**
 * `login/complete` 结果。
 *
 * - `authenticated`：后端已建会话（cookie），此处携带经 `/auth/me` 组装的用户；
 * - `mfa_required`：绑定账号启用了 TOTP ⇒ **后端不建会话**，前端须走二因子；
 *   `expiresAtMs` 为 epoch 毫秒（V2 `LoginResponse` 既有口径）。
 */
export type IdentityLoginCompleteResult =
  | { status: 'authenticated'; user: User }
  | { status: 'mfa_required'; challengeId: string; expiresAtMs: number };

/** Telegram `login/status` 结果（**不建会话**，纯状态查询）。 */
export interface TelegramLoginStatus {
  verified: boolean;
  expiresAt: string;
}

/** OAuth 回调捕获结果（**不消费、不建会话**）。 */
export interface IdentityCallbackCapture {
  provider: IdentityProviderType;
  challengeId: string;
  receivedCode: boolean;
  message: string;
}
