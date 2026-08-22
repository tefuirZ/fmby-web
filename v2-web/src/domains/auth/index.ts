/**
 * 认证域
 *
 * 包含：
 * - 登录/登出 API
 * - 初始化设置 API
 * - 认证相关类型
 */

export { authApi } from './api';
export type {
  LoginRequest,
  RegisterRequest,
  RegisterResponse,
  SetupRequest,
  AuthResponse,
  SetupStatusResponse,
} from './api';
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

