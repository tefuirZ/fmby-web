/**
 * HTTP 客户端错误映射（FE-CLIENT-SPLIT 四桶：types / error-mapping / core / index）。
 *
 * 职责：响应 → ApiError 的映射（含 http 元数据附加与后端错误体识别）。
 * 被 `core.ts` 消费；对外不出桶（`index.ts` 不 re-export 这些内部符号）。
 */

import type { ApiError } from '@fmby/v2-shared/types';
import { isApiError } from '@fmby/v2-shared/types';
import { isBackendErrorBody, retryableForCode } from '@fmby/v2-shared/errors/error';

import {
  extractFeatureKeyFromMessage,
  freeBaselineDeniedMessage,
  isFreeBaselineFeature,
} from '@fmby/v2-shared/contracts/manage/license/freeBaseline';

type ApiErrorWithHttpMetadata = ApiError & {
  /** 原始 HTTP 状态码，便于调用方区分业务错误和传输错误。 */
  status: number;
  /** 原始 HTTP 状态文本。 */
  statusText: string;
};

type JsonRecord = Record<string, unknown>;

/** ★M2 收窄：折入 HTTP_401 的后端码（会话失效语义；catalog 401 共 11 支，其余 9 支保留后端码）。 */
const FOLD_INTO_HTTP_401 = new Set(['AUTH_REQUIRED', 'AUTH_EXPIRED']);

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
 * ★免费基线能力被拒 ⇒ **改写文案**（去掉「请购买/升级授权」）。
 *
 * 为什么在这里改而不是逐页改：所有 403 都经 `mapResponseToApiError` 这一个口；
 * 逐页改会漏（12 项散落在多个页面），而"漏"的后果正是让用户以为要掏钱买
 * 一个承诺免费的功能。
 *
 * 判据：`error_code === 'license_feature_denied'` **且**文案里的能力键属
 * `FREE_BASELINE_FEATURES`。付费能力原样透传（引导购买是对的）。
 */
function rewriteFreeBaselineDenial(error: ApiError): ApiError {
  if (error.code !== 'license_feature_denied') return error;
  const key = extractFeatureKeyFromMessage(error.message);
  if (!key || !isFreeBaselineFeature(key)) return error;
  return { ...error, message: freeBaselineDeniedMessage(key) };
}

/**
 * 将 fetch Response 映射为 ApiError
 */
export async function mapResponseToApiError(response: Response): Promise<ApiErrorWithHttpMetadata> {
  // 尝试解析服务端返回的错误结构
  try {
    const body: unknown = await response.json();
    if (isBackendErrorBody(body)) {
      const mapped: ApiErrorWithHttpMetadata = withHttpMetadata(
        {
          // ★M2 收窄（rb02 终审⑤）：仅 AUTH_REQUIRED/AUTH_EXPIRED 折入 HTTP_401
          //   （会话失效语义）；其余 9 支 401 码**保留后端码**，原始码经 backendCode 旁路。
          // ★M6：'HTTP_401' 是 **FE 私有值域**（不属于后端 error_code 目录值域）——
          //   FE 消费方据此区分「会话失效（清会话/重登）」与「后端业务码」。
          code:
            response.status === 401 && FOLD_INTO_HTTP_401.has(body.error_code)
              ? 'HTTP_401'
              : body.error_code,
          backendCode: body.error_code,
          message: body.message,
          retryable: retryableForCode(body.error_code, response.status),
          traceId: body.trace_id,
        },
        response,
      );
      // ★#91：免费基线能力被拒——把「请购买/升级授权」改写成如实说明
      //   （rewrite 只换 message,status/statusText 经 mapped 保留）。
      return withHttpMetadata(rewriteFreeBaselineDenial(mapped), response);
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
