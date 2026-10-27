# REVIEW-RV-D-FRONTEND —— 前端代码审计（只读评审 · fmby-web）

> 评审席：**rv3-frontend**（席目录 `/data/fmby-seats/rv3-frontend`）｜分支 `seat/rv3/rv-frontend`
> 基线：`fmby-web origin/main = 99acc73`（2026-10-24）｜后端对照基线：`fmby-v2 origin/main = a7c8c15b79`（2026-10-27，经 `git archive` 展开到 `/tmp/fmby-v2-main`，非本地推测）
> 纪律：**只读评审，未改任何生产代码**（`git status --porcelain` 空，见 §9 复现清单）。所有扫描脚本写在 `/tmp`，报告是唯一写入物。
> 证据分级：**实测**＝我当次跑的命令原文；**引用**＝读上游源码/文档；**推断**＝我据证据推出、未实测。

---

## 结论（一句话）

**需返工 + 需裁决**：无「阻断发布的 P0」（未发现可被绕过的授权面，服务端 capability 闸确实在拦），但有 **1 条真数据丢失 P1**（元数据编辑的 3 个字段被后端 serde 静默丢弃、前端还报「已保存」）、**1 条用户可点但静默失效的 P1**（media-items 三个筛选）、**1 条「二次确认只在前端」的 P1 需裁决**（`session_confirmation` 在全后端**零读取**）、以及 **fmby-web main 上 `pnpm repo-size` 当前是红的**（`pnpm verify` 含此闸 ⇒ 后端 CI 的 `frontend` job 应为红）。另有 4 处「打了卡没接线」的死模块、e2e 43 条登记红 + 27 个 spec 全体 `test.skip`。

---

## 一、先交清单（总纲 §10）

### P0（阻断发布）
**无**（在本卡已核验范围内）。我特意去查的三条 P0 候选与结论：
1. 「只用前端做鉴权」→ **未见**：全部前端门控取自后端下发的 capability（`host/src/guards/PermissionGate.tsx:26-31`、`host/src/app/guards/CapabilityGuard.tsx`），且 FE 的 8 个能力串与后端 `Capability` 枚举**逐值一致**（见 §5 对账）。
2. 「密钥/内网地址进前端产物」→ **未见**：`shared/src`+`host/src` 无真密钥（唯一命中是测试夹具与 `192.168.1.10` 之类的 placeholder）；无 `.env*` 文件；构建期变量只有 `VITE_FEATURE_PAN115_IMGHOST`（`host/src/featureFlags.ts:11`）。
3. 「把后端错误码当成功」→ 未发现吞成成功；已知的 404/500/501 分支被显式归类为「数据面未就绪」并**不改写为成功**（`shared/src/contracts/manage/casAdmin/api.ts:360-372` 等），且多处代码注释明确写「绝不能把业务 404 算成未装配」。

### P1（发布前必修 / 需裁决）

| # | 位置 | 问题 | 影响 | 类别 |
|---|---|---|---|---|
| **P1-1** | FE `shared/src/contracts/manage/media-items/api/mappers-payload.ts:42-56` ↔ BE `crates/fmby-v2-contracts/src/dto/manage_media_metadata.rs:71-88` | 元数据编辑发 `original_title` / `directors` / `actors`，后端结构体**没有这三个字段**且无 `deny_unknown_fields` ⇒ serde 静默丢弃；FE 仍弹「元数据已保存」 | 管理员改「原始标题 / 导演 / 演员」→ 保存成功提示 → 刷新后值回退（草稿漂移提示）。**静默数据丢失 + 假成功** | 契约漂移（body） |
| **P1-2** | FE `…/media-items/api/mappers-payload.ts:20-40` + `host/src/pages/manage/ManageMediaItemsPage.tsx:55-70` ↔ BE `crates/fmby-v2-contracts/src/dto/manage.rs:155-170` | media-items 列表发 `sourceStatus`/`metadataStatus`/`hasLocalOverride`（+死声明 `mountStatus`/`hasPoster`/`hasSubtitle`），后端 `MediaItemsQuery` 无这些字段、SQL 也不筛 | 「来源状态 / 元数据状态 / 本地覆盖」三个下拉**点了没反应**（页面无本地过滤：`ManageMediaItemsPage.tsx:197` 只用 `hasLocalOverride` 算了个计数徽标） | 契约漂移（query，静默） |
| **P1-3** | FE `shared/src/ui/common/SensitiveActionDialog.tsx:43-94`、`shared/src/contracts/manage/mapping/payloads.ts:72-73` ↔ BE `state/manage_users.rs:67,207,214,234,243`、`state/registration_codes.rs:85`、`application/media_identity.rs:35` | 危险操作的「输入密码 + 输入确认串」二次确认**只在前端**：`session_confirmation` 在**全后端生产代码零读取**（仅测试与结构体出现），`current_password` 在这些危险端点也未被校验；后端注释自认「接受但不做二次校验」 | 拿到会话即可执行删除类破坏操作，无需再认证；产品 UI 却让人以为有二次校验 | 需裁决（前端安全剧场 vs 有意设计） |
| **P1-4** | `scripts/check-repo-size.mjs`（`pnpm repo-size`） | main 上红：入库二进制 1332.0 KiB > 1024 KiB（15 张 `docs/evidence/**/samples/*.png`）；而 `package.json:17` 的 `pnpm verify` **包含** `repo-size` | 文档/README 声称「repo-size ✓」，后端 `ci.yml` 的 `frontend` job 跑 `pnpm verify` ⇒ 该 job 应为红 | 门禁真红（未登记） |
| **P1-5** | 4 处模块**零外部引用** | `host/src/pages/_placeholder/PlaceholderPage.tsx`（43 行）、`host/src/pages/manage/mounts/components/MountCredentialGuidance.tsx`（72 行）、`host/src/pages/manage/task-center/components/AsyncJobsSection.tsx`（139 行）、`shared/src/utils/imageProbe.ts`（63 行） | 「打了卡没接线」：凭据过期引导、任务中心后台任务区、204 裂图探测修复**都没上线**；`imageProbe` 还让 `check-contract-drift` 报了一条只靠参数段吸收的伪路径 | 死代码 / 未接线 |

> P1-1/2/3 的完整证据链（含后端 file:line）见 §3；P1-4 见 §4.1；P1-5 见 §4.2。

