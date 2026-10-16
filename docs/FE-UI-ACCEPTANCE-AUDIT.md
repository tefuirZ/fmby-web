# FE-UI-ACCEPTANCE-AUDIT —— Web UI 清单逐项验收审计

> 审计：fe01 · 分支 `docs/fe-ui-acceptance-audit` · base `origin/main` @ `e0de275`
> 时间：2026-10-15 · 真跑原文见 §7 · 缺口分级见 §6
> 卡面：对「按钮 / 表格 / 表单 / CRUD / 列表 / 海报 / 海报墙」七类逐项验收 → 每项「实现文件:行 · 是否可用 · 缺口」+ 真跑前端测试与 typecheck。

---

## §1 范围与方法

- **页面**：52 个路由级组件（router `lazy` 动态导入）——管理面 36 / 浏览面 10 / 设置 5 / 登录+安装 2。全清单见 §5。
- **七类**：按钮 · 表格 · 表单 · CRUD · 列表 · 海报 · 海报墙。
- **手段**：codegraph 定位符号（禁 grep）→ 逐文件逐标签静态清点 → **真跑**（`pnpm typecheck` / `pnpm test` / `node --test tests/*.test.ts` / `playwright`）。
- **判定口径**（不造假）：
  - *是否可用* = 有真实实现 + 接线到契约端点 + 具备装载/空/错误态（或对只读面显式说明不需要）；
  - 失败一律三分并各给证据：**产品缺陷** / **测试陈旧** / **环境（基建）**。

---

## §2 结论汇总

| 类别 | 规模 | 可用性 | 缺口 |
|---|---|---|---|
| **表格** | 58 张（37 文件接 roving） | ✅ 可用 | 3 张裸表无任何 a11y 标注（`ManageCasPage`）；52 张「仅容器 region 有名、表本身无名」（本仓既定范式） |
| **表单** | 21 个 `<form>`（+ 大量抽屉内联表单） | ✅ 可用 | 仅 1 处用 react-hook-form+zod（依赖已声明），其余手写受控态；校验风格不统一 |
| **CRUD** | ~56 文件含 `useMutation` | ✅ 可用 | 破坏性操作 33 文件有确认门控；CAS 写面后端未就绪（设计为禁用+提示，不造假） |
| **列表** | `<ul>`/`role=list` 15 处 + 媒体网格/横轨 | ✅ 可用 | 媒体列表用 div 网格（非语义 list），屏幕阅读器不播报「列表」语义 |
| **海报** | `usePosterUrl` + 8 个卡片组件 | ✅ 可用 | 见 §3.5 |
| **海报墙** | `BrowseRail`(首页横轨) + `VirtualizedLibraryDetailGrid`(库详情) + 主题 `card-wall`(darkroom) | ✅ 可用 | 主题皮肤态机测试陈旧（本轮已修，见 §6.2） |
| **按钮** | 477 个 `<button>` | ✅ 可用 | 31 个带 `aria-label`；其余靠可见文本给可访问名（图标按钮已单独标注） |

---

## §3 逐类明细

### 3.1 表格 —— 全量 58 张清单

共 58 张 <table>

