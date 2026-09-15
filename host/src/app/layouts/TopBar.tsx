import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { ChevronDown, LogOut, Search, Settings, ShieldCheck, User } from 'lucide-react';
import { useSession } from '@/session/SessionProvider';
import { prefetchRouteByKey } from '@/app/router/prefetch';
import { SearchOverlay } from '@/pages/browse/SearchOverlay';
import styles from './TopBar.module.css';

/**
 * 顶部导航栏 (Darkroom Minimal Bar)
 *
 * - 站点 Logo FMBY（链接首页）
 * - 一级导航（首页 / 媒体库 / 观看历史 / 管理中心）
 * - 全局搜索触发器（支持 Ctrl/Cmd + K 快捷键调起 SearchOverlay）
 * - 用户菜单（个人设置 / 退出登录）
 */
export function TopBar() {
  const { user, logout, hasCapability } = useSession();
  const isAdmin = hasCapability('manage:access');
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 全局快捷键 Cmd/Ctrl + K 打开搜索
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // 点击外部关闭用户菜单
  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const displayName = user?.display_name || user?.name || '未登录';

  function handleLogout() {
    setMenuOpen(false);
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <>
      <header className={styles.topbar}>
        <div className={styles.container}>
          <div className={styles.leftArea}>
            <Link to="/" className={styles.brand}>
              FMBY
            </Link>

            <nav className={styles.nav} aria-label="主导航">
              <NavLink
                to="/"
                end
                className={({ isActive }) => (isActive ? styles.navLinkActive : styles.navLink)}
              >
                首页
              </NavLink>
              <NavLink
                to="/libraries"
                onMouseEnter={() => prefetchRouteByKey('libraries')}
                onFocus={() => prefetchRouteByKey('libraries')}
                className={({ isActive }) => (isActive ? styles.navLinkActive : styles.navLink)}
              >
                媒体库
              </NavLink>
              <NavLink
                to="/history"
                onMouseEnter={() => prefetchRouteByKey('history')}
                onFocus={() => prefetchRouteByKey('history')}
                className={({ isActive }) => (isActive ? styles.navLinkActive : styles.navLink)}
              >
                观看历史
              </NavLink>
              {isAdmin ? (
                <NavLink
                  to="/manage"
                  onMouseEnter={() => prefetchRouteByKey('manageOverview')}
                  onFocus={() => prefetchRouteByKey('manageOverview')}
                  className={({ isActive }) => (isActive ? styles.navLinkActive : styles.navLink)}
                >
                  <span className={styles.adminNavText}>管理中心</span>
                </NavLink>
              ) : null}
            </nav>
          </div>

          <div className={styles.rightArea}>
            <button
              type="button"
              className={styles.searchTrigger}
              onClick={() => setSearchOpen(true)}
              aria-label="全局搜索"
            >
              <Search size={14} className={styles.searchIcon} />
              <span className={styles.searchLabel}>搜索媒体…</span>
              <kbd className={styles.searchKbd}>
                <span>Ctrl</span> K
              </kbd>
            </button>

            <div className={styles.userMenu} ref={menuRef}>
              <button
                type="button"
                className={styles.userButton}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((prev) => !prev)}
              >
                <span className={styles.avatar}>
                  <User size={14} />
                </span>
                <span className={styles.userName}>{displayName}</span>
                <ChevronDown
                  size={13}
                  className={menuOpen ? styles.chevronOpen : styles.chevron}
                />
              </button>

              {menuOpen ? (
                <div className={styles.dropdown} role="menu">
                  {isAdmin ? (
                    <>
                      <Link
                        to="/manage"
                        role="menuitem"
                        className={styles.dropdownItem}
                        onClick={() => setMenuOpen(false)}
                      >
                        <ShieldCheck size={15} />
                        管理中心
                      </Link>
                      <div className={styles.divider} />
                    </>
                  ) : null}
                  <Link
                    to="/settings/profile"
                    role="menuitem"
                    className={styles.dropdownItem}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Settings size={15} />
                    个人设置
                  </Link>
                  <div className={styles.divider} />
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.dropdownItemDanger}
                    onClick={handleLogout}
                  >
                    <LogOut size={15} />
                    退出登录
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

