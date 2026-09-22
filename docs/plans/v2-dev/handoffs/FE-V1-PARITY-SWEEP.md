# FE-V1-PARITY-SWEEP 交付报告（P1 只读审计）

- 分支：`w/zcode/writer1-fe-v1-parity-sweep`（基线 = 前端 `origin/main` @ `81b24fd`）
- 性质：**只读**——不改任何代码/契约；仅做机械扫描 + 定性 + 卡草案。
- 动因：媒体库排序 UI、合集 B3 均属「V1 有、V2 前端缺」同类；请机械扫一遍，找出同类缺口。

---

## 0. 方法（两条线 + 三集合差集）

**页面级**：枚举 V1 管理面（`apps/web/src/pages/manage` + `apps/web-gallery/src/manage` + `web-gallery/src/pages/manage.tsx`）与 V2 管理面（`host/src/pages/manage`）的页面/入口。

**功能级**：不比页面存在，而比**端点消费**——因为 V2 管理面页面大多已建，但内部操作可能缺失。

三集合（均从源码机械提取，非人工枚举）：

| 集合 | 来源 | 数量 |
|---|---|---|
| **B**（V2 后端端点） | `FMBY-V2/crates/fmby-v2-http/src/routes/**` 的 doc-comment `` `VERB /api/manage/...` ``（后端作者写的权威真值） | 239 声明 / **212** 去重规范化 |
| **F2**（V2 前端消费） | `shared/src/contracts/**` + `host/src/**` 的 `httpClient.<verb>(` 真实调用路径 | 105 路径 |
| **F1**（V1 前端调用） | `apps/web/src/**` + `apps/web-gallery/src/**` 的 `/api/manage/...` 路径 | 204 路径 |

**真缺口判定**（本卡核心）：
```
真缺口①  =  B ∩ F1 ∩ ¬F2
        （V2 后端有端点 且 V1 前端也调用 且 V2 前端零消费）
```

**噪声控制（重要）**：纯路径字符串匹配会因嵌套泛型（`httpClient.get<RawX<Y>>(`）、模板串 `${encodeURIComponent(id)}` 截断产生**假阳性**。因此每条候选都经**第二道核对**：
1. 看 V2 契约层对应 `api.ts` 是否有同名 `async` 方法；
2. 看 V2 页面层 `.tsx` 是否实际调用该方法。

仅当「契约层零方法 + 页面层零调用」才判定为①；若契约有方法但页面未接 UI，单独标注为「同页缺操作」子型。

---

## 1. 汇总数字

| 指标 | 数值 |
|---|---|
| V2 后端 `/api/manage` 端点（去重） | 212 |
| 机械差集（B ∩ ¬F2，含噪声） | 101 |
| 机械差集且 F1 也为真（B ∩ F1 ∩ ¬F2） | **57** |
| 经契约层+页面层双重核对后的**确证真缺口①** | **41 端点**（带后端 file:line） |
| 其中：整面/整集成未移植（大卡） | 4 面（microsoft / yun139 / auth-providers / developer-endpoints） |
| 其中：同页缺操作/字段（小卡） | 6 组（media-items / mounts / operations / rewards / pan115 / upstreams） |
| 设计差异②（V1 有、V2 后端无端点 → V2 故意未做） | 见 §4（约 10 类） |
| 已对齐③（本卡扫描证明已补齐的历史项） | 见 §5（5 项） |
| 诚实边界（无法判定项） | 见 §6 |

> 机械差集 57 → 确证 41 的差额 = 16 条假阳性，主要来自：
> - `media-reviews/{id}/claim|release|resolve` 3 条：V2 契约 `media-reviews/api.ts:151-181` **已有方法**，且 `ManageMediaReviewsPage.tsx:46-66` **已接 UI** → 实际已消费，纯路径匹配因嵌套泛型漏抓。
> - upstreams 的 `apple-cms/*`、`emby/libraries|discover-libraries`、`mapping/*`、`enable/disable/health-check`、`bindings` 共约 13 条：V2 `upstreams/api.ts:301-422` **已全部消费** → 假阳性。
> 这证明「路径级差集」必须二阶核对，否则会虚报约 28% 的缺口。

---

## 2. 确证真缺口① 对位表（V1 面 | V2 面 | 定性 | 证据）

### 2.1 整面/整集成未移植（大卡）