| # | 文件:行 | roving | table role | 容器 region 标注 |
|---|---|---|---|---|
| 1 | `manage/CasContentListPage.tsx:81` | — | - | CAS 内容列表（可横向滚动） |
| 2 | `manage/ManageSessionsPage.tsx:138` | ✅ | - | 会话管理（可横向滚动） |
| 3 | `manage/ManageMediaReviewsPage.tsx:199` | ✅ | - | 审核队列（可横向滚动） |
| 4 | `manage/ManageSecretsPage.tsx:180` | ✅ | - | 密钥链状态列表（可横向滚动） |
| 5 | `manage/ManageSystemAboutPage.tsx:149` | ✅ | - | 链接（可横向滚动） |
| 6 | `manage/ManageSystemAboutPage.tsx:164` | ✅ | - | 链接（可横向滚动） |
| 7 | `manage/ManageSystemAboutPage.tsx:185` | ✅ | - | 链接（可横向滚动） |
| 8 | `manage/ManageEventsPage.tsx:164` | ✅ | treegrid | 事件列表（可横向滚动） |
| 9 | `manage/ManageEventsPage.tsx:321` | ✅ | - | 事件列表（可横向滚动） |
| 10 | `manage/ManageEventsPage.tsx:353` | ✅ | - | 事件列表（可横向滚动） |
| 11 | `manage/CasPublishOrchestrationPage.tsx:90` | — | - | 扇出进度与失败原因（可横向滚动） |
| 12 | `manage/CasPublishOrchestrationPage.tsx:178` | — | - | 扇出进度与失败原因（可横向滚动） |
| 13 | `manage/ManageCasPage.tsx:156` | ✅ | - | - |
| 14 | `manage/ManageCasPage.tsx:252` | ✅ | - | - |
| 15 | `manage/ManageCasPage.tsx:350` | ✅ | - | - |
| 16 | `manage/ManageOperationsPage.tsx:166` | ✅ | - | 挂载负载（可横向滚动） |
| 17 | `manage/ManageOperationsPage.tsx:197` | ✅ | - | 挂载负载（可横向滚动） |
| 18 | `manage/ManageOperationsPage.tsx:245` | ✅ | - | 挂载负载（可横向滚动） |
| 19 | `manage/ManageOperationsPage.tsx:279` | ✅ | - | 挂载负载（可横向滚动） |
| 20 | `manage/ManageOperationsPage.tsx:329` | ✅ | - | 挂载负载（可横向滚动） |
| 21 | `manage/ManageAuditLogsPage.tsx:107` | ✅ | - | 操作记录（可横向滚动） |
| 22 | `manage/rewards/RewardsLedgerSection.tsx:83` | ✅ | - | 积分流水（可横向滚动） |
| 23 | `manage/microsoft/MicrosoftAccountsSection.tsx:47` | ✅ | - | 已授权账号（可横向滚动） |
| 24 | `manage/microsoft/MicrosoftAccountsSection.tsx:102` | ✅ | - | 已授权账号（可横向滚动） |
| 25 | `manage/microsoft/MicrosoftOAuthSection.tsx:294` | ✅ | - | SharePoint 站点列表（可横向滚动） |
| 26 | `manage/microsoft/MicrosoftOAuthSection.tsx:317` | ✅ | - | SharePoint 站点列表（可横向滚动） |
| 27 | `manage/yun139/Yun139ProfilesSection.tsx:112` | ✅ | - | 凭据档案（可横向滚动） |
| 28 | `manage/mounts/components/MountTableDesktopTable.tsx:70` | ✅ | - | 来源列表（可横向滚动） |
| 29 | `manage/task-center/components/TaskCenterList.tsx:50` | ✅ | - | 任务列表（可横向滚动） |
| 30 | `manage/users/components/UserTable.tsx:161` | ✅ | - | 账号列表（可横向滚动） |
| 31 | `manage/auth-providers/AuthProvidersSection.tsx:128` | ✅ | - | 提供方配置（可横向滚动） |
| 32 | `manage/auth-providers/ProviderDiagnosticsCard.tsx:131` | ✅ | - | 自检步骤（可横向滚动） |
| 33 | `manage/registration-codes/components/RegistrationCodeDetailTable.tsx:41` | ✅ | - | 注册码详情（可横向滚动） |
| 34 | `manage/naming-rules/ai-intervention/components/AiInterventionThreadList.tsx:124` | ✅ | - | AI 干预线程（可横向滚动） |
| 35 | `manage/naming-rules/ai-intervention/components/AiInterventionDetailPanel.tsx:216` | ✅ | - | 干预运行记录（可横向滚动） |
| 36 | `manage/collections/components/CollectionListTable.tsx:121` | ✅ | treegrid | 合集列表（可横向滚动） |
| 37 | `manage/collections/components/CollectionMemberPanel.tsx:80` | ✅ | - | 合集成员明细（可横向滚动） |
| 38 | `manage/libraries/components/LibraryTable.tsx:128` | ✅ | - | 媒体库列表（可横向滚动） |
| 39 | `manage/probe-tasks/components/ProbeTaskTable.tsx:112` | ✅ | - | 探测任务列表（可横向滚动） |
| 40 | `manage/upstreams/UpstreamSyncJobsSection.tsx:168` | ✅ | - | Emby 导入作业（可横向滚动） |
| 41 | `manage/upstreams/UpstreamSyncJobsSection.tsx:197` | ✅ | - | Emby 导入作业（可横向滚动） |
| 42 | `manage/upstreams/UpstreamBindingsSection.tsx:180` | ✅ | - | 当前生效绑定（可横向滚动） |
| 43 | `manage/upstreams/UpstreamBindingsSection.tsx:285` | ✅ | - | 当前生效绑定（可横向滚动） |
| 44 | `manage/upstreams/UpstreamSourceListSection.tsx:154` | ✅ | - | 上游源列表（可横向滚动） |
| 45 | `manage/upstreams/UpstreamSourceListSection.tsx:222` | ✅ | - | 上游源列表（可横向滚动） |
| 46 | `manage/upstreams/UpstreamMappingPresetsSection.tsx:183` | ✅ | - | 映射预设（可横向滚动） |
| 47 | `manage/upstreams/UpstreamMappingWizardSection.tsx:289` | ✅ | - | 预览结果（可横向滚动） |
| 48 | `manage/runtime-logs/RuntimeLogsDesktopTable.tsx:26` | — | - | 运行日志（可横向滚动） |
| 49 | `manage/runtime-logs/RuntimeLogArchivesSection.tsx:84` | ✅ | - | 日志归档列表（可横向滚动） |
| 50 | `manage/media-item-detail/components/RemoteAssetsTable.tsx:29` | ✅ | - | 随文件资源（可横向滚动） |
| 51 | `manage/media-reviews/components.tsx:81` | ✅ | - | 候选媒体（可横向滚动） |
| 52 | `manage/media-items/components/MediaItemListTable.tsx:69` | ✅ | - | 媒体资源列表（可横向滚动） |
| 53 | `manage/pan115-share/components/SyncSection.tsx:163` | ✅ | - | 最近同步任务（可横向滚动） |
| 54 | `manage/pan115-share/components/SyncSection.tsx:186` | ✅ | - | 最近同步任务（可横向滚动） |
| 55 | `manage/pan115-share/components/ShareItemBrowseSection.tsx:34` | ✅ | - | 浏览结果（可横向滚动） |
| 56 | `manage/pan115-share/components/PreviewBrowseSection.tsx:101` | ✅ | - | 网盘目录浏览结果（可横向滚动） |
| 57 | `manage/operations/OperationsGapSections.tsx:112` | ✅ | - | 播放记录（可横向滚动） |
| 58 | `manage/operations/OperationsGapSections.tsx:209` | ✅ | - | 播放记录（可横向滚动） |


