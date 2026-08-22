/**
 * HTTP 工具层统一导出
 *
 * 对外暴露 httpClient 实例及相关类型。
 * 各 domain 的 service 层通过此模块发起请求。
 */

export { httpClient } from '@/shared/api/client';
export type {
  RequestConfig,
  RetryConfig,
  HttpInterceptors,
  NormalizedRequest,
} from '@/shared/api/client';
export {
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_RETRY_BASE_MS,
  DEFAULT_RETRY_FACTOR,
  DEFAULT_RETRY_MAX_DELAY_MS,
} from '@/shared/api/client';
