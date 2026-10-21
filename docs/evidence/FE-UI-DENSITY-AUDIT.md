# FE-UI-2 · 全站信息密度与留白审计

> 卡面：FE-UI-2（用户原话：「前端设计的还是很烂啊？过一遍呢？是不是需要部分留白呢？很多地方信息密度不要那么大，完整的过一遍前端的 UI 设计」）
> 纪律：**只读审计**（本报告是唯一写入物，未改任何组件/样式；未跑 cargo/pnpm build）。符号定位用 codegraph（index 9,278 节点）；字面量统计用 python3 扫描（本机钩子禁 grep 找代码）。
> 基线：fmby-web @ branch `lovely-skunk`，commit `ddc1a4c`（工作区干净）。
> 四维定义：**①信息密度**（一屏块数/KPI/表格列，该合并或折叠的）· **②留白阶梯**（是否守 4/8/12/16/24/32 token 阶梯，容器内边距 ≥16，卡片间距 ≥12）· **③层级**（标题/次要/辅助是否 ≤3 级，避免等重大字）· **④首屏主行动**（首屏有无明确主行动，是否被次要信息淹没）。

---

## 0. 一页结论

| 维度 | 结论 |
|---|---|
| 总体 | Token 体系健全（`themes/darkroom/tokens.css` 定义 4–64px 阶梯），browse 面执行好；**问题集中在「信息重复」与「管理面密度」**：同屏同值出现 2–3 处的页面 5 个，管理首屏一屏 13 块 |
| P0 | 2 条：① 中控「正在运行的任务队列」硬编码空数组 + 空态谎报「全部刮削完成」+ 指向不存在路由的死链；② 生产 UI 文案含粗口（命名刮削页头） |
| P1 | 11 条：详情页双重 gutter、任务中心双类别控件、3 处同值重复计数、用户表 10 列、38 页重复 eyebrow、中控一屏 13 块等，逐条见 §4 |
| P2 | 10 条：间距阶梯 111 处脱梯（16 文件）、8 档非 token 字号、硬编码色、死代码分支等 |
| 间距体检 | CSS 侧 padding/margin/gap 脱梯声明 **111 处 / 16 文件**（值域 2/3/5/6/7/9/10/11/13/14/15/18/26/28/30/36/42/44px）；TSX 内联少量（7 处） |
| 字号体检 | 正文/标签出现 **10.5/11/11.5/12.5/13/13.5/22/28px** 8 档非 token 值（token 只定义 12/13/14/15/19/26） |
| 模板体检 | `ManagePageHeader` 被 **38 个文件**使用，每个都带「管理中心」eyebrow + 一句 changelog 口吻描述 |

---

## 1. 审计范围：页面清单与覆盖方式

路由唯一权威 `host/src/app/router/index.tsx`（644 行）。真实页面（非重定向）44 个 + 4 个布局壳。

