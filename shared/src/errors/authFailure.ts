import { isApiError } from '@fmby/v2-shared/types';

type AuthFailureListener = () => void;

const AUTH_FAILURE_CODES = new Set(['AUTH_REQUIRED', 'AUTH_EXPIRED']);
const AUTH_NON_SESSION_CODES = new Set([
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

  if (AUTH_FAILURE_CODES.has(error.code) || error.code === 'HTTP_401') {
    return true;
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
