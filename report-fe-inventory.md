# 前端盘点报告 · fe01（只读评估）

> 卡面：`/tmp/brief-fe01.md` ｜ 工作目录 `/data/fmby-seats/fe01`（fmby-web @ origin/main `9496122`）
> V1 考古源：`/data/projects/fmby-main/fmby/apps/web`
> 纪律：**只读**（本报告是唯一写入物；期间 `pnpm install` 建 `node_modules`、`pnpm verify` 与一次性 e2e 真跑属命令执行，未 commit/push；e2e 产生的 `docs/evidence/fe-opt-03/**` 快照改动已 `git checkout --` 还原，临时探针文件已删，`git status --porcelain` 为空）
> 目标：为「10/20 可完整测试 + UI 打磨」提供底账

---

## 0. 一页结论

| 维度 | 结论 |
|---|---|
| 页面/流程 | V2 **50 条真实页面路由**（`host/src/app/router/index.tsx:644`，644 行路由表），对照 V1 46 条 lazy 路由：**39 条 V1 已有面已实现**，**7 条 V1 有/V2 无**（多为主动收敛或后端无端点），**13 条 V1 无/V2 新增** |
| 半成品 | **`_placeholder/PlaceholderPage.tsx` 存在但零引用**（43 行，无页面用它）——桩机制已废但文件未删；**安装向导是最大半成品**（62 行 vs V1 582 行 + 5 个子组件，只接 2/9 端点） |
| UI 打磨 | 既有报告（FE-OPT-01..05 / FE-COLLECTIONS-B1·B2 / FE-LIST-KEYNAV / BUG-SKIN-NAV-01）**9 张全部已合入 main**，功能件均在位。但本次真跑揪出 **5 个真回归/新缺口**（见 §3.2）：手机档 3 页横向溢出、history 3 个 `<select>` 无可访问名、WideMediaCard 链接无名、auth 错误码断言漂移、合集 B2 e2e 恒红 |
| 可测性 | `pnpm verify` **EXIT=0**（12 闸全绿，§4 原文）；`pnpm e2e` 在本席**默认全 skip**（无 server 二进制 → `E2E_ENABLED=false`）。我用 `/data/fmby-build/local-target/debug/` 二进制手工装配真实栈跑通：**108 条用例 80 passed / 26 failed / 2 skipped**，其中 24 条失败是环境（未组装主题产物 + 未设 `FMBY_TRUSTED_ORIGINS`）导致，补齐后降到 **2 条真失败 + 1 条真红（auth 断言漂移）** |
| 最大风险 | **e2e 门禁形同虚设**：`pnpm verify` 不含 e2e；本席 `playwright.config.ts` 的 `webServer` 前置 `pnpm build` 被 fmby-queue 判为重活拒绝（实测 exit 3 / 180s 超时），且默认环境下所有 spec 静默 skip → 「40 passed」「87 passed」这类历史数字在当前机器上**不可复现**，需主代理裁决如何落 CI |

---

## 1. 结构与规模（先摸清）

```
fmby-web/
├── host/     466 源文件 / 59,184 行   —— 路由、布局、守卫、主题调度、全部页面
├── shared/   225 源文件 / 29,107 行   —— contracts + viewmodels + ui + theme 协议 + batch
├── themes/   darkroom(545 行/3 文件) + _template(338 行/2 文件)
├── scripts/  12 个门禁脚本 + e2e(1 py) + perf(2) + release(1)
└── host/e2e/ 18 个 spec / 2,273 行 + host/tests 65 个单测 / 9,039 行
```

页面子树规模（`host/src/pages`）：

| 子树 | 文件 | 行数 |
|---|---|---|
| `browse/` | 64 | 10,030 |
| `manage/` | 353 | 50,728 |
| `settings/` | 11 | 2,243 |
| `login/` | 15 | 2,266 |
| `install/` | **1** | **62** |
| `_placeholder/` | 1 | 43 |

`manage/` 下最大的子树：`mounts` 5,631 / `media-item-detail` 3,867 / `naming-rules` 3,342 / `libraries` 1,812 / `collections` 1,426。

---

## 2. 页面/流程盘点（三张表）

路由唯一权威：`host/src/app/router/index.tsx`（644 行，50 个 lazy 页面 + 若干重定向/遗留别名）。

### 2.1 已实现（真实页面，非重定向）

#### 用户面（browse + settings）

| 路由 | 页面文件 | 行数 | 数据面 | 备注 |
|---|---|---|---|---|
| `/` | `browse/HomePage.tsx` | 287 | viewmodel | 放映厅 |
| `/history` | `browse/HistoryPage.tsx` | 153 | viewmodel | ⚠ 3 个 `<select>` 无可访问名（§3.2 P0-2） |
| `/libraries` | `browse/LibrariesPage.tsx` | 157 | viewmodel | 含拼音搜索真交互（e2e 已验） |
| `/libraries/:libraryId` | `browse/LibraryDetailPage.tsx` | 198 | viewmodel + 虚拟化网格 | 已接方向键漫游 |
| `/item/:itemId` | `browse/ItemDetailPage.tsx` | 186 | 自管 `useItemDetailQueries` | **唯一未走 viewmodel 的 browse 页** |
| `/people/:personId` | `browse/PersonDetailPage.tsx` | 132 | viewmodel | 单页硬上限，无「加载更多」（如实） |
| `/collections` | `browse/CollectionsListPage.tsx` | 149 | viewmodel | V2 新增（FE-USER-COLLECTIONS-LIST-PAGE-2） |
| `/collections/:collectionId` | `browse/CollectionDetailPage.tsx` | 104 | viewmodel | V2 新增 |
| `/play/:itemId` | `browse/PlayPage.tsx` | 381 | viewmodel | 全屏独立布局 |
| `/settings/profile` | `settings/ProfileSettingsPage.tsx` | 171 | 契约层 | |
| `/settings/identity` | `settings/IdentityBindingsSettingsPage.tsx` | 395 | 契约层 | V2 新增（FE-IDENTITY-BINDINGS） |
| `/settings/rewards` | `settings/RewardsSettingsPage.tsx` | 298 | 契约层 | V2 新增（FE-POINTS-CHECKIN） |
| `/settings/playback` | `settings/PlaybackSettingsPage.tsx` | 159 | 契约层 | |
| `/settings/appearance` | `settings/AppearanceSettingsPage.tsx` | 175 | 契约层 | 主题切换落点 |
| `/login` | `login/LoginPage.tsx` | 324 | 契约层 | 含三方身份登录面板 |
| `/install` | `install/InstallPage.tsx` | **62** | 契约层 | ⚠ **半成品**，见 §2.3 |