**结论**：58 张全部接线可用（37 个文件接 `useTableRowRoving` 行漫游；其余为只读/静态表，按既定裁定不给 Enter 语义）。容器 `role="region"`+`aria-label` 覆盖 55/58。

**缺口**：
1. ~~**`manage/ManageCasPage.tsx` 3 张裸表**~~ —— **✅ 本轮已修**（`:159` / `:255` / `:353` 补 `aria-label`，名取所在卡片标题；并加契约 ⑤ 守卫，见 §7）。
   *残留*：这 3 张仍无 `.tableWrap` 包裹（无横向滚动保护）——a11y **名**的缺口已闭合，**窄视口溢出保护**仍缺，建议另卡（属视觉/响应式，需浏览器实测）。
2. **52 张表「表本身无可访问名」**：本仓范式把名字放在外层 `.tableWrap` 的 `role=region aria-label`，`<table>` 无 `caption`/`aria-label` ⇒ AT 会播报「表」但无名称。属**既定范式**（PR #29/#34/#44 有意如此），记录为已知边界，非缺陷。

### 3.2 表单 —— 21 个 `<form>`

| # | 文件:行 | noValidate |
|---|---|---|
| 1 | `pages/settings/IdentityBindingsSettingsPage.tsx:238` | — |
| 2 | `pages/settings/IdentityBindingsSettingsPage.tsx:310` | — |
| 3 | `pages/install/InstallPage.tsx:235` | — |
| 4 | `pages/login/forms/SetupForm.tsx:49` | 是 |
| 5 | `pages/login/forms/ForgotPasswordForm.tsx:114` | 是 |
| 6 | `pages/login/forms/ForgotPasswordForm.tsx:158` | 是 |
| 7 | `pages/login/forms/MfaVerifyPanel.tsx:77` | — |
| 8 | `pages/login/forms/RegisterForm.tsx:62` | 是 |
| 9 | `pages/login/forms/LoginForm.tsx:47` | 是 |
| 10 | `pages/login/forms/ResetPasswordForm.tsx:69` | 是 |
| 11 | `pages/login/forms/IdentityLoginPanel.tsx:124` | — |
| 12 | `pages/login/forms/IdentityCompletionPanel.tsx:183` | — |
| 13 | `pages/manage/ManageTelegramPage.tsx:253` | — |
| 14 | `pages/manage/ManageRewardsPage.tsx:155` | — |
| 15 | `pages/manage/ManageRewardsPage.tsx:237` | — |
| 16 | `pages/manage/developer-api/DeveloperEndpointsSection.tsx:80` | — |
| 17 | `pages/manage/license/components/ActivationTokenCard.tsx:48` | — |
| 18 | `pages/manage/users/components/ResetUserPasswordDialog.tsx:96` | — |
| 19 | `pages/manage/email-channel/EmailChannelConfigSection.tsx:69` | — |
| 20 | `pages/manage/pan115-share/components/ShareItemBrowseSection.tsx:75` | — |
| 21 | `pages/manage/pan115-share/components/PreviewBrowseSection.tsx:54` | — |

