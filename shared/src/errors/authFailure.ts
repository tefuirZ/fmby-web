import { isApiError } from '@fmby/v2-shared/types';
import type { ApiError } from '@fmby/v2-shared/types';

type AuthFailureListener = () => void;

const AUTH_FAILURE_CODES = new Set(['unauthorized', 'AUTH_REQUIRED', 'AUTH_EXPIRED']);
const AUTH_NON_SESSION_CODES = new Set([
  'credential_invalid',
  'dependency_rate_limited',
  'AUTH_INVALID_CREDENTIALS',
  'AUTH_RATE_LIMITED',
  'AUTH_ACCOUNT_LOCKED',
  'AUTH_ACCOUNT_INACTIVE',
  'AUTH_ACCOUNT_NOT_YET_VALID',
  'AUTH_ACCOUNT_EXPIRED',
  'AUTH_PASSWORD_CHANGE_REQUIRED',
  'AUTH_INTERACTIVE_LOGIN_DISABLED',
]);
const AUTH_FAILURE_HTTP_CODES = new Set(['HTTP_401']);
const AUTH_FAILURE_MESSAGE_PATTERNS = [
  '缺少认证令牌',
  '缺少访问令牌',
  '无效的会话令牌',
  '会话令牌',
  '认证已过期',
  'unauthorized',
  'token',
] as const;
const INVALID_CREDENTIAL_PATTERNS = [
  'invalid credentials',
  '凭据无效',
  '用户名或密码',
  '账号或密码',
  '用户名密码',
] as const;

const listeners = new Set<AuthFailureListener>();

/** 登录接口路径：该接口的 401 表示凭据校验失败，不属于会话失效 */
const AUTH_LOGIN_API_PATH = '/api/auth/login';

/**
 * HTTP 客户端在抛出 ApiError 前附加的请求来源路径（见 api/client.ts executeOnce）。
 * 用于区分“登录失败返回 401”与“既有会话过期返回 401”。
 */
type ApiErrorWithRequestPath = ApiError & { requestPath?: string };

function isAuthLoginRequest(error: ApiError): boolean {
  const requestPath = (error as ApiErrorWithRequestPath).requestPath;
  if (typeof requestPath !== 'string') {
    return false;
  }
  // 去掉 query string 后做精确比较，避免路径前缀误判（如 /api/auth/login-history）
  return requestPath.split('?')[0] === AUTH_LOGIN_API_PATH;
}

export function subscribeAuthFailure(listener: AuthFailureListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyAuthFailure(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function isSessionInvalidationError(error: unknown): boolean {
  if (!isApiError(error)) {
    return false;
  }

  if (AUTH_NON_SESSION_CODES.has(error.code)) {
    return false;
  }

  if (AUTH_FAILURE_CODES.has(error.code)) {
    return true;
  }

  // 登录接口自身的 401 是“用户名/密码错误”，不是“会话已失效”，
  // 不能触发全局登出事件（临时止血方案；正式 error_code 区分见 F2/P4-06）。
  if (error.code === 'HTTP_401') {
    return !isAuthLoginRequest(error);
  }

  if (!AUTH_FAILURE_HTTP_CODES.has(error.code)) {
    return false;
  }

  const message = error.message.trim().toLowerCase();
  if (INVALID_CREDENTIAL_PATTERNS.some((pattern) => message.includes(pattern))) {
    return false;
  }

  return AUTH_FAILURE_MESSAGE_PATTERNS.some((pattern) => message.includes(pattern.toLowerCase()));
}