导航项：`settingsNavigation.ts` 5 项（个人资料/账号绑定/播放偏好/积分与签到/外观），服务器级设置已收敛为重定向（`router/index.tsx:222-243`）。

#### 管理面（`ManageLayout.tsx:372` 侧栏 32 个导航目标，与路由一一对应）

| 路由 | 页面 | 行数 | 状态 |
|---|---|---|---|
| `/manage` | `ManageOverviewPage.tsx` | 392 | ✅ |
| `/manage/task-center` | `ManageTaskCenterPage.tsx` | 183 | ✅ |
| `/manage/media-reviews` | `ManageMediaReviewsPage.tsx` | 385 | ✅ |
| `/manage/operations` | `ManageOperationsPage.tsx` | 337 | ✅ |
| `/manage/system-about` | `ManageSystemAboutPage.tsx` | 182 | ✅ |
| `/manage/events` | `ManageEventsPage.tsx` | 359 | ✅ |
| `/manage/upstreams` | `ManageUpstreamsPage.tsx` | 179 | ✅ |
| `/manage/media/add` | `ManageAddMediaPage.tsx` | 276 | ✅ 引导页（5 路查询聚合） |
| `/manage/media/items` | `ManageMediaItemsPage.tsx` | 351 | ✅ |
| `/manage/media/items/:itemId` | `ManageMediaItemDetailPage.tsx` | 256 | ✅ |
| `/manage/media/libraries` | `ManageLibrariesPage.tsx` | 232 | ✅ |
| `/manage/media/mounts` | `ManageMountsPage.tsx` | 398 | ✅ 最大子树 5,631 行 |
| `/manage/media/developer-api` | `developer-api/` | 213 | ✅ V2 新增 |
| `/manage/media/auth-providers` | `auth-providers/` | 409 | ✅ V2 新增 |
| `/manage/media/yun139` | `yun139/` | 1,080 | ✅ V2 新增 |
| `/manage/media/microsoft` | `microsoft/` | 727 | ✅ V2 新增 |
| `/manage/media/pan115-share` | `pan115-share/` | 642 | ✅ V2 新增 |
| `/manage/media/probe-tasks` | `ManageProbeTasksPage.tsx` | 119 | ✅ |
| `/manage/media/naming-scrape` | `ManageNamingRulesPage.tsx` | 362 | ✅ 子树 3,342 行 |
| `/manage/site/users/registration-codes` | `ManageRegistrationCodesPage.tsx` | 254 | ✅ |
| `/manage/site/users/accounts` | `ManageUsersPage.tsx` | 395 | ⚠ 后端 `PATCH status` / `batch/*` **501 stub**（`ManageUsersPage.tsx:147-148`） |
| `/manage/site/users/role-templates` | `ManageRoleTemplatesPage.tsx` | 252 | ✅ |
| `/manage/site/security/sessions` | `ManageSessionsPage.tsx` | 309 | ⚠ e2e 记为「诚实降级」（`manage-pages.spec.ts:86`） |
| `/manage/site/security/audit-logs` | `ManageAuditLogsPage.tsx` | 191 | ✅ |
| `/manage/site/security/runtime-logs` | `ManageRuntimeLogsPage.tsx` | 396 | ✅ + 归档段 B08/B09 |
| `/manage/site/telegram` | `ManageTelegramPage.tsx` | 312 | ⚠ status 端点未装配（`ManageTelegramPage.tsx:217`） |
| `/manage/site/email` | `ManageEmailChannelPage.tsx` | 159 | ✅ V2 新增 |
| `/manage/site/cas` | `ManageCasPage.tsx` | 243 | ✅ V2 新增（fmby-web#8） |
| `/manage/site/rewards` | `ManageRewardsPage.tsx` | 364 | ✅ |
| `/manage/site/secrets` | `ManageSecretsPage.tsx` | 311 | ✅ V2 新增 |
| `/manage/site/license` | `ManageLicensePage.tsx` | 192 | ✅ |
| `/manage/site/settings` | `ManageSiteSettingsPage.tsx` | 202 | ✅ |
| `/manage/site/advanced` | `ManageAdvancedPage.tsx` | 149 | ⚠ `GET /api/manage/advanced` 后端未实现（`shared/.../mapping/records.ts:231`） |
| `/manage/collections` | `ManageCollectionsPage.tsx` | 282 | ✅ 子树 1,426 行，17 个契约方法全消费 |
| `/manage/tools/pan115-imghost` | `pan115-imghost/` | 984 | ✅ **默认关闭**（`featureFlags.ts:10` `VITE_FEATURE_PAN115_IMGHOST=1`） |

### 2.2 缺失（V1 有 / V2 无）

| V1 路由 | V1 面 | V2 现状 | 定性 | 优先级 |
|---|---|---|---|---|
| `/manage/media/collections/:collectionId` | `ManageCollectionDetailPage.tsx` | V2 无独立详情页；用**列表内联展开**（`expandedId` + `CollectionMemberPanel`） | **主动设计差异**，非缺失 | P2（若产品要独立页/可分享 URL 再补） |
| `/settings/server/{general,security,session-policy}` | 3 个独立页面 | 收敛为 `/manage/site/settings`；旧路径保留重定向（`router/index.tsx:222-243`） | **主动收敛**（注释写明「改一处漏一处」） | 无需补 |
| `/manage/media/upstreams` | 同页面 | V2 改为 `/manage/upstreams`（顶层） | 路径变更，功能在 | P2（旧书签靠 `/manage/upstreams` 遗留重定向覆盖） |
| `/manage/site/about` | `ManageSystemAboutPage` | V2 改为 `/manage/system-about` | 路径变更 | P2 |
| `/manage/site/telegram-bot` | `ManageTelegramBotPage` | V2 改为 `/manage/site/telegram`（遗留别名保留） | 路径变更 | P2 |
| V1 整面：迁移向导 `migration/{export,import,inspect}` | V1 UI | V2 契约只建 `inspect`/`export`，**`import` 是后端 NotImplemented 占位，前端刻意不接**（`shared/.../migration/api.ts:10`） | 后端未实现 | P2（等后端） |
| V1 `rclone-rc/*` / `runtime-log-archives/*` 老形态 / 豆瓣导入 / emby 用户报告 | V1 UI | V2 架构层未实现 | **需主代理裁决是否排期**（`docs/plans/v2-dev/handoffs/FE-V1-PARITY-SWEEP.md:103-121`） | P3 |

