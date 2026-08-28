/**
 * 错误类型定义
 */

/** 统一 API 错误结构（归一化后使用 camelCase，来源兼容后端 snake_case）。 */
export interface ApiError {
  /** 后端 ErrorBody.error_code 的稳定 snake_case slug。 */
  code: string;
  message: string;
  traceId?: string;
  /** 仅由错误码/HTTP 状态推导，不信任服务端任意布尔字段。 */
  retryable: boolean;
}

export interface BackendErrorBody {
  error_code: string;
  message: string;
  trace_id?: string;
}

const RETRYABLE_CODES = new Set([
  'dependency_timeout',
  'dependency_unavailable',
  'dependency_rate_limited',
  'retryable_storage',
  'internal',
]);

export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { message?: unknown }).message === 'string' &&
    typeof (error as { retryable?: unknown }).retryable === 'boolean'
  );
}

export function isBackendErrorBody(value: unknown): value is BackendErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { error_code?: unknown }).error_code === 'string' &&
    typeof (value as { message?: unknown }).message === 'string'
  );
}

export function retryableForCode(code: string, status: number): boolean {
  return status >= 500 || RETRYABLE_CODES.has(code);
}
