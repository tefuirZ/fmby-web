import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface QueryProviderProps {
  children: ReactNode;
}

/**
 * React Query Provider
 * - 配置全局默认参数
 * - QueryClient 通过 useState 保持实例稳定
 */
export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 窗口聚焦时不自动重新请求（媒体播放场景下避免打断）
            refetchOnWindowFocus: false,
            // 默认重试 1 次
            retry: 1,
            // 5 分钟内视为新鲜数据
            staleTime: 5 * 60 * 1000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
