import { Outlet, useLocation } from 'react-router';
import { AsyncJobsProvider } from '@fmby/v2-shared/ui';
import { useSession } from '@/session';
import { TopBar } from './TopBar';
import { DomainSkinOutlet } from '@/theme/skins/DomainSkinOutlet';
import styles from './AppShell.module.css';

/**
 * 应用壳组件（暗房）
 *
 * 统一包裹所有需要鉴权的页面，提供：
 * - TopBar 顶部导航栏（站点名 + 用户菜单 + 退出登录）
 * - 播放页（/play/*）全屏隐藏 TopBar
 * - 页面内容出口 Outlet
 *
 * P2-06-R5 / WEB-C1：Outlet 外包 DomainSkinOutlet —— 当前主题声明了
 * 对应 PageDomain 的 skin 且 host 有该域数据源时渲染主题组件，
 * 否则静默回落 host 默认页面（功能永不缺失）。
 */
export function AppShell() {
  const location = useLocation();
  const hideTopBar = location.pathname.startsWith('/play/');
  // ★FE-ASYNC-FEEDBACK：后台任务反馈层挂载在会话内（发起人 = 当前用户）。
  const { user } = useSession();

  return (
    <div className={styles.shell}>
      <AsyncJobsProvider initiator={user?.display_name ?? user?.name ?? '当前用户'}>
        {hideTopBar ? null : <TopBar />}
        <main className={styles.content}>
          <DomainSkinOutlet>
            <Outlet />
          </DomainSkinOutlet>
        </main>
      </AsyncJobsProvider>
    </div>
  );
}
