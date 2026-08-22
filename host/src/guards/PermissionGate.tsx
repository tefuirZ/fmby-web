import type { ReactNode } from 'react';
import { useSession } from '@/session/SessionProvider';
import type { Capability } from '@fmby/v2-shared/types';

interface PermissionGateProps {
  /** 需要的能力标识 */
  required: Capability;
  /** 拥有权限时渲染的内容 */
  children: ReactNode;
  /** 无权限时的降级内容（可选，默认不渲染） */
  fallback?: ReactNode;
}

/**
 * 权限门控组件
 *
 * 根据当前用户的 capability 决定是否渲染子内容。
 * 用于页面内局部权限控制。
 *
 * @example
 * <PermissionGate required="manage_library">
 *   <DeleteLibraryButton />
 * </PermissionGate>
 */
export function PermissionGate({ required, children, fallback = null }: PermissionGateProps) {
  const { hasCapability } = useSession();

  if (!hasCapability(required)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