| # | 路由 | 页面文件 | 覆盖方式 |
|---|---|---|---|
| 1 | `/login` | `pages/login/LoginPage.tsx` (315 行) | 深读 + css |
| 2 | `/install` | `pages/install/InstallPage.tsx` (312 行) | 深读 |
| 3 | `/` | `pages/browse/HomePage.tsx` (287) | 深读 + css |
| 4 | `/history` | `browse/HistoryPage.tsx` (168) | 深读 |
| 5 | `/libraries` | `browse/LibrariesPage.tsx` (158) | 深读 + css |
| 6 | `/libraries/:id` | `browse/LibraryDetailPage.tsx` (198) | 深读 |
| 7 | `/item/:id` | `browse/ItemDetailPage.tsx` (186) + item-detail/* (563) | 深读 + css |
| 8 | `/people/:id` | `browse/PersonDetailPage.tsx` (137) | 结构扫描 |
| 9 | `/collections` | `browse/CollectionsListPage.tsx` (160) | 结构扫描 |
| 10 | `/collections/:id` | `browse/CollectionDetailPage.tsx` (115) | 结构扫描 |
| 11 | `/play/:id` | `browse/PlayPage.tsx` (381) + play/* (11 文件) | 深读 + css |
| 12 | `/settings/{profile,rewards,playback,appearance,identity}` | `pages/settings/*` (1,503) | 深读 Profile + css，其余共享面 |
| 13 | `/manage` | `manage/ManageOverviewPage.tsx` (392) + overview/* | 深读 + css（cockpit 1,128 行） |
| 14 | `/manage/task-center` | `ManageTaskCenterPage.tsx` (183) + task-center/* (650) | 深读 |
| 15 | `/manage/media/items` | `ManageMediaItemsPage.tsx` (351) + media-items/components | 深读 |
| 16 | `/manage/media/items/:id` | `ManageMediaItemDetailPage.tsx` (256) + media-item-detail/components (2,723) | 深读页面组装层 |
| 17 | `/manage/site/users/accounts` | `ManageUsersPage.tsx` (395) + users/components (1,896) | 深读 |
| 18 | `/manage/system-about` | `ManageSystemAboutPage.tsx` (201) | 深读 |
| 19 | `/manage/media/add` | `ManageAddMediaPage.tsx` (276) | 结构扫描 |
| 20 | `/manage/media/naming-scrape` | naming-rules/* (3,342) | 抽样（header 文案） |
| 21–44 | 其余 24 个 manage 长尾页（mounts/libraries/mounts/collections/media-reviews/operations/events/upstreams/sessions/audit-logs/runtime-logs/site-settings/advanced/secrets/license/telegram/email/cas*/rewards/registration-codes/role-templates/developer-api/auth-providers/yun139/microsoft/pan115-*） | 均消费 `ManagePageHeader`/`ManageSectionCard`/`ManageShared.module.css` | **共享面结论**（§2-S3/S4 + header 文案全量扫描）；未逐页深读，页面私有差异不在本表断言 |

---

## 2. 全局系统性发现

| ID | 发现 | 证据 | 波及面 |
|---|---|---|---|
| S1 | 间距脱梯：CSS 中 111 处 padding/margin/gap 使用非 token 像素值，值域覆盖 2–44px 共 18 个值 | 扫描明细见 §4-P2-1 表（top: cockpit 22 处、PlayPage 17、LoginPage 10、TopBar 9、SettingsCenter 8、detail 8） | 全站，视觉节奏不统一 |
| S2 | 字号不入 token：出现 10.5/11/11.5/12.5/13/13.5/22/28px 共 8 档 token 外字号（token: 12/13/14/15/19/26） | `browse/styles/shared.module.css`（11/11.5/12.5px）、`library.module.css:75,82`（10.5/22px）、`TopBar.module.css:70`（13.5px）、`ManageOverviewCockpit.module.css:75,89`（28/11.5px） | 全站文字阶梯多 3 档 |
| S3 | 页头模板过重且自我重复：`ManagePageHeader` = eyebrow「管理中心」+ title + 长描述 + meta + actions，38 处使用；eyebrow 与侧栏「管理工作台」同义 | `manage/components.tsx:52-90`、`longtail-shared/components.tsx`；38 文件引用 | 管理端每页多 1 行无效层级 |
| S4 | 页头描述是 changelog/工单口吻（写给人看的提交说明而非 UI 文案），且有内部票号直出 | `UsersHeaderAndTable.tsx:82`「补齐…闭环，删除语义先明确收口为…」、`CasContentListPage.tsx:68`「（#658 第 1 页；发布编排/分享转存另卡）」、`ManageCasPage.tsx:76`「（后端 #42-N5）」 | 管理端全部页头 |
| S5 | 管理端样式词汇三分裂：`ManagePages.module.css`（949 行）+ `ManageDetailSurfaces`（288）+ `longtail-shared/ManageShared.module.css`（1,043+）+ 5 个页面级 css；ManagePages/ManageShared 本身守 token（0 处脱梯），脱梯集中在 cockpit/PlayPage/login 等文件；且与 browse 的暗房「没有卡片、细线分区」原则相悖（manage 用 border+bg 玻璃卡） | ManagePages.module.css 头注自称「全部取自 tokens」（属实）；cockpit 自称「玻璃拟态」 | 可维护性 + 风格一致性 |
| S6 | 提示条堆叠：同一页最多 4 个 banner 槽位纵向排列（outdated/partial/success/error 各占一行） | `settings/ProfileSettingsPage.tsx:54-69`；`ManageOverviewPage.tsx:310-311`、`ManageMediaItemsPage.tsx:279-280` 同模式 | 设置中心、管理列表页首屏 |
| S7 | 同值重复展示（密度虚高主因）：计数/状态在同一屏出现 2–3 处 | HistoryPage 71/126；LibraryDetailPage 83-86/95/168；MediaItemsPage 264/267/296；ItemDetail 评分两处（PosterBadges + SmallStat）；LibrariesPage chips 84-86 vs stats 89-101；PlayPage 复制链接×2 + 外部播放×3 | 6 个页面，见 §4 各条 |

