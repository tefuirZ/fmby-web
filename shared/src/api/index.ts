/**
 * API 客户端层统一入口
 *
 * - httpClient：统一 fetch 封装（鉴权头、CSRF 位、错误映射、重试/拦截器）
 * - mapping：raw DTO 读取助手（asRecord/readString 等），供 contracts mapper 使用
 */

export { httpClient } from './client';
export type {
  RequestConfig,
  RetryConfig,
  HttpInterceptors,
  NormalizedRequest,
} from './client';
export {
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_RETRY_BASE_MS,
  DEFAULT_RETRY_FACTOR,
  DEFAULT_RETRY_MAX_DELAY_MS,
} from './client';
export * from './mapping';