**结论**：全部可用。登录/注册/找回/重置集中在 `pages/login/forms/*`（`noValidate` + 自研校验），管理面表单分布在各自页面/子组件。

**缺口**：`package.json` 声明了 `react-hook-form` + `zod`，但**仅 `manage/license/schemas.ts` 使用**——其余 20 个表单是手写受控态 + 自研校验。功能可用，但**校验风格/错误呈现不统一**（有的用 `InlineBanner`，有的用 `<span>`）。属可维护性债务，非阻断。

### 3.3 CRUD

- **56 个文件含 `useMutation`**（详见盘点：install/login/manage 各域/settings）。
- **破坏性操作**：33 个文件含 `confirmAction`/`sessionConfirmation`/`currentPassword`/`pendingDelete` 门控（删除/重置/换绑/停用等）。
- **可用性**：✅ 全部接线到 `@fmby/v2-shared/contracts/**` 的真实端点。
- **缺口（设计如此，不造假）**：
  - `CasPublishOrchestrationPage`「发起扇出」写面**后端不存在**（考古结论）⇒ 按钮禁用 + 显式提示，**不调用不存在的端点、不伪造成功**（源码注释 `fixme` 明确）。
  - `CasContentListPage`/`ManageCasPage` 部分扇出/对账端点 `unwired` ⇒ 显式「数据面未就绪」提示。
  - 多处 `Manage*Page` 标注「待后端」：`AdvancedPage`/`AuditLogsPage`/`CollectionsPage`/`MediaReviewsPage`/`OperationsPage`/`SessionsPage`/`UpstreamsPage`/`TelegramPage`/`RewardsPage`/`UsersPage(UserTable)`/`CredentialRebindGapSection`。

### 3.4 列表

- 语义列表 `<ul>`/`role=list`：**15 处**（多为导航/元数据列表）。
- 媒体列表用 **div 网格 / 横向轨道**（`VirtualizedLibraryDetailGrid`、`BrowseRail`、`MediaItemCardGrid`）：键盘漫游已接（roving），但**非语义 `<ul>`** ⇒ 读屏器不播报「列表，共 N 项」。属既定实现（虚拟化需要 div）。
- 移动端列表：多页有 `mobileCardList`/`mobileRecordCard` 分支（`ManageEventsPage`/`ManageRuntimeLogsPage`/`RegistrationCodeDetailMobileList` 等），与桌面表并列，二者皆已具名/可聚焦。
- **结论**：✅ 可用。

