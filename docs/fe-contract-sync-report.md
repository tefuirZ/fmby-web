# FE-CONTRACT-SYNC —— 前端消费面主动对拍（契约盲区扫描）报告
> ⚠ 本文部分结论已被后续卡推翻/与现状不符（见 `docs/FE-REPO-DOC-CLAIM-AUDIT.md` §3；以当前 `shared/src/contracts/**` + `host/src/**` 代码为准）。

- **卡**：前端 registration-codes confirmed 对拍 + 契约盲区登记（小卡）
- **分支**：前端仓 `w/zcode/writer3-fe-contract-sync`（基于前端 main `23349d2`）
- **背景**：check-contract-sync 门禁抓不到后端手拼 `json!` 的字段（w1 OPERATIONS-SNAPSHOT 报告的盲区）。本卡用前端真实消费面主动对拍。

---

## 1. 后端生产段手拼 `json!` 端点清单（全 routes 扫描，`#[cfg(test)]` 段排除）

| 文件 | 端点 | 手拼字段面 |
|---|---|---|
| `manage_operations.rs:57-119` | GET /api/manage/operations/overview | days/windowStart/now/summary{...}/hotItems[5 字段]/activeUsers[4]/mediaTrend[3]/registrationTrend[3]/playbackTrend[3]/**activeSnapshot**{activeSessionCount,runningTasks,sessions[10 字段]}/**dataSourceLoad**[6 字段] |
| `media_reviews.rs:261` ticket_to_json | media-reviews 列表/详情 | 19 字段（camelCase 全套） |
| `media_reviews.rs:286` hit_to_json | provider-search | 9 字段 |
| `manage_events.rs:103` item_to_json | GET /api/manage/events | events/total/page/pageSize/runtimeSourceAvailable + 8 字段 |
| `manage_events.rs:138-176` detail_to_json | events/{id} | requestId/timeline[5]/result/errorCode/diagnosis[4]/auditRecords[7]/runtimeRecords/runtimeSourceAvailable |
| `self_register.rs:183` | POST /api/auth/setup | `{id, username}` |
| `self_register.rs:238` | POST /api/auth/register（Authenticated 分支） | `user: {token, user:{id,username,display_name,status}}` 嵌套手拼 |

其余 14 个含 `json!` 的路由文件（manage.rs/manage_license.rs 等）全部命中在测试段，生产面零手拼。

## 2. 逐字段对拍结果（后端真实代码 ↔ 前端 types/mapper）

| 域 | 后端 | 前端 | 判定 |
|---|---|---|---|
| **registration-codes batch/delete** | `state/registration_codes.rs:141-160`：query `?confirmed=true` 权威；body confirm_action/session_confirmation/current_password 接收但忽略（serde alias 双形态） | `manage/api.ts:574-599`：`params:{confirmed:true}` + body `batch_ids` + mapDangerousActionPayloadToApi（camelCase→snake_case mapper 齐） | ✅ 对齐（w1 已修） |
| **operations/overview** | 手拼含 **activeSnapshot**/**dataSourceLoad**（7c1133bf V1F-08-B2 新增） | `operations/api.ts:46-57` RawOperationsOverview **无此两字段**，全仓零消费 | 🟡 漂移 1：能力闲置 |
| **media-reviews** | 19+9 字段 | `media-reviews/api.ts:13-51` 逐字段全对齐（含 6 个 *Json 串字段与可空性） | ✅ |
| **events 列表+详情** | 8 字段 + detail 8 顶层字段 | `events/api.ts:13-63` 全对齐（含 runtimeSourceAvailable/auditRecords.fields{key,value}） | ✅ |
| **auth/setup** | `{id, username}`；**无 token 无 user，不自动登录** | `auth/api.ts:180` 声明 `Promise<AuthResponse>`；`SetupForm.tsx:37` 取 `response.user` → 运行时 undefined | 🔴 漂移 2：真 bug |
| **auth/register**（authenticated 分支） | `user = {token, user:{id:数字, username, display_name, status}}` 嵌套手拼 | `auth/api.ts` RegisterResponse.user 声明 `User|null`；`RegisterForm.tsx:40` 把它直接 `onAuthenticated(response.user)` → login() 存入错误结构（roles/capabilities undefined） | 🔴 漂移 2b：真 bug |
| **确认闸覆盖**（反向核） | 17 个 require_confirmed 端点（media_items×3、naming×2、manage_users、auth_mfa、sessions、role_templates、mounts、secrets、libraries、admin、media_reviews、identity、microsoft、site） | 前端 12 处 `params:{confirmed:true}` 全部在调；**totp reset / secrets apply_overrides / admin_delete_media / install_theme / microsoft import / identity** 前端零调用 | ✅ 已调的全对齐；未调的归闲置 |