---

## 3. 页面 × 问题 总表

评级：● 问题突出 / ◐ 有问题但局部 / ○ 达标。括号为关键证据编号（§4 条目）。

| 页面 | ①信息密度 | ②留白阶梯 | ③层级 | ④首屏主行动 | 关键问题 |
|---|---|---|---|---|---|
| 登录 `/login` | ○ 表单 4 字段 + 模式切换 | ◐ 卡片 36px 裸值 (P2-5) | ○ 三级 | ● 唯一实心提交钮 | mfa 分支重复死代码 (P2-4)；副标题一句两义 |
| 安装 `/install` | ◐ 提交前 3 段说明文字 | ◐ 复用 login css | ◐ 步骤说明×2 | ● 上一步/下一步/应用 | `restart_required=true` 术语直出 (P2-7) |
| 首页 `/` | ○ hero + 3 区 | ○ | ○ kicker 三级 | ● hero 主 CTA | 管理提醒 4 种 banner 变体占 hero (P2-9)；分区描述文案化 |
| 历史 `/history` | ◐ 同值计数×2 (S7) | ○ | ○ | ◐ 刷新为唯一动作 | 双计数 (P1-4)；3 个 select 可用名已修 |
| 媒体库 `/libraries` | ◐ chips + 铭牌双套 KPI (S7) | ○ | ◐ 两套数字语言 | ◐ 浏览页可接受 | totalItems 双处 (P2-6)；10.5px 标签 (P2-6) |
| 库详情 `/libraries/:id` | ◐ loaded×3 (S7) | ○ | ○ | ◐ | 已加载数三处重复 (P1-5)；4 select 连排 |
| 条目详情 `/item/:id` | ● hero 一屏 10 块 (S7) | ● 双重 gutter (P1-1) | ◐ 评分两处 | ● 播放主钮 | 嵌套 `.page` (P1-1)；评分重复 (P2-9) |
| 人物/合集 3 页 | ○ 海报栅格 | ○ | ○ | ○ 浅读通过 | 无 |
| 播放 `/play/:id` | ● 操作区重复×3 (S7) | ● 17 处脱梯 (P2-1) | ◐ info 三条并存 | ● 播放/外部 | incompat overlay 与 InfoBar/PlayerBar 职责重叠 (P1-6) |
| 设置中心 5 页 | ○ 单列分区 | ◐ sticky 让位 88/120 魔数 (P1-10) | ○ | ● sticky 保存条 | banner 槽×4 (S6)；保存成功 title+desc 同义 |
| 管理首页 `/manage` | ● 一屏 13 块 (P1-9) | ● cockpit 22 处脱梯 (P2-1) | ● KPI 28px 独大 | ● 快速入库 | 空任务队列谎报+死链 (P0-1)；硬编码蓝 (P2-3) |
| 任务中心 | ◐ 指标+分组+列表 | ○ | ◐ 类别筛选×2 (P1-2) | ◐ 只读运营页 | 双类别控件 (P1-2)；「今日起点 UTC」术语 |
| 媒体资源 `/manage/media/items` | ◐ total×3 + 当前页 KPI (P1-3) | ○ | ◐ | ● 筛选即行动 | 指标板 3/4 为当前页瞬态值 (P1-3) |
| 资源详情 `/manage/media/items/:id` | ● 8 节平铺无导航 | ○ | ● 8 个同级 sectionCard | ● 扫描/刷新 | 无节内锚点/折叠 (P1-7) |
| 用户管理 | ● 10 列表格 (P1-8) | ○ | ◐ | ● 新建用户 | changelog 描述 (S4)；列过多 |
| 命名与刮削 | ◐ | ○ | ◐ | ● | **粗口文案 (P0-2)** |
| 系统关于 | ○ 4 表分区 | ○ | ○ | ○ 只读页 | 「PATH 探测（-version 首行）」术语 (P2-7) |
| 长尾 24 页（共享面） | ◐ 每页 header+2-4 节 | ◐ ManageShared 本身守 token | ◐ eyebrow×38 (S3) | 多数有 header 主钮 | 页头模板+文案 (S3/S4)；个别页私有差异未断言 |