### 3.5 海报 / 海报墙

**海报取值**（统一入口）：
- `shared/src/hooks/usePosterUrl.ts:58` —— poster URL 解析（含回落，`fallback=True`）。
- `shared/src/contracts/assets/index.ts` —— 资产 URL 契约。

**海报卡片族**（`host/src/pages/browse/components/`）：
| 组件 | 行 | 回落 |
|---|---|---|
| `PosterMediaCard.tsx` | 23 | ✅ onError/fallback |
| `LibraryDetailMediaCard.tsx` | 5 | — |
| `LandscapeMediaCard.tsx` | — | ✅ |
| `WideMediaCard.tsx` | — | ✅ |
| `HeroSpotlight.tsx` | 85 | ✅ |
| `CinemaFilmstrip.tsx` | 58 | ✅ |
| `CinemaHeroBackdrop.tsx` | — | ✅ |
| `MediaItemPosterThumb.tsx`（管理面） | 10 | ✅ |

**海报墙**：
- 首页横轨：`host/src/pages/browse/components/BrowseRail.tsx:14`（`data-browse-rail`，roving 接线，一次性全量渲染无分页）。
- 库详情墙：`host/src/pages/browse/library-detail/VirtualizedLibraryDetailGrid.tsx`（虚拟化网格，由 `LibraryDetailPage.tsx:180` 消费）。
- 主题皮肤墙：`themes/darkroom/src/skins/LibrarySkin.ts:102`（`data-darkroom="card-wall"`）+ `_template` ItemSkin。经 `DomainSkinOutlet`（`host/src/theme/skins/DomainSkinOutlet.ts`）按 `browse.library`/`browse.item` 调度。

**结论**：✅ 可用。海报有统一 URL 入口 + 多卡片组件 + 多回落；海报墙三条路径（首页轨 / 库网格 / 主题皮肤）均接线。
**缺口**：主题皮肤**态机**（loading/ready/empty/error）测试此前陈旧（见 §6.2），修后 9/9 绿。

### 3.6 按钮

- **477 个 `<button>`**；31 个显式 `aria-label`（图标类按钮，如「显示密码」「上移/下移」「全选」）。
- 其余 446 个依赖可见文本给可访问名 —— 经 `tests/manage-a11y-name-scan.test.ts`（DOM 级可访问名扫描）+ `tests/a11y-static-contract.test.ts` 覆盖。
- 装载/禁用态：写操作按钮普遍绑 `disabled={mutation.isPending}` 且文案切换（「保存中…」等）。
- **结论**：✅ 可用。

---

## §4 页面清单（52）