> 说明：V1 的 `pan115-imghost` / `yun139-accounts` / `developer-api` / `license` / `rewards` / `telegram-bot` 等 V2 **均已补齐**（FE-PARITY 系列 + FE-UI-BACKLOG 系列）。

### 2.3 半成品（桩）

| # | 项 | 证据 | 现状 |
|---|---|---|---|
| S-1 | **安装向导** | `host/src/pages/install/InstallPage.tsx` **62 行**；V1 `apps/web/src/pages/install/` **582 行 + 5 个子组件（1,385 行）** | V1 有 9 个 install 端点：`/status` `/probe/database` `/probe/redis` `/database/initialize` `/dependencies/install` `/config` `/setup` `/site-settings` `/complete`。V2 **只消费 2 条**（`shared/src/contracts/auth/api.ts:259` `/api/install/status`、`:263` `/api/install/probe/database`）：**只能「探活数据库」，不能完成初始化**（无建库、无依赖安装、无管理员建档、无运行时配置、无站点品牌、无完成态）。V1 的 `AdminSetupForm` / `DependenciesSection` / `RuntimeConfigForm` / `DatabaseStatusPanel` 全部未移植 |
| S-2 | **占位页工厂零引用** | `host/src/pages/_placeholder/PlaceholderPage.tsx`（43 行）定义 `PlaceholderPage` / `createPlaceholderPage`，全仓扫描**无任何 import/调用** | 桩机制已废；文件是死代码（`component-size` 未抓到，因 <400 行） |
| S-3 | **集合管理详情页** | V2 `ManageCollectionsPage.tsx:282` 内联展开成员面板 | 已覆盖功能，但**无 URL 可寻址**（刷新丢展开态、无法分享/回退） |
| S-4 | **后端 501 面（前端就绪、后端为桩）** | `ManageUsersPage.tsx:147-148`（`PATCH status` + `batch/*` 501）；`useRegistrationCodesPageState.ts:186`（`batch/delete` 501）；e2e 诚实降级注释 `manage-pages.spec.ts:69,86` | 前端已按「逐条编排 + 如实呈现 fail」实现（FE-OPT-04），**等后端端点落地即可用** |
| S-5 | **端口未装配面前端已 fail-closed** | `ManageTelegramPage.tsx:217`（status 未装配）、`ManageMediaReviewsPage.tsx:95`、`ManageUpstreamsPage.tsx:53`、`ManageCollectionsPage.tsx:110`、`ManageEmailChannelPage.tsx:111-125`、`SiteSettingsBrandSection.tsx:106` | 均为**诚实提示卡**（「X 端口未装配 / 未启用」），非假数据；等后端装配 |
| S-6 | **115 图床默认关闭** | `host/src/featureFlags.ts:10`；`host/.env.example` 不含 `VITE_FEATURE_PAN115_IMGHOST` | 984 行代码在默认构建下 tree-shake 掉，功能等同不存在 |

---

## 3. UI 打磨缺口

### 3.1 既有 evidence/docs 台账（已知问题 → 当前是否已修）

| 文档 | 核心问题 | 当前状态 | 判据 |
|---|---|---|---|
| `docs/THEME-BUILD-01.md` | 主题皮肤被内联进 host 主 bundle，主题无法外挂 | **已修** | `themes/*/dist/` 真实产出；size 闸 `[3b][3c]` 双断言 PASS（§4） |
| `docs/FE-OPT-01.md` | 路由预取 / 图片懒加载 / 乐观更新 / 主题切换闪烁 | **已修** | `host/src/app/router/prefetch.ts` 在位（`routeLoaders` 39 项）；主题 IIFE + 双缓冲 |
| `docs/BUG-SKIN-NAV-01.md` | darkroom 卡片不可导航；主题 IIFE 缺宿主全局桥 | **已修** | `host/src/theme/themeGlobals.ts` 存在并接线；`shared/src/theme/index.ts:108/114` 有 `openItem`/`itemHref`；`themes/darkroom/src/skins/{LibrarySkin,ItemSkin}.ts` 均接两键；e2e `browse.spec.ts` 第 48 条「从媒体库进入条目」**真跑通过** |
| `docs/FE-OPT-02.md` + `-ROUND2.md` | 手机档 +69px 溢出 / 触控 44px / 触屏 media 从不匹配 | **已修（但有新回归，见 P0-1）** | 触屏规则在 `Button/Switch/TopBar/ManageLayout` CSS 内；`playwright.config.ts` 有 `mobile-chrome` project |
| `docs/FE-OPT-03.md` + `-ROUND2.md` | 全站 ~170 处 axe 违规 / 键盘导航 / 对比度 | **已修（有 1 处漏网，见 P0-2）** | 本次真跑：`a11y.spec.ts` **36/37 通过**（唯一失败 = `/history` 3 个 select 无名） |
| `docs/FE-OPT-04.md` | 管理面批量操作体感（多选/进度/重试） | **已修** | `shared/src/batch/{selection,runner}.ts` + `BatchProgressPanel`；e2e `batch-operations` 2/2 通过 |
| `docs/FE-OPT-05.md` | 第三方主题样板 | **已修** | `_template` 有真实 `browse.item` 皮肤；e2e `theme-template-skin` **4/4 通过** |
| `docs/FE-COLLECTIONS-CONSUME-B1.md` | 成员添加流 0 消费 | **已修** | e2e `collections-member-add` 3/3 通过 |
| `docs/FE-COLLECTIONS-CONSUME-B2.md` | 成员移除 + 重排 | **契约与 UI 已修，e2e 恒红**（见 P1-3） | 单测 24 项在 `host/tests/collections-member-remove-reorder.test.ts`；e2e 2 条真失败 |
| `docs/FE-LIST-KEYNAV.md` | 列表方向键漫游 | **已修** | `host/src/features/a11y/useGridRovingFocus.ts` 接 `VirtualizedLibraryDetailGrid.tsx:109`；e2e `grid-keynav` **7/7 通过** |
| `docs/FE-DELETE-UX-AND-ORDER.md` | 删除乐观更新 + 媒体库排序 | **已修** | `libraryOrder.ts` / `deleteOptimistic.ts` + 单测 14 项 |
| `docs/FE-REPO-DOC-CLAIM-AUDIT.md` | 5 条文档断言被后续卡推翻 | **已处置**（加 banner） | 5 个历史 handoff 头部已加 banner |

