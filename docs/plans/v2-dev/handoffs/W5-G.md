# W5-G 交付说明 · LICENSE-UX-V1-PARITY

**仓库**：`ws-zcode-writer1-web`　**分支**：`w/zcode/writer1-w5g-license-parity`（自 `origin/main` = `9fa4b2e`）
**判据**：`pnpm verify` **EXIT=0**；host **308 pass / 0 fail**；shared **99 pass / 0 fail**；component-size **[PASS] 0 违规**；零新依赖。

**三笔 commit（照卡面「契约+域层 / UI+守卫」，守卫再拆一笔）**

| # | commit | 内容 |
|---|---|---|
| ① | `062b1a7` | 契约 + 域层（status / entitlement / summary / access） |
| ② | `a0a5a03` | 授权页 UI（5 卡 + presentation + 3 hook + 页重构） |
| ③ | `2419d20` | 付费守卫（Guard + `canUsePaidFeature` + 3 处接线） |

> 说明：上一轮 session 中断；已交付成果在同一 git 仓库的另一 worktree（`fmby-web-main`）上完整存在（`04567b2`/`92c6a0f`/`34bb5f7`），本分支用 **cherry-pick 原样复用**（非重造），并在本 worktree 复跑 `pnpm verify` 确认。

---

## 后端契约核对（结论：字段齐备，纯前端活）

按主代理核实：`GET /api/manage/license/status` → `LicenseStatusDto`（`crates/fmby-v2-http/src/state/license.rs:205`，33 字段）。**冻结契约**：`GET status` 返回**状态对象本体**（`{"runtime_state"...}`，非 `{status:{…}}`）；写操作统一 `{status}` 载体。

- 前端 `licenseApi.getStatus()` 已是 `return mapStatus(raw)`（**未包一层**）✓ —— `host/tests/license.contract.test.ts` 的 ① 断言直接读 `status.runtimeState`。
- 5 条路由（status / device-flow / device-flow/poll / activation-token / heartbeat）均消费真端点；`LicenseUnwiredPanel.tsx`（陈旧「后端端点尚未提供」兜底）**已删除**。
- `activation-token` 请求体后端 serde 默认名 `activation_token`（无 rename），契约层如实发送 ✓。
- 后端字段面**无缺**（未开后端卡、未造字段）。

---

## V1 → V2 逐项对位表

### 契约（V1 `apps/shared/src/contracts/manage/`）

| V1 文件 | V2 落点 | 判定 |
|---|---|---|
| `license-status.ts` | `shared/src/contracts/manage/license/status.ts`（新增） | 已并入 |
| `license-summary.ts` | `.../license/summary.ts`（新增，付费守卫半边：`PAID_MANAGE_SURFACES`(15) / `canUseLicenseVisibilitySurface` / `FREE_LICENSE_VISIBILITY`）；`LicenseSummaryRecord` 在 `types.ts` | 已并入 |
| `license-entitlement.ts` | `.../license/entitlement.ts`（新增：元数据 label+description / 分类 / 用量读取+标签 / 归一化+类型） | 已并入 |
| `license-device-flow.ts` | `.../license/types.ts` 的 `LicenseDeviceFlowRecord` + `api.ts` 的 `mapDeviceFlow` | 已并入（内联，未单独拆文件） |
| `license-usage.ts` | `.../license/types.ts` 的 `LicenseUsageRecord` + `api.ts` 的 `mapUsage` | 已并入（内联） |

### 域层（V1 `apps/web/src/domains/manage/license/`）

| V1 文件 | V2 落点 | 判定 |
|---|---|---|
| `types.ts` | `.../license/types.ts` | 已并入（补 `usageLabel`） |
| `raw-types.ts` | `.../license/api.ts` 的私有 `Raw*` 接口 | 已并入（内联） |
| `mapping.ts` | `.../license/api.ts` 的 `mapStatus/mapEntitlement/mapUsage/…` | 已并入（内联） |
| `api.ts` | `.../license/api.ts` 的 `licenseApi`（5 方法） | 已并入 |
| `access.ts` | `.../license/access.ts`（新增；V1 读 bootstrap，V2 无该载荷 → 由 `status.summary.visibility` 派生）；宿主侧守卫判定见 `host/src/pages/manage/license/licenseAccess.ts` | 已并入（数据源改 V2 形态） |
| `schemas.ts` | `host/src/pages/manage/license/schemas.ts`（新增，zod） | 已并入 |

### UI（V1 `apps/web/src/pages/manage/license/`）

