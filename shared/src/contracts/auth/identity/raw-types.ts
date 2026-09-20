/**
 * 三方身份登录 wire 形状（后端 snake_case 优先，兼容 camelCase）。
 *
 * 与 `crates/fmby-v2-http/src/routes/identity/mod.rs` 的 DTO 逐字段对位；
 * 读取一律经宽容 helper（缺字段不崩，落 `undefined` 交由 mapper 决定口径）。
 */

/** `GET /api/auth/identity/providers` item。 */
export interface RawIdentityProviderAvailability {
  provider?: unknown;
  display_name?: unknown;
  displayName?: unknown;
  enabled?: unknown;
  login_enabled?: unknown;
  loginEnabled?: unknown;
  binding_enabled?: unknown;
  bindingEnabled?: unknown;
  password_reset_enabled?: unknown;
  passwordResetEnabled?: unknown;
  configured?: unknown;
}

/** `login/start` 响应（字段形状随 provider 而异，全部可缺省）。 */
export interface RawIdentityLoginStart {
  provider?: unknown;
  challenge_id?: unknown;
  challengeId?: unknown;
  action?: unknown;
  authorize_url?: unknown;
  authorizeUrl?: unknown;
  delivery_status?: unknown;
  deliveryStatus?: unknown;
  completion_token?: unknown;
  completionToken?: unknown;
  message?: unknown;
  expires_at?: unknown;
  expiresAt?: unknown;
}

/** `login/complete` 响应（`LoginResponse`：成功与 MFA 共用形状）。 */
export interface RawIdentityLoginComplete {
  user_id?: unknown;
  userId?: unknown;
  expires_in_secs?: unknown;
  expiresInSecs?: unknown;
  status?: unknown;
  challenge_id?: unknown;
  challengeId?: unknown;
  /** MFA 分支为 epoch 毫秒数字（与后端口径同）。 */
  expires_at?: unknown;
  expiresAt?: unknown;
}

/** `login/status` 响应（仅 Telegram）。 */
export interface RawTelegramLoginStatus {
  verified?: unknown;
  expires_at?: unknown;
  expiresAt?: unknown;
}

/** `GET .../callback` 响应。 */
export interface RawIdentityCallbackCapture {
  provider?: unknown;
  challenge_id?: unknown;
  challengeId?: unknown;
  received_code?: unknown;
  receivedCode?: unknown;
  message?: unknown;
}