**结论：既有报告的「已知问题 → 已修」闭环完整。真正的打磨缺口在下面这批「既有报告没覆盖到的新发现」。**

### 3.2 本次真跑/扫代码发现的新缺口（按 P0/P1/P2 + 修法 + 工作量）

#### P0-1　手机档 3 个管理页横向溢出（回归 FE-OPT-02「0 溢出」结论）

- **现象**（真跑原文，`mobile-audit.spec.ts:138` 输出）：
  ```
  [audit] phone horizontal overflow pages: manage-task-center (+119px ), manage-runtime-logs (+426px SPAN._badge_16v5c_8), manage-license (+81px )
  ```
- **定位**：
  - `manage-runtime-logs` +426px：元凶是 `StatusBadge` 的 `.badge`（`shared/src/ui/common/StatusBadge.module.css` 含 `white-space: nowrap`），落在 `ManageRuntimeLogsPage.tsx:327` 的等级列；父容器 `.logOverviewCell` 硬写 `min-width: 240px`（`ManageShared.module.css:441`），375 视口下表本身 `min-width: 760px`（:393）→ 徽章不可换行把行撑出。
  - `manage-task-center` +119px：`TaskCenterList` 移动分支走 `mobileRecordGrid`（`ManageDetailSurfaces.module.css:230`，`flex-direction: column`，**不是栅格**，与桌面 `entityGrid` 不同源），长 `lastErrorCode` 无断行。
  - `manage-license` +81px：`ManageLicensePage.tsx` 用 `.twoColumn`（`ManagePages.module.css:121` `minmax(min(360px,100%),1fr)`）下的 Device Flow / 租约卡片。
- **修法**：① 给 `.badge` 在窄屏加 `overflow-wrap: anywhere` + 允许换行（或改 `min-width:0` 参与收缩）；② `.logOverviewCell` 窄屏去 `min-width`；③ 长错误码/ID 单元格统一加 `overflow-wrap: anywhere`（照 `ManageShared.module.css:62-73` 的 FE-OPT-02 既有范式，不新造）；④ 收窄后复跑 `mobile-audit` 断言（阈值已是 `>4px` 即红，不放宽）。
- **工作量**：**0.5 人日**（3 处 CSS + 复跑 25 页 × 3 断点 ≈ 3 分钟）

#### P0-2　`/history` 3 个筛选 `<select>` 无可访问名（axe critical，FE-OPT-03 漏网）

- **现象**（真跑原文）：
  ```
  [critical] select-name×3 — Select element must have an accessible name
        select:nth-child(1) select:nth-child(2) select:nth-child(3)
  ```
- **定位**：`host/src/pages/browse/HistoryPage.tsx:82 / 98 / 104` 是**裸 `<select>`**，无 `aria-label`。FE-OPT-03 当年只给 `LibrariesPage`（`媒体库类型筛选`）和 `LibraryDetailPage`（4 个）补了名，`HistoryPage` 这一路漏了；xe 在 `/history` 页扫到了。
- **修法**：补 `aria-label`（建议 `观看类型筛选` / `时间范围筛选` / `观看状态筛选`），与 FE-OPT-03 同口径；或换成 `shared/src/ui/primitives/Select.tsx`（已支持 `aria-label`，`:22`）。
- **工作量**：**0.2 人日**（3 行 + 复跑 a11y）

#### P0-3　`WideMediaCard` 缩略图链接无可访问名（axe/ariaSnapshot 双报）

- **现象**（真跑原文，`a11y-report.spec.ts:187` 断言）：
  ```
  - Array []
  + Array [ "history: A._wideThumbLink_1x7iw_563 ×5" ]
  ```
- **定位**：`host/src/pages/browse/components/WideMediaCard.tsx:29` —— `<Link>` 内只有 `<img alt={item.title}>`（有图时靠 alt 得名）或 `<div>暂无封面</div>`（**无图时彻底无名**）。历史页 5 条记录触发 5 次。
- **修法**：给该 `<Link>` 加 `aria-label={item.title}`（或给 fallback div 加 `aria-hidden` + Link 具名）。注意 `cardTitleLink`（:39）已具名，勿重复朗读。
- **工作量**：**0.2 人日**

#### P1-1　e2e 门禁在本席不落 `verify`、默认全 skip

- **现象**：
  - `package.json` 的 `verify` 链**不含 e2e**；`pnpm e2e` 单独一项（第 16 行）。
  - `host/e2e/fixtures/helpers.ts:30` `E2E_ENABLED = serverBinaryExists()`；本席默认路径（前端仓 `target/` + `FMBY_E2E_MAIN_REPO=/home/tefuir/rustproject/FMBY-V2`）**均无二进制** → 18 个 spec 全部 `test.skip(!E2E_ENABLED)` → **skip 而非 fail**，门禁恒绿但零覆盖。
  - `playwright.config.ts:96` 的 `webServer.command = 'pnpm build && node e2e/start.mjs'` 被 fmby-queue 判为重活拒绝（实测：`✗ fmby-queue 拒绝：这是重活（test/testc/clippy/build）… Exit code: 3`），或 180s 超时。
- **修法（三选一，需主代理裁决）**：① 给 `verify` 增一个 `e2e:optional` 闸，**有二进制就真跑、无二进制显式登记 skip 数**（不静默）；② 把 e2e 挂 CI（农场 node62），本地 verify 不跑；③ 提供 `FMBY_E2E_SERVER_BIN` 到本席已知可用路径 `/data/fmby-build/local-target/debug/` 的仓库内约定。
- **工作量**：**0.5 人日**（脚本改造） + 裁决

