/**
 * 设置中心布局（暗房）
 *
 * 桌面端：左侧导航 + 右侧内容；移动端：顶部横向滚动导航。
 * 导航结构来自 pages/settings/settingsNavigation。设置中心只放个人偏好，
 * 每一项对所有已登录用户都可见，因此这里不再按能力过滤导航项。
 */
import { NavLink, Outlet } from 'react-router';
import {
  settingsNavGroups,
  type SettingsNavItem,
} from '@/pages/settings/settingsNavigation';
import styles from '@/pages/settings/SettingsCenter.module.css';

function SettingsNavLink({ item }: { item: SettingsNavItem }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
      }
    >
      <span>{item.label}</span>
      <span className={styles.navDescription}>{item.description}</span>
    </NavLink>
  );
}

export function SettingsLayout() {
  return (
    <div className={styles.layout}>
      <aside className={styles.nav} aria-label="设置导航">
        {settingsNavGroups.map((group) => (
          <div className={styles.navGroup} key={group.label}>
            <div className={styles.navLabel}>{group.label}</div>
            {group.items.map((item) => (
              <SettingsNavLink key={item.to} item={item} />
            ))}
          </div>
        ))}
      </aside>

      <div className={styles.main}>
        <nav className={styles.mobileNav} aria-label="设置导航（移动端）">
          {settingsNavGroups.flatMap((group) =>
            group.items.map((item) => <SettingsNavLink key={item.to} item={item} />),
          )}
        </nav>
        <Outlet />
      </div>
    </div>
  );
}

export default SettingsLayout;
