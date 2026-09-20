/**
 * 认证域
 *
 * 包含：
 * - 登录/登出 API
 * - 初始化设置 API
 * - 认证相关类型
 */

export { authApi, mapMeResponse } from './api';
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
export { completeIdentityLogin, identityLoginApi } from './identity';
export type {
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

export type { User, UserRole, Capability } from './user';
export type { SessionState, SessionStatus } from './session';