## 3. 漂移三分类清单

### 🔴 真漂移（字段/结构不符，运行时 bug）——已修（最小 diff，3+2 文件）

1. **setup**（后端 `self_register.rs:183` vs 前端 `auth/api.ts:180` + `SetupForm.tsx:37`）：
   - 前端把响应类型声明为 `AuthResponse` 并取 `response.user`——实际后端回 `{id, username}`，运行时 `onAuthenticated(undefined)`。
   - V1 权威（fmby-api/auth/routes.rs:563-566 `init_setup` 返回 `AuthResponse{user,...}` 自动登录）：**V2 是行为偏离**（不自动登录），不是前端写错。
   - **修**：①`auth/api.ts` setup() 类型改 `SetupCompletedResponse{id:number;username:string}`（新 interface，注释登记 V1 偏离）；②`SetupForm.tsx` props 改 `onSetupCompleted(username)`，onSuccess 转交；③`LoginPage.tsx` 传回调 → `setMode('login')` + 提示「管理员 X 创建成功，请登录」。
2. **register**（后端 `self_register.rs:238` vs `RegisterForm.tsx:40`）：
   - 后端 `user` 字段是 `{token, user:{...}}` 嵌套且内层 `{id:数字, username, display_name, status}` 与前端 `User{id:string,name,roles,capabilities}` 完全不符；原代码直接传给 `onAuthenticated` → 会话存坏结构。
   - **修**：`RegisterForm.tsx` onSuccess 改 async——authenticated 分支不再信任 `response.user` 形态，照 `login()` 先例调 `authApi.getSession()`（后端注册成功已签发会话 cookie，`/api/auth/me` 可用）重新组装权威 User；me 失败 fail-closed 提示手动登录，不伪装登录态。类型面 `RegisterResponse.user` 改 `unknown` + 注释禁止直用。

### 🟡 能力闲置（后端有、前端没消费）——登记不改

1. `operations/overview` 的 **activeSnapshot**（活跃会话快照 10 字段）与 **dataSourceLoad**（挂载负载 6 字段）——w1 OPERATIONS-SNAPSHOT（V1F-08-B2）只做了后端，前端 RawOperationsOverview 未声明未渲染。
2. 确认闸端点前端零调用：`post_reset_user_totp`、`manage_secrets_apply_overrides`、`admin_delete_media`、`install_theme`、`post_import_token_account`（microsoft）、identity 确认闸端点。

### ⚪ 两边都没有（契约未登记）——不在本卡

- 契约仓 fmby-ui-contract-v2 对上述手拼端点字段本就无登记（盲区本身），随门禁盲区议题一并处理。

## 4. 前端修改清单（最小 diff，5 文件 +43/-11）

| 文件 | 改动 |
|---|---|
| `shared/src/contracts/auth/api.ts` | RegisterResponse.user → `unknown` + 禁直用注释；新增 SetupCompletedResponse；setup() 返回类型对齐 |
| `shared/src/contracts/auth/index.ts` | 导出 SetupCompletedResponse |
| `host/src/pages/login/forms/SetupForm.tsx` | props onAuthenticated → onSetupCompleted；onSuccess 改交 username；删 User import |
| `host/src/pages/login/LoginPage.tsx` | SetupForm 传 onSetupCompleted（setMode('login') + 提示语） |
| `host/src/pages/login/forms/RegisterForm.tsx` | authenticated 分支经 getSession() 重组 User（照 login 先例），me 失败 fail-closed |

## 5. 诚实未验证项

1. **pnpm typecheck 未跑**：worktree 归属 tefuir 而写手为 root，`pnpm install` EACCES（且全仓无 node_modules 先例）——依赖安装/门禁需主代理环境执行。已做静态自查（引用符号、props 链、import 残留、react-query async onSuccess 合法性）。
2. **沙箱 API 缺口**：本卡未涉及 test_support.rs（PG-SANDBOX 卡改派/搁置）。
3. register 成功后 `/api/auth/me` 可用性基于后端代码推演（register 自动登录签 cookie）——建议 e2e 冒烟覆盖。
4. tracked 的 `*.d.ts`（骨架时代入库）与 .ts 已漂移且仓惯例不再同步（shared/package.json main/types 直指 .ts 源），本次同样未更新——如实登记。
