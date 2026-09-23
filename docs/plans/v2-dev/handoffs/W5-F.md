# W5-F 交付说明

仓库：`fmby-web-main`（分支 `w/zcode/writer1-w5f-artplayer-parity`）。
提交：`0cce3e0`（①引擎默认）+ `0215157`（②handoff）。
判据（当前分支 HEAD = `a051b7d`，主代理已按既有工作流把 W5-E 合入本分支）：`pnpm verify` EXIT=0；host **299 pass / 0 fail**；shared 94 pass；component-size **0 违规**；零新依赖。
> 测试数归属：299 含随分支累积的 W5-E（+25）；**W5-F 自身增量 = +5**（`host/tests/player-config.test.ts`）。

---

## ① 默认播放引擎改 ArtPlayer（commit `0cce3e0`）

- `host/src/features/player/playerConfig.ts:6`：`DEFAULT_PLAYER_ENGINE: PlayerEngineId = 'dplayer'` → `'artplayer'`（**只影响未设置时**）。
- DPlayer **保留**：`PlayerEngineFactory.ts:7` 注册表 `dplayer: new DPlayerEngineAdapter()` 未动，仍可切换（`createPlayerEngine(opts, engineId)` / localStorage 偏好）。
- 已存本机偏好不受影响：`resolvePlayerEngineId()` 仍是「读到合法存储值就用存储值，否则用默认」。
- 新增 `host/tests/player-config.test.ts` 5 项防回归：未设置→artplayer / 已存 dplayer 保持 / 已存 artplayer 保持 / 非法值回退 artplayer / `dplayer` 仍合法且可设。
- 两引擎 CSS 早已就位（`PlayPage.module.css` 的 `:global(.dplayer)` 与 `:global(.artplayer)` 两段），无需改动。
- **ponytail**：一行改默认 + 一条防回归断言；跳过的是「引擎切换 UI」——仓内 `setPlayerEngineId` 无调用点（无设置页切换器），本次不新增（YAGNI，用户只要求改默认）。

---

## ② V1 web-gallery 能力核对（只读，不新建前端）

**方法**：`codegraph callers/node`（找符号/调用链）+ `FMBY_ALLOW_SYMBOL_GREP=1 grep`（仅字面量/中文，逃生阀已说明）+ python3 文件遍历。V1 源 `/data/projects/fmby-main/fmby/apps/web-gallery/src/`。

### A. 路由键覆盖（V1 `contract.ts` 的 `MANAGE_CONTRACT_ROUTE_KEYS` 全 27 键）

| V1 路由键 | 主前端落点 | 判定 |
|---|---|---|
| home | `pages/manage/ManageOverviewPage.tsx` | 已并入 |
| task-center | `ManageTaskCenterPage.tsx` + `task-center/` | 已并入 |
| media/add | `ManageAddMediaPage.tsx`（向导形态，指向既有页） | 已并入（形态变化） |
| media/items | `ManageMediaItemsPage.tsx` + `media-items/` | 已并入 |
| media/reviews | `ManageMediaReviewsPage.tsx` + `media-reviews/`（claim/release/resolve + ProviderSearch/Detail/MobileCard） | 已并入 |
| media/libraries | `ManageLibrariesPage.tsx` + `libraries/` | 已并入 |
| media/collections | `ManageCollectionsPage.tsx` + `collections/` | 已并入 |
| media/mounts | `ManageMountsPage.tsx` + `mounts/` | 已并入 |
| media/upstreams | `ManageUpstreamsPage.tsx` + `upstreams/` | 已并入 |
| media/probe-tasks | `ManageProbeTasksPage.tsx` + `probe-tasks/` | 已并入 |
| media/naming-scrape | `ManageNamingRulesPage.tsx` + `naming-rules/` | 已并入 |
| media/pan115-imghost | `pan115-imghost/`（`VITE_FEATURE_PAN115_IMGHOST` 门控，`router/index.tsx:520`） | 已并入（门控） |
| media/yun139-accounts | `yun139/` | 已并入 |
| site/users/registration-codes | `ManageRegistrationCodesPage.tsx` + `registration-codes/` | 已并入 |
| site/users/accounts | `ManageUsersPage.tsx` + `users/` | 已并入 |
| site/users/role-templates | `ManageRoleTemplatesPage.tsx` + `role-templates/` | 已并入 |
| site/rewards | `ManageRewardsPage.tsx` + `rewards/` | 已并入 |
| site/security/sessions | `ManageSessionsPage.tsx` | 已并入 |
| site/security/audit-logs | `ManageAuditLogsPage.tsx` | 已并入 |
| site/security/events | `ManageEventsPage.tsx` | 已并入 |
| site/security/runtime-logs | `ManageRuntimeLogsPage.tsx` + `runtime-logs/` | 已并入 |
| site/license | `ManageLicensePage.tsx` | 已并入（**冻结面，本次未碰**） |
| site/developer-api | `developer-api/` | 已并入 |
| site/telegram-bot | `ManageTelegramPage.tsx` | 已并入 |
| site/about | `ManageSystemAboutPage.tsx` | 已并入 |
| site/settings | `ManageSiteSettingsPage.tsx` + `site-settings/`（含 `SiteSettingsRegistrationSection.tsx`） | 已并入 |
| site/advanced | `ManageAdvancedPage.tsx` | 已并入 |

⇒ **路由键级：27/27 全覆盖，无缺失页面。**

### B. 命名面（card 特别看）

