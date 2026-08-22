import type { ReactNode } from 'react';
import { useSession } from '@/shared/session/SessionProvider';

interface CapabilityGuardProps {
  required: string;
  children: ReactNode;
}

/**
 * 能力守卫
 *
 * 在已登录前提下对页面做二次能力校验。
 * 无权限时抛出 403，让 RouteErrorPage 统一接管。
 */
export function CapabilityGuard({ required, children }: CapabilityGuardProps) {
  const { hasCapability } = useSession();

  if (!hasCapability(required)) {
    throw new Response('当前账号没有访问此页面的权限。', { status: 403 });
  }

  return <>{children}</>;
}
