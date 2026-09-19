import { useState } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import {
  Activity,
  BarChart3,
  CalendarCheck,
  Globe,
  FileText,
  Film,
  FolderHeart,
  HardDrive,
  Info,
  KeyRound,
  LayoutDashboard,
  Library,
  Menu,
  Monitor,
  ScrollText,
  Search,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link, Outlet, useLocation } from 'react-router';
import { prefetchRouteByKey, routeLoaders } from '@/app/router/prefetch';
import styles from './ManageLayout.module.css';

interface ManageNavNode {
  id: string;
  label: string;
  icon?: LucideIcon;
  to?: string;
  exact?: boolean;
  children?: ManageNavNode[];
}

/** 管理侧边导航树（与路由结构对齐）。 */
const manageNavTree: ManageNavNode[] = [
  { id: 'overview', label: '管理首页', icon: LayoutDashboard, to: '/manage', exact: true },
  { id: 'add-media', label: '添加媒体', icon: HardDrive, to: '/manage/media/add' },
  { id: 'task-center', label: '任务中心', icon: Activity, to: '/manage/task-center' },
  {
    id: 'media',
    label: '媒体与刮削',
    icon: Film,
    children: [
      { id: 'media-items', label: '媒体条目', icon: Film, to: '/manage/media/items' },
      { id: 'media-libraries', label: '媒体库', icon: Library, to: '/manage/media/libraries' },
      { id: 'media-mounts', label: '媒体来源', icon: HardDrive, to: '/manage/media/mounts' },
      { id: 'media-probe-tasks', label: '媒体信息检测', icon: Search, to: '/manage/media/probe-tasks' },
      { id: 'media-naming-scrape', label: '命名与刮削', icon: SlidersHorizontal, to: '/manage/media/naming-scrape' },
      { id: 'media-collections', label: '收藏合集', icon: FolderHeart, to: '/manage/collections' },
    ],
  },
  {
    id: 'content-ops',
    label: '内容与运营',
    icon: Activity,
    children: [
      { id: 'media-reviews', label: '媒体审核工单', icon: ShieldCheck, to: '/manage/media-reviews' },
      { id: 'operations', label: '运营看板', icon: BarChart3, to: '/manage/operations' },
      { id: 'events', label: '事件中心', icon: Activity, to: '/manage/events' },
      { id: 'upstreams', label: '上游源', icon: Globe, to: '/manage/upstreams' },
    ],
  },
  {
    id: 'site',
    label: '用户与站点',
    icon: Settings,
    children: [
      {
        id: 'site-users',
        label: '邀请与用户',
        icon: Users,
        children: [
          { id: 'site-registration-codes', label: '邀请与注册码', icon: KeyRound, to: '/manage/site/users/registration-codes' },
          { id: 'site-accounts', label: '用户账号', icon: Users, to: '/manage/site/users/accounts' },
          { id: 'site-role-templates', label: '权限模板', icon: Library, to: '/manage/site/users/role-templates' },
          { id: 'site-rewards', label: '积分与签到', icon: CalendarCheck, to: '/manage/site/rewards' },
        ],
      },
      {
        id: 'site-security',
        label: '会话与日志',
        icon: Shield,
        children: [
          { id: 'site-sessions', label: '当前会话', icon: Monitor, to: '/manage/site/security/sessions' },
          { id: 'site-audit-logs', label: '操作记录', icon: ScrollText, to: '/manage/site/security/audit-logs' },
          { id: 'site-runtime-logs', label: '运行日志', icon: FileText, to: '/manage/site/security/runtime-logs' },
        ],
      },
      { id: 'site-settings', label: '站点设置', icon: Settings, to: '/manage/site/settings' },
      { id: 'site-license', label: '授权与订阅', icon: ShieldCheck, to: '/manage/site/license' },
      { id: 'site-telegram-bot', label: 'Telegram Bot 配置', icon: Send, to: '/manage/site/telegram' },
      { id: 'site-secrets', label: '密钥链管理', icon: KeyRound, to: '/manage/site/secrets' },
      { id: 'site-advanced', label: '高级维护', icon: SlidersHorizontal, to: '/manage/site/advanced' },
      { id: 'system-about', label: '系统关于', icon: Info, to: '/manage/system-about' },
    ],
  },
];