| V1 | 主前端 | 判定 | 证据 |
|---|---|---|---|
| `ManageNamingScrapeSurface`（命名与刮削） | `naming-rules/`（cleanup / custom terms / default terms / protected terms / preview / replay / signal grid / strategy / batch repair 共 14 组件） | 已并入 | `naming-rules/components/NamingScrapeBatchRepairSection.tsx:1`「V1F 拆分：scrape-sections.tsx → 独立组件」；`useNamingRulesMutations.ts` 的 replayIdentify/批量补刮 |
| `ai-intervention-section.tsx`（AI 干预会话） | **无消费** | **真缺** | 主前端 host/src + shared/src 对 `ai-interventions`/`aiIntervention` 命中 **0**（grep_exit=1）；V2 后端 `crates/fmby-v2-http/src/routes/ai_interventions.rs` + `router_manage.rs:239-267` 有 **6 端点**（threads / media/{id} / session/open / apply / session/message / session/close / media/{id}/suggest） |

### C. 115 图床面

| 能力 | 主前端 | 判定 |
|---|---|---|
| 凭据扫码绑定 / 解绑（四态 Active/Pending/Expired/Unbound） | `pan115-imghost/components/CredentialsCard.tsx` | 已并入 |
| 资产列表 + 镜像状态徽标 + host/local fallback | `AssetList.tsx` / `AssetCard.tsx`（`MIRROR_STATUS_LABELS` + StatusBadge + fallback） | 已并入 |
| 手动排障上传 | `UploadZone.tsx` | 已并入 |
| 治理模型说明块（新图片自动入队/历史可回补/本地副本可控）+ 成功/待处理/异常指标卡 | 仅 `共 N 张图片`（`AssetList.tsx:151`） | **小差异（登记）**：能力不缺，缺的是说明文案与 4 个指标 chip |

### D. 探针任务面

| 能力 | 主前端 | 判定 |
|---|---|---|
| 任务列表 + 状态/媒体库/数据源筛选 + 搜索 | `probe-tasks/components/ProbeTaskTable.tsx` | 已并入 |
| 详情弹窗（视频/音频/字幕流技术快照） | `ProbeTaskDetailModal.tsx`（252 行） | 已并入 |

### E. 拖拽排序（card 特别看）

| V1 | 主前端 | 判定 |
|---|---|---|
| `@dnd-kit/*` 的 `DisplayOrderEditor`（用于 libraries + collections 排序） | **未引入 dnd-kit**；改为上/下移按钮（键盘可达、`aria-label`「上移/下移」、边界禁用）：`libraries/LibraryTable.tsx`、`collections/components/CollectionListTable.tsx:171,180`、`CollectionMemberPanel.tsx:89,98` | **已被主前端另一形态取代**（功能等价，交互由拖拽→按钮） |
| 「播放列表排序」 | V1 web-gallery 无 playlist 概念（python 遍历 `.ts/.tsx/.css` 对 `playlist`/`播放列表` 命中 **0**） | 不存在 |

### F. 基础设施文件（V1 web-gallery 架构件）

| V1 | 主前端等价 | 判定 |
|---|---|---|
| `contract-route-registry.tsx` / `contract-surfaces.tsx`（契约路由插件系统） | `host/src/app/router/index.tsx`（lazy 路由）+ `layouts/ManageLayout.tsx`（导航树） | 已被取代 |
| `item-context.ts`（剧集排序 / 可播 id / 背景图） | `browse/item-detail`（`EpisodeRow.tsx`、`formUtils.ts`） | 已被取代 |
| `media-ui.tsx`（asset-image 重试/品牌字） | `browse/components/PosterMediaCard.tsx` 的 `usePosterUrl` + `onError` fallback | 已被取代 |
| `media-mappers.ts` | `shared/src/contracts/manage/*/mapping` | 已被取代 |
| `auth/IdentityPanels.tsx`（三方登录） | `pages/login/forms/IdentityLoginPanel.tsx` + `IdentityCompletionPanel.tsx` | 已并入 |

### G. 真缺汇总（**只登记，不自行开卡**，交主代理）

1. **AI 干预会话面**：V2 后端已备 6 端点（`/api/manage/ai-interventions/*`），主前端零消费。V1 来源 `manage/naming/ai-intervention-section.tsx`（设置面 + 会话线程列表 + 详情面板 + provider 面板 + 应用结果）。**需主代理决定是否开卡**。
2. **账号身份绑定面**：V2 后端已备 3 端点（`/api/account/identity-bindings` 的 list / start / complete，`router_core.rs:95-105`），主前端 `shared/src/contracts/auth/identity` **无绑定方法**、零消费。V1 来源 `settings/ProfileIdentityBindingsPanel.tsx`。**需主代理决定是否开卡**。
3. **115 图床治理说明 + 指标卡**（小差异，非能力缺）：`AssetList` 仅显示总数，缺成功/待处理/异常 chip 与治理模型文案。

### codegraph 查证记录
- `codegraph callers "resolvePlayerEngineId" -p .` → 仅 `PlayerEngineFactory.ts:1`
- `codegraph callers "setPlayerEngineId" -p .` → **无调用点**（故无引擎切换 UI）
- `codegraph callers "createPlayerEngine" -p .` → `VideoPlayer.tsx:10` 等
- `codegraph callers "DisplayOrderEditor" -p /data/projects/fmby-main/fmby/apps/web-gallery` → `ManageLibrariesSurface.tsx:33`、`collection-surface-sections.tsx:183`

**ponytail 一句**：核对只做只读对拍，跳过的是「为三个真缺项直接开卡」——按卡面红线真缺只登记交主代理；dnd-kit 不引入（主前端已有等价按钮排序，YAGNI）。