| V1 文件 | V2 落点 | 判定 |
|---|---|---|
| `ManageLicensePage.tsx` | `host/src/pages/manage/ManageLicensePage.tsx`（重构为 V1 形态） | 已并入 |
| `components/LicenseStatusOverview.tsx` | `host/src/pages/manage/license/components/LicenseStatusOverview.tsx` | 已并入 |
| `components/EntitlementsCard.tsx` | 同名 | 已并入 |
| `components/LeaseDetailsCard.tsx` | 同名 | 已并入 |
| `components/DeviceFlowCard.tsx` | 同名 | 已并入 |
| `components/ActivationTokenCard.tsx` | 同名 | 已并入 |
| `licenseSummaryPresentation.ts` | `host/.../license/licenseSummaryPresentation.ts` | 已并入 |
| `hooks/useLicenseQueries.ts` | 同名 | 已并入 |
| `hooks/useLicenseMutations.ts` | 同名 | 已并入 |
| `hooks/useLicenseDeviceFlowPolling.ts` | 同名 | 已并入 |
| （新增）`licenseFormat.ts` | epoch ms 格式化 / 相对时间 / 复制 / http(s) 安全外链 | V2 适配（V1 时间为 ISO） |

### 付费守卫（V1 `pages/manage/ManagePaidFeatureGuard.tsx` + `shared/featureFlags.ts`）

| V1 | V2 落点 | 判定 |
|---|---|---|
| `ManagePaidFeatureGuard.tsx` | `host/src/pages/manage/ManagePaidFeatureGuard.tsx` | 已并入（交互不变：warning + 「查看授权与订阅」/「返回管理首页」） |
| `featureFlags.canUsePaidFeature(surface)` | `host/src/featureFlags.ts` **再导出**；实现在 `host/src/pages/manage/license/licenseAccess.ts`（Vite-free，可单测） | 已并入（判定用**真** `summary.visibility.*`，非 env） |
| V1 守卫接线 3 处 | `ManageUpstreamsPage`(feature=`['upstream-emby','upstream-apple-cms']`)、`pan115-imghost`(=`pan115-imghost`)、`ManageRegistrationCodesPage`(=`registration-codes`) | 已并入（照 codegraph 核实的 V1 3 处） |

### 第二前端并入（`apps/web-gallery/src/`）

| V1 web-gallery | V2 落点 | 判定 |
|---|---|---|
| `manage/site/ManageLicenseSurface.tsx` | 由主前端 `ManageLicensePage` 覆盖（V2 只保留 1 个前端；web-gallery 的 ToastStack/InlineState 形态不并入） | 已被主前端形态取代 |
| `shared/license-access.ts` | `shared/src/contracts/manage/license/access.ts` + `summary.ts` | 已并入 |

---

## 测试

- `shared/tests/license-contract.test.ts`（5）：三套枚举解析 fail-closed / 标签色调 / 分类与用量 / surface→可见性映射 / FREE 兜底 / barrel 可取用。
- `host/tests/license.contract.test.ts`（4）：5 端点路径/方法/请求体（`activation_token`）/ epoch 映射 / entitlement 说明+用量标签 / `poll_status` 非四态抛错 / 500 fail-closed 必须 reject。
- `host/tests/license-guard.test.ts`（5）：FREE 拒绝 / 命中放行 / status 派生 fail-closed / `string[]` 或语义 / env 不影响判定。

## codegraph 查证记录

- `codegraph callers "ManagePaidFeatureGuard" -p apps/web` → 仅 3 处：`ManageRegistrationCodesPage.tsx:47`、`ManageUpstreamsPage.tsx:43`、`Pan115ImghostPage.tsx:14`（据此对齐接线范围）。
- `codegraph callers "canUsePaidFeature" -p apps/web` → 除 Guard 外还有 4 处**细粒度字段级**门（见下方延后项）。
- `codegraph callers "DisplayOrderEditor"`（W5-F 遗留，与本卡无关）。

## 延后项（登记，不自行开卡）

1. **4 处细粒度付费门未接线**（V1 有、V2 未加）：`ManageUsersPage.tsx:48`（`user-expiration`/`upstream-emby`）、`ManageSiteSettingsPage.tsx:90`（`registration-window`/`identity-google`/`identity-telegram`）、`site-settings/components/SiteSettingsRegistrationSection.tsx:16`（`registration-window`）、`SiteSettingsSecuritySection.tsx:18`（`identity-google`/`identity-telegram`）。这些是**字段级显隐**，非页面级守卫；接线会改动用户页/站点设置的字段呈现，故单独登记交主代理。
2. **后端契约缺字段**：无（字段齐备）。
3. `grant`/`license` 相关**冻结面**未碰。

## ponytail 一句

「跳过了什么/何时再加」：契约未按 V1 逐文件拆 `license-device-flow.ts`/`license-usage.ts`（V2 内联在 `types.ts`+`api.ts` 已等价，拆文件是纯搬运无收益）；守卫的 4 处字段级细门未接线（会改字段呈现，需主代理确认再加）；web-gallery 的 `ManageLicenseSurface` 不整搬（V2 单前端形态已用主页面覆盖）。
