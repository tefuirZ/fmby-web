import type { ApiError } from '@fmby/v2-shared/types';
import { isApiError } from '@fmby/v2-shared/types';
import { isSessionInvalidationError, notifyAuthFailure } from '@fmby/v2-shared/errors/authFailure';
import { isBackendErrorBody, retryableForCode } from '@fmby/v2-shared/errors/error';

/**
 * HTTP 客户端封装
 *
 * 特性：
 * - 统一 base URL 处理
 * - 写方法自动回显 CSRF 双提交 header（fmby_csrf cookie → x-csrf-token）
 * - 统一错误映射为 ApiError
 * - JSON 请求/响应自动处理
 * - 支持 AbortSignal、请求超时、指数退避重试、请求/响应/错误拦截器
 */

/** 默认请求超时（毫秒），0 或负数表示不超时 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

/**
 * CSRF 双提交 cookie 名（与后端 middleware/csrf.rs CSRF_COOKIE_NAME 一致）。
 * 登录成功后端签发（无 HttpOnly，值 = HMAC(session_token, origin)），前端在
 * 写方法上读取并经 x-csrf-token header 回显，与 cookie 回带构成双匹配。
 */
const CSRF_COOKIE_NAME = 'fmby_csrf';

/** CSRF 回显 header 名（与后端 middleware/csrf.rs CSRF_HEADER_NAME 一致）。 */
const CSRF_HEADER_NAME = 'X-CSRF-Token';

/** 读取指定 cookie 值（无该 cookie 或值为空返回 null；SSR 环境防御性返回 null）。 */
function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  for (const pair of document.cookie.split(';')) {
    const t = pair.trim();
    if (t.startsWith(`${name}=`)) {
      const v = t.slice(name.length + 1).trim();
      return v === '' ? null : decodeURIComponent(v);
    }
  }
  return null;
}

/** 重试相关默认值 */
export const DEFAULT_RETRY_BASE_MS = 300;
export const DEFAULT_RETRY_FACTOR = 2;
export const DEFAULT_RETRY_MAX_DELAY_MS = 3_000;

/** 重试配置 */
export interface RetryConfig {
  /** 最大重试次数（不含首次请求本身） */
  retries: number;
  /**
   * 自定义判断某次错误是否应该重试。
   * attempt 从 0 开始计数（0 表示首次请求之后的第一次判断）。
   * 返回 true 则继续重试；不设置时走默认策略：
   *   - 网络错误 / 超时 / AbortError（非外部 signal 触发时）
   *   - ApiError.retryable === true（通常是 5xx）
   */
  retryOn?: (error: unknown, attempt: number) => boolean;
  /** 指数退避基数（毫秒），默认 300 */
  baseDelayMs?: number;
  /** 指数退避倍率，默认 2 */
  factor?: number;
  /** 单次退避最大延迟（毫秒），默认 3000 */
  maxDelayMs?: number;
}

/** 拦截器集合 */
export interface HttpInterceptors {
  /** 请求发出前调用，可返回新的 RequestConfig（不返回则使用原值） */
  request?: Array<(config: NormalizedRequest) => NormalizedRequest | Promise<NormalizedRequest>>;
  /** 响应成功后调用，可返回新的 Response */
  response?: Array<(response: Response, config: NormalizedRequest) => Response | Promise<Response>>;
  /** 错误发生时调用，可抛出新的错误或返回一个 Response/数据以"恢复"请求 */
  error?: Array<(error: unknown, config: NormalizedRequest) => Promise<unknown> | unknown>;
}

/** 经过归一化的请求（供拦截器使用） */
export interface NormalizedRequest {
  url: string;
  method: string;
  headers: Headers;
  body: BodyInit | undefined;
  credentials: RequestCredentials;
  /** 原始用户传入的配置（只读视图） */
  originalConfig: RequestConfig;
}

/** 请求配置 */
export interface RequestConfig extends Omit<RequestInit, 'body' | 'signal'> {
  /** 请求体。普通对象会自动 JSON.stringify，FormData/Blob/字符串等原样透传。 */
  body?: unknown;
  /** 查询参数 */
  params?: Record<string, string | number | boolean | undefined>;
  /** 外部 AbortSignal，与内部超时 signal 合并后透传给 fetch */
  signal?: AbortSignal;
  /**
   * 请求超时（毫秒）。
   * - 未设置 / undefined：使用默认 {@link DEFAULT_REQUEST_TIMEOUT_MS}
   * - 设为 0 或负数：不启用超时
   */
  timeout?: number;
  /** 重试策略；未设置或 retries <= 0 时不重试 */
  retry?: RetryConfig;
  /** 响应体解析/校验钩子（FE-API-AS-T）：JSON→unknown 后经此产出 T，可落地运行时
   * 不变量校验（如 zod `.parse`，失败抛错）；未提供退化为历史 `raw as T`（零行为变更）。 */
  parse?: (raw: unknown) => unknown;
}