#### P1-2　`auth.spec.ts:31` 断言漂移（真红，非环境问题）

- **现象**：`expect(page.getByText('unauthorized'))` 找不到元素；后端实返 `{"error_code":"AUTH_INVALID_CREDENTIALS","message":"用户名或密码错误，请重新输入。"}`（我直接 curl 实测，401）。
- **定位**：spec 断言的是**旧后端错误码字面量**，前端现在渲染后端中文文案。
- **修法**：改断言为「可见的错误提示 + URL 仍为 `/login`」（不钉死具体文案，或钉 `AUTH_INVALID_CREDENTIALS` 对应的中文文案）。
- **工作量**：**0.2 人日**

#### P1-3　合集成员移除/重排 e2e 恒红（数据布置缺陷）

- **现象**（真跑）：首行「下移」按钮 `disabled`（`aria-label="将「星际穿越」下移"`）——说明合集**只有 1 个成员**，`index === members.length - 1`（`CollectionMemberPanel.tsx:100`）。移除用例随之超时。
- **定位**：`e2e/collections-member-remove-reorder.spec.ts:44-62` 的 `ensureCollectionWithMembers` 用关键词 `星` 取候选，循环 `i=1..options-1` 逐个 `selectOption` + 「加入合集」；但第二次加入时**同一条目已存在**（409 冲突）或候选 select 未刷新，实测只加进 1 个。spec 的 `added` 计数取自 `page.locator('tbody tr').count()`，而**成员表与合集列表都是 `tbody tr`** → 计数串味。
- **修法**：① 候选改用更宽关键词（如 `际` / 空串后端可能 400，用 `电`/`星` 各加一次）；② 成员行用**成员表专属选择器**（如 `[data-member-row]` 或面板内 `table` 的 `tr`，避免与合集列表 `tbody` 混）；③ 保证 ≥2 成员后再点「下移」。注意：这是 **e2e 数据布置 bug，不是产品 bug**——同族 B1（成员添加）3/3 通过，`moveMemberIds` 有 24 项单测兜底。
- **工作量**：**0.5 人日**

#### P1-4　主题产物必须由 `start.mjs` 组装，手工起栈会静默失败

- **现象**：我第一次手工起 server + preview 时，`theme-switch` 2 条全红（`data-theme` 恒 `null`）；把 `themes/*/dist` 拷进 `$FMBY_DATA_DIR/themes/<manifest.id>/dist/` 后 **6/6 通过**（`theme-switch` 2 + `theme-template-skin` 4）。
- **定位**：主题是**运行时外挂**（`THEME-BUILD-01`），host 从 `/themes/<id>/*` 拉；后端静态面映射 `${FMBY_DATA_DIR}/themes/<id>/dist/<rest>`。`start.mjs` 有 ①b 步骤做这件事（`:129-176`），**但手工/CI 直接起 server 就漏了**。
- **风险**：`data-theme` 为 null 时页面仍渲染（fallback token），**看不出是环境错还是功能错**——这正是 a11y 对比度当年测到「假色」的同一坑。
- **修法**：① CI/手工装配脚本化（已存在，只需**必须**走 `start.mjs`）；② 建议给 `ThemeProvider` 加一条「manifest 可达但 entry 加载失败 → 显式错误横幅」的可观测（当前走 error 分支静默）。
- **工作量**：**0.3 人日**（若在 CI 内统一走 `start.mjs` 则为 0）

#### P2-1　`prefetch.ts` 与路由表人工同步，已漏 7 条

- **定位**：`host/src/app/router/index.tsx` 有 50 个 lazy 页，`host/src/app/router/prefetch.ts` 的 `routeLoaders` 只登记 43 个。差集（router 有、预取无）：
  ```
  @/pages/browse/CollectionDetailPage      @/pages/browse/CollectionsListPage
  @/pages/browse/PersonDetailPage          @/pages/manage/ManageCasPage
  @/pages/manage/pan115-share              @/pages/settings/IdentityBindingsSettingsPage
  @/pages/settings/RewardsSettingsPage
  ```
- **影响**：这 7 条路由无 hover/focus 预取，首次导航多一次往返（FE-OPT-01 实测 hover 预取可省 ~25ms p50）。非功能缺陷，是**体感债**。
- **修法**：补 7 条登记；或加一个门禁「`routeLoaders` 与 router lazy import 差集 = 0」（防再漂移）。
- **工作量**：**0.3 人日**（含门禁 0.5）

#### P2-2　`_placeholder/PlaceholderPage.tsx` 死代码

- **定位**：43 行，全仓零引用（`PlaceholderPage` / `createPlaceholderPage`）。
- **修法**：删除。
- **工作量**：**0.1 人日**

#### P2-3　安装向导只完成「探活」，无法完成安装

- 见 §2.3 S-1。V1 有 9 端点 / 1,385 行；V2 只接 2 端点 / 62 行。
- **修法**：要么按 V1 补齐（建库 → 依赖 → 管理员 → 运行时配置 → 站点品牌 → 完成），要么**明确降级为「数据库连通性检查页」并在 UI 上如实标注**（当前 UI 写的是「首次安装 · 配置数据库」，会误导）。
- **工作量**：补齐 **3–5 人日**；降级标注 **0.2 人日**。→ **需主代理裁决 V2 是否要完整安装向导**

#### P2-4　`ItemDetailPage` 未走 viewmodel（分层不一致）

- **定位**：`host/src/pages/browse/` 9 个页面中，8 个走 `@fmby/v2-shared/viewmodels`；`ItemDetailPage.tsx` 自管 `useItemDetailQueries`（`item-detail/hooks`），`PersonDetailPage.tsx:6` 同时 import viewmodel **又**用 `useQuery`。
- **影响**：主题（L3）拿到的 `data` 形态不一致的风险点；`PersonDetailPage` 的双取数属冗余。
- **工作量**：**0.5–1 人日**（收敛 + 回归）

---

## 4. `pnpm verify` 当次实跑（原文）

命令：`cd /data/fmby-seats/fe01 && pnpm verify`（先 `pnpm install --frozen-lockfile`，因工作区 `node_modules` 缺失）

