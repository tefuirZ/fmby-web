import type { ReactNode } from 'react';
import { QueryProvider } from './QueryProvider';
import { SessionProvider } from '@/session';
import { ThemeProvider } from '@/theme/ThemeProvider';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * 统一 Provider 包装
 * - 按依赖顺序嵌套各 Provider
 * - ThemeProvider 只做 tokens 热替换与 skins 懒加载，不触碰查询缓存
 * - 新增全局 Provider 时统一在此处添加
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryProvider>
      <ThemeProvider>
        <SessionProvider>
          {children}
        </SessionProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
