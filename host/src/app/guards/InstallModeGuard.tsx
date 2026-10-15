import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '@fmby/v2-shared/contracts/auth';
import { queryKeys } from '@fmby/v2-shared/query';
import { isInstallModeInProgress } from '@/pages/install/installStatus';

/**
 * 安装模式守卫（INSTALL-FIRST-ROUND-UX · Bug A）。
 *
 * 背景：安装模式进程只挂 6 条安装路由（install_flow.rs），**不挂主应用路由**
 * ⇒ 用户首次打开 / 会落到主应用 404 页（真浏览器验收抓到的第一个逻辑 bug）。
 *
 * 逻辑：先拉 `/api/install/status`——
 *  - 安装中（needs_database / configured / needs_admin）⇒ `<Navigate to="/install">`；
 *  - 已安装（completed，或主应用实例下 /install/status **404**）/ 网络错 ⇒ 放行主应用。
 *
 * ★retry:false + staleTime:Infinity：安装状态是 boot 一次性判定；已安装实例下
 *   /install/status 稳定 404，重试只会拖慢首屏。与 InstallPage 共用
 *   queryKeys.install.status() ⇒ react-query 去重（一次网络）。
 */
export function InstallModeGuard({ children }: { children: ReactNode }) {
  const statusQuery = useQuery({
    queryKey: queryKeys.install.status(),
    queryFn: () => authApi.getInstallStatus(),
    retry: false,
    staleTime: Infinity,
  });

  // 加载中：极简占位（与画布同色），避免闪一下主应用 404 再跳走。
  if (statusQuery.isPending) {
    return <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }} />;
  }

  // 安装中 ⇒ 去安装向导。isInstallModeInProgress(undefined)===false，
  // 故 status 拉取失败（已安装实例 404 / 网络错）时落到下方放行主应用。
  if (isInstallModeInProgress(statusQuery.data)) {
    return <Navigate to="/install" replace />;
  }

  return <>{children}</>;
}
