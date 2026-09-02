/**
 * HTTP 客户端封装
 *
 * 特性：
 * - 统一 base URL 处理
 * - CSRF 双提交：写方法读取 `fmby_csrf` cookie 并经 `x-csrf-token` header 回显
 *   （与后端 middleware/csrf.rs 双匹配契约一致）
 * - 统一错误映射为 ApiError
 * - JSON 请求/响应自动处理
 * - 支持 AbortSignal、请求超时、指数退避重试、请求/响应/错误拦截器
 */
/** 默认请求超时（毫秒），0 或负数表示不超时 */
export declare const DEFAULT_REQUEST_TIMEOUT_MS = 30000;
/** 重试相关默认值 */
export declare const DEFAULT_RETRY_BASE_MS = 300;
export declare const DEFAULT_RETRY_FACTOR = 2;
export declare const DEFAULT_RETRY_MAX_DELAY_MS = 3000;
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
}
/**
 * HTTP 客户端
 *
 * @example
 * ```ts
 * import { httpClient } from '@fmby/v2-shared/api/client';
 *
 * const user = await httpClient.get<User>('/api/users/me');
 * await httpClient.post('/api/auth/login', { body: { username, password } });
 * ```
 */
export declare const httpClient: {
    get<T>(path: string, config?: Omit<RequestConfig, "body">): Promise<T>;
    post<T>(path: string, config?: RequestConfig): Promise<T>;
    put<T>(path: string, config?: RequestConfig): Promise<T>;
    patch<T>(path: string, config?: RequestConfig): Promise<T>;
    delete<T>(path: string, config?: RequestConfig): Promise<T>;
    /** 注册拦截器，返回卸载函数 */
    interceptors: {
        request(fn: NonNullable<HttpInterceptors["request"]>[number]): () => void;
        response(fn: NonNullable<HttpInterceptors["response"]>[number]): () => void;
        error(fn: NonNullable<HttpInterceptors["error"]>[number]): () => void;
        /** 仅用于测试：清空所有拦截器 */
        _clearAll(): void;
    };
};
//# sourceMappingURL=client.d.ts.map