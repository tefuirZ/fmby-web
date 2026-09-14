/**
 * View-model 层公共类型与状态推导（WEB-B1，L3 主题前置）。
 *
 * 主题（L3）只接收**成型的视图数据**：本模块把「取数状态 → 视图状态」的判定
 * 收敛为纯函数，供各 viewmodel 复用，避免每个页面各写一套 isPending/isError
 * 分支（L3 硬条件：主题不感知 loading/error 判定差异）。
 *
 * 状态机（单向、无歧义）：
 * ```
 * loading ─┬─→ ready      （有数据）
 *          ├─→ empty      （成功但无数据）
 *          ├─→ error      （失败，非权限）
 *          └─→ forbidden  （403 权限不足）
 * ```
 *
 * 判定优先级：**forbidden > error > loading > empty > ready**——权限态优先于
 * 通用错误（同一错误既可能是 403 也可能是 500，取更具体的语义）。
 */

import type { ApiError } from '@fmby/v2-shared/errors';

/** 视图状态（L3 主题与页面共用的唯一状态词汇）。 */
export type ViewState = 'loading' | 'ready' | 'empty' | 'error' | 'forbidden';

/** 布局提示（移动端/桌面端）：viewmodel 统一暴露，供主题与页面分支。 */
export type LayoutHint = 'mobile' | 'desktop';

/**
 * 视图模型统一形状：`{ data, state, actions }`。
 *
 * - `data`：**视图模型**（非 raw DTO）——已按展示需要整形/派生（如 heroSlides、
 *   统计数、分组），主题可直接渲染，不需要再理解后端字段。
 * - `state`：上述五态之一。
 * - `actions`：页面可触发的动作（重试/刷新/加载更多/筛选），不含取数细节。
 */
export interface ViewModel<TData, TActions = Record<string, unknown>> {
  data: TData;
  state: ViewState;
  actions: TActions;
  /** 布局提示（WEB-B1 交付物 3）：移动端/桌面端，供主题与页面分支。 */
  layout: LayoutHint;
  /** 归一化后的错误（error/forbidden 态下可用；其余状态为 undefined）。 */
  error?: unknown;
}

/** 取数结果的最小可观察面（TanStack Query 结果子集，便于单测 mock）。 */
export interface QueryLike<TData> {
  data: TData | undefined;
  isPending: boolean;
  isError: boolean;
  error?: unknown;
  /** 无数据时是否仍在后台拉取（如 disabled 的 query 视为未加载）。 */
  isLoading?: boolean;
}

/** 权限错误码（后端稳定 slug）与 HTTP 403：命中即 forbidden。 */
const FORBIDDEN_CODES = new Set([
  'forbidden',
  'permission_denied',
  'unauthorized',
  'auth_failed',
  'capability_missing',
]);

/**
 * 从错误推导是否为「权限不足」。
 *
 * 依据：`ApiError.code` 命中权限码集合，或错误对象携带 HTTP 403 状态。
 * 不依赖服务端任意布尔字段（与 errors 模块同纪律）。
 */
export function isForbiddenError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const candidate = error as Partial<ApiError> & { status?: number; statusCode?: number };
  if (typeof candidate.code === 'string' && FORBIDDEN_CODES.has(candidate.code)) {
    return true;
  }
  return candidate.status === 403 || candidate.statusCode === 403;
}

/**
 * 纯函数：由取数结果 + 数据空判定推导视图状态。
 *
 * @param query    取数结果（真实 Query 或 mock）
 * @param isEmpty  数据是否为空（由调用方按视图语义判定，如数组长度/是否有 hero）
 */
export function deriveViewState<TData>(
  query: QueryLike<TData>,
  isEmpty: boolean,
): ViewState {
  if (query.isError) {
    return isForbiddenError(query.error) ? 'forbidden' : 'error';
  }
  // 数据已到位：优先按内容判空（empty 优先于 ready，成功但无内容 ≠ ready）。
  if (query.data !== undefined) {
    return isEmpty ? 'empty' : 'ready';
  }
  // 未拿到数据：pending（含 disabled 的初始态）一律 loading。
  if (query.isPending || query.isLoading) {
    return 'loading';
  }
  // 既无数据也无错误且不在加载：视为 loading（避免漏状态导致白屏）。
  return 'loading';
}

/**
 * 数组空判定快捷式（多数 viewmodel 的数据主体是列表/分组）。
 */
export function isEmptyList<T>(items: readonly T[] | undefined | null): boolean {
  return !items || items.length === 0;
}

/**
 * 分组数据空判定：任一组非空即视为有内容。
 */
export function isEmptyGroups(groups: ReadonlyArray<readonly unknown[] | undefined | null>): boolean {
  return groups.every((group) => isEmptyList(group));
}