function isNodeActive(pathname: string, node: ManageNavNode): boolean {
  if (node.to) {
    if (node.exact) {
      return pathname === node.to;
    }
    if (pathname === node.to || pathname.startsWith(`${node.to}/`)) {
      return true;
    }
  }
  return (node.children ?? []).some((child) => isNodeActive(pathname, child));
}

function findActiveNode(nodes: ManageNavNode[], pathname: string): ManageNavNode | null {
  for (const node of nodes) {
    if (node.to && isNodeActive(pathname, node)) {
      return node;
    }
    if (node.children) {
      const child = findActiveNode(node.children, pathname);
      if (child) {
        return child;
      }
    }
  }
  return null;
}

/** FE-OPT-01：路径 → 预取 key 映射（与 manageNavTree/路由同步登记）。 */
const PATH_PREFETCH_KEYS: Record<string, keyof typeof routeLoaders> = {
  '/manage/site/settings': 'manageSiteSettings',
  '/manage': 'manageOverview',
  '/manage/task-center': 'manageTaskCenter',
  '/manage/media/add': 'manageAddMedia',
  '/manage/media/items': 'manageMediaItems',
  '/manage/media/libraries': 'manageLibraries',
  '/manage/media/mounts': 'manageMounts',
  '/manage/media/probe-tasks': 'manageProbeTasks',
  '/manage/media/naming-scrape': 'manageNamingRules',
  '/manage/collections': 'manageCollections',
  '/manage/media-reviews': 'manageMediaReviews',
  '/manage/operations': 'manageOperations',
  '/manage/system-about': 'manageSystemAbout',
  '/manage/events': 'manageEvents',
  '/manage/upstreams': 'manageUpstreams',
  '/manage/site/users/registration-codes': 'manageRegistrationCodes',
  '/manage/site/users/accounts': 'manageUsers',
  '/manage/site/users/role-templates': 'manageRoleTemplates',
  '/manage/site/rewards': 'manageRewards',
  '/manage/site/security/sessions': 'manageSessions',
  '/manage/site/security/audit-logs': 'manageAuditLogs',
  '/manage/site/security/runtime-logs': 'manageRuntimeLogs',
  '/manage/site/telegram': 'manageTelegram',
  '/manage/site/secrets': 'manageSecrets',
  '/manage/site/license': 'manageLicense',
};

/** FE-OPT-01：hover/focus 预取（侧栏树叶子节点复用）。 */
function prefetchByPath(path: string): void {
  const key = PATH_PREFETCH_KEYS[path];
  if (key) prefetchRouteByKey(key);
}

function NavLeaf({
  node,
  pathname,
  level,
  onNavigate,
}: {
  node: ManageNavNode;
  pathname: string;
  level: number;
  onNavigate?: () => void;
}) {
  if (!node.to) {
    return null;
  }
  const Icon = node.icon;
  const active = isNodeActive(pathname, node);
  return (
    <Link
      to={node.to}
      className={styles.navLink}
      data-active={active ? 'true' : undefined}
      style={{ paddingLeft: `${level * 12 + 12}px` }}
      onClick={onNavigate}
      onMouseEnter={() => node.to && prefetchByPath(node.to)}
      onFocus={() => node.to && prefetchByPath(node.to)}
      aria-current={active ? 'page' : undefined}
    >
      {Icon ? <Icon size={16} className={styles.navIcon} aria-hidden="true" /> : null}
      <span>{node.label}</span>
    </Link>
  );
}

function NavBranch({
  nodes,
  pathname,
  level = 0,
  onNavigate,
}: {
  nodes: ManageNavNode[];
  pathname: string;
  level?: number;
  onNavigate?: () => void;
}) {
  return (
    <>
      {nodes.map((node) => {
        if (node.children && node.children.length > 0) {
          const Icon = node.icon;
          return (
            <div
              key={node.id}
              className={styles.subGroup}
              data-active={isNodeActive(pathname, node) ? 'true' : undefined}
            >
              <div className={styles.subGroupTitle}>
                {Icon ? <Icon size={15} className={styles.navIcon} aria-hidden="true" /> : null}
                <span>{node.label}</span>
              </div>
              <div className={styles.subGroupBody}>
                <NavBranch nodes={node.children} pathname={pathname} level={level + 1} onNavigate={onNavigate} />
              </div>
            </div>
          );
        }
        return <NavLeaf key={node.id} node={node} pathname={pathname} level={level} onNavigate={onNavigate} />;
      })}
    </>
  );
}

