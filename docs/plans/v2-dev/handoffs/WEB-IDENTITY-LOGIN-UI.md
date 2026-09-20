# WEB-IDENTITY-LOGIN-UI — 三方身份登录前端消费面（THIRDPARTY-LOGIN-FLOW 收口）

> 作者：w3。分支 `w/zcode/writer3-identity-ui`（fmby-web 仓，base `origin/main 46e8294`）。
> 后端：THIRDPARTY-LOGIN-FLOW 4 端点已在 FMBY-V2 main（`w/zcode/writer3-sso-login` 含
> 测试夹具修复 `f01eeab1` 待并）。本卡**零后端改动**，只动 fmby-web。

---

## 0. 一句话结论

登录页新增「第三方登录」入口：公开 provider 列表 → Google 端到端（start → 跳转授权
→ 回流捕获 → complete → 会话）；Telegram 深链 + status 轮询；Email 验证码。后端
503/403 等失败**一律原样呈现**，`mfa_required` **绝不伪装登录成功**。

---

## 1. 考古结论（先考古再动手）

| 关注点 | 结论 |
|---|---|
| 登录页结构 | `host/src/pages/login/LoginPage.tsx`（180 行）+ `forms/{LoginForm,RegisterForm,SetupForm}.tsx`；无任何 identity 消费（全仓 grep 0 命中） |
| 会话管理 | `host/src/session/SessionProvider.tsx`：`login(user)` 置 authenticated；`/auth/me` 恢复会话；`authFailure` 事件清会话 |
| CSRF | `httpClient` 写方法自动回显（`fmby_csrf` cookie → `x-csrf-token`，client.ts:334-340）；登录链端点**免会话**，CSRF 中间件对「无会话 cookie 的非 auth 入口写请求」直放（`csrf.rs` `csrf_verdict`）⇒ 前端无需特殊处理 |
| 契约模式 | 双件套（raw-types + mappers + api + barrel）；门禁 `check-contract-mappers`（域内须有 mapper）+ `check-frontend-dupes`（页面禁直引 `contracts/*/api`、`raw-types`、自建 fetch） |

### 后端契约（main 现状，前端逐字段对位）

| 端点 | 免会话 | 请求 | 响应 |
|---|---|---|---|
| `GET /api/auth/identity/providers` | ✓ | — | `{items:[{provider, display_name, enabled, login_enabled, binding_enabled, password_reset_enabled, configured}]}` |
| `POST .../{provider}/login/start` | ✓ | `{email?, redirect_uri?}` | `{provider, challenge_id, action, authorize_url?, delivery_status?, completion_token?, message?, expires_at}` |
| `POST .../{provider}/login/complete` | ✓ | `{challenge_id, code?, verification_code?}` | 成功 `LoginResponse{status:"ok", user_id, expires_in_secs}` + cookie；MFA `{status:"mfa_required", challenge_id, expires_at(ms)}` **无 cookie** |
| `POST .../{provider}/login/status` | ✓ | `{challenge_id, completion_token}`（仅 Telegram） | `{verified, expires_at}` |
| `GET .../{provider}/callback?code&state&challenge_id` | ✓ | — | `{provider, challenge_id, received_code, message}` |

---

## 2. 交付清单

| 文件 | 内容 |
|---|---|
| `shared/src/contracts/auth/identity/{types,raw-types,mappers,api,index}.ts` | 双件套契约域（5 文件，371 行） |
| `shared/src/contracts/auth/index.ts` | barrel 导出 `identityLoginApi` + identity 类型 |
| `host/src/pages/login/forms/IdentityLoginPanel.tsx` | 入口面板：就绪 provider 按钮 + Email 邮箱输入展开 |
| `host/src/pages/login/forms/IdentityCompletionPanel.tsx` | 完成阶段：Email 验证码 / Telegram 深链+轮询 / Google 回流自动完成 / MFA 诚实态 |
| `host/src/pages/login/forms/identityPendingContext.ts` | 回流上下文（sessionStorage）：`state`(=challenge_id) 反查 provider |
| `host/src/pages/login/LoginPage.tsx` | 接线：providers 查询、start、回调捕获、完成面板、回调错误呈现 |
| `host/src/pages/login/LoginPage.module.css` | identity 面样式（+`secondaryButton`） |
| `shared/tests/identity-login.test.ts` | 13 断言（mapper + API + ★mfa_required 不假成功 + ★503 原样上抛） |
| `host/tests/identity-pending-context.test.ts` | 5 断言（回流上下文：反查/防串流/清理/不可用/损坏值） |

---

## 3. 交互流（如实语义）

- **Google**：点按钮 → `start` → `authorizeUrl` → `window.location.assign` → Google 授权 →
  回站 `/login?code=...&state=<challenge_id>` → 读 URL 捕获（`/callback`，不消费）→
  自动 `complete` → 会话 → `login(user)`。
- **Telegram**：点按钮 → `start` → 深链 + 状态提示；`completionToken` 存在时轮询
  `login/status`（1.5s，失败态原样呈现）。**注意**：V2 后端 `start` 不回
  `completion_token`（D2 前置）⇒ 轮询分支**就位但实际不触发**；`complete` 恒 503
  ⇒ 点击「完成」后**原样呈现后端错误**，不假装成功。
- **Email**：点按钮展开邮箱输入 → `start(email)`；后端发信面未装配 ⇒ 503
  **原样呈现**（「邮箱登录发信面未接线」）。
