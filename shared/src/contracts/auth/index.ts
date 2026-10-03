/**
 * 认证域
 *
 * 包含：
 * - 登录/登出 API
 * - 初始化设置 API
 * - 认证相关类型
 */

// SESSION_USERNAME_STORAGE_KEY 是 MfaVerifyPanel 登录二因子流的会话键（api.ts:139 已导出），
// 此前漏在 barrel 外 ⇒ 消费方 TS2305。补 re-export（零语义：仅把既有导出接到门面上）。
export { authApi, mapMeResponse, SESSION_USERNAME_STORAGE_KEY } from './api';
export type {
  LoginRequest,
  RegisterRequest,
  RegisterResponse,
  SetupRequest,
  AuthResponse,
  SetupCompletedResponse,
  SetupStatusResponse,
  InstallDatabaseKind,
  InstallStatusResponse,
  DatabaseProbeRequest,
  DatabaseProbeResponse,
  MeResponse,
} from './api';
// 三方身份登录（SSO）：与 auth 同域，经本 barrel 暴露（页面禁直 import ./identity/api）。
// FE-IDENTITY-BINDINGS：账号绑定面（list/start/complete/unbind）同域同 barrel。
export { bindingReadyProviders, completeIdentityLogin, identityBindingsApi, identityLoginApi } from './identity';
export type {
  AccountIdentityBinding,
  IdentityBindingCompleteInput,
  IdentityBindingUnbindResult,
  IdentityCallbackCapture,
  IdentityLoginCompleteResult,
  IdentityLoginStart,
  IdentityProviderAvailability,
  IdentityProviderType,
  IdentityStartInput,
  TelegramLoginStatus,
} from './identity';
export {
  loginSchema,
  registerSchema,
  setupSchema,
} from './schemas';
export type {
  LoginFormData,
  RegisterFormData,
  SetupFormData,
} from './schemas';
export {
  passwordResetStartSchema,
  passwordResetCodeSchema,
  passwordResetLinkSchema,
  PASSWORD_RESET_START_CONFIRM_MESSAGE,
} from './passwordReset';
export type {
  PasswordResetDelivery,
  PasswordResetStartRequest,
  PasswordResetStartResponse,
  PasswordResetCompleteCodeRequest,
  PasswordResetCompleteLinkRequest,
  PasswordResetCompleteRequest,
  PasswordResetStartFormData,
  PasswordResetCodeFormData,
  PasswordResetLinkFormData,
} from './passwordReset';

export type { User, UserRole, Capability } from './user';
export type { SessionState, SessionStatus } from './session';
export { mfaApi } from './mfa';
export type {
  MfaStatusRecord,
  MfaEnrollmentRecord,
  MfaRecoveryCodesRecord,
  MfaVerifyRecord,
} from './mfa';