---

## 4. 分级明细（每条：位置 + 现值 → 建议值 + 影响面）

### P0（先修：可信度/品牌）

**P0-1 · 中控「正在运行的任务队列」是空壳：硬编码空数组 + 空态谎报 + 死链**
- 位置：`host/src/pages/manage/ManageOverviewPage.tsx:35`（`const tasks: ActiveTaskQueueItem[] = []`，恒为空）；`host/src/pages/manage/overview/components/ActiveTaskQueueWidget.tsx:73`（`to="/manage/tasks"`，路由表只有 `/manage/task-center`，点击进 RouteErrorPage）；同文件 `:86-93`（空态渲染「任务队列空闲 / 所有挂载目录、海报与元数据已完成最新刮削与入库」）
- 问题：三合一——组件永远收不到数据；空态文案把「没有数据」说成「全部完成」；「任务中心 ➔」链接 404。
- 建议：① 该 widget 在任务中心（#14）已有完整真实面，直接从首屏移除或接 `/manage/task-center` overview 数据；② 空态文案改「暂无任务数据」；③ 链接改 `to="/manage/task-center"`。
- 影响面：管理首屏可信度（与 FE-HONESTY-P2 已清偿的「假 0 会话」同类回归）。

**P0-2 · 生产 UI 文案含粗口**
- 位置：`host/src/pages/manage/naming-rules/components/NamingRulesHeader.tsx:35`：`description="…数据库是元数据真相源，海报会落本地缓存，不再只存一条屁用没有的外链。"`
- 建议：改「海报落本地缓存，播放不依赖第三方外链可达性。」描述整体压缩到一句（同 S4）。
- 影响面：所有进入命名与刮削页的管理员；品牌观感。

### P1（信息密度/重复/结构）

**P1-1 · 条目详情页嵌套 `.page`：双重栅格边距，hero 与分节左缘错位**
- 位置：`host/src/pages/browse/ItemDetailPage.tsx:156`（外层 `<div className={styles.page}>`）与 `:159`（内层又一层 `<div className={styles.page}>`）；`.page` 定义于 `browse/styles/shared.module.css:18-24`（`padding: var(--space-5) var(--grid-margin) var(--space-16)`，`--grid-margin: clamp(16px,3vw,40px)`）
- 现值：横向 gutter 叠加至 2×`--grid-margin`（最大 80px/侧），且 hero（外层）与全部分节（内层）左右缘不对齐，纵向底部留白叠加 64px。
- 建议：内层改为无 padding/gap 的普通 `<div>`（或直接去掉一层），hero 与分节共用同一栅格。
- 影响面：全站条目详情（电影/剧集/音乐详情）布局一致性。

**P1-2 · 任务中心：同一 state 绑两个类别筛选控件**
- 位置：`host/src/pages/manage/task-center/components/TaskCenterCategoryGroups.tsx:38-53`（「分类总览」卡片内每类一个按钮，绑定 `categoryFilter`）与 `TaskCenterFilters.tsx:28-44`（「筛选与列表」区又一个「类别」select，绑定同一 `categoryFilter`）
- 问题：一屏两个控件改同一个值，且卡片组没有「全部」复位（只能回 select 清）；「分类总览」整节（约半屏）本质是另一套筛选器。
- 建议：二选一保留——保留卡片组（加「全部」chip，删 select 的类别项），或保留 select、把卡片组降级为只读 KPI 概览；按钮选中态从 `secondaryButton` 改为统一 `chip[data-active]` 词汇。
- 影响面：任务中心首屏高度可省约 200-280px。

**P1-3 · 媒体资源页：total 三处重复 + 指标板 3/4 是「当前页」瞬态值**
- 位置：`host/src/pages/manage/ManageMediaItemsPage.tsx:264`（页头 meta「共 N 条资源」）、`:196,289,311`（`localOverrideCount` 计算两次并分别传给指标板与筛选条）、`media-items/components/MediaItemMetricsBoard.tsx`（「资源总数」与页头重复；「当前页有覆盖/可播放/待处理」随翻页变化）
- 建议：① 删指标板或改为后端全局口径（需另开数据面卡，报告不假设）；短期直接删除该节——筛选条已含 `itemsCount/total`；② `localOverrideCount` 只算一次传入两处；③ total 只保留页头一处。
- 影响面：资源管理首屏少一整行（约 96px），且消除「翻页数字乱跳」的困惑。