### 需主代理投农场（本机重活已硬禁）
本卡需要但本机跑不了的：**`tsc --noEmit` 类型检查**与**单测/端到端真跑**（我实测：`npx tsc` 被 `fmby-queue` 排队 7 分钟未启动，队列里已有 5 个 cargo 重活；loadavg 7.3–8.8，已按广播停手）。

「**需主代理投农场**：建议命令 `FMBY_ORCHESTRATOR=1 bash scripts/farm.sh seat/rv3/rv-frontend test --node node62`」

期望看到什么（判据）：
1. `pnpm -r test`（host 132 个 `.test.ts` / 981 个用例、shared 26 个文件）**0 fail**；特别是 `host/tests/media-items-detail.test.ts` 仍应全绿（它**没有**覆盖 P1-1 的 body 形状 —— 见 §4.3）。
2. `pnpm --filter @fmby/v2-host typecheck`（= `tsc -p tsconfig.app.json --noEmit`）**exit 0**。这是本报告唯一「未独立核验」的绿。
3. 若要验 P1-1 的修法，RED 判据（我建议的新测试）：`assert.deepEqual(bodies[0], {title:…, directors:['A'], actors:[…], original_title:…})` —— 现在拿 BE main 对跑必然差三个键。

---

## 二、我独立复核过的主代理线索（逐条）

| # | 主代理说的 | 我的复核结论 | 证据（file:line + 命令输出） |
|---|---|---|---|
| 1 | 「前端发 `/manage/media-items ?hasSubtitle`，后端未声明 ⇒ serde 静默丢弃」 | **成立，且不止 1 条**：真源在**后端仓**（`fmby-v2`），前端仓 `shared/` 只是调用方而非契约真源；同一形态共 **6 条**（3 条用户可点、3 条死声明），另有 3 条 browse 条目是**闸的误报**（见 §三 更正） | 我跑后端 main 的闸：`node scripts/check-fe-be-query-parity.mjs --fe /data/fmby-seats/rv3-frontend` ⇒ `[DRIFT]…（9 条）`，其中 `/manage/media-items ?sourceStatus/mountStatus/metadataStatus/hasLocalOverride/hasPoster/hasSubtitle` + `/browse/libraries/{} ?resolution/watched/sort`。BE 结构体：`crates/fmby-v2-contracts/src/dto/manage.rs:155-170`（只有 page/pageSize/keyword/libraryId/mediaType/sortBy/sortOrder） |
| 2 | 「前端权限不是安全边界，但错法会误导用户」 | **成立且已定位具体误导点**：能力门是后端驱动的（好），但「危险操作二次确认」是纯前端剧场（P1-3） | 见 §3.3 |
| 3 | 「安全绿：XSS 面 / 敏感信息 / 错误处理」 | **复核与总纲一致（绿）**：生产码 `dangerouslySetInnerHTML` 0 处、唯一 `innerHTML` 是播放器清容器（`host/src/features/player/engines/ArtPlayerEngine.ts:17`）；`target="_blank"` 9 处**全部**带 `rel="noopener noreferrer"/"noreferrer"`；无密钥入库 | 扫描命令见 §9-③ |
| 4 | 「e2e 门禁形同虚设（无二进制 ⇒ 全 skip）」 | **成立，并给出量化**：27 个 spec / 104 个 test 全部首行 `test.skip(!E2E_ENABLED)`；`scripts/e2e-known-red.txt` 登记 **43 条**已知红（issue #150×38、#122×5）；另有 3 处 `test.skip(true, …)` 永久跳 | `python3` 统计（§9-④）；台账原文 `scripts/e2e-known-red.txt` |
| 5 | 「`check-fe-be-query-parity` 的 `--json` 必须纯 JSON（其自陈口径 #3）」 | **闸自己违反自己的口径**：`--json` 模式下 stdout 第一行是中文日志 `（扫描前端仓：…）`，消费方直接 JSON.parse 会炸（我首次就炸了） | `node scripts/check-fe-be-query-parity.mjs --json` → 首行非 `{`；脚本 `scripts/check-fe-be-query-parity.mjs` 中该 `console.log` 在 `asJson` 分支之前 |

---

## 三、对主代理线索的更正（§9 要求单列）

### 更正 1：browse 库详情的 `resolution/watched/sort` **不是** wire 漂移（闸的 3 条误报）

- 闸的口径是「params 对象里出现的字面量键 = 已发」。但 FE 的 HTTP 客户端 `buildUrl` **跳过 `undefined`**：
  `shared/src/api/client/core.ts:78-88`（`if (value !== undefined) url.searchParams.set(...)`）。
- 这三个键在 `shared/src/contracts/browse/api.ts:129-138` 里传的是 `params.resolution / params.watched / params.sort`，而唯一的调用方 `shared/src/viewmodels/useLibraryDetail.ts:88-100` **只传 `cursor/pageSize/mediaType`** ⇒ 三键恒 `undefined` ⇒ **不上 wire**。
- 反证（穷举调用点）：`python3` 扫全仓 `getLibraryDetail(` ⇒ 仅 4 处，browse 版只有 `useLibraryDetail.ts:92` 一处调用（另 3 处是 manage 的同名 API）。
- 结论：`check-fe-be-query-parity` 在这 3 条上是**误报**；同仓另一闸 `check-query-params` 的 `KNOWN_GAPS` 判断（「前端死声明，不构成 wire 缺口」）**是对的**。
- 但**另有真问题**（P2-3）：这三个筛选是**纯本地过滤**（`useLibraryDetail.ts:126-146`），只作用于**已加载的页**，而后端响应仍在 advertise 这些筛选项（`shared/src/contracts/browse/api.ts:284-293` 从 `record.resolutions/watched_states/sort_options` 取选项）⇒ 用户选完看到「筛选后没有匹配内容」，但翻页后又会冒出匹配项。

### 更正 2：「后端有但前端没接」的两张表里，`/collections`、`/items/{}`、task-center、member-candidates 是**我的脚本误报**，已用二次手段推翻