function ManageSidenav({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const activeNode = findActiveNode(manageNavTree, location.pathname);
  const overviewNode = manageNavTree.find((node) => node.id === 'overview');
  const branchNodes = manageNavTree.filter((node) => node.id !== 'overview');

  return (
    <aside className={styles.rail} aria-label="管理中心导航">
      <div className={styles.railHero}>
        <span className={styles.railEyebrow}>FMBY Admin</span>
        <strong className={styles.railTitle}>管理工作台</strong>
        <span className={styles.railHint}>当前模块：{activeNode?.label ?? '管理首页'}</span>
      </div>

      <nav className={styles.navTree} aria-label="管理中心导航">
        {overviewNode ? (
          <div className={styles.overviewCard}>
            <NavLeaf node={overviewNode} pathname={location.pathname} level={0} onNavigate={onNavigate} />
          </div>
        ) : null}

        {branchNodes.map((node) => {
          const Icon = node.icon;
          return (
            <section
              key={node.id}
              className={styles.navCard}
              data-active={isNodeActive(location.pathname, node) ? 'true' : undefined}
            >
              <div className={styles.navCardHeader}>
                {Icon ? <Icon size={16} aria-hidden="true" /> : null}
                <span>{node.label}</span>
              </div>
              <div className={styles.navCardBody}>
                {node.children ? (
                  <NavBranch nodes={node.children} pathname={location.pathname} onNavigate={onNavigate} />
                ) : (
                  <NavLeaf node={node} pathname={location.pathname} level={0} onNavigate={onNavigate} />
                )}
              </div>
            </section>
          );
        })}
      </nav>
    </aside>
  );
}

/**
 * 管理后台布局：桌面端左侧 Sidenav + 内容区；移动端顶部模块切换 + 抽屉导航。
 */
export function ManageLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  const activeModuleLabel = findActiveNode(manageNavTree, location.pathname)?.label ?? '管理首页';

  return (
    <div className={styles.shell} data-surface="manage">
      <div className={styles.desktopRail}>
        <ManageSidenav />
      </div>

      <div className={styles.workspace}>
        <RadixDialog.Root open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <div className={styles.mobileBar}>
            <RadixDialog.Trigger asChild>
              <button
                className={styles.mobileTrigger}
                type="button"
                aria-label={`切换管理模块，当前模块：${activeModuleLabel}`}
              >
                <span className={styles.mobileTriggerText}>
                  <span className={styles.mobileTriggerEyebrow}>当前模块</span>
                  <strong className={styles.mobileTriggerTitle}>{activeModuleLabel}</strong>
                </span>
                <span className={styles.mobileTriggerAction}>
                  切换模块
                  <Menu size={16} aria-hidden="true" />
                </span>
              </button>
            </RadixDialog.Trigger>
          </div>

          <RadixDialog.Portal>
            <RadixDialog.Overlay className={styles.mobileOverlay} />
            <RadixDialog.Content className={styles.mobileDrawer}>
              <div className={styles.mobileDrawerHeader}>
                <div className={styles.mobileDrawerTitleBlock}>
                  <span className={styles.mobileTriggerEyebrow}>管理导航</span>
                  <RadixDialog.Title className={styles.mobileDrawerTitle}>切换管理模块</RadixDialog.Title>
                  <RadixDialog.Description className={styles.mobileDrawerDescription}>
                    当前模块：{activeModuleLabel}。选择目标后将自动关闭导航抽屉。
                  </RadixDialog.Description>
                </div>
                <RadixDialog.Close asChild>
                  <button className={styles.mobileClose} type="button" aria-label="关闭管理导航">
                    <X size={18} aria-hidden="true" />
                  </button>
                </RadixDialog.Close>
              </div>
              <div className={styles.mobileDrawerBody}>
                <ManageSidenav onNavigate={() => setMobileNavOpen(false)} />
              </div>
            </RadixDialog.Content>
          </RadixDialog.Portal>
        </RadixDialog.Root>

        <div className={styles.contentSurface}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default ManageLayout;