**P1-4 · 历史页同一计数显示两次**
- 位置：`host/src/pages/browse/HistoryPage.tsx:71`（页头「共整理出 N 条记录」）与 `:126`（工具条「当前结果：N 条」，N 为相同三项之和）
- 建议：删工具条那处，保留页头；工具条右侧改为展示「筛选生效中」状态（仅当 `typeFilter/timeRange/stateFilter ≠ all`）。
- 影响面：历史页首屏。

**P1-5 · 库详情页「已加载 x/y」三处重复**
- 位置：`host/src/pages/browse/LibraryDetailPage.tsx:83-86`（构造 `loadedLabel`）→ `:95`（传入 hero 展示）、`:168`（工具条 meta 再算一遍「已加载 x/y · 已全部加载」）、页面尾部 `loadMoreHintCard`（`:187-190`，第三次展示加载状态）
- 建议：hero 保留一处；工具条只显示「当前结果 N 个」；尾部滚动提示只显示「继续下滑自动加载」/「已全部展开」布尔态，不带数字。
- 影响面：库详情页视觉噪音 -2 行。

**P1-6 · 播放页外部播放/复制链入口三处并存**
- 位置：`host/src/pages/browse/play/PlaybackStage.tsx:75-99`（不兼容 overlay：外部打开 + 复制链接 + 新标签打开 3 个动作）、`play/PlaybackInfoBar.tsx:52-67`（复制链接 + 「外部播放器」裸直链 anchor）、`play/ExternalPlayerBar.tsx`（PotPlayer/VLC/IINA/nPlayer/Infuse/MX 6 个深链按钮）
- 建议：① InfoBar 的「外部播放器」裸直链 anchor 删除（与 PlayerBar 六按钮同义且更低级）；② 复制链接保留 InfoBar 一处，overlay 内保留（overlay 全屏接管时 InfoBar 不可见，属合理冗余，但「新标签打开」与「外部打开」合并成一个）；③ overlay 与 InfoBar 的兼容提示徽标（`兼容性待确认`）只在一处渲染。
- 影响面：播放页操作区从最多 3 行操作收敛为 2 行。

**P1-7 · 资源详情 8 节平铺、无节内导航**
- 位置：`host/src/pages/manage/ManageMediaItemDetailPage.tsx:184-222`（Overview→Metadata→Sources→Artwork→Subtitle→Pipeline→IdentityGovernance→DangerZone 8 个同级 `ManageSectionCard`，全展开长页）
- 建议：页头下加一行锚点导航（8 个文字链接，复用 `.chip` 词汇）；低频三节（Pipeline/IdentityGovernance/DangerZone）默认折叠（`<details>` 或受控 disclosure，站内已有 `StreamDisclosureGroup` 先例）。
- 影响面：详情页首屏聚焦「概览+元数据」，长页可导航。

**P1-8 · 用户表 10 列，3 列可合并、1 列可移**
- 位置：`host/src/pages/manage/users/components/UserTable.tsx:164-181`（勾选、账号、角色、类型、状态、来源授权、创建时间、最近登录、最近设备、操作）
- 建议：① 角色+类型+来源授权 → 合并为「权限」列（徽章组，悬停展开，数据已在行模型内）；② 创建时间 → 移入查看抽屉（低频）；③ 最近登录+最近设备 → 合并为一列两行文本（同单元格，零信息损失）。结果 10→7 列，行高不变。
- 影响面：用户管理横向密度与可读性；1366px 档减少横向滚动。

**P1-9 · 管理首页一屏 13 块**
- 位置：`host/src/pages/manage/ManageOverviewPage.tsx:269-380`（页头 1 + banner 1 + KPI 胶囊 4 + 左列 3 panel + 右列 2 panel + 底部看板 1 + modal = 13 块）
- 建议（不动数据面）：① 移除 ActiveTaskQueueWidget（P0-1 同步处理）→12；② `TaskPipelineWidget` 的 quickLinks 上移为 KPI 胶囊下方一行 chip，活动流与 RiskRadar 合并为「风险与动态」一节 →10；③ `ServerVitalsPanel` 收敛为 4 指标一行（CPU/内存/磁盘/负载），展开交给 existing detail → 首屏 8 块。
- 影响面：管理首屏密度下降约 1/3，6:4 栅格（`ManageOverviewCockpit.module.css:147` `minmax(0,1.45fr) minmax(0,1fr)`）保持不变。

