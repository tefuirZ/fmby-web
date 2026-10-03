/**
 * HTTP 客户端错误映射（FE-CLIENT-SPLIT 四桶：types / error-mapping / core / index）。
 *
 * 职责：响应 → ApiError 的映射（含 http 元数据附加与后端错误体识别）。
 * 被 `core.ts` 消费；对外不出桶（`index.ts` 不 re-export 这些内部符号）。
 */

import type { ApiError } from '@fmby/v2-shared/types';
import { isApiError } from '@fmby/v2-shared/types';
import { isBackendErrorBody, retryableForCode } from '@fmby/v2-shared/errors/error';

type ApiErrorWithHttpMetadata = ApiError & {
  /** 原始 HTTP 状态码，便于调用方区分业务错误和传输错误。 */
  status: number;
  /** 原始 HTTP 状态文本。 */
  statusText: string;
};

type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function withHttpMetadata(
  error: ApiError,
  response: Response,
): ApiErrorWithHttpMetadata {
  return {
    ...error,
    status: response.status,
    statusText: response.statusText,
  };
}

/**
 * 将 fetch Response 映射为 ApiError
 */
export async function mapResponseToApiError(response: Response): Promise<ApiErrorWithHttpMetadata> {
  // 尝试解析服务端返回的错误结构
  try {
    const body: unknown = await response.json();
    if (isBackendErrorBody(body)) {
      return withHttpMetadata(
        {
          code: body.error_code === 'unauthorized' && response.status === 401 ? 'HTTP_401' : body.error_code,
          message: body.message,
          retryable: retryableForCode(body.error_code, response.status),
          traceId: body.trace_id,
        },
        response,
      );
    }
    if (isApiError(body)) {
      return withHttpMetadata(body, response);
    }

    const record = isJsonRecord(body) ? body : undefined;
    return withHttpMetadata(
      {
        code: `HTTP_${response.status}`,
        message: typeof record?.message === 'string' ? record.message : response.statusText,
        retryable: response.status >= 500,
        traceId:
          typeof record?.traceId === 'string'
            ? record.traceId
            : typeof record?.trace_id === 'string'
              ? record.trace_id
              : undefined,
      },
      response,
    );
  } catch {
    // 无法解析 JSON
    return withHttpMetadata(
      {
        code: `HTTP_${response.status}`,
        message: response.statusText || '请求失败',
        retryable: response.status >= 500,
      },
      response,
    );
  }
}

/**
 * 组合多个 AbortSignal 为一个：任意一个 abort 则合成信号 abort。
 * 优先使用平台 `AbortSignal.any`（Node 20+/现代浏览器），否则手动降级。
 */
