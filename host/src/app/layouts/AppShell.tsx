import { Outlet, useLocation } from 'react-router';
import { TopBar } from './TopBar';
import styles from './AppShell.module.css';

/**
 * 应用壳组件（暗房）
 *
 * 统一包裹所有需要鉴权的页面，提供：
 * - TopBar 顶部导航栏（站点名 + 用户菜单 + 退出登录）
 * - 播放页（/play/*）全屏隐藏 TopBar
 * - 页面内容出口 Outlet
 */
export function AppShell() {
  const location = useLocation();
  const hideTopBar = location.pathname.startsWith('/play/');

  return (
    <div className={styles.shell}>
      {hideTopBar ? null : <TopBar />}
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}
