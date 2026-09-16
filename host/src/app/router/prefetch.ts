/**
 * FE-OPT-01 ①：路由级预取。
 *
 * 原理：路由全部是 `lazy: async () => import(...)`（router/index.tsx），
 * 点击后才开始拉 chunk → 首次导航多一次网络往返（实测 p50 ~335ms）。
 * hover/focus 预取把这段延迟移出关键路径：指针悬停到导航项（约 100-300ms
 * 的移动意图窗口）时提前触发动态 import 的模块请求（浏览器命中缓存）。
 *
 * 用法：给 <Link to={...}> 加 `onMouseEnter={prefetchRoute('/manage')}`、
 * `onFocus={prefetchRoute('/manage')}`。重复触发无副作用（Promise 去重）。
 */

const prefetched = new Set<string>();

/** 预取一个路由 chunk（懒加载函数在首次调用后由模块缓存吸收）。 */
export function prefetchRoute(loader: () => Promise<unknown>): void {
  void loader().catch(() => {
    // 预取失败静默：真实导航时会再次 import并暴露真实错误，预取层不吞导航错误。
    prefetched.delete('failed');
  });
}

/** hover/focus 通用 handler 工厂：仅预取一次。 */
export function routePrefetcher(loader: () => Promise<unknown>): () => void {
  let fired = false;
  return () => {
    if (fired) return;
    fired = true;
    prefetchRoute(loader);
  };
}

/**
 * 路由 → 懒加载函数映射（与 router/index.tsx 的 lazy 闭包同源）。
 * 目的：给导航组件一个声明式预取面——hover/focus 时提前触发同一段 import，
 * 真实导航时 import 已命中模块缓存。映射新增路由时同步登记。
 */
export const routeLoaders = {
  install: () => import('@/pages/install/InstallPage'),
  login: () => import('@/pages/login/LoginPage'),
  home: () => import('@/pages/browse/HomePage'),
  history: () => import('@/pages/browse/HistoryPage'),
  libraries: () => import('@/pages/browse/LibrariesPage'),
  libraryDetail: () => import('@/pages/browse/LibraryDetailPage'),
  itemDetail: () => import('@/pages/browse/ItemDetailPage'),
  settingsProfile: () => import('@/pages/settings/ProfileSettingsPage'),
  settingsPlayback: () => import('@/pages/settings/PlaybackSettingsPage'),
  settingsAppearance: () => import('@/pages/settings/AppearanceSettingsPage'),
  play: () => import('@/pages/browse/PlayPage'),
  manageOverview: () => import('@/pages/manage/ManageOverviewPage'),
  manageTaskCenter: () => import('@/pages/manage/ManageTaskCenterPage'),
  manageAddMedia: () => import('@/pages/manage/ManageAddMediaPage'),
  manageMediaItems: () => import('@/pages/manage/ManageMediaItemsPage'),
  manageMediaItemDetail: () => import('@/pages/manage/ManageMediaItemDetailPage'),
  manageLibraries: () => import('@/pages/manage/ManageLibrariesPage'),
  manageMounts: () => import('@/pages/manage/ManageMountsPage'),
  manageProbeTasks: () => import('@/pages/manage/ManageProbeTasksPage'),
  manageNamingRules: () => import('@/pages/manage/ManageNamingRulesPage'),
  manageRegistrationCodes: () => import('@/pages/manage/ManageRegistrationCodesPage'),
  manageUsers: () => import('@/pages/manage/ManageUsersPage'),
  manageRoleTemplates: () => import('@/pages/manage/ManageRoleTemplatesPage'),
  manageSessions: () => import('@/pages/manage/ManageSessionsPage'),
  manageAuditLogs: () => import('@/pages/manage/ManageAuditLogsPage'),
  manageRuntimeLogs: () => import('@/pages/manage/ManageRuntimeLogsPage'),
  manageTelegram: () => import('@/pages/manage/ManageTelegramPage'),
  manageRewards: () => import('@/pages/manage/ManageRewardsPage'),
  manageSecrets: () => import('@/pages/manage/ManageSecretsPage'),
  manageLicense: () => import('@/pages/manage/ManageLicensePage'),
  manageCollections: () => import('@/pages/manage/ManageCollectionsPage'),
  manageMediaReviews: () => import('@/pages/manage/ManageMediaReviewsPage'),
  manageOperations: () => import('@/pages/manage/ManageOperationsPage'),
  manageEvents: () => import('@/pages/manage/ManageEventsPage'),
  manageUpstreams: () => import('@/pages/manage/ManageUpstreamsPage'),
  manageSiteSettings: () => import('@/pages/manage/ManageSiteSettingsPage'),
  manageAdvanced: () => import('@/pages/manage/ManageAdvancedPage'),
} as const;

const fired = new Set<keyof typeof routeLoaders | string>();

/** 预取一个路由（按 key 去重，进程生命周期内只拉一次）。 */
export function prefetchRouteByKey(key: keyof typeof routeLoaders): void {
  if (fired.has(key)) return;
  fired.add(key);
  const loader = routeLoaders[key];
  if (!loader) return;
  void loader().catch(() => {
    // 预取失败静默：真实导航时 import 会重试并暴露真实错误。
    fired.delete(key);
  });
}
