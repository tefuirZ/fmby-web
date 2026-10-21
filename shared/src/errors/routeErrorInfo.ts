/**
 * 路由错误页的**纯提取逻辑**（#106 rb02 复审：extractErrorInfo 未导出 ⇒ 真 bug 半
 * 零回归覆盖——导出 + 契约测试；从 RouteErrorPage.tsx 上移到 shared，脱离
 * react-router 依赖以可离线测试：`isRouteErrorResponse` 以谓词注入，生产侧传
 * react-router 真函数，测试侧传显式夹具谓词）。
 */

export interface RouteErrorInfo {
  code: string;
  title: string;
  description: string;
  /** 可折叠错误详情（Error.stack / 非归一化对象 JSON dump）。 */
  trace?: string;
  /** 排查码（后端 ErrorBody.trace_id，#1904 Slice 2 展示位；有则展示，便于报障）。 */
  traceId?: string;
  showHome: boolean;
}

export function safeStringify(value: unknown): string | undefined {
  if (value == null) return undefined;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * 把任意抛出物提取为错误页可渲染的结构化信息。
 *
 * 分支序：
 * 1. react-router 路由错误响应（404/403/其余状态）——data 为后端 ErrorBody JSON 时
 *    提取其 `trace_id` 为排查码；
 * 2. **ApiError 归一化对象**（client 桶 throw 的是 plain object，非 Error 实例）——
 *    description = 后端人话 message、code = HTTP 状态（缺失回落 `code` 本身，
 *    **不虚构 500**）；`trace = safeStringify(error)` 兜底（多数错误暂无 traceId，
 *    通用注入未上线，该 dump 是既有信息量，不得丢失）；
 * 3. 真 Error —— stack 兜底；
 * 4. 未知 —— JSON dump 兜底。
 */
export function extractErrorInfo(
  error: unknown,
  isRouteErrorResponse: (e: unknown) => boolean,
): RouteErrorInfo {
  if (isRouteErrorResponse(error)) {
    const r = error as { status: number; data?: unknown };
    if (r.status === 404) {
      return {
        code: '404',
        title: '页面不存在',
        description: '你访问的页面不存在或已被移动，返回首页继续浏览。',
        traceId: safeExtractDataTraceId(r.data),
        showHome: true,
      };
    }
    if (r.status === 403) {
      return {
        code: '403',
        title: '无权限访问',
        description: '当前账号没有访问此页面的权限，如需访问请联系管理员。',
        traceId: safeExtractDataTraceId(r.data),
        showHome: true,
      };
    }
    return {
      code: String(r.status),
      title: `请求失败 (${r.status})`,
      description:
        typeof r.data === 'string' && r.data
          ? r.data
          : '服务端返回了异常状态，请稍后重试。',
      trace: typeof r.data === 'string' ? undefined : safeStringify(r.data),
      traceId: safeExtractDataTraceId(r.data),
      showHome: true,
    };
  }
  if (error instanceof Error) {
    return {
      code: '500',
      title: '页面加载失败',
      description: error.message || '页面出现异常，请刷新后重试。',
      trace: error.stack,
      showHome: true,
    };
  }
  // ★ApiError 归一化对象（client 桶 errorMapping throw 的是 plain object）：
  //   description 取后端人话 message；code = HTTP 状态（缺失回落 code 本身）；
  //   trace 保留 safeStringify 兜底（traceId 有专用展示位，dump 不丢信息量）。
  const rec = error as { code?: unknown; message?: unknown; status?: unknown };
  if (typeof rec.code === 'string' && typeof rec.message === 'string') {
    const statusNum = typeof rec.status === 'number' ? rec.status : undefined;
    return {
      code: statusNum !== undefined ? String(statusNum) : rec.code,
      title:
        statusNum !== undefined
          ? `请求失败 (${statusNum})`
          : `请求失败 (${rec.code})`,
      description: rec.message,
      trace: safeStringify(error),
      traceId: safeExtractDataTraceId(error),
      showHome: true,
    };
  }
  return {
    code: '500',
    title: '页面加载失败',
    description: '页面出现未知异常，请刷新后重试。',
    trace: safeStringify(error),
    showHome: true,
  };
}

function safeExtractDataTraceId(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  const d = data as Record<string, unknown>;
  if (typeof d.trace_id === 'string' && d.trace_id) return d.trace_id;
  if (typeof d.traceId === 'string' && d.traceId) return d.traceId;
  return undefined;
}