我按闸的相同思路做了反向对账（后端可接受的 query 名 − 前端实发名），首轮输出把 `/collections`、`/items/{}`、`/manage/task-center/items` 报成缺口。**二次核实后全部推翻**：
- `/collections` 有两个同名归一化路径：v2 的 `manage_collections::collections_public_list`（`router_core.rs:216`）与 Emby 兼容的 `compat::collections`（`fmby-v2-compat/src/routes/collections.rs:66`），我把后者字段（`StartIndex/Limit/SearchTerm/api_key`）并进了前者的允许集 ⇒ 假阳性。兼容路由实际挂在 `/emby`、`/jellyfin` 下（`fmby-v2-compat/src/routes/table.rs:89-98`、`fmby-v2-server/src/factory/interfaces_router.rs:359`），与 `/api/collections` 无交集。真结构体 `CollectionsListQuery`（`manage_collections.rs:91-101`）**接受** page/pageSize/search。
- `/items/{id}/descendants` ⇒ `ItemDescendantsQuery`（`crates/fmby-v2-http/src/routes/items.rs:22-27`）接受 page/pageSize/cursor ⇒ FE 的 `page=1&pageSize=limit` 合法。
- `/manage/task-center/items` ⇒ `TaskCenterItemsQuery`（`routes/manage_task_center.rs:90-116`）接受 category/status/from/to/page/size/first ⇒ FE 6 个参数全合法。
- `/manage/collections/member-candidates` ⇒ FE 确实发 `keyword`（`shared/src/contracts/manage/peripherals/api.ts:575`），是我的提取脚本漏了 ES6 简写 `{ keyword }`。
- **教训**：闸/脚本的「按 struct 名取字段 + 同路径并集」必然会踩这种坑；我这次的判定一律回到「读 handler 签名 + 读结构体原文」。

### 更正 3：「播放页字幕 URL 404」——我先怀疑、后推翻（留档，防复核者重复走）

- FE `host/src/pages/browse/PlayPage.tsx:274-276` 会把不带 `/` 的轨 id 拼成 `/api/assets/subtitles/{id}`，而后端字幕路由是 `/api/assets/media-items/{item_id}/subtitles/{override_id}`（`crates/fmby-v2-http/src/routes/router_core.rs:174`）⇒ 看上去像 404。
- 但后端**给的 id 本身就带前导 `/`**：`crates/fmby-v2-bridges/src/bridges/playback/session_service.rs:578-587` 生成 `"id": "/api/assets/media-items/{item_id}/subtitles/{override_id}"`，且被服务端契约测试钉住（`crates/fmby-v2-server/src/tests/subtitle_route_tests.rs:637-641`）⇒ FE 走 `startsWith('/') ? '' : …` 分支，URL 正确。**非缺陷**；仅登记为 P2 脆弱性（那个兜底前缀匹配不到任何后端路由）。

---

## 四、我新发现的问题

### 4.1 P1-4：fmby-web main 上 `pnpm repo-size` 真红（未登记）

```
$ cd /data/fmby-seats/rv3-frontend && node scripts/check-repo-size.mjs
=== FMBY v2 Repo Artifact Budget Gate (REPO-HYGIENE-01) ===
二进制/产物文件：15 个
总量：1.30 MiB / 上限：1.00 MiB（130%）
按目录（Top）： 1.30 MiB  docs/evidence
最大文件（Top 5）：
   296.2 KiB  docs/evidence/fe-opt-02/samples/tablet-768/home.png
   210.1 KiB  docs/evidence/fe-ui-accept-node62/samples/desktop/naming-header.png
   142.5 KiB  docs/evidence/fe-ui-accept-node62/samples/desktop/manage-cockpit.png
   131.5 KiB  docs/evidence/fe-opt-02/samples/desktop-1280/manage-site-settings.png
   124.0 KiB  docs/evidence/fe-opt-02/samples/tablet-768/manage-site-settings.png
[FAIL] 仓库体积门禁未通过。
```
（我自己用 `git ls-files` 复算：15 个 png，合计 **1332.0 KiB** ⇒ 与闸一致，非工作区污染。）

- 该闸在 `pnpm verify` 里（`package.json:17`），而**后端仓** `ci.yml:234-252` 的 `frontend` job 会 checkout fmby-web 并跑 `pnpm verify`（`/tmp/fmby-v2-main/.github/workflows/ci.yml:248-251`）。
- **fmby-web 自己的 CI 不跑 verify**：`.github/workflows/gates.yml` 只有 3 个 job（identity / evidence（仅 PR）/ contract=错误码目录）——**typecheck / build / test / size / repo-size / dupes / contracts 都不在前端仓 CI 里**，只有后端 PR 触发时才会代跑。
- 结论：这是一个「两端都以为对方在管」的红。**修法（最懒）**：把 `docs/evidence/fe-opt-02/samples/**`、`fe-ui-accept-node62/samples/**` 里超预算的图外置到 CI artifact，只留 ≤8 张抽样（照 `docs/evidence-policy.md` R1/R2 已定策略）；或按策略申请 `REPO_SIZE_MAX_TOTAL` 上调（需裁定）。顺带把 `pnpm verify` 加进 `gates.yml`（否则前端 PR 无 verify 背书）。

### 4.2 P1-5：4 处零调用模块（「打了卡没接线」）

判据 = 「全仓无任何文件 import 该模块」+ codegraph `callers` 空（两个独立手段）：

```
$ codegraph callers "PlaceholderPage" -p .        → 只有同文件内的 createPlaceholderPage/NamedPlaceholderPage
$ codegraph callers "MountCredentialGuidance" -p . → No callers found
$ codegraph callers "AsyncJobsSection" -p .        → No callers found
$ codegraph callers "imageProbe" / "needsProbe" / "getProbeResult" -p . → No callers found
$ python3 全仓 basename-import 扫（见 §9-⑤）→ 仅这 4 个业务模块无引用者（页面文件除外，它们走 router 动态 import）
```
| 模块 | 行数 | 意味着什么 |
|---|---|---|
| `host/src/pages/_placeholder/PlaceholderPage.tsx` | 43 | 占位页机制已废，文件未删；`createPlaceholderPage` 也是死的 |
| `host/src/pages/manage/mounts/components/MountCredentialGuidance.tsx` | 72 | 「凭据过期 → 引导重新绑定」的组件没挂到任何页面（同目录 `useMountHealthFaultMap.ts:21` 另有一份 health 查询在用，故**功能可能以别种形式覆盖**，但此组件确为死码） |
| `host/src/pages/manage/task-center/components/AsyncJobsSection.tsx` | 139 | 任务中心「后台任务」区块未渲染；`useAsyncJobs` 仅被 `UserDrawer.tsx:80` 与 AppShell 用 |
| `shared/src/utils/imageProbe.ts` | 63 | 为解决「后端对缺图返回 204 ⇒ `<img>` 既不 onload 也不 onerror ⇒ 裂图」而写的探测器**没接线**；而 FE **确实**会投机拼接 `/api/assets/...`（`shared/src/contracts/assets/index.ts:12,19`、`host/src/pages/browse/PersonDetailPage.tsx:93`） |