- **不可用 provider 不展示**：`loginReadyProviders` 仅纳入 `enabled && configured &&
  loginEnabled`（V1 `getIdentityLoginDiscoveryProviders` 同语义）。V2 现状 Email
  `configured` 恒 false、Telegram 需 bot 全配 ⇒ 实际通常只有 Google 入口——如实，不伪装。

### 回流 provider 反查（关键设计，零后端/配置改动）

Google 回流只带 `code` + `state`（`state` = challenge_id，V1 口径），**不带** provider。
V1 靠运营把 provider 名拼进配置面 `redirect_uri`（隐式约定，`identity-manage-ui` 占位符
`callbackUrl` 未固化该约定）。V2 后端 `start_oauth` **采用前端传入的 redirect_uri 覆盖配置**
（与 V1 忽略入参不同）⇒ 若前端传无参 URL，回调将丢失 provider。

**本卡方案**：前端不传 `redirect_uri`（后端回退配置面已登记值，避免 `redirect_uri_mismatch`），
改用 **sessionStorage 反查**：发起跳转前存 `{challengeId, provider}`，回站按 `state` 反查。
- 零后端/零配置改动；隐私面只存流元信息（challenge_id 本就出现在 OAuth state），无凭据。
- 不可用降级：sessionStorage 不可用/损坏/不匹配 ⇒ 回流无 provider ⇒ 不猜、不假成功
  （用户重新发起即可）；有 5 条单测锁定。

---

## 4. ★结构性发现（超出本卡，建议主代理裁决）

### 4.1 前端零 MFA 基础设施（跨 `/auth/login` 与 identity 两条登录面）

- 全仓 0 个 `*mfa*`/`*totp*` 文件、0 处 `/auth/mfa` 调用、无 MFA 设置页。
- 后端 identity `complete`（D5 安全收紧）与 `/auth/login` 都会在绑定账号启用 TOTP 时
  返回 `mfa_required`（**不建会话**）。
- 本卡处理：`mfa_required` ⇒ **如实提示需二因子、绝不置登录态**（RB-4），并登记缺口。
- 但 TOTP 用户经此 UI **无法完成登录**——完整二因子登录 UI（TOTP 输入 →
  `POST /auth/mfa/totp/verify`，后端已就绪）是独立可测单元，建议另卡（一并覆盖
  `/auth/login`，见 4.2）。

### 4.2 ★既有安全/诚实缺陷：base `/auth/login` 对 `mfa_required` **假成功**

`shared/src/contracts/auth/api.ts` `authApi.login`（origin/main 既有，非本卡引入）：
- 不读 `LoginResponse.status`；后端 `mfa_required` 时 `user_id` 缺省，
  前端 `id: String(raw.user_id || 1)` ⇒ **fabricate `user.id="1"`**；
- `persistSessionUsername(username)` + 返回 `{user}` ⇒ LoginForm `onAuthenticated`
  → `login(user)` ⇒ 会话置 authenticated（**无会话 cookie**）；
- 后果：启用 TOTP 的用户输对密码即「看似已登录」，随后任意 API 401 → 踢出。RB-4 违例。

**建议**：`authApi.login` 应判 `status`：`mfa_required` ⇒ 返回显式分支（不置会话），
与 identity 路径同口径。**未在本卡修复**（改 `AuthResponse` 契约 + LoginForm 消费面，
波及既有 `auth-session.test.ts`，属独立卡；且本卡身份路径已正确处理，无回归）。

### 4.3 其余登记

- **D-UI-1**：回流 provider 反查依赖 sessionStorage（见 §3）；若浏览器禁用存储，
  Google 回流将无法识别 provider ⇒ 不猜、不假成功（用户重新发起）。V1 的
  「配置面 redirect_uri 带 `?identity_provider=`」约定为备选，未采用（避免要求
  Google 控制台登记带 query 的 URL）。
- **D-UI-2**：`login/status` 轮询代码就位但 V2 `start` 不回 `completion_token`（D2
  前置）⇒ 轮询分支实际不触发；后端补 `completion_token` 后零前端改动即可生效。
- **D-UI-3**：本卡**未修** 4.2 的 base login 假成功（避免与 MFA 前端卡/其它写手撞车）；
  修复点已精确定位（`authApi.login` 读 `status` 分流）。

---

## 5. 门禁

`fmby-web` 全量门禁自跑（node/bash，非 cargo）：

| 门禁 | 结果 |
|---|---|
| versions / typecheck / build / build:themes / size / repo-size / dupes / contracts / component-size / theme-budget / theme-parity | **PASS** |
| test(shared) | **FAIL（既有）**：`contract-mappers.test.ts` Node 原生 TS 解析错（origin/main 原样，与本卡无关）；本卡新增 13+5 断言全 PASS |
| test(host) | **PASS**（23+5） |

> 注：`pnpm size` 首跑 FAIL 是因主题产物未构建（`pnpm build:themes` 未跑），
> 构建后 PASS——环境性问题，非本卡。

---

## 6. 诚实未验证项

1. **未跑真实 Google OAuth 回流**（无后端/凭据）：start→authorize→回流→捕获→complete
   全链的参数拼写以后端实现为准逐字段核对（`identity/mod.rs` DTO + `login_flow.rs`）；
   `redirect_uri` 需运营在 Google 控制台登记为前端 `/login`（本卡不传，见 §3）。
2. **未跑 e2e/playwright**（仓库有 `test:e2e`，需真实后端）。
3. `pnpm test` 的既有失败（4.0 节）在 origin/main 上同样存在，本卡未修（范围外）。