**P1-10 · 设置中心 sticky 让位用魔数**
- 位置：`host/src/pages/settings/SettingsCenter.module.css:155`（`padding-bottom: 88px`）与 `:485`（移动端 `padding-bottom: 120px`）
- 建议：注册 `--stickybar-clearance: 88px`（mobile 120px），或改为 `calc(var(--space-12) + 40px)`；stickyBar 高度变化时只改一处。
- 影响面：设置中心 5 页。

**P1-11 · 管理侧栏「卡片套卡片」+ 三层树**
- 位置：`host/src/app/layouts/ManageLayout.module.css`：`.rail`（L24-46，border+bg+shadow）内嵌 `.navCard`（L84-91，又是 border+bg）再嵌 `.subGroup`（L118+）；`ManageLayout.tsx` 导航树最深 3 层（用户与站点 → 邀请与用户 → 叶子）
- 建议：① 去掉 `.navCard` 盒子（保留分组标题 + 2px 间距缩进），与暗房「没有卡片」原则对齐，视觉噪音 -1 层；② 第三层叶子（邀请与用户/会话与日志下各 3-4 项）上提一层，272px 宽栏内减少嵌套缩进；③ 叶子共 30 个链接，保持现有 sticky+scroll。
- 影响面：管理端所有页面左侧导航。

### P2（打磨）

**P2-1 · 间距阶梯收敛（111 处 / 16 文件）**

| 文件 | 脱梯数 | 高频现值 → 建议值 |
|---|---|---|
| `manage/overview/ManageOverviewCockpit.module.css` | 22 | 2px→保留（发丝级对齐）或 4px；6px gap→`--space-2`(8)；10px 14px→`--space-3`/`--space-4` |
| `browse/PlayPage.module.css` | 17 | 6px→8；7px 13px→`--space-2`/`--space-3`；clamp 值吸附 8 的倍数 |
| `login/LoginPage.module.css` | 10 | 36px→`--space-8`(32)；10px→`--space-3`(12) |
| `app/layouts/TopBar.module.css` | 9 | 6px 12px→8/12；15px/9px→16/8 |
| `settings/SettingsCenter.module.css` | 8 | 2px→4；5px 10px→8/12；见 P1-10 |
| `browse/styles/detail.module.css` | 8 | 3px 9px→4/8；7px 14px→8/16；11px→12 |
| 其余 10 文件（ManageShared 5、NamingRules 5、hero 5、shared 4、cinema-hero 4、cards 4、SearchOverlay 4、ManageLayout 4、MediaItemDetail 1、ManageMediaItems 1） | 37 | 6→8、10→8/12、14→16、18→16、26→24、28→24、30→32、42/44→40 |
| `manage/ManageMediaItemsPage.module.css:26` | 1 | `padding: 42px`→`--space-10`(40) |

- 建议执行方式：不搞全局 sed；按上表逐文件一次 commit 一文件；2px 发丝对齐类（icon-text）白名单保留。
- 影响面：全站视觉节奏统一。

**P2-2 · 字号收敛到 token（8 档非 token → 6 档）**
- 10.5px（`library.module.css:84` 铭牌标签）→ 12px caption；11px/11.5px（`shared.module.css` eyebrow/sectionTitle、cockpit kpiSubText）→ 12px；12.5px（`shared.module.css` metaText/input）→ 13px；13.5px（`TopBar.module.css:82` brand、cockpit 空态）→ 13px；28px（cockpit `kpiMainValue:77`）→ `--text-h1`(26px)；22px（`library.module.css:91` 铭牌数字）→ 保留但加注释或用 `--text-h2`(19px)。
- 影响面：全站文字阶梯唯一化。

**P2-3 · 硬编码色绕过 token**
- `host/src/pages/manage/overview/OverviewKpiCapsules.tsx:74`：`style={{ color: '#38bdf8' }}`（云盘图标，纯蓝）→ `var(--info)`（暗房下调色板已中性化，硬编码蓝在 manage 琥珀语境突兀）。
- `host/src/pages/manage/ManagePages.module.css:321-335` 与 `host/src/styles/base.css:90-97`：`option` 用 `#12171f/#f1f5f9/#1e293b/#0b0f14` → `var(--glass-bg-strong)`/`var(--text-1)`。
- `host/src/pages/manage/ManagePages.module.css:199`：`color: #04121a`（主钮文字）→ `var(--bg-base)`。

