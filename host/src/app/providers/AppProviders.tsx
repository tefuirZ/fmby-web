import type { ReactNode } from 'react';
import { QueryProvider } from './QueryProvider';
import { SessionProvider } from '@/shared/session/SessionProvider';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * 统一 Provider 包装
 * - 按依赖顺序嵌套各 Provider
 * - 新增全局 Provider 时统一在此处添加
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryProvider>
      <SessionProvider>
        {children}
      </SessionProvider>
    </QueryProvider>
  );
}