| 资源 | V1 面（功能） | V2 面（现状） | 定性 | 后端证据 file:line |
|---|---|---|---|---|
| microsoft/auth | V1 `ManageMicrosoftAuth*`（OAuth 登录/令牌导入） | V2 零契约、零页面（license 契约仅提及） | ①整面未移植 | `manage_microsoft.rs:223/232/244/254/267/279/294/306/318` |
| yun139 | V1 `yun139-accounts`（天翼网盘账户/扫码登录） | V2 零契约、零页面 | ①整面未移植 | `yun139_accounts.rs:128/141` |
| auth-providers | V1 `ManageAuthProviders`（认证提供商配置/诊断） | V2 零契约、零页面 | ①整面未移植 | `manage_auth_providers.rs:98/109/124` |
| developer/endpoints | V1 `developer`（开发者 API 端点清单） | V2 零契约、零页面（V2 后端仅此 1 端点） | ①整面未移植 | `manage_developer_api.rs:1` |

### 2.2 同页缺操作/字段（小卡）

| 资源 | V1 面（功能） | V2 面（现状） | 定性 | 后端证据 file:line |
|---|---|---|---|---|
| media-items 详情 | V1 媒体项详情：可见性切换/人工匹配/供应商搜索/识别/刮削/刷新元数据/重置 | V2 `mediaItems` 契约**缺** visibility/manual-match/provider-search/identify/scrape/refresh-metadata/metadata-reset 方法及子资源 DELETE | ①同页缺操作 | `manage/media_items.rs:229/325`、`media_identity.rs:36` 等 |
| mounts | V1 挂载列表「批量刷新异常」按钮 | V2 `mounts` 契约**缺** `batch/refresh-abnormal` | ①同页缺操作 | `manage/mounts.rs:66` |
| operations | V1 运营面板：数据源加载状态 / 活跃播放流监控 | V2 `ManageOperationsPage` 仅消费 `overview`，**缺** `data-sources/load` + `playback/active` | ①同页缺操作 | `manage_operations_gap.rs:5/6` |
| rewards | V1 积分：媒体请求列表/规则/统计/积分调整/状态流转 | V2 `ManageRewardsPage` 仅消费 `config` + 按用户 `accounts/ledger`，**缺** media-requests/rule/stats/points-adjust/transition | ①同页缺操作 | `manage.rs:732/751`、`manage_rewards.rs:83/94/112/126` |
| pan115 | V1 115：分享下载预览（创建/扫码）/分享项浏览/同步 | V2 `pan115` 契约消费了 qr/activate/account/browse，但**缺** share-download-preview/*、share-items/browse、sync/mounts | ①同页缺操作 | `pan115_share_download.rs:52/65/90/206`、`pan115_sync.rs:3` |
| upstreams | V1 上游：emby 导入/同步、apple-cms 同步、同步任务监控 | V2 `upstreams` 契约已消费 apple-cms/categories+discover+bindings、emby/libraries+discover-libraries+library-bindings、mapping/*、enable/disable/health-check，但**缺** emby/import(+preview)/sync、apple-cms/sync(+sync-page)、sync-jobs(+{job_id})、emby/import/jobs | ①同页缺操作 | `upstream_sync.rs:44/57/75/93/111/129/147/162` 等 |

---

## 3. 卡草案（每个①一条小卡）

> 验收标准统一含：①新增/扩展契约层 `async` 方法（snake_case wire，参照既有 `XxxApi` 范式）；②页面层接 UI + react-query mutation；③`host/tests/*.test.ts` 补 wire 对拍（node --test，stub fetch）；④`pnpm verify` 全绿。
> 红线（继承本仓纪律）：后端零改动、契约文档零改动、不引新依赖、失败态分清 404/409/403/401 不吞成空。

### 大卡（整面未移植）
- **FE-PARITY-MICROSOFT**：范围=微软 OAuth 登录集成前端（config-status/profiles 展示 + start/complete/token/* 全流程 UI）。改 `shared/src/contracts/manage/microsoft/`(新) + `host/src/pages/manage/microsoft/`（新页面，挂 `ManageLayout` 导航）。
- **FE-PARITY-YUN139**：范围=天翼网盘账户管理（qr-login/qr-status 扫码绑定 UI）。改 `shared/src/contracts/manage/yun139/`(新) + `host/src/pages/manage/yun139/`(新)。注：V1 的 account-pools/credential-profiles/previews 在 V2 后端**无端点**，不纳入。
- **FE-PARITY-AUTH-PROVIDERS**：范围=认证提供商列表/配置/诊断。改 `shared/src/contracts/manage/auth-providers/`(新) + `host/src/pages/manage/auth-providers/`(新)。
- **FE-PARITY-DEVELOPER-ENDPOINTS**：范围=开发者 API 端点清单查看页（只读展示）。改 `shared/src/contracts/manage/developer/`(新) + `host/src/pages/manage/developer/`(新)。注：V1 的 api-tokens/subjects 在 V2 后端无端点，不纳入。

### 小卡（同页缺操作）
- **FE-PARITY-MEDIA-ITEMS-DETAIL**：范围=媒体项详情补全 `visibility/{state}`、`identity/manual-match`、`provider-search`、以及 `identify`/`scrape`/`scrape/refresh`/`refresh-metadata`/`metadata/reset` 与子资源 DELETE（artwork/subtitles/sources）。改 `shared/src/contracts/manage/media-items/api/*`(扩展) + `host/src/pages/manage/media-item-detail/`(扩展)。**最高频管理操作，建议优先**。
- **FE-PARITY-MOUNTS-REFRESH**：范围=挂载列表「批量刷新异常」按钮。改 `shared/src/contracts/manage/api.ts`(扩展 mounts 段) + `host/src/pages/manage/ManageMountsPage.tsx`(扩展)。
- **FE-PARITY-OPERATIONS-EXTRA**：范围=运营面板补 `data-sources/load` + `playback/active` 两块监控卡。改 `shared/src/contracts/manage/operations/api.ts`(扩展) + `host/src/pages/manage/ManageOperationsPage.tsx`(扩展)。
- **FE-PARITY-REWARDS-EXTRA**：范围=积分媒体请求/规则/统计/积分调整/状态流转 UI。改 `shared/src/contracts/manage/peripherals/api.ts`(扩展 rewards 段) + `host/src/pages/manage/ManageRewardsPage.tsx`(扩展)。
- **FE-PARITY-PAN115-SHARE**：范围=115 分享下载预览/分享项浏览/同步 UI。改 `shared/src/contracts/manage/pan115/api.ts`(扩展) + `host/src/pages/manage/pan115/`(扩展)。
- **FE-PARITY-UPSTREAMS-SYNC**：范围=上游 emby 导入/同步、apple-cms 同步、同步任务监控 UI。改 `shared/src/contracts/manage/upstreams/api.ts`(扩展) + `host/src/pages/manage/upstreams/`(扩展)。

---

## 4. 设计差异②（V1 有、V2 后端无对应端点 → V2 故意未做，等裁决）

以下 V1 前端调用了但 V2 后端**完全没有**端点，故不是「V2 前端缺」，而是 V2 架构层面未实现，需主代理确认是否排期：

| V1 端点（示例） | 说明 | 建议定性 |
|---|---|---|
| `/api/manage/migration/{export,import,inspect}` | 数据迁移工具 | ② V2 无迁移需求 |
| `/api/manage/mounts/rclone-rc/*` | rclone 远程管理 | ② V2 用不同挂载机制 |
| `/api/manage/runtime-log-archives/*` | 运行日志归档 | ② V2 用 runtime-logs/export 替代 |
| `/api/manage/ai-interventions/{threads,session/*,media/{id}/apply}` | 会话式 AI 干预 | ② V2 仅实现 `media/{id}/suggest` 单条建议 |
| `/api/manage/users/{emby-import/*,reports/*}` | emby 导入/用户报告 | ② V2 未移植 |
| `/api/manage/collections/imports/douban/*` | 豆瓣导入 | ② V2 后端无此端点 |
| `/api/manage/task-center/{person-metadata/historical-seeds/cancel,pipeline-gaps,actions/batch}` | 任务中心扩展 | ② V2 后端无对应 |
| `/api/manage/pan115/{previews/*,share-mounts}`、`/api/manage/yun139/{account-pools,credential-profiles,previews,share-links/browse}` | 115/139 扩展面 | ② V2 后端未实现（仅 yun139 qr-login/qr-status 有） |
| `/api/manage/developers/{api-tokens,subjects}` | 开发者令牌/主体 | ② V2 后端仅 `developer/endpoints` 有 |

---

## 5. 已对齐③（本卡扫描证明已补齐，非缺口）

为证明扫描覆盖完整，列出用户点名的「已知已补」项在 V2 后端/前端的当前状态：

| 项 | V2 后端端点 | V2 前端消费 | 状态 |
|---|---|---|---|
| 媒体库排序 UI | `PUT /api/manage/libraries/order` | `libraryOrder.ts` + `ManageLibrariesPage` 重排按钮 | ✅ 已对齐 |
| 合集 B3（presets/rules/sync/member 操作） | `collections/presets`、`presets/create`、`rules/preview`、`{id}/rules`、`{id}/sync`、`members/{add,remove,reorder}`、`order` | `CollectionPresetCreate`/`CollectionRulesPanel`/`CollectionMember*` | ✅ 已对齐 |
| 删除乐观 UI | `DELETE libraries/{id}`、`DELETE mounts/{id}` 等 | 契约层 `params:{confirmed:true}`（CONFIRM-GATE-ALIGN）+ 乐观更新 | ✅ 已对齐 |
| 邮件通道前端 EMAIL-WEB-UI | `GET/PUT /api/settings/server/email`、`/test`、`password-reset/*`、`/api/admin/site-settings` | `ManageEmailChannelPage` + login 流程 | ✅ 已对齐 |
| 媒体项危险操作 `?confirmed=true` | 14 条删除类端点（popup-only）+ 20 条非删除类 | 前端带上 `?confirmed=true`（无害） | ✅ 已对齐 |

> **口径修正（用户 2026-09-22 通知，已采纳）**：后端已按用户裁定**去掉删除类 `?confirmed=true` 闸**（14 条删除改为 popup-only；保留 20 条非删除类）。因此「前端已带、后端缺失则 400」的推论**不再成立**——现在多带参数无害。本卡所有定性不依赖该推论；前述「已对齐」表第 5 行据此更新为「无害」。

---

## 6. 诚实边界（无法判定项）

1. **页面级对位未逐页深读 V1**：本卡以「端点消费」为锚（比页面存在更精确），未对 V1 每个管理页做像素级功能清单。若需精确到「V1 某页某按钮」级对位，需另开人工读 V1 页面卡。
2. **media-items 详情子资源 DELETE（artwork/subtitles/sources）**：后端有端点（`media_metadata.rs:149/176/301/358`、`manage/media_items.rs:65/83`），V2 前端 `media-items` 契约**部分**消费（artwork POST/subtitles POST 有，DELETE 无）。归入 §3 `FE-PARITY-MEDIA-ITEMS-DETAIL` 卡范围，但未单独列端点（避免与可见性/匹配等混淆），实施时以「契约层缺哪些方法」为准再精确。
3. **operations `data-sources/load` / `playback/active`**：V2 后端 `manage_operations_gap.rs` 为「gap」类端点，可能 V2 设计上归到别处或尚未启用。建议实施前先查该端点实际返回，避免建空壳 UI。
4. **upstreams `sync-jobs` 监控**：V2 已消费 `emby/libraries` 等但 sync-jobs 无——可能 V2 同步走不同机制，实施前确认 `upstream_sync.rs` 的 job 模型。
5. **机械差集噪声**：路径级匹配对嵌套泛型/模板串敏感（见 §1）。任何「V2 前端零消费」结论都以「契约层+页面层二阶核对」为准；本报告 41 条均经此核对。
6. **V2 后端端点清单来源为 doc-comment**：后端作者承诺「路径以 V1 真值为准」，但个别端点可能代码与注释不一致。实施每张卡时仍应以 `curl` 实测为准（沿用 EMAIL-E2E-SMOKE 的真实栈纪律）。

---

## 7. 优先级建议

- **P1（最高频、低风险、同页扩展）**：`FE-PARITY-MEDIA-ITEMS-DETAIL`（媒体项详情操作）、`FE-PARITY-MOUNTS-REFRESH`、`FE-PARITY-OPERATIONS-EXTRA`。
- **P2（整面未移植、工作量大）**：`FE-PARITY-REWARDS-EXTRA`、`FE-PARITY-PAN115-SHARE`、`FE-PARITY-UPSTREAMS-SYNC`。
- **P3（整集成，需主代理确认 V2 是否要这些集成）**：`FE-PARITY-MICROSOFT`、`FE-PARITY-YUN139`、`FE-PARITY-AUTH-PROVIDERS`、`FE-PARITY-DEVELOPER-ENDPOINTS`。这些 V1 有但 V2 产品定位可能不打算做，建议先裁决②再排期。

---

*扫描脚本可复现：三集合提取 + 规范化差集（嵌套泛型/模板串修正）+ 契约层方法名二阶核对。原始机械差集 57 → 二阶核对后确证 41。所有①均带后端 `file:line` 证据。*