> 关于 imageProbe 的**更正**：其后端前提已过时 -- 现在的资产读侧对缺图返回 **404**（`crates/fmby-v2-http/src/routes/asset/image.rs:29,45,60,...` 一串 `StatusCode::NOT_FOUND`），而 404 会正常触发 `<img onError>`（`host/src/pages/manage/media-item-detail/components/ArtImage.tsx:58`）。所以它是**过时死码**，不是「仍在流血」的缺口；实测是 404 这件事我读的是后端源码（=引用），浏览器 204 行为我没实测。

### 4.3 P2 清单（可后续）

| # | 位置 | 问题 | 证据 / 判据 |
|---|---|---|---|
| P2-1 | `shared/src/contracts/manage/media-items/api/mappers-payload.ts:20-40` | 3 个**死声明**参数（`mountStatus`/`hasPoster`/`hasSubtitle`）：类型里有、UI 无控件、仍会进 params 对象（值恒 undefined） | `MediaItemFilters.tsx:17-34` 的 props 只有 keyword/libraryId/mediaType/sourceStatus/metadataStatus/overrideFilter |
| P2-2 | `host/src/pages/manage/media-items/hooks/useMediaItemQueries.ts:69-75` | `refetchIntervalInBackground: true` ⇒ 流水线活跃时**标签页在后台也每 3s 轮询**（默认行为是后台暂停）。有终态收敛（无活动任务即停），故非无界 | 上游实现见 §5-② |
| P2-3 | `shared/src/viewmodels/useLibraryDetail.ts:126-146` | 分辨率/观看状态筛选是**本地过滤**，只作用于已加载页；后端仍 advertise 这些筛选项 ⇒ 与无限滚动叠加会给出「没有匹配内容」的假结论 | 同 §三 更正 1 |
| P2-4 | `host/src/pages/login/forms/IdentityCompletionPanel.tsx:82-91` | Telegram 登录状态 `refetchInterval` 轮询**无终态停止、无退避**（`retry: false` 但 react-query 的错误不停止 interval）；窗口在前台时若后端持续报错会一直按固定间隔打 | 上游语义见 §5-2（interval 不清除） |
| P2-5 | `host/src/pages/manage/yun139/Yun139QrLoginSection.tsx:68-77`、`host/src/pages/manage/pan115-share/components/PreviewCredentialSection.tsx:73-84` | 二维码轮询有卸载清理 + 终态停止，但**错误无退避**（对比 `shared/src/hooks/usePan115QrLogin.ts:151-181` 有 `maxPollErrorRetries` 与 `retryDelayMs`，是正确范式） | 直接对比两处实现 |
| P2-6 | 后端 `scripts/check-fe-be-query-parity.mjs` | `--json` 输出不纯（首行中文日志），违反其自陈口径「--json 必须纯 JSON」 | 见 §二-5 |
| P2-7 | `host/src/pages/browse/PlayPage.tsx:275` | 字幕 URL 兜底前缀 `/api/assets/subtitles/` 匹配不到任何后端路由（当前 id 恒带 `/`，故不触发） | §三 更正 3 |
| P2-8 | 反向对账（后端有、前端没接，**已核实**）| `GET /api/search`：后端接受 `hasPoster/hasSubtitle/hasLocalOverride/hasEffectiveSource/sourceStatus/metadataStatus/mountStatus/libraryIds/mediaTypes/keyword/offset/rootOnly/sort/filters` 等富筛选，FE 只发 `q` + `limit`（`shared/src/contracts/browse/search/api.ts:17`）；`GET /api/manage/operations/overview` 的 `?days` 与 `/manage/rewards/accounts/{id}/ledger` 的 `?limit` FE 均未发 | 我的反向对账脚本 §9-⑥ + 逐一读 handler |
| P2-9 | 全仓 | **无 i18n 层**：无 i18n 框架依赖，界面全硬编码中文（`host/index.html` `lang="zh-CN"`；时间格式固定 `zh-CN`，`shared/src/time/index.ts:12,31`）；扫描「英文 UI 字面量」= **0** 处 | 见 §9-⑦。按现状**不算缺陷**，但「主题契约里有 `i18n?: {locale}`（`shared/src/theme/index.ts:152`）而运行时无任何消费方」是死协议，需决策 |
| P2-10 | 测试覆盖缺口 | **没有任何测试覆盖元数据 PATCH 的 body 形状**（搜 `mapUpdatePayloadToApi`/`updateMediaItemMetadata`/`directors`+`actors` ⇒ 0 命中）⇒ P1-1 正是被这个缺口放过去的 | `python3` 扫 `host/tests`+`shared/tests`（§9-⑧） |

---

## 五、外部知识比对（总纲 §8）