**P2-4 · 登录页 mfa 分支重复（死代码）**
- `host/src/pages/login/LoginPage.tsx:278-290`：连续两个完全相同的 `) : mfaChallenge ? (<MfaVerifyPanel …/>)` 三元分支，第二个永不可达。删一段。

**P2-5 · 登录卡片 padding 36px 裸值**
- `host/src/pages/login/LoginPage.module.css:217`：`padding: 36px` → `var(--space-8)`（32px）。卡内 `.form` 行距同步核对。

**P2-6 · 库大厅铭牌标签 10.5px + 双套 KPI**
- `host/src/pages/browse/styles/library.module.css:75`（10.5px）→ 12px；`LibrariesPage.tsx:84-86` chips 与 `:89-101` 铭牌都展示「内容总数/库数」→ chips 只留「最近更新：X」一个动态项，其余删（同 S7）。

**P2-7 · 术语直出 UI**
- `host/src/pages/install/InstallPage.tsx:217-225`（completed 分支）：「`restart_required = true`：为 true 时须重启服务…」→「安装完成。需重启服务后由主应用接管，然后即可登录。」布尔名与取值不必展示。
- `host/src/pages/manage/ManageSystemAboutPage.tsx:162`：「PATH 探测（-version 首行）」→「通过版本命令探测」。
- `ManageTaskCenterPage.tsx:109`：「今日起点：`<UTC 时间>`」→「今日 0 点起」+ 本地时区。

**P2-8 · 首页/历史页分区描述文案化**
- `HomePage.tsx:187,223,246` 与 `HistoryPage.tsx:131,143,155`：每个 BrowseSection 带一句「产品文案」（如「先扫一眼最近刚进库的片子，挑到就直接进。」）。建议：`BrowseSection.description` 默认不渲染，仅工具型副标题保留；或删除三处描述。省 3×24px 纵向。

**P2-9 · 条目详情 hero 评分两处**
- `item-detail/components/ItemDetailHero.tsx:108`（SmallStat「评分」）与 PosterBadges（`score`，同 `item.ratingLabel`，`ItemDetailPage.tsx:92`）同值。删 SmallStat 评分项（海报角标已有），SmallStat 剩 3 项。

**P2-10 · 指标卡栅格宽屏失控**
- `host/src/pages/manage/ManagePages.module.css:128-130`（`.metricsGrid` `auto-fit minmax(min(200px,100%),1fr)`）：1760px 内容宽下可排 8 列。建议宽屏 `grid-template-columns: repeat(4, minmax(0,1fr))`，中屏回落 auto-fit。

---

## 5. 建议修复批次（供裁决；本卡不改码）

| 批次 | 内容 | 预估 commit 数 |
|---|---|---|
| B1 立即 | P0-1（移除/接真任务队列 + 死链）、P0-2（文案）、P2-4（死代码） | 3 |
| B2 密度 | P1-3/P1-4/P1-5/P1-6（删重复展示）+ P2-6/P2-9（同值重复） | 5 |
| B3 结构 | P1-1（双 gutter）、P1-2（双控件）、P1-7（锚点+折叠）、P1-8（表格列）、P1-9（首屏块数）、P1-11（侧栏） | 6 |
| B4 阶梯 | P2-1/P2-2（逐文件收敛）+ P1-10 + P2-5 | 6-8 |
| B5 杂项 | P2-3/P2-7/P2-8/P2-10 + S3 页头文案统一（38 文件一次性替换规则） | 4-5 |

## 6. 方法与覆盖声明

- 枚举：`router/index.tsx` 全量读取；44 真实页面 + 4 布局壳；codegraph init 建索引（9,278 节点）用于符号定位（如 `ManagePageHeader` 38 处引用统计）。
- 字面量统计（间距/字号/文案）用 python3 正则扫描 `host/src` 全部 `.css/.tsx`，关键结论均回读源文件核对行号。
- 深读 25 个文件（§1 标注），长尾 24 页给共享面结论、不做页级断言；未运行任何构建/测试（按卡面约束）。
- 本报告未修改任何代码；`git status --porcelain` 除本文件外为空。