| # | 组件 | 文件 |
|---|---|---|
| 1 | `InstallPage` | `@/pages/install/InstallPage` |
| 2 | `LoginPage` | `@/pages/login/LoginPage` |
| 3 | `HomePage` | `@/pages/browse/HomePage` |
| 4 | `HistoryPage` | `@/pages/browse/HistoryPage` |
| 5 | `LibrariesPage` | `@/pages/browse/LibrariesPage` |
| 6 | `LibraryDetailPage` | `@/pages/browse/LibraryDetailPage` |
| 7 | `ItemDetailPage` | `@/pages/browse/ItemDetailPage` |
| 8 | `PersonDetailPage` | `@/pages/browse/PersonDetailPage` |
| 9 | `CollectionsListPage` | `@/pages/browse/CollectionsListPage` |
| 10 | `CollectionDetailPage` | `@/pages/browse/CollectionDetailPage` |
| 11 | `ProfileSettingsPage` | `@/pages/settings/ProfileSettingsPage` |
| 12 | `RewardsSettingsPage` | `@/pages/settings/RewardsSettingsPage` |
| 13 | `PlaybackSettingsPage` | `@/pages/settings/PlaybackSettingsPage` |
| 14 | `AppearanceSettingsPage` | `@/pages/settings/AppearanceSettingsPage` |
| 15 | `IdentityBindingsSettingsPage` | `@/pages/settings/IdentityBindingsSettingsPage` |
| 16 | `PlayPage` | `@/pages/browse/PlayPage` |
| 17 | `ManageOverviewPage` | `@/pages/manage/ManageOverviewPage` |
| 18 | `ManageTaskCenterPage` | `@/pages/manage/ManageTaskCenterPage` |
| 19 | `ManageMediaReviewsPage` | `@/pages/manage/ManageMediaReviewsPage` |
| 20 | `ManageOperationsPage` | `@/pages/manage/ManageOperationsPage` |
| 21 | `ManageSystemAboutPage` | `@/pages/manage/ManageSystemAboutPage` |
| 22 | `ManageEventsPage` | `@/pages/manage/ManageEventsPage` |
| 23 | `ManageUpstreamsPage` | `@/pages/manage/ManageUpstreamsPage` |
| 24 | `ManageAddMediaPage` | `@/pages/manage/ManageAddMediaPage` |
| 25 | `ManageMediaItemsPage` | `@/pages/manage/ManageMediaItemsPage` |
| 26 | `ManageMediaItemDetailPage` | `@/pages/manage/ManageMediaItemDetailPage` |
| 27 | `ManageLibrariesPage` | `@/pages/manage/ManageLibrariesPage` |
| 28 | `ManageMountsPage` | `@/pages/manage/ManageMountsPage` |
| 29 | `ManageDeveloperApiPage` | `@/pages/manage/developer-api` |
| 30 | `ManageAuthProvidersPage` | `@/pages/manage/auth-providers` |
| 31 | `ManageYun139Page` | `@/pages/manage/yun139` |
| 32 | `ManageMicrosoftPage` | `@/pages/manage/microsoft` |
| 33 | `Pan115SharePage` | `@/pages/manage/pan115-share` |
| 34 | `ManageProbeTasksPage` | `@/pages/manage/ManageProbeTasksPage` |
| 35 | `ManageNamingRulesPage` | `@/pages/manage/ManageNamingRulesPage` |
| 36 | `ManageRegistrationCodesPage` | `@/pages/manage/ManageRegistrationCodesPage` |
| 37 | `ManageUsersPage` | `@/pages/manage/ManageUsersPage` |
| 38 | `ManageRoleTemplatesPage` | `@/pages/manage/ManageRoleTemplatesPage` |
| 39 | `ManageSessionsPage` | `@/pages/manage/ManageSessionsPage` |
| 40 | `ManageAuditLogsPage` | `@/pages/manage/ManageAuditLogsPage` |
| 41 | `ManageRuntimeLogsPage` | `@/pages/manage/ManageRuntimeLogsPage` |
| 42 | `ManageTelegramPage` | `@/pages/manage/ManageTelegramPage` |
| 43 | `ManageEmailChannelPage` | `@/pages/manage/ManageEmailChannelPage` |
| 44 | `ManageCasPage` | `@/pages/manage/ManageCasPage` |
| 45 | `CasContentListPage` | `@/pages/manage/CasContentListPage` |
| 46 | `CasPublishOrchestrationPage` | `@/pages/manage/CasPublishOrchestrationPage` |
| 47 | `ManageRewardsPage` | `@/pages/manage/ManageRewardsPage` |
| 48 | `ManageSecretsPage` | `@/pages/manage/ManageSecretsPage` |
| 49 | `ManageLicensePage` | `@/pages/manage/ManageLicensePage` |
| 50 | `ManageSiteSettingsPage` | `@/pages/manage/ManageSiteSettingsPage` |
| 51 | `ManageAdvancedPage` | `@/pages/manage/ManageAdvancedPage` |
| 52 | `ManageCollectionsPage` | `@/pages/manage/ManageCollectionsPage` |

---

## §5 缺口清单（分级）

### A. 真缺陷 —— 本轮已修（2）

