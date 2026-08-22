import { RouterProvider } from 'react-router/dom';
import { AppProviders } from './app/providers/AppProviders';
import { router } from './app/router';

/**
 * 根组件
 * - 包装全局 Providers
 * - 渲染路由
 */
export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
