import { Link, isRouteErrorResponse, useRouteError } from 'react-router';
import { GlassPanel, Button } from '@fmby/v2-shared/ui';
import { getErrorTraceId } from '@fmby/v2-shared/errors/error';

interface ErrorInfo {
  code: string;
  title: string;
  description: string;
  trace?: string;
  /** 排查码（后端 ErrorBody.trace_id，#1904 Slice 2 展示位；有则展示，便于报障）。 */
  traceId?: string;
  showHome: boolean;
}

function extractErrorInfo(error: unknown): ErrorInfo {
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return {
        code: '404',
        title: '页面不存在',
        description: '你访问的页面不存在或已被移动，返回首页继续浏览。',
        showHome: true,
      };
    }
    if (error.status === 403) {
      return {
        code: '403',
        title: '无权限访问',
        description: '当前账号没有访问此页面的权限，如需访问请联系管理员。',
        showHome: true,
      };
    }
    return {
      code: String(error.status),
      title: `请求失败 (${error.status})`,
      description:
        typeof error.data === 'string' && error.data
          ? error.data
          : '服务端返回了异常状态，请稍后重试。',
      trace: typeof error.data === 'string' ? undefined : safeStringify(error.data),
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
  // ★ApiError 归一化对象（client 桶 throw 的是 plain object，非 Error 实例）：
  //   展示后端人话 message + HTTP 状态，排查码由组件级 getErrorTraceId 统一提取。
  const rec = error as { code?: unknown; message?: unknown; status?: unknown };
  if (typeof rec.code === 'string' && typeof rec.message === 'string') {
    const statusNum = typeof rec.status === 'number' ? rec.status : 500;
    return {
      code: String(statusNum),
      title: `请求失败 (${statusNum})`,
      description: rec.message,
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

function safeStringify(value: unknown): string | undefined {
  if (value == null) return undefined;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * 路由级错误页（玻璃拟态风格）
 * - 403：无权限文案 + 返回首页
 * - 404：页面不存在
 * - 500 / 未知异常：展示错误信息与可折叠 trace
 */
export function RouteErrorPage() {
  const error = useRouteError();
  const info = { ...extractErrorInfo(error), traceId: getErrorTraceId(error) };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-6, 24px)',
      }}
    >
      <GlassPanel variant="blur">
        <div
          style={{
            width: 'min(560px, calc(100vw - 48px))',
            padding: 'var(--space-6, 24px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3, 12px)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 'var(--space-3, 12px)',
            }}
          >
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--aurora-1, #7ae2ff)',
              }}
            >
              FMBY
            </span>
            <span
              style={{
                fontSize: '2.5rem',
                fontWeight: 800,
                lineHeight: 1,
                background:
                  'linear-gradient(120deg, var(--aurora-1, #7ae2ff), var(--aurora-3, #b48cff))',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              {info.code}
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: '1.375rem' }}>{info.title}</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary, #9aa3b5)' }}>
            {info.description}
          </p>
          {info.traceId ? (
            <p
              style={{
                margin: 0,
                fontSize: '0.75rem',
                color: 'var(--text-secondary, #9aa3b5)',
              }}
            >
              排查码：
              <code
                style={{
                  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                  color: 'var(--text-primary, #e6e9ef)',
                  wordBreak: 'break-all',
                }}
              >
                {info.traceId}
              </code>
              （报障时请附上）
            </p>
          ) : null}
          {info.trace ? (
            <details
              style={{
                borderRadius: 'var(--radius-md, 10px)',
                border: '1px solid var(--glass-border, rgba(255,255,255,0.12))',
                background: 'rgba(0, 0, 0, 0.25)',
                padding: 'var(--space-3, 12px)',
              }}
            >
              <summary style={{ cursor: 'pointer', color: 'var(--text-secondary, #9aa3b5)' }}>
                错误详情
              </summary>
              <pre
                style={{
                  margin: 'var(--space-2, 8px) 0 0',
                  maxHeight: 220,
                  overflow: 'auto',
                  fontSize: '0.75rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  color: 'var(--text-secondary, #9aa3b5)',
                }}
              >
                {info.trace}
              </pre>
            </details>
          ) : null}
          <div style={{ display: 'flex', gap: 'var(--space-3, 12px)', marginTop: 'var(--space-2, 8px)' }}>
            {info.showHome ? (
              <Link to="/" style={{ textDecoration: 'none' }}>
                <Button variant="primary">回首页</Button>
              </Link>
            ) : null}
            <Button variant="ghost" onClick={() => window.location.reload()}>
              刷新页面
            </Button>
          </div>
        </div>
      </GlassPanel>
    </main>
  );
}