| # | 文件:行 | 缺陷 | 证据 |
|---|---|---|---|
| A1 | `shared/src/contracts/manage/casAdmin/index.ts:1` | `mapCasContentSummary` 本地声明未导出，却被 barrel 再导出 ⇒ **TS2459**，`pnpm typecheck` 在 shared 包直接失败 | §7.1 BEFORE |
| A2 | `host/src/pages/manage/CasPublishOrchestrationPage.tsx:113` | 把对象 `CasContentFingerprint`（sha256/md5/sizeBytes）当 ReactNode 渲染 ⇒ **TS2322** | §7.1 BEFORE（host tsc） |

两处均属 #658 CAS 新代码，**阻塞全部前端 typecheck**。修法：A1 加 `export`（与其余 `mapCas*` 同构）；A2 照 `CasContentListPage.tsx:102` 惯例取 `sha256 ?? md5 ?? '—'`。

### B. 测试陈旧 / 基建（4 项全部已修）

| # | 测试 | 判定 | 处置 |
|---|---|---|---|
| B1 | `a11y-static-contract.test.ts` → `SearchOverlay.tsx:91` | **测试陈旧**（行号漂移：91 行现为 `document.addEventListener`，真正 `<input>` 在 **117** 且**已有** `aria-label="搜索电影、剧集"`）⇒ 产品无缺口 | ✅ 已修行号 91→117 |
| B2 | `theme-skins.test.ts` ready/empty（2 条） | **测试陈旧**（预填 query key `['browse','library','42']` 缺第 4 段 `mediaType`；现 key = `['browse','library',id,mediaType ?? null]`）⇒ 缓存未命中恒 loading，产品态机正常 | ✅ 已修 key 补 `'all'` |
| B3 | `search-overlay-focus.test.ts`（PlaybackSidebar Esc / SearchOverlay 焦点归还） | **环境（基建）**：探针 entry 原用 **bare specifier**（`import from 'react'`）故只能写入仓库树 `host/tests/`；而 `pnpm test` 经 fmby-queue **降权到 tefuir**，仓库树 root:755 ⇒ **EACCES**。直跑（不降权）全绿 | ✅ 已修（#47：entry 落 `os.tmpdir()`，照 `table-row-keynav.test.ts` 先例） |

**B3 后续收敛（2026-10-16 回填）**：该测试原把 entry 写到 `HOST_ROOT/tests/__probeFe02Dom-entry.tsx` ⇒ 经 fmby-queue 降权后写不进 root:755 仓库树、`pnpm test` 对**全部席位**恒红。**已修（#47 已合）**：entry 改落 `mkdtemp(join(os.tmpdir(), 'fe02-dom-'))`，`react`/源码全走**绝对路径** import（注释 `search-overlay-focus.test.ts:101-103` 记录原因），并在收尾 `rm` 整棵 work（同卡另修 `/tmp` 泄漏）。复跑 `pnpm test` 不再 EACCES。

### C. 存量缺口（部分本轮已修）

1. ~~**`ManageCasPage.tsx` 三张裸表无任何 a11y 标注**~~ → **✅ 本轮已修**（补 `aria-label` + 契约 ⑤）。~~残留：三表仍无 `.tableWrap`~~ → **后续已修（#49 已合）**：三表补 `.tableWrap` 横向滚动区（窄视口不再溢出文档）。
2. **52 张表「表本身无名」**：名字只在外层 region（既定范式，非缺陷，记已知边界）。
3. **`react-hook-form`+`zod` 未被使用**（仅 1 文件）：20 个表单手写校验，风格不统一。
4. ~~**B3 的 EACCES**（见上）~~ → **已修（#47 已合）**，见 §5.B 的 B3 后续收敛。

### D. 设计如此（待后端，不造假 —— 非缺陷）

CAS 扇出写面、CAS 内容列表/对账端点、多页「待后端」标注：均按 RB-4 纪律 **fail-closed + 显式提示**，不返回假数据、不调用不存在的端点。

---

## §6 真跑原文（当次，非回忆）

### 6.1 `pnpm typecheck`

