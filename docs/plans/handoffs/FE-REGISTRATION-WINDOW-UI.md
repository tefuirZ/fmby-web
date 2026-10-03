# 交接 · FE-REGISTRATION-WINDOW-UI（注册窗口设置 UI · 先证伪）

仓库 `/home/tefuir/rustproject/fmby-web`，分支 `w/fe2b/fe-registration-window-ui`（基于 `origin/main`）。
本卡用 **ponytail**（不自造字段、不为无后端支撑的面造假 UI）；找符号只用 **codegraph**。

---

## 0. 结论：卡面 premise **证伪** —— 后端无注册窗口的**管理读写端点**，前端无从接线

卡面称「后端 `REGISTRATION-WINDOW-ADMIN-API` 已在 main ⇒ 契约已就位，可直接接 UI」。
实测（后端仓 `FMBY-V2`）**与该说法不符**：注册窗口只有**读语义 + KV 存储**，
**没有任何管理端点可读写它** ⇒ 本卡**不写生产代码**，仅交付取证结论并回报后端缺口。

## 1. 取证链（后端，逐项）

| 项 | 位置 | 结论 |
|---|---|---|
| 注册窗口**语义** | `crates/fmby-v2-bridges/src/bridges/self_register.rs::direct_availability` | ✅ 存在（读 KV `auth.direct_registration`） |
| 配置结构 | 同文件 `struct DirectRegistrationSettings` | `enabled`（必填）、`start_at` / `end_at` / `max_users` / `default_role_template`（均 `#[serde(default)]`），时间为 **ms（i64）** |
| 未配置语义 | `direct_availability`：`raw` 为 `None` ⇒ `Validation("站点当前未开放直接注册")` | ✅ fail-closed（红线） |
| 损坏语义 | JSON 解析失败 ⇒ 日志留痕（`config_invalid`），客户端仍走**统一文案**（防枚举） | ✅ 防枚举口径 |
| **管理读端点** | `GET /api/admin/site-settings`（`routes/admin.rs::get_site_settings`） | ❌ 返回强类型 `SiteSettingsDto` |
| **管理写端点** | `PUT /api/admin/site-settings`（`put_site_settings`） | ❌ 接受强类型 `SiteSettingsDto` |
| `SiteSettingsDto` 字段 | `crates/fmby-v2-http/src/state/settings.rs` | **仅** `theme_mode` / `timezone_display` / `site_name` / `brand_logo_url` —— **不含** `enabled`/`start_at`/`end_at`/`max_users`/`default_role_template` |
| 是否有自由 KV 读写端点 | 全量 `routes/**` 扫描（`/manage/*/settings`、`/settings/**`、`/admin/site-settings`） | ❌ 全部强类型，**无**任意 key 的 KV 写入面 |
| `auth.direct_registration` 引用者 | 全仓扫描 | **仅** `bridges/self_register.rs`（唯一读者），**无写者** |

## 2. 前端现状取证

- 全仓检索 `direct_registration` / `directRegistration` / `registration_window` / `max_users` /
  `default_role_template`：**仅命中** `shared/src/contracts/manage/license/{api,summary,types}.ts`
  的 `registrationWindow`（授权/权益**展示**面）。
- **无**直连注册的设置界面、**无**写入调用链 ⇒ 与后端一致（本就无从接线）。

## 3. 为什么不停在「补 UI」

`/admin/site-settings` 是**强类型 DTO**，前端若补表单并提交注册窗口字段：
- 请求会被 DTO 反序列化**静默忽略**（`serde` 未知字段默认丢弃），或
- 前端必须**自造**一个后端不认识的字段面 ⇒ 直接违反卡面红线「**不许自造字段**」。
⇒ 补 UI 只能是「看起来能配、实际不生效」的假面 ⇒ 不做。

## 4. RED → GREEN

本卡**无生产代码改动**（证伪后无后端可接），故无传统 RED→GREEN 环；
取证本身即「先证伪」环：假设「契约已就位可接 UI」→ 逐项核后端端点与 DTO 后**证伪**。

## 5. 当次验证

```
git status --porcelain                       → 0（干净，基于 origin/main）
codegraph sync .                             → exit 0
后端：struct DirectRegistrationSettings      → self_register.rs（5 字段，ms 时间）
后端：struct SiteSettingsDto                 → state/settings.rs（4 字段，无注册窗口字段）
后端：routes/** 任意 KV 写端点               → 无
后端：KV_DIRECT_REGISTRATION 引用者          → 仅 self_register.rs（只读，无写者）
前端：direct_registration 等关键词           → 仅 license 展示面，无设置面
```

（本卡零源码改动 ⇒ 未重复跑 tsc/闸；如需，相邻卡上三闸均为 PASS。）

## 6. 给主代理的后续卡建议（本卡不吞）

**后端缺口（前置，必须先做）**：为注册窗口补**管理读写面**，二选一：
1. 在 `SiteSettingsDto` 增加注册窗口字段并让 `set_site_settings` 落到 KV
   `auth.direct_registration`（与 `get_site_settings` 同源回显）；或
2. 新增专用端点（如 `GET/PUT /api/admin/registration-window`），DTO 逐字段对齐
   `DirectRegistrationSettings`（`enabled` 必填、时间为 **ms**）。

**边界语义（前端/后端均须对拍）**：`start_at`/`end_at` **含边界放行**（卡面已述后端有 7 条单测）；
未配置 / 未启用 / 名额满均 fail-closed 且客户端文案**防枚举**（不得据响应区分「未配置」与「配置损坏」）。

后端任一口径落地后，再派前端卡即可按 DTO 直接对拍接线（表单：启用开关 + 起止时间 + 名额 + 默认角色模板 + 诚实错误态）。

## 7. 跳过项（明写）

- 未补表单/页面/契约（无后端可接，补了即假面）。
- 未自造任何字段；未改契约仓 / mirror；未引依赖；不碰农场；未跑全仓重活。
- 未跑 `npm test` / tsc（零源码改动，无回归风险；如需原文可随时补跑）。

## 8. 提交

一原子项一提交：本 handoff 文档（docs only，零源码 diff）。

`Reviewed-by: pending-non-author-review`