```
> fmby-web@0.2.14 verify /data/fmby-seats/fe01
> pnpm versions && pnpm typecheck && pnpm build && pnpm build:themes && pnpm test && pnpm size && pnpm repo-size && pnpm dupes && pnpm contracts && pnpm theme-budget && pnpm component-size && pnpm theme-parity
```

### 4.1 versions

```
root    = v0.2.14
host    = v0.1.0
shared  = v0.1.0
themes  = _template@v0.1.0, darkroom@v0.1.0

CONTRACT_VERSION (shared) = 0.1.0
  theme _template: contract_version 0.1 ✅ 兼容
  theme darkroom: contract_version 0.1 ✅ 兼容

[PASS] 版本门禁通过（四层独立版本 + 契约对齐）。
```

### 4.2 typecheck

```
shared typecheck: Done
themes/_template typecheck: Done
themes/darkroom typecheck: Done
host typecheck: Done
```

### 4.3 build（节选头尾）

```
vite v6.4.3 building for production...
✓ 2500 modules transformed.
dist/index.html                                         0.78 kB │ gzip:   0.49 kB
dist/.vite/manifest.json                               48.81 kB │ gzip:   5.13 kB
...
dist/assets/ManageMountsPage-D4Ktg0HU.js              101.92 kB │ gzip:  28.69 kB
dist/assets/artplayer-1mIf-tpL.js                     142.04 kB │ gzip:  37.50 kB
dist/assets/index-DXo8XFhI.js                         282.31 kB │ gzip:  85.19 kB
dist/assets/react-vendor-D7hBJjIB.js                  287.79 kB │ gzip:  92.20 kB
dist/assets/DPlayer.min-j8hp70oN.js                   299.84 kB │ gzip:  60.38 kB
dist/assets/matchKeyword-DjhA7jIK.js                  304.71 kB │ gzip: 139.87 kB
✓ built in 7.42s
```

### 4.4 build:themes

```
themes/_template build: dist/index.js  4.90 kB │ gzip: 1.78 kB   ✓ built in 137ms
themes/darkroom build: dist/index.js  7.44 kB │ gzip: 2.27 kB   ✓ built in 148ms
```

### 4.5 test（4 包汇总）

```
shared test:            ℹ tests 148   ℹ pass 148   ℹ fail 0   ℹ skipped 0   duration 2562.97ms
themes/_template test:  ℹ tests   9   ℹ pass   9   ℹ fail 0   ℹ skipped 0   duration 312.06ms
themes/darkroom test:   ℹ tests  19   ℹ pass  19   ℹ fail 0   ℹ skipped 0   duration 351.77ms
host test:              ℹ tests 461   ℹ pass 461   ℹ fail 0   ℹ skipped 0   duration 19795.85ms
                                 ────────────────────────────
                                 合计 637 tests / 637 pass / 0 fail
```

### 4.6 size

```
[1] Entry key identified: index.html -> assets/index-DXo8XFhI.js
[2] Initial screen JS closure files:
  - assets/index-DXo8XFhI.js: 83.09 KB (85084 bytes) (gzip)
  - assets/react-vendor-D7hBJjIB.js: 89.91 KB (92064 bytes) (gzip)
  - assets/query-CyEMm1pK.js: 12.33 KB (12630 bytes) (gzip)
  => Total Initial JS Gzip: 185.33 KB / Limit: 300.00 KB
  [PASS] Initial screen JS size within budget.
[3]  [PASS] Zero theme & player chunks in initial screen closure.
[3b] [PASS] 首屏闭包逐 chunk 反查零主题代码（LibrarySkin/ItemSkin/DomainSkinOutlet/data-darkroom 均未命中）。
[3c] [PASS] themes/_template/dist/index.js IIFE 产物且 react 外部化
     [PASS] themes/darkroom/dist/index.js IIFE 产物且 react 外部化
[4]  Theme [_template] manifest 331 B / Limit 2048 — PASS；Theme [darkroom] 420 B — PASS
[6]  [PASS] 首屏直接引用脚本不含 LibrarySkin / 主题代码。
All frontend size & chunking gates PASSED.
```

### 4.7 repo-size

```
二进制/产物文件：10 个
总量：916.2 KiB / 上限：1.00 MiB（89%）
最大文件：296.2 KiB  docs/evidence/fe-opt-02/samples/tablet-768/home.png
[PASS] 仓库二进制产物在预算内（策略见 docs/evidence-policy.md）。
```

> ⚠ 预算已用 **89%**；新增截图证据会顶到上限（FE-OPT-02 全量 76 张已外置，只剩 8 张样本入库）。

### 4.8 dupes / contracts

```
=== FMBY v2 Frontend Dupes & Boundary Gate ===
[1] Checking Theme Purity (apps/themes/**)...
[2] Checking Raw DTO Boundary (apps/host/src/pages/**)...
[3] Checking Single Source of Truth Implementations...
[PASS] 0 violations found. All frontend architectural boundaries clean.

=== FMBY v2 Contract Mappers & Alignment Gate ===
[1] 7 个契约域齐备（auth/browse/playback/manage/settings/theme/assets）— 全 PASS
[2] 7 个域均有 mapper / 转换层 — 全 PASS
[3] [PASS] Zero raw DTO imports detected across all page domains.
[4] [PASS] Zero ad-hoc HTTP client instantiations found.
[PASS] 0 contract violations found.
```

### 4.9 theme-budget / component-size / theme-parity

```
[主题] _template   源码 338 行（2 文件）  dist 14.5 KB [OK]
[主题] darkroom    源码 545 行（3 文件）  dist 30.7 KB [OK]
[PASS] 主题质量门禁通过（无 God File；总量不设限）。

[0] 豁免：host/src/app/router/index.tsx（644 行，路由声明表）
[2b] 契约 .ts 超 400 行：15 个（均未超 1200 硬顶）—— 最大 manage/api.ts 1114 行
[2c] 端点密度超标：browse/item/api.ts 218 行/端点、browse/api.ts 195 行/端点（未超 250 硬顶）
[2] 超线文件 0 个受管
[3] shared/src/api/client.ts 已降到红线以下 → 可跑 `pnpm component-size --update-baseline` 回收基线
[PASS] 0 违规，无超线组件。

[主题] _template（声明 1 个 domain）  browse.item: [OK] 四项能力面齐备
[主题] darkroom（声明 2 个 domain）   browse.library / browse.item: [OK] 四项能力面齐备
[PASS] All declared domain skins satisfy required capabilities.
```

