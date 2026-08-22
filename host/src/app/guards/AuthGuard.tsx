import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useSession } from '@/session/SessionProvider';
import { Button, FeedbackState } from '@fmby/v2-shared/ui';

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * 路由守卫 — 鉴权拦截
 *
 * 未登录用户重定向到 /login，并携带 from 参数以便登录后跳回。
 * 加载中时展示全局 loading。
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { status, restoreError, retryRestore } = useSession();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: '24px' }}>
        <FeedbackState
          variant="loading"
          title="正在恢复会话"
          description="正在和服务端同步当前登录状态。"
        />
      </div>
    );
  }

  if (status === 'recovering') {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: '24px' }}>
        <FeedbackState
          variant="warning"
          title="网络波动，正在重试恢复会话"
          description={restoreError ?? '当前无法确认登录状态，正在自动重试。'}
          action={
            <Button variant="ghost" size="sm" onClick={retryRestore}>
              立即重试
            </Button>
          }
        />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    const from = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?from=${from}`} replace />;
  }

  return <>{children}</>;
}
