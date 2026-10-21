import { isApiError } from '@fmby/v2-shared/types';
import type { ApiError } from '@fmby/v2-shared/types';

type AuthFailureListener = () => void;

// ★nit（w05）：AUTH_FAILURE_CODES（'UNAUTHORIZED'）已删——catalog 401 全列**无
//   UNAUTHORIZED 生产者**（11 支全列实证），原 Set 恒不命中 = 又一死集；
//   会话失效判定由 HTTP_401 折叠分支承载（M2 收窄口径）。若将来 wire 出现
//   'UNAUTHORIZED' 生产者，连同守卫一起加回。
// ★rb02 收口（二/四）：两支死 Set（AUTH_NON_SESSION_CODES / AUTH_FAILURE_HTTP_CODES）
//   与消息模式尾段已删——core.ts:274 是唯一触发点；三态 code 合成下 HTTP_401 在下方
//   提前 return ⇒ 尾段恒不可达；排除集与恒 false 回落结果相同 ⇒ 删除**零行为变化**。
//   （三）命名对齐（SCREAMING）本身亦无行为变化，不构成对「429 误触发登出」的修复。
//   历史注（保留，四）：'CREDENTIAL_INVALID' 与 'DEPENDENCY_RATE_LIMITED' 均**非**
//   error-catalog 201 码（rb02 核正；T2·二 原注释误称后者为 catalog 真码）——
//   若将来真码化，重排守卫时在此处加回排除语义。

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

  // FE 私有折叠码（M2 收窄：仅 AUTH_REQUIRED/AUTH_EXPIRED 折成 HTTP_401）。
  // 登录接口自身的 401 是“用户名/密码错误”，不是“会话已失效”，不能触发全局登出。
  if (error.code === 'HTTP_401') {
    return !isAuthLoginRequest(error);
  }

  return false;
}