### 4.10 结果

```
EXIT=0
```

**12 闸全绿**。唯一不是「绿」而是「债」的：`repo-size` 89%、`[2c]` 两条端点密度 WARN、`component-size` 15 条契约文件 WARN + 1 个可回收基线。

---

## 5. E2E 可测性状态与差距

### 5.1 现状：18 个 spec，设计覆盖 108 条用例

| spec | 用例 | 覆盖 |
|---|---|---|
| `a11y.spec.ts` | 29+8 | 全站 28 页 axe（wcag2a/2aa/21a/21aa）+ Tab 序/焦点可见/Ctrl+K/Esc/landmark/可访问名 |
| `a11y-report.spec.ts` | 1 | 15 页 × 2 profile 的 `ariaSnapshot` 报告 + 断言（无名控件/缺 alt/可聚焦数） |
| `a11y-keyboard.spec.ts` | 1 | 登录控件 Tab 无焦点陷阱 |
| `auth.spec.ts` | 4 | 登录表单可访问字段 / 空提交双错误 / 错误凭据 / 登录+刷新恢复+登出 |
| `browse.spec.ts` | 4 | 首页真数据 / 库过滤→打开库→打开条目 / **darkroom 卡片导航（BUG-SKIN-NAV-01 回归）** / 库详情 DOM 有界 |
| `manage-pages.spec.ts` | 18 | 管理面 18 页逐页进入 + 关键真交互（站点设置真写后复原） |
| `user-pages.spec.ts` | 7 | 首页/历史/库列表(搜索)/库详情/条目详情/播放(真实会话+取流)/设置三页 |
| `manage.spec.ts` | 2 | 管理驾驶舱真实 mounts / 三组站点设置读写 |
| `playback.spec.ts` | 2 | 真实会话 + 取流（字节>0）/ 暂停上报 + 导航停止 |
| `theme-switch.spec.ts` | 2 | darkroom 激活 + token / 热切 template 不刷新 |
| `theme-template-skin.spec.ts` | 4 | `_template` 产物可达 / L3 皮肤真渲染 / `itemHref` 真 `<a>` / 回落 host 默认页 |
| `batch-operations.spec.ts` | 2 | 全选→批删→逐条进度 / 范围选+反选 |
| `grid-keynav.spec.ts` | 7 | roving tabindex 二维/一维漫游 + Home/End + 焦点可见 + 不劫持输入控件 |
| `collections-member-add.spec.ts` | 3 | B1 边界/正向/失败 |
| `collections-member-remove-reorder.spec.ts` | 3 | B2 重排/移除/失败 ⚠ 2 条真红 |
| `cas-admin.spec.ts` | 4 | fmby-web#8 判据 2：盘配置 200 / 未启用↔真空态互斥 / 扇出不越过服务状态 / 播放阴性对照 |
| `mobile-audit.spec.ts` | 4 | 三断点 25 页溢出+截图 / 触控 44px / 表格横滚+抽屉 / 播放页控件 ⚠ phone-375 溢出真红 |
| `mfa-capabilities.spec.ts` | 1 | 种子未启 MFA → 显式 skip |

另有 `scripts/e2e/email_channel_smoke.py`（367 行，真栈邮件通道冒烟）—— **刻意未并入 `verify`**（脚本注释：首次编译约 4.5 分钟会拖慢门禁），需 `pnpm email-smoke` 单独跑。

### 5.2 本次真跑（装配真实栈）

```
server: /data/fmby-build/local-target/debug/fmby-v2-server + fmby-e2e-seed（真实 SQLite 三库）
web:    vite preview 服务 host/dist（FMBY_BACKEND=http://127.0.0.1:18199）
主题：  手工把 themes/*/dist 复制到 $FMBY_DATA_DIR/themes/<manifest.id>/dist/
```

**第一次（未组装主题产物 + 未设 `FMBY_TRUSTED_ORIGINS`）**：`80 passed / 26 failed / 2 skipped`
**补齐后复验**（逐 spec 重跑）：

| 复跑 | 结果 |
|---|---|
| `theme-switch` + `theme-template-skin` | **6 passed**（原 6 failed） |
| `a11y.spec.ts` | **36 passed / 1 failed**（原 12 failed） |
| `auth` + `collections-member-remove-reorder` | **4 passed / 3 failed** |
| `browse` / `manage-pages`(18) / `user-pages`(7) / `playback` / `batch-operations` / `grid-keynav`(7) / `cas-admin`(4) / `manage` / `collections-member-add`(3) | **全通过** |

→ **剩余真失败仅 3 条**：`a11y /history`（P0-2）、`auth` 错误码断言（P1-2）、合集 B2 两条（P1-3，同源 1 个数据布置 bug）。`mobile-audit phone-375`（P0-1）在完整跑中另计。

### 5.3 覆盖率：e2e 触达的路由 vs 全部真实路由（51）

**未被任何 spec 触达的真实路由（19 条）**：

```
/install                          /manage/events
/collections                      /manage/media-reviews
/collections/:collectionId        /manage/media/auth-providers
/people/:personId                 /manage/media/developer-api
/settings/identity                /manage/media/microsoft
/settings/rewards                 /manage/media/pan115-share
/manage/operations                /manage/media/yun139
/manage/system-about              /manage/site/email
/manage/upstreams                 /manage/tools/pan115-imghost
/libraries/:libraryId（仅 /libraries/1 硬编码）
```

其中值得优先补的：**用户面 `/collections` + `/collections/:collectionId` + `/people/:personId`**（全新页面、零 e2e）、**`/manage/media-reviews` + `/manage/operations` + `/manage/upstreams` + `/manage/events`**（WEB-4PAGES 交付的高频管理页、零 e2e）、**`/settings/identity` + `/settings/rewards`**（新设页面、零 e2e）。

### 5.4 差距清单（按影响排序）