| # | 我们的写法 | 上游权威 / 实际实现 | 结论 |
|---|---|---|---|
| ① | 依赖「serde 对未知字段静默丢弃」来解释 P1-1/P1-2 | **serde_derive 1.0.229 源码**（本机 `~/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/serde_derive-1.0.229/src/de/struct_.rs`）：只有 `cattrs.deny_unknown_fields()` 为真时才生成 `ignored_arm`；否则 fallthrough 是 `_serde::__private::Ok(__Field::__ignore)`（`:580-590`、`:682-686`）。`attr.rs:345-346` 说明该开关**必须显式声明** | **与上游一致**：我们这些 DTO（`UpdateMediaItemMetadataRequest`、`MediaItemsQuery`）都未加 `deny_unknown_fields` ⇒ 未知字段被吞。**偏离点是有意的**（渐进式契约 + 闸兜底），但代价就是本卡的 P1-1/P1-2；`check-fe-be-query-parity` 的口径「补齐或 fail-closed，不得静默丢弃」与社区实践一致 |
| ② | `refetchInterval` / `refetchIntervalInBackground` 的轮询语义（P2-2/P2-4） | **@tanstack/query-core 5.101.4 实际源码**（本机 `node_modules/.pnpm/@tanstack+query-core@5.101.4/.../queryObserver.js:211-218`）：`setInterval(() => { if (refetchIntervalInBackground \|\| focusManager.isFocused()) this.#executeFetch() }, interval)`；interval 只在 options 变化/`enabled=false` 时清除 | **与上游一致**：① 默认后台暂停（我们那处显式打开，是**偏离默认**的选择，有代价）；② **错误不清除 interval** ⇒ 「错误也继续按固定间隔轮询」是上游既定语义，不是 bug，但我们的 Telegram/139 轮询因此没有退避（对照 `usePan115QrLogin` 自己实现了退避，说明仓内已知该风险） |
| ③ | 不手写 `Origin`，写方法回显 `fmby_csrf` cookie 到 `X-CSRF-Token`（= 双提交 + Origin 绑定） | 后端常量：`crates/fmby-v2-http/src/middleware/csrf.rs:41`（cookie `fmby_csrf`）、`:43`（header `x-csrf-token`），`:133-141` Origin 缺失即拒；令牌 = `HMAC-SHA256(session_token, origin)`（`:66-76`）。浏览器行为：`Origin` 对**非 GET/HEAD** 的同源请求由浏览器自动附加（Fetch/HTTP 规范），前端手写反而会造错 | **与规范一致**：FE 侧 `shared/src/api/client/core.ts:222-231` 只回显 header、不造 Origin；cookie/header 名与后端常量**逐字一致**；有配套测试 `shared/tests/csrf-echo.test.ts` |
| 4 | 能力串用 TS 字面量联合 + 边界 fail-closed parse | 后端**唯一 string 真源** `Capability::as_str()`（`crates/fmby-v2-domain/src/access/models.rs:197-225`，8 变体 + `parse()` fail-closed + `ALL`） | **一致**：FE `shared/src/contracts/auth/capability.ts:24-32` 的 8 值与该枚举**逐值相同**（我逐条对照），且有 `shared/tests/capability-union.test.ts` 钉住；引用行号（197-252）也属实 |
| ⑤ | 「本地过滤 + 无限滚动」的筛选（P2-3） | 社区共识/上游文档：分页数据集的筛选必须进 `queryKey` 且由服务端执行，否则只作用于已加载子集（TanStack Query 文档「Filters/queryKey 必须包含全部输入」）。我们 **mediaType 已改成服务端筛选**（`useLibraryDetail.ts:88-100` 注释明确写了这次修复），`resolution/watched/sort` 仍是本地 | **偏离（部分）**：属于「已认账、只改了一半」的技术债；引用的是上游文档共识 + 仓内注释自证 |

---

## 六、覆盖率表（总纲 §7 —— 完整性判据）

**粒度声明**：fmby-web 共 **1126 个文件（含 docs）/ 代码约 15 万行**（`host/src 531`、`shared/src 252`、`host/tests 132`、`shared/tests 26`、`host/e2e 33`、`themes 23`、`scripts 26`、`docs 103`）。我按**模块（目录）**逐行列出**全部**顶层与二级模块并标状态；「已审」= 该模块内**至少有关键文件被全读**（具体文件列在状态列），不是「整个目录逐行读完」。**没有写「大概/可能」**。

