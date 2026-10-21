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
  // ★M1（产品裁：429 语义=限流 ⇒ 一律可重试）：catalog 三支 Coded-429 码。
  //   大小写照 wire 真值（error_code/slug.rs as_slug = SCREAMING_SNAKE）。
  'AUTH_RATE_LIMITED',
  'PLAYBACK_SESSION_LIMIT_EXCEEDED',
  'INSTALL_RATE_LIMITED',
  // ⚠️ 以下 5 条为**存量死条目**：wire error_code 是 SCREAMING（as_slug），
  //    snake_case 从未命中 ⇒ 本集合此前对真实流量恒空命中。修正大小写 =
  //    行为变更（DependencyTimeout 等将变为可重试），超出 M1 范围 ⇒ 另卡裁决。
  //    （#1870/#1871 的生成器落地后本集合改为生成派生，死条目问题随之消失。）
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
  // ★M1：429 = 限流语义 ⇒ 一律可重试（产品裁）；catalog 三支 Coded-429 码
  //   同时入白名单（覆盖 429 状态被网关改写/响应体先行的形态）。
  return status >= 500 || status === 429 || RETRYABLE_CODES.has(code);
}