| # | 差距 | 影响 | 修法 | 工作量 |
|---|---|---|---|---|
| G-1 | **e2e 不在 `verify` 内 + 默认全 skip** | 「全绿」不含任何浏览器验证；历史「40/77/87 passed」在本席不可复现 | 见 P1-1（三选一，需裁决） | 0.5 人日 + 裁决 |
| G-2 | **`webServer` 前置 `pnpm build` 被 fmby-queue 判重活拒绝** | `pnpm e2e` 在本席直接 exit 3 / 180s 超时 | 改用农场 build 产物，或给 `webServer.command` 加 `FMBY_QUEUE_ALLOW_HEAVY_LOCAL=1`，或将 build 移出 webServer（改为 `globalSetup` 复用已有 dist） | 0.3 人日 |
| G-3 | **19 条路由零 e2e**（§5.3） | 新页面（合集/人物/身份绑定/积分）与高频管理页（审核/运营/上游/事件）无浏览器回归网 | 补 2 个 spec：`user-pages` 扩 3 页、`manage-pages` 扩 8～10 页（照既有 `expectPage` 范式，每页 1 真交互） | **2 人日** |
| G-4 | **`/install` 零 e2e**（WEB-E2E-FULL 已登记） | 安装向导是唯一「无登录态」路径，且当前是半成品 | 需「空库首启」专用 harness（seed 后即完成安装态，走不到） | 1 人日（依附 P2-3 裁决） |
| G-5 | **`mobile-chrome` project 未在默认跑中包含**（`--project=chromium` 时触屏断言 skip） | 触屏 44px 规则在桌面 profile 从不生效（FE-OPT-02 N-4 已登记，是设计） | 默认跑两 project（代价 ≈ 2× 时长） | 0.1 人日 + 时长 |
| G-6 | **MFA / CAS 正腿 / 真实 provider 全链路无覆盖** | `mfa-capabilities` 显式 skip（种子未启 MFA）；`cas-admin` 只钉阴性对照（无云盘凭据，正腿物理不可证，spec 注释已给 3 条源码证据）；115/139/TMDB 全链路需外部凭据 | 需用户提供测试账号/目录/API Key（WEB-E2E-FULL §7 已登记 6 项） | 待输入 |
| G-7 | **`email-smoke` 未并入 verify** | 邮件通道真栈验证需手动触发 | 见脚本注释（编译 4.5 分钟）；建议挂 CI 夜间档 | 0.1 人日 + 排期 |

---

## 6. 交付底账：为「10/20 可完整测试 + UI 打磨」的建议排期

| 优先级 | 项 | 工作量 | 前置 |
|---|---|---|---|
| **P0** | P0-2 history select 具名 | 0.2 | 无 |
| **P0** | P0-3 WideMediaCard 链接具名 | 0.2 | 无 |
| **P0** | P0-1 手机档 3 页溢出收口 | 0.5 | 无 |
| **P0** | G-1/G-2 e2e 门禁落地方式 | 0.8 | **主代理裁决** |
| **P1** | P1-2 auth 断言去漂移 | 0.2 | 无 |
| **P1** | P1-3 合集 B2 e2e 数据布置修复 | 0.5 | 无 |
| **P1** | G-3 补 19 条路由的 e2e（重点 11 条） | 2.0 | G-1/G-2 |
| **P2** | P2-1 预取表补齐 + 防漂移门禁 | 0.5 | 无 |
| **P2** | P2-2 删 `_placeholder` 死代码 | 0.1 | 无 |
| **P2** | P2-4 ItemDetail/PersonDetail 收敛 viewmodel | 0.5–1.0 | 无 |
| **P2** | P1-4 主题装配可观测（加载失败显式横幅） | 0.3 | 无 |
| **待裁** | P2-3 安装向导：补齐 3–5 人日 / 降级标注 0.2 人日 | — | **产品裁决** |
| **待裁** | G-6 真实 provider 全链路（需外部凭据） | — | **用户提供** |

**合计（不含待裁项）**：≈ **5.3 人日**。

---

## 7. 诚实边界 / 待人工

1. **V1 对位是「路由 + 页面文件」级，非像素级功能逐项对位**。V1 每页的按钮/表单字段级差异未逐一比对（`FE-V1-PARITY-SWEEP.md:145` 亦自登记此边界）。若要精确到「V1 某页某按钮」需另开人工读 V1 页面卡。
2. **V1 端点可用性未实测**：V1 的 9 个 install 端点是从 V1 源码字面量扫出（`/data/projects/fmby-main/fmby/apps/web/src` 的 `/api/install/*` 9 条），**未对 V1 后端做 curl 验证**。V2 后端是否有对应端点亦未核实（本席未找到 V2 后端仓 `crates/fmby-v2-http`——`/data/projects/fmby-main/fmby/crates/` 下只有 `fmby-api/server/worker` 等旧名，无 `fmby-v2-http`）→ **「V2 后端是否支持完整安装」标为待人工**。
3. **§5.2 的 e2e 真跑用的是手工装配栈**（非 `start.mjs` 全流程），且 `FMBY_TRUSTED_ORIGINS` / 主题组装两步是我补的；`start.mjs` 全流程在完整跑时曾因 server 启动竞态失败（日志：`backend did not become ready in time` 与 SQLite `write-lock` 残留），**未在本席完整复现** → 该失败是否为本机并发/锁残留问题，标 **待人工**。
4. **`mobile-audit` 的 phone-375 三条溢出是在「完整跑（未组装主题）」那轮测到的**；补齐主题后我没有单独重跑 phone-375（时长 ~47s/轮）。溢出元凶是 CSS 尺寸（与主题无关），判定可靠，但**修复前后建议复跑该 spec 一次确认**。
5. **`repo-size` 89% 与 `[2c]` 端点密度 WARN** 是债不是错，未计入缺口工作量。
6. **未跑 `pnpm email-smoke`**（需后端仓 `scripts/e2e/harness.py`，`FMBY_BACKEND_REPO` 默认路径在本席不存在）→ 邮件通道 e2e 状态 **未验证**。
7. 本报告唯一写入物；所有 e2e 产物（`docs/evidence/fe-opt-03/**` 快照、`/tmp/fe01-pw-results`）已还原/置于仓外，`git status --porcelain` 为空。
