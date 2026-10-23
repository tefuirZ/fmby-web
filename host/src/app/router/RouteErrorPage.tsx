import { Link, isRouteErrorResponse, useRouteError } from 'react-router';
import { GlassPanel, Button } from '@fmby/v2-shared/ui';
import { extractErrorInfo } from '@fmby/v2-shared/errors/routeErrorInfo';
import { getErrorTraceId } from '@fmby/v2-shared/errors/error';

/**
 * 路由级错误页（玻璃拟态风格）
 * - 403：无权限文案 + 返回首页
 * - 404：页面不存在
 * - 500 / 未知异常：展示错误信息与可折叠 trace
 *
 * ★F10：`contained` 变体——挂在**布局层路由**（Browse/Manage/Settings）时传 true：
 *   子页渲染异常只替换该 section 内容区，AppShell（导航）存活；不传则整页替换
 *   （根路由兜底用）。errorElement 只接 loader/action/渲染错误，本组件即渲染错误的
 *   落点（errorElement 覆盖不了子树渲染异常的缺口由此补齐）。
 */
export function RouteErrorPage({ contained = false }: { contained?: boolean } = {}) {
  const error = useRouteError();
  const info = { ...extractErrorInfo(error, isRouteErrorResponse), traceId: getErrorTraceId(error) };

  return (
    <main
      style={{
        ...(contained
          ? { display: 'flex', justifyContent: 'center', padding: 'var(--space-6, 24px) 0' }
          : {
              minHeight: '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--space-6, 24px)',
            }),
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
