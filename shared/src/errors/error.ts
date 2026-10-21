/**
 * 错误类型定义
 */

/** 统一 API 错误结构（归一化后使用 camelCase，来源兼容后端 snake_case）。 */
export interface ApiError {
  /** 后端 ErrorBody.error_code 的稳定 slug（SCREAMING；M2 收窄后部分 401 折为 FE 私有 HTTP_401）。 */
  code: string;
  /** ★M2 收窄旁路：折叠前原始后端码（未折叠时与 code 同值）。 */
  backendCode?: string;
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

import { CODES_HTTP_429 } from './error-catalog.generated';

/** 可重试码集 = Coded-429（限流一律可重试，#1838/M1；generated 单源）。
 *  ★rb02 复评裁决（②）：原「意图可重试族」名单 5 slug 经 catalog 201 码逐字核
 *  **全 0 命中**（DEPENDENCY_TIMEOUT/…/INTERNAL 均非 catalog slug）⇒ 过滤为空操作，
 *  名单已删（历史与意图见 git）。意图与 catalog 真码的映射由 T1 裁定；
 *  T1 落地前本集 = Coded-429 单源。
 */
const RETRYABLE_CODES = new Set<string>(CODES_HTTP_429);

/**
 * 「能力未就绪」码（后端 501，FMBY-V2 `middleware/license_gate.rs`，#1626 DECLARE-NOT-READY）。
 *
 * 与 `license_feature_denied`（403）**不同轴**：后者是「能力已实现、但当前授权不含」⇒ 引导
 * 购买是对的；本条是「本端尚未声明该授权键 ⇒ 服务端永不签发」⇒ 买了也还是不通，文案必须
 * 是「暂未开放」，**不得**出现「请购买/升级授权」（否则就是在卖一个买不到的东西）。
 *
 * 注：它是 middleware 的自由 slug（小写），不在 `ERROR_CATALOG_SLUGS`（那是 `ErrorCode`
 * 的 SCREAMING 值域）⇒ 这里显式登记，避免落到通用兜底。
 */
export const LICENSE_CAPABILITY_NOT_READY = 'license_capability_not_ready';

/** 是否「能力未就绪」（501）——区别于授权拒绝（403）。 */
export function isLicenseCapabilityNotReady(error: unknown): boolean {
  return isApiError(error) && error.code === LICENSE_CAPABILITY_NOT_READY;
}

export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { message?: unknown }).message === 'string' &&
    typeof (error as { retryable?: unknown }).retryable === 'boolean'
  );
}

/**
 * 404 Not Found 判定（INSTALL-FIRST-ROUND-UX B）。
 *
 * 按 `code`（not_found / NOT_FOUND / HTTP_404）或运行时 `status === 404` 判定。
 * ★安装模式进程不挂主应用路由 ⇒ `/auth/me` 必然 404（预期而非网络波动）；
 *   SessionProvider 据此与 install/status 联合判定「静默清会话」，不误报 recovering 重试风暴。
 */
export function isNotFound(error: unknown): boolean {
  if (!isApiError(error)) return false;
  const { code } = error;
  if (code === 'not_found' || code === 'NOT_FOUND' || code === 'HTTP_404') {
    return true;
  }
  return (error as { status?: unknown }).status === 404;
}

/**
 * 403 Forbidden 判定（FE-LICENSE-GATED-MODULES ②）。
 *
 * 按 `code`（forbidden / HTTP_403）或运行时 `status === 403` 判定。
 * ★许可门（license_gate）未激活 ⇒ 付费端点 403（`AppError::Forbidden` → code `forbidden`）。
 *   gated 模块收到 403 时按「未授权/需要授权」语义呈现，**不**弹「你没有权限」
 *   （后者让人以为账号坏；实为实例许可未激活，去许可管理激活即可）。
 * ★注意：403 亦可来自能力门（如 MANAGE_MOUNT 缺）——文案须同时覆盖两种可能，不断言账号坏。
 */
export function isForbiddenError(error: unknown): boolean {
  if (!isApiError(error)) return false;
  const { code } = error;
  if (code === 'forbidden' || code === 'HTTP_403') {
    return true;
  }
  return (error as { status?: unknown }).status === 403;
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
  // ★未就绪（501）不是瞬时故障：重试一百次也不会变就绪（要等服务端补声明+执法面）
  //   ⇒ 必须先于 `status >= 500` 判，否则它会被当成可重试 5xx，界面反复转圈。
  if (code === LICENSE_CAPABILITY_NOT_READY) return false;
  // ★M1：429 = 限流语义 ⇒ 一律可重试（产品裁）；catalog 三支 Coded-429 码
  //   同时入白名单（覆盖 429 状态被网关改写/响应体先行的形态）。
  return status >= 500 || status === 429 || RETRYABLE_CODES.has(code);
}
