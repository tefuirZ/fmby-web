/**
 * HTTP 客户端统一出口（FE-CLIENT-SPLIT 三桶拆分：types / core / index）。
 *
 * 对外导出与拆分前的单文件 `client.ts` **逐字一致**：
 * - 运行时：httpClient、四个重试/超时缺省常量；
 * - 类型：RequestConfig、RetryConfig、HttpInterceptors、NormalizedRequest。
 * 消费方（`@fmby/v2-shared/api` 与各契约）零改动。
 */

export { httpClient } from './core';
export type {
  RequestConfig,
  RetryConfig,
  HttpInterceptors,
  NormalizedRequest,
} from './types';
export {
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_RETRY_BASE_MS,
  DEFAULT_RETRY_FACTOR,
  DEFAULT_RETRY_MAX_DELAY_MS,
} from './core';