function isRawBodyInit(value: unknown): value is BodyInit {
  return (
    typeof value === 'string' ||
    value instanceof FormData ||
    value instanceof Blob ||
    value instanceof URLSearchParams ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    value instanceof ReadableStream
  );
}

function normalizeRequestBody(body: unknown): {
  body: BodyInit | undefined;
  shouldSetJsonContentType: boolean;
} {
  if (body === undefined) {
    return {
      body: undefined,
      shouldSetJsonContentType: false,
    };
  }

  if (isRawBodyInit(body)) {
    return {
      body,
      shouldSetJsonContentType: false,
    };
  }

  return {
    body: JSON.stringify(body),
    shouldSetJsonContentType: true,
  };
}

/**
 * 构建完整 URL（附加查询参数）
 */
function buildUrl(path: string, params?: RequestConfig['params']): string {
  const url = new URL(path, window.location.origin);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
}

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
async function mapResponseToApiError(response: Response): Promise<ApiErrorWithHttpMetadata> {
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
function anySignal(signals: Array<AbortSignal | undefined>): AbortSignal | undefined {
  const valid = signals.filter((s): s is AbortSignal => Boolean(s));
  if (valid.length === 0) return undefined;
  if (valid.length === 1) return valid[0];

  const anyFn = (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any;
  if (typeof anyFn === 'function') {
    return anyFn(valid);
  }

  const controller = new AbortController();
  const onAbort = (evt: Event) => {
    const target = evt.target as AbortSignal;
    controller.abort((target as AbortSignal & { reason?: unknown }).reason);
  };
  for (const s of valid) {
    if (s.aborted) {
      controller.abort((s as AbortSignal & { reason?: unknown }).reason);
      break;
    }
    s.addEventListener('abort', onAbort, { once: true });
  }
  return controller.signal;
}

/** 默认重试判定 */
function defaultRetryOn(error: unknown, externalSignal?: AbortSignal): boolean {
  // 外部主动取消：永不重试
  if (externalSignal?.aborted) return false;

  // 网络错误 / 超时 / 运行时 abort（内部超时）：可重试
  if (error instanceof TypeError) return true; // fetch 网络错误
  if (error instanceof DOMException && error.name === 'AbortError') return true; // 内部超时
  if (isApiError(error)) return error.retryable === true;

  return false;
}

function computeBackoffDelay(attempt: number, cfg: RetryConfig): number {
  const base = cfg.baseDelayMs ?? DEFAULT_RETRY_BASE_MS;
  const factor = cfg.factor ?? DEFAULT_RETRY_FACTOR;
  const max = cfg.maxDelayMs ?? DEFAULT_RETRY_MAX_DELAY_MS;
  const delay = base * Math.pow(factor, attempt);
  return Math.min(delay, max);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal!.reason ?? new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** 全局拦截器注册表（模块级单例） */
const interceptors: Required<HttpInterceptors> = {
  request: [],
  response: [],
  error: [],
};

/**
 * 执行一次实际 fetch（不含重试），含：
 * - 超时合成 signal
 * - 请求/响应/错误拦截器
 * - ApiError 归一化
 */
async function executeOnce<T>(
  path: string,
  config: RequestConfig,
  externalSignal: AbortSignal | undefined,
): Promise<T> {
  const { body, params, headers: customHeaders, timeout, signal: _s, retry: _r, parse, ...restConfig } = config;
  void _s;
  void _r;

  const url = buildUrl(path, params);
  const method = (restConfig.method ?? 'GET').toUpperCase();
  const headers = new Headers(customHeaders);
  const normalizedBody = normalizeRequestBody(body);

  if (normalizedBody.shouldSetJsonContentType && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('X-Requested-With', 'FMBY-Web');
  // CSRF 双提交回显（P1-04 F-1 接线）：Origin 闸由后端统一执行；写方法再读取
  // 登录签发的 fmby_csrf cookie 并经 x-csrf-token 回显，与浏览器自动回带的
  // cookie 构成双匹配（middleware/csrf.rs）。安全方法无需回显；cookie 缺失
  //（未登录/已登出）时不发头——渐进式校验下无工件即不强制，登录后自然生效。
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const csrf = readCookie(CSRF_COOKIE_NAME);
    if (csrf && !headers.has(CSRF_HEADER_NAME)) {
      headers.set(CSRF_HEADER_NAME, csrf);
    }
  }

  // 组合超时 signal
  const effectiveTimeout = timeout === undefined ? DEFAULT_REQUEST_TIMEOUT_MS : timeout;
  let timeoutController: AbortController | undefined;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  if (effectiveTimeout > 0) {
    timeoutController = new AbortController();
    timeoutHandle = setTimeout(() => timeoutController!.abort(), effectiveTimeout);
  }
  const combinedSignal = anySignal([externalSignal, timeoutController?.signal]);

  let normalized: NormalizedRequest = {
    url,
    method,
    headers,
    body: normalizedBody.body,
    credentials: restConfig.credentials ?? 'same-origin',
    originalConfig: config,
  };

  // 请求拦截器
  for (const fn of interceptors.request) {
    normalized = await fn(normalized);
  }

  try {
    let response = await fetch(normalized.url, {
      ...restConfig,
      method: normalized.method,
      headers: normalized.headers,
      body: normalized.body,
      credentials: normalized.credentials,
      signal: combinedSignal,
    });

    // 响应拦截器（可替换 response，例如 401 刷新 token 后重放）
    for (const fn of interceptors.response) {
      response = await fn(response, normalized);
    }

    if (!response.ok) {
      throw await mapResponseToApiError(response);
    }
    if (response.status === 204) return undefined as T;
    const raw: unknown = await response.json();
    return (parse ? parse(raw) : raw) as T;
  } catch (err) {
    // 错误拦截器：允许返回数据以"恢复"（返回非 undefined 则视为成功值）
    let currentErr: unknown = err;
    for (const fn of interceptors.error) {
      try {
        const recovered = await fn(currentErr, normalized);
        if (recovered !== undefined) return recovered as T;
      } catch (nextErr) {
        currentErr = nextErr;
      }
    }
    // 标记请求来源路径，供 isSessionInvalidationError 区分
    // “登录接口 401（凭据错误）”与“其他接口 401（会话失效）”。
    if (isApiError(currentErr)) {
      (currentErr as ApiError & { requestPath?: string }).requestPath = path;
    }
    if (isSessionInvalidationError(currentErr)) {
      notifyAuthFailure();
    }
    throw currentErr;
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
  }
}

/**
 * 基础请求方法（含重试循环）
 */
async function request<T>(path: string, config: RequestConfig = {}): Promise<T> {
  const retryCfg = config.retry;
  const maxRetries = retryCfg && retryCfg.retries > 0 ? retryCfg.retries : 0;
  const externalSignal = config.signal;

  let attempt = 0;
  // 首次 + 最多 maxRetries 次重试
  while (true) {
    try {
      return await executeOnce<T>(path, config, externalSignal);
    } catch (err) {
      if (attempt >= maxRetries) throw err;
      const shouldRetry = retryCfg?.retryOn
        ? retryCfg.retryOn(err, attempt)
        : defaultRetryOn(err, externalSignal);
      if (!shouldRetry) throw err;

      const delay = computeBackoffDelay(attempt, retryCfg!);
      try {
        await sleep(delay, externalSignal);
      } catch {
        throw err; // 等待期间被外部取消，直接抛出原错误
      }
      attempt += 1;
    }
  }
}

/**
 * HTTP 客户端（用法：`await httpClient.get<User>('/api/users/me')`；写方法
 * `await httpClient.post('/api/auth/login', { body: { username, password } })`）。
 */
export const httpClient = {
  get<T>(path: string, config?: Omit<RequestConfig, 'body'>) {
    return request<T>(path, { ...config, method: 'GET' });
  },

  post<T>(path: string, config?: RequestConfig) {
    return request<T>(path, { ...config, method: 'POST' });
  },

  put<T>(path: string, config?: RequestConfig) {
    return request<T>(path, { ...config, method: 'PUT' });
  },

  patch<T>(path: string, config?: RequestConfig) {
    return request<T>(path, { ...config, method: 'PATCH' });
  },

  delete<T>(path: string, config?: RequestConfig) {
    return request<T>(path, { ...config, method: 'DELETE' });
  },

  /** 注册拦截器，返回卸载函数 */
  interceptors: {
    request(fn: NonNullable<HttpInterceptors['request']>[number]): () => void {
      interceptors.request.push(fn);
      return () => {
        const i = interceptors.request.indexOf(fn);
        if (i >= 0) interceptors.request.splice(i, 1);
      };
    },
    response(fn: NonNullable<HttpInterceptors['response']>[number]): () => void {
      interceptors.response.push(fn);
      return () => {
        const i = interceptors.response.indexOf(fn);
        if (i >= 0) interceptors.response.splice(i, 1);
      };
    },
    error(fn: NonNullable<HttpInterceptors['error']>[number]): () => void {
      interceptors.error.push(fn);
      return () => {
        const i = interceptors.error.indexOf(fn);
        if (i >= 0) interceptors.error.splice(i, 1);
      };
    },
    /** 仅用于测试：清空所有拦截器 */
    _clearAll(): void {
      interceptors.request.length = 0;
      interceptors.response.length = 0;
      interceptors.error.length = 0;
    },
  },
};