| 模块 | 文件/LOC | 状态 | 说明（未审必给理由） |
|---|---|---|---|
| `host/src/pages/manage/media-items/` | 11 / 1.3k | **已审** | 全读 `ManageMediaItemsPage.tsx`、`hooks/useMediaItemQueries.ts`、`components/MediaItemFilters.tsx`（P1-2 现场） |
| `host/src/pages/manage/media-item-detail/` | 20 / 4.0k | **已审（关键面）** | 全读 `useMetadataForm.ts`、`components/MediaItemMetadataSection.tsx`、`components/ArtImage.tsx`（P1-1 现场）；`IdentityGovernancePanel/Subtitle*/Artwork*` 仅读注释与调用关系 |
| `host/src/pages/manage/`（其余 353 文件 / ~50k） | 379 / 55k | **抽样** | 抽样依据：契约漂移相关（task-center、mounts、pan115-imghost、pan115-share、yun139、login、collections、libraries 的 api/hook）优先；`naming-rules/`、`users/`、`cas/`、`overview/`、`site-settings/`、`registration-codes/`、`runtimeLogPresentation/` **未逐文件审**（理由：无契约面改动、体量 3 万行以上，且本卡时限内 P1 已定位） |
| `host/src/pages/browse/` | 64 / 10.2k | **已审（关键面）** | 全读 `LibraryDetailPage.tsx`、`PlayPage.tsx`（局部 + 定位点）；`browse/components/*`、`item-detail/*`、`library-detail/*` 未逐文件审（理由：UI 组件、无契约面） |
| `host/src/pages/login/`、`settings/`、`install/` | 15+11+11 / ~6.1k | **抽样** | 读 `login/forms/IdentityCompletionPanel.tsx`（轮询）、`install/installStatus.ts`（404 语义）；其余未审（理由：与本次四类问题无交集） |
| `host/src/pages/_placeholder/` | 1 / 43 | **已审（全）** | 死码，P1-5 |
| `host/src/app/`(router/guards/layouts/providers) | 16 / 2.4k | **已审（关键面）** | `router/index.tsx`（lazy 路由 + 旧路径重定向，grep 全表）、`guards/{AuthGuard,CapabilityGuard,InstallModeGuard}.tsx`、`layouts/AppShell.tsx` |
| `host/src/features/`、`theme/`、`session/`、`types/`、`guards/`、`styles/` | 30 / ~3.4k | **抽样** | 读 `features/player/engines/ArtPlayerEngine.ts:17`（innerHTML 唯一命中）、`theme/skins/loaders.ts`（skin 数据源）、`session/SessionProvider.tsx`（404 语义注释）；`styles/*.css` **未审**（理由：纯样式，本卡不含视觉） |
| `shared/src/contracts/manage/media-items/` | 11 / ~1.4k | **已审** | `api/{queries,mutations,mappers-payload}.ts`、`types.ts`（P1-1/P1-2 现场） |
| `shared/src/contracts/`（其余 131 文件 / ~21.3k） | 142 / 22.7k | **抽样** | 全读：`browse/api.ts`、`browse/collections/api.ts`、`playback/api.ts`、`manage/task-center/api.ts`、`manage/license/{access,summary}.ts`、`manage/mapping/payloads.ts`、`errors/error-catalog.generated.ts`；**未逐文件审** 其余 100+ 域契约（理由：以「闸 + 我的三个提取脚本」做过机械全量对账，覆盖 316 个调用点 / 250 条路径，逐文件重读无增量） |
| `shared/src/api/`、`errors/`、`query/`、`utils/`、`search/`（browse/search 契约亦计入 contracts 行）、`theme/`、`time/`、`batch/`、`hooks/`、`forms/` | 110 / ~9.4k | **已审（核心）/ 抽样** | 全读 `api/client/core.ts`、`api/client/errorMapping.ts`、`errors/authFailure.ts`、`utils/imageProbe.ts`；`hooks/`、`batch/`、`forms/`、`time/` **未逐文件审**（理由：与四类问题无交集；`usePan115QrLogin.ts` 因轮询检查读了关键段） |
| `shared/src/ui/` | 52 / 4.2k | **抽样** | 读 `common/SensitiveActionDialog.tsx`（P1-3 现场）、`feedback/index.ts`；其余 UI 基元未审（理由：展示层，无契约面） |
| `shared/src/viewmodels/` | 14 / 1.9k | **已审（关键面）** | 全读 `useLibraryDetail.ts`（更正 1 现场） |
| `host/tests/` | 132 / 24.3k | **机械全量扫（未逐条读）** | 扫了：假绿断言（0）、skip/todo（unit 侧 0）、断言总数 3469、覆盖缺口（P2-10）。**未逐条读 24k 行**（理由：本卡不需要，且真跑需农场） |
| `shared/tests/` | 26 / 3.7k | **同上** | 读 `csrf-echo.test.ts` 全文 |
| `host/e2e/` | 33 / 4.8k | **已审（结构 + 台账）** | 统计 27 spec/104 test、全量 `E2E_ENABLED` 门、`e2e-known-red.txt` 43 条；spec 内断言未逐条审（理由：需二进制才能跑，本机无法取证） |
| `themes/{darkroom,_template}` | 23 / 3.1k | **未审** | 理由：主题域不属于本卡四类问题；仅通过 `theme-parity`/`theme-budget` 闸看结果（PASS） |
| `scripts/` | 26 / 5.3k | **已审（关键面）** | 读 `check-e2e.mjs`、`check-repo-size.mjs`（+运行全部轻量闸）、`check-contract-mappers.mjs`；`perf/`、`release/`、`e2e/email_channel_smoke.py` 未审（理由：非本卡范围） |
| `docs/` | 103 / ~12k | **抽样** | 只读与结论相关的（`evidence-policy.md`、`repo-hygiene-01`、`前端授权入口映射.md` 的存在性）；其余文档**未审**（理由：本卡禁采信转述，文档不作为证据） |
| `.github/workflows/gates.yml` | 1 / 60 行 | **已审（全）** | P1-4 的 CI 缺口 |

**未审的量化声明**：按文件数口径，本卡**全读或精读**约 **60 个文件**（清单见 §9-⑩），机械全量对账覆盖 **316 个 API 调用点 / 250 条路径 / 全 142 个契约文件**；**未逐行读**的最大两块是 `host/src/pages/manage/` 其余 353 文件（约 50k 行）与 `docs/`（103 文件）。

---

## 七、测试卫生（总纲 §2.3 教训对照）

| 项 | 读数 | 判据 |
|---|---|---|
| 单测规模 | `host/tests` 132 文件 / **981 用例** / 3469 断言；`shared/tests` 26 文件 | `python3` 计数（§9-④） |
| 假绿模式 | `assert(true)`/`assert.ok(true)`/`assert.equal(1,1)`：**0 处**；无 `assert` 的文件：**0 个** | 同上 |
| 单测 skip/todo | **0 处**（unit 侧干净） | 同上 |
| 元数据 PATCH body 覆盖 | **0**（P2-10，P1-1 的放行原因） | §9-⑧ |
| e2e 门 | 27 spec/104 test，**每个 spec 首行** `test.skip(!E2E_ENABLED, …)`；`test.skip(true, …)` 3 处 | §9-④ |
| e2e 已知红 | `scripts/e2e-known-red.txt` **43 条**（mobile-audit 10、task-center-degradation 7、user-pages 7、async-feedback 6、grid-keynav 5、theme-template-skin 4、perf-19pages 2、theme-switch 2；issue #150×38、#122×5） | 台账原文 |
| 从未绿/一直被跳过 | **我无法判定**（要真跑）。已知的可疑面：43 条登记红里 `grid-keynav` 5 条自称「负载型偶发」（`#122`），其余 38 条是「2026-10-24 全量基线红」 | 台账理由字段 |

---

## 八、我没有查的（诚实声明）

1. **`tsc --noEmit` / `vite build` / 单测真跑 / e2e 真跑**：本机重活已硬禁（我实测 tsc 被 `fmby-queue` 排队 7 分钟未启动、队列里有 5 个 cargo 重活、loadavg 7.3–8.8）⇒ 已按广播写「需主代理投农场」并给出判据（见 §一）。**因此 `pnpm build`／体积预算（`pnpm size`）没有读数**（它需要 `host/dist/.vite/manifest.json`：我实跑得到 `[FAIL] Vite manifest not found … Did you run 'pnpm build'?`，这是环境缺件不是产品红，我据此不下结论）。
2. `host/src/pages/manage/` 其余约 50k 行、`docs/` 103 文件、`themes/*` 未逐行读（理由见 §六）。
3. 排序/筛选**在浏览器里的真实观感**（P1-2 的 UI 行为、P2-3 的本地过滤观感）：我只做了代码级证据链，没起真栈点过。按总纲 §4「说有问题要给复现」的严格口径，我给的是**静态复现**（读代码 + 跑闸），**运行时复现属农场/真栈**。
4. 后端侧的四类方向（provider/镜像/分层/双库等）不是本卡范围，我只做了「与前端契约相交」的部分。
5. 未审任何「V1 有/V2 无」的前端功能（需 V1 考古源 `/data/projects/fmby-main/fmby/apps/web` 逐页对照，本卡时限内未做）。

