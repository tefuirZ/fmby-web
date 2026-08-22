/**
 * 错误类型定义
 */

/** 统一 API 错误结构 */
export interface ApiError {
  /** 错误码（业务层面，例如 "AUTH_EXPIRED", "NOT_FOUND"） */
  code: string;
  /** 面向用户的错误描述 */
  message: string;
  /** 面向开发者的提示信息 */
  hint?: string;
  /** 是否可重试 */
  retryable: boolean;
  /** 服务端追踪 ID，便于排查 */
  traceId?: string;
}

/**
 * 判断是否为 ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'retryable' in error
  );
}