**修复前（RED）**：
```
> pnpm -r typecheck

Scope: 4 of 5 workspace projects
shared typecheck$ tsc -p . --noEmit
shared typecheck: src/contracts/manage/casAdmin/index.ts(1,104): error TS2459: Module '"./api"' declares 'mapCasContentSummary' locally, but it is not exported.
shared typecheck: Failed
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @fmby/v2-shared@0.1.0 typecheck: `tsc -p . --noEmit`
Exit status 2
```
host 包单独跑补捉到第二处：
```
src/pages/manage/CasPublishOrchestrationPage.tsx(113,55): error TS2322: Type 'CasContentFingerprint' is not assignable to type 'ReactNode'.
../shared/src/contracts/manage/casAdmin/index.ts(1,104): error TS2459: ...
```
**修复后（GREEN，EXIT=0）**：
```
> pnpm -r typecheck

Scope: 4 of 5 workspace projects
shared typecheck$ tsc -p . --noEmit
shared typecheck: Done
themes/_template typecheck$ tsc -p . --noEmit
themes/darkroom typecheck$ tsc -p . --noEmit
themes/_template typecheck: Done
themes/darkroom typecheck: Done
host typecheck$ tsc -p tsconfig.app.json --noEmit
host typecheck: Done
```

### 6.2 前端测试

**host 直跑（修复后）—— 全绿**：
```
$ cd host && node --import ./tests/register-aliases.mjs --test tests/*.test.ts
ℹ tests 684
ℹ pass 684
ℹ fail 0
ℹ skipped 0
RC=0
```
**`pnpm test`（经 fmby-queue 降权）—— shared/themes 绿，host 因 B3 EACCES 红 2 条**：
```
shared            Done
themes/_template  Done
themes/darkroom   Done
host              Failed   （2 条 = search-overlay-focus 的 PlaybackSidebar Esc / SearchOverlay 焦点归还，
                            原因 EACCES 写 host/tests/__probeFe02Dom-entry.tsx，见 §5 B3）
```
> 修复前 `pnpm test` 的 host 还多挂 3 条（B1×1 + B2×2），均已修。

### 6.3 playwright（e2e，重建 dist 后）

**批量跑**（`a11y-keyboard` + `browse` + `a11y`）：
```
41 passed (4.7m)
1 failed   ← a11y-keyboard（ECONNREFUSED×8：后端在 vite proxy 就绪前未 bind，
              基础设施抖动，与本 PR 无关）
```
**该 spec 单独重跑 3 次 —— 全 PASS**（`ECONNREFUSED 0`）：
```
run 1: PASS | ECONNREFUSED 0
run 2: PASS | ECONNREFUSED 0
run 3: PASS | ECONNREFUSED 0
```
⇒ 批量那次是**后端启动抖动**（15 席共享负载下的已知现象），非产品缺陷；`a11y-keyboard`（登录页 Tab 无陷阱）**稳定绿**。
`a11y.spec.ts`（28 页 axe WCAG 2.1 A/AA）在批量跑中全过。

---

## §7 本轮修复明细（审计发现 → 最小修复）

| 提交 | 内容 |
|---|---|
| `fix(typecheck)` | A1 `casAdmin/api.ts` 给 `mapCasContentSummary` 加 `export`；A2 `CasPublishOrchestrationPage.tsx:113` 按惯例渲染指纹去重键 |
| `fix(test)` | B1 `a11y-static-contract.test.ts` 锚点 91→117；B2 `theme-skins.test.ts` 预填 key 补 `'all'` |
| `fix(a11y)` | C1：`ManageCasPage` 3 张裸表补 `aria-label`（取所在卡片标题）+ 契约 ⑤（全仓 `<table>` 须有名） |
| `docs` | 本审计报告 |

**验证**：`pnpm typecheck` EXIT=0（4 包全 Done）；host 单测 **684/684 全绿**；两测试文件 9/9。

---

## §8 审计边界（诚实声明）

- 本审计是**代码级 + 单测/typecheck 级**验收；**未**逐页做人工浏览器走查（e2e 覆盖 a11y 面 28 页 axe + 若干交互，非全 52 页面功能走查）。
- 「是否可用」判定基于**实现接线 + 契约端点 + 状态覆盖**；真实后端可用性受后端就绪度影响（§5 D 已列待后端项）。
- 表清单/表单清单/页面清单均由脚本从源码生成（可复现），非手抄。