---

## 九、复现清单（总纲 §9 —— 供对抗复核独立重跑）

```bash
# 0) 环境与基线
cd /data/fmby-seats/rv3-frontend && git rev-parse HEAD origin/main   # 99acc73…=99acc73…（与 origin/main 同点）
git status --porcelain                                              # 空 —— 未改生产码
# 后端对照基线（我用的就是这个，非本地猜测）：
cd /data/fmby-seats/c6-cdnprobe && git rev-parse origin/main         # a7c8c15b79
git archive origin/main | tar -x -C /tmp/fmby-v2-main               # 展开后端 main（80M）

# ① 契约漂移主闸（后端 main 的版本，不是我手改的）
cd /tmp/fmby-v2-main && node scripts/check-fe-be-query-parity.mjs --fe /data/fmby-seats/rv3-frontend
#   → 9 条 DRIFT（media-items 6 + browse/libraries 3；后者为误报，见 §三更正 1）
cd /tmp/fmby-v2-main && FMBY_WEB_DIR=/data/fmby-seats/rv3-frontend node scripts/check-query-params.mjs
#   → PASS + "acknowledged: 15 条基线内已知缺口"（两个闸口径矛盾，见 P1-2）
cd /tmp/fmby-v2-main && FMBY_WEB_DIR=/data/fmby-seats/rv3-frontend node scripts/check-fe-be-contract.mjs
#   → "FE 调用 251 条 · BE 路由 512 条（豁免 0 · 弱匹配 0 · BE-only 147）" RC=0
cd /tmp/fmby-v2-main && FMBY_WEB_DIR=/data/fmby-seats/rv3-frontend node scripts/check-confirm-gate.mjs
#   → "CONFIRM-GATE CHECK PASSED"（?confirmed=true 全发齐；但**不校验密码**，见 P1-3）

# ② 我的 body 字段对账（P1-1 的来源；脚本在 /tmp，独立实现）
python3 /tmp/body-parity.py      # 后端 2296 struct / 609 routes / 141 body-routes
#   → [BODY DRIFT] 31 条；人工去掉嵌套误报后**真漂移**= dangerous-action 三键（有意）+ media-items metadata 三键（P1-1）+ playback/report 的 completed + upstream bindings 嵌套（误报）
cd /tmp/fmby-v2-main && python3 - <<'EOF'   # 直接读结构体（最权威）
import re; s=open("crates/fmby-v2-contracts/src/dto/manage_media_metadata.rs").read()
print(re.search(r"struct UpdateMediaItemMetadataRequest\s*\{([\s\S]*?)\n\}", s).group(1))
EOF
#   → 只有 title/year/sort_title/overview/community_rating/premiered/genres/studios（无 original_title/directors/actors）

# ③ 安全面
cd /data/fmby-seats/rv3-frontend && python3 - <<'EOF'
import os,re
for dp,dns,fs in os.walk("."):
    dns[:]=[d for d in dns if d not in ("node_modules","dist",".codegraph",".vite","docs","evidence")]
    for f in fs:
        if f.endswith((".ts",".tsx")):
            p=os.path.join(dp,f)
            for i,l in enumerate(open(p,encoding="utf-8",errors="replace"),1):
                if re.search(r"dangerouslySetInnerHTML|\.innerHTML\s*=|eval\s*\(", l): print(p,i,l.strip()[:100])
EOF
#   → 仅 ArtPlayerEngine.ts:17（清容器）；无 dangerouslySetInnerHTML

# ④ 测试/覆盖率统计（本报告 §七 的数字来源）
cd /data/fmby-seats/rv3-frontend && python3 - <<'EOF'
import os,re
files=[os.path.join(dp,f) for base in ("host/tests","shared/tests") for dp,_,fs in os.walk(base) for f in fs if f.endswith(".test.ts")]
print("test files",len(files),"cases",sum(len(re.findall(r"^\s*test\(",open(p).read(),re.M)) for p in files),
      "asserts",sum(len(re.findall(r"assert\.\w+\(",open(p).read())) for p in files))
specs=[f for f in os.listdir("host/e2e") if f.endswith(".spec.ts")]
print("e2e specs",len(specs),"tests",sum(len(re.findall(r"^\s*test\(",open("host/e2e/"+f).read(),re.M)) for f in specs))
EOF
grep -c '' scripts/e2e-known-red.txt      # 82 行（含注释）→ 有效条目 43

# ⑤ 死码（两个独立手段）
cd /data/fmby-seats/rv3-frontend && codegraph callers "imageProbe" -p .     # No callers found
python3 - <<'EOF'   # basename-import 全仓反向索引
import os,re
files=[os.path.join(dp,f) for base in ("host/src","shared/src") for dp,_,fs in os.walk(base) for f in fs if f.endswith((".ts",".tsx")) and not f.endswith(".d.ts")]
imports=set()
for f in files:
    imports|=set(re.findall(r"""from\s+['"]([^'"]+)['"]""", open(f,encoding="utf-8",errors="replace").read()))
for f in files:
    stem=os.path.splitext(os.path.basename(f))[0]
    if not any(os.path.basename(s)==stem for s in imports): print("orphan:",f)
EOF

# ⑥ 反向对账（后端有 / 前端没接）
python3 /tmp/reverse-parity.py     # 注意：同路径多路由会污染（见 §三更正 2），结论须回读 handler

# ⑦ i18n / 英文泄漏
python3 -c "import os,re;print(sum(1 for dp,_,fs in os.walk('host/src') for f in fs if f.endswith('.tsx') for l in open(os.path.join(dp,f),encoding='utf-8',errors='replace') if re.search(r'>\s*(Save|Cancel|Submit|Delete|Close|Search|Retry|Confirm)\s*<',l)))"
#   → 0

# ⑧ P1-1 的测试覆盖缺口
python3 -c "
import os,re
pats=('mapUpdatePayloadToApi','updateMediaItemMetadata','directors')
print([os.path.join(dp,f) for base in ('host/tests','shared/tests') for dp,_,fs in os.walk(base) for f in fs for p in [os.path.join(dp,f)] if any(x in open(p,encoding='utf-8',errors='replace').read() for x in pats)])"
#   → [] 相关文件（无覆盖）

# ⑨ 前端自有门禁（轻量，可跑）
cd /data/fmby-seats/rv3-frontend
node scripts/check-versions.mjs      # PASS
node scripts/check-contract-mappers.mjs  # PASS 0 violations
node scripts/check-frontend-dupes.mjs    # PASS 0 violations
node scripts/check-css-module-usage.mjs  # PASS 0 未定义类引用
node scripts/check-frontend-component-size.mjs  # PASS 0 违规（2 条可回收基线）
node scripts/check-theme-parity.mjs  # PASS
node scripts/check-repo-size.mjs     # **FAIL 1.30 MiB / 1.00 MiB**（P1-4）
node scripts/check-frontend-size.mjs # FAIL：缺 host/dist manifest（需 build；本机不跑）
node scripts/generate-error-contract.mjs --catalog vendor/error-catalog.md --check  # ✅ 204 码一致
# 错误码目录与后端 main 的一致性（我另做的跨仓比对）：
diff /tmp/fmby-v2-main/docs/plans/v2-dev/contracts/error-catalog.md vendor/error-catalog.md && echo IDENTICAL
```

