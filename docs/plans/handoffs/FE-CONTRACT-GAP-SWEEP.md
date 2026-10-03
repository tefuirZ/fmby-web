# FE-CONTRACT-GAP-SWEEP 交付说明 · 前后端契约缺口全量扫描

> 卡号：FE-CONTRACT-GAP-SWEEP · 分支：`w/fe1/fe-contract-gap-sweep`
> 方法：后端 `origin/main` 路由面（`crates/fmby-v2-http/src/routes/**`，364 唯一路径）×
> 前端 `shared/src/**` URL 字面量（204 唯一路径）逐一比对；**只写清单不改代码**。
> 日期：2026-10-03 · 写手：zcode · `Reviewed-by: pending-non-author-review`

---

## 0. 总量与结论

- **(b) 契约漂移（FE 调、BE 无）＝ 0**。7 个候选逐一溯源：6 个是路由注册在**跨文件**（`settings.rs`/`yun139_accounts.rs`/compat 面）或 `router_core.rs` 之外被初扫漏掉（已并入复扫剔除）；1 个（`/api/users/me`）是 `core.ts` 的 **JSDoc 示例**非实际调用。**无真 bug**。
- **(c) 字段抽样 4 个全 ✅**：①collections list/detail（FE-COLLECTIONS 两卡已对拍）②`memberOrigin`（S12 评审）③license visibility 14 字段（FE-LICENSE-REMAINING 已核）④search `RootItemDto`（FE-SEARCH-UI 已核）。
- **(a) 真缺口（BE 有、FE 零调用）**：初扫 135 → 清洗误报（nest 变体、raw/webhook、注释路径）后 **~60 条**，按业务价值分档见 §2。

## 1. 方法与证据

```
BE：for routes/*.rs（除 router_core/_tests）: .route("path", method(handler)) → (METHOD, /api+path)
FE：shared/src/** 内 /api/… URL 字面量（含 ${} 模板 → {} 归一）→ 路径集合
比对：normalize（模板/路径参数 → {}，去 query）后求差集
误报清洗：跨文件注册（settings.rs/yun139_accounts.rs 等 7 候选）、注释示例 1、
          webhook/raw/双前缀 /api/api/（migration 面字符串拼接误抓）
```

## 2. (a) 真缺口清单（按业务价值分档）

### 高价值（用户可感，建议开卡）
| 面 | 路由（条） | 判断 |
|---|---|---|
| **MFA/TOTP** | `/api/auth/mfa/totp*` 6 条 | 后端已全量（GET/POST/confirm/recovery-codes/verify），前端登录/安全设置**零消费**。安全能力对用户不可见。单卡规模：中（设置区+登录态两处 UI） |
| **播放历史/继续观看** | `browse/recently-added`、`browse/resume`、`browse/roots` 3 条 | 用户面浏览三入口前端零调用；首页已有 bootstrap 聚合替代，但 resume（继续观看）独立面缺失。规模：小-中 |
| **积分签到（rewards）** | `/api/rewards/me`、`rewards/checkins`、`rewards/redemptions*`、`manage/rewards/media-requests*` 共 ~8 条 | 契约 types 已有部分占位；签到/兑换 UI 无。规模：中-大 |

### 中价值（管理面能力空转）
| 面 | 路由（条） | 判断 |
|---|---|---|
| 媒体重处理/可见性治理 | `operations/media-reprocess*` 5 条、`media-visibility-governance*` 4 条 | 运营页已有 runtime 面；这两块治理动作无 UI 入口。规模：中 |
| 运行日志归档 | `runtime-log-archives(+download)` 2 条 | 日志页有实时流无归档下载。规模：小 |
| 到期通知设置 | `users/expiry-notifications/settings` GET/PUT | 后端已有 worker 消费同 KV；前端无设置面。规模：小 |
| 存储占用 | `manage/system/storage-footprint` 1 条 | 后端 MISC-STORAGE-FOOTPRINT 已实现；前端无消费。规模：小 |

### 低价值/待裁（形态差异或需产品决策）
- `microsoft/auth` 全套 24 条中 15 条未消费（drives/sites/write 上传族）——与 FE-IDENTITY-BINDINGS-EMAIL 等卡并列，属 Microsoft 面增强，**规模大**。
- `yun139/account-pools*` 9 条：前端仅 `types.ts` 占位、无 UI；依赖 runtime 会话引擎面（后端也在演进）。
- `cdn-operations*` 5 条、`settings/integrations/outbound-http*` 3 条：CDN/出站代理属部署级设置，是否进 WebUI 待产品裁定。
- `admin/*` 5 条（api-tokens 删除/audit/media 删除/overview/tasks）：属平台 admin 面，WebUI 是否暴露待裁。
- `manage/migration/*` 3 条 + `install/probe`：迁移/安装向导面（MIGRATION-IMPORT-DESIGN 已登记 import 设计卡）。
- `auth/captcha`、`auth/password`（change-required）1+1 条：登录流边缘态，需 UX 决策。

## 3. (b)(c) 证据摘录

- (b) 溯源例：`/api/manage/license` 在 `license 面路由文件` 注册（FE 已消费）；`/api/users/me` 仅 `shared/src/api/client/core.ts` JSDoc 示例。
- (c) 例：`ManagedMountSummaryDto.note/rate_config/…`（`dto/manage/mount.rs`）↔ `ManageMountRecord.note/rateConfig`（`shared/src/contracts/manage/types.ts`）逐字对齐。

## 4. 跳过项

- **未抽样全部 185 条字段级比对**：按卡面要求抽 4 核心面 ✅；全量字段审计建议在 (a) 清单开卡时随卡做。
- **未跑 check-contract-sync（后端仓）**：跨仓纪律；本扫以路由/字面量直比替代。
- tsc 双包：零源码改动，不适用。