# ⑩ 本卡全读/精读的文件清单（~60 个，供对抗复核核对我到底看了什么）
host/src: main.tsx, index.html, app/layouts/AppShell.tsx, app/router/index.tsx(grep 全表), app/guards/{AuthGuard,CapabilityGuard,InstallModeGuard}.tsx,
          guards/PermissionGate.tsx, session/SessionProvider.tsx(局部), theme/skins/loaders.ts, featureFlags.ts,
          pages/browse/LibraryDetailPage.tsx, pages/browse/PlayPage.tsx(局部), pages/browse/PersonDetailPage.tsx(局部),
          pages/manage/ManageMediaItemsPage.tsx, pages/manage/media-items/{types.ts,formUtils.ts,hooks/useMediaItemQueries.ts,components/MediaItemFilters.tsx},
          pages/manage/media-item-detail/{useMetadataForm.ts,types.ts,components/MediaItemMetadataSection.tsx,components/ArtImage.tsx},
          pages/manage/mounts/components/MountCredentialGuidance.tsx, pages/manage/mounts/hooks/useMountHealthFaultMap.ts(局部),
          pages/manage/task-center/components/AsyncJobsSection.tsx, pages/manage/pan115-imghost/components/AssetList.tsx(局部),
          pages/manage/pan115-share/components/PreviewCredentialSection.tsx(局部), pages/manage/yun139/Yun139QrLoginSection.tsx(局部),
          pages/login/forms/IdentityCompletionPanel.tsx(局部), pages/install/installStatus.ts, pages/manage/collections/hooks.ts(局部),
          features/player/engines/{ArtPlayerEngine,DPlayerEngine}.ts(局部)
shared/src: api/client/{core.ts,index.ts,errorMapping.ts}, api/{client.ts,mapping.ts(局部)}, errors/{authFailure.ts,error.ts(局部),index.ts,error-catalog.generated.ts},
          contracts/browse/{api.ts,collections/api.ts,browse/search/api.ts}, contracts/playback/api.ts,
          contracts/manage/{api.ts(局部),mapping/payloads.ts(局部),media-items/{types.ts,api/queries.ts,api/mutations.ts,api/mappers-payload.ts},task-center/api.ts(局部),peripherals/api.ts(局部),license/{access.ts,summary.ts(局部)}},
          contracts/auth/capability.ts, ui/common/SensitiveActionDialog.tsx(局部), ui/feedback/index.ts, viewmodels/useLibraryDetail.ts,
          utils/imageProbe.ts, search/searchTerms.ts(头部), theme/index.ts(局部), time/index.ts(局部)
shared/tests: csrf-echo.test.ts
host/tests: media-items-detail.test.ts, capability/相关（机械全量扫描）
```
> 注：为跑上面的 node 闸，我在席工作区建了 3 个 **gitignored** 的 `node_modules` 符号链接（指向 `/home/tefuir/rustproject/fmby-web/...`，与其它 worktree 的同款装机惯例一致）；`git status --porcelain` 仍为空。

---

## 十、给修法人（按 ponytail 阶梯的最懒修法）

1. **P1-1**：先问「这三个字段要不要」——
   - 不要 ⇒ 删 FE 的 3 个输入框 + 3 个 payload 键（**纯删，最小 diff**，且与「不伪造成功」一致）。
   - 要 ⇒ 后端 `UpdateMediaItemMetadataRequest` 补 `original_title`/`directors`/`actors`（+迁移列），FE 不动。**别**给 FE 加本地假保存。
2. **P1-2**：三种都行，选一个并让两闸口径统一：
   - 后端补 3 个筛选（`MediaItemsQuery` + SQL）；或
   - FE 删掉 3 个下拉（保留 libraryId/mediaType/keyword）——**最懒**；或
   - 两闸合并成一个（`check-query-params` 的 `KNOWN_GAPS` 不该在另一个闸判 FAIL 时静默 ack）。
3. **P1-3**（裁决项）：要么后端真校验 `session_confirmation`/`current_password`（危险写路径），要么 FE 撤掉密码输入框、只留 `?confirmed=true` 语义。当前形态是「安全剧场」，比没有更糟（误导）。
4. **P1-4**：按 `docs/evidence-policy.md` 把超预算截图外置，保留 ≤8 张抽样；并把 `pnpm verify` 接进 `.github/workflows/gates.yml`（否则前端 PR 永远没有 verify 背书）。
5. **P1-5**：`imageProbe.ts` 若确认后端只回 404 ⇒ **直接删**（含其 `.d.ts` 无引用）；`PlaceholderPage.tsx` 直接删；另两个组件要么接线、要么删（接线与否属产品决定，先登记）。

---

## 十一、结论与签名

- **结论：需返工（P1×5）+ 需裁决（P1-2 闸口径 / P1-3 二次确认语义）**。无 P0。
- 本报告不采信任何 agent 报告与文档转述：**闸读数、结构体原文、调用点行号、命令输出**均为当次实测；上游结论来自本机依赖源码/后端 main 源码（引用）。
- 身份：**family: glm**（GLM 席 rv3-frontend）。
