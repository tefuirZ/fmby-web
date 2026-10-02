# FE-IDENTITY-BINDINGS 交付说明 · 账号三方身份绑定管理界面

**仓库**：`fmby-web`　**分支**：`w/fe/identity-bindings-ui`
**基点**：`1cfab4b`（v0.2.14）
**提交**：
- `13e7a4c`（契约层 shared：types/api/mappers/index + `bindingReadyProviders` + RED 契约对拍）
- `06e786c`（host UI 层：页面 + 纯逻辑 + 单测 + 路由/导航/CSS）

**判据（本地最小门禁）**：
- host `tsc -p tsconfig.app.json --noEmit` **EXIT=0**
- shared `tsc -p . --noEmit` **EXIT=0**
- host `tests/identity-bindings-presentation.test.ts` **8/8 pass**
- shared `tests/identity-bindings.test.ts` **14/14 pass**

> 注：本机 farm 队列将 `pnpm typecheck`/`pnpm test`（扇出全量 tsc/build）列为重活，
> 本卡只执行仓内允许的**窄跑**（`node --test tests/xxx.test.ts` + 直接 `tsc --noEmit`，
> 经 `FMBY_QUEUE_ALLOW_HEAVY_LOCAL` 逃生阀，仅落本地 tsc 不落农场），未触发全量门禁。

---

## ponytail 段

- **阶梯**：先复用既有（`@fmby/v2-shared/contracts/auth` 的 identity 端点、`queryKeys`、
  `@fmby/v2-shared/ui` 的 Button/Input/ConfirmDialog/FeedbackState/InlineBanner、
  `getErrorMessage`、`settings/components` 的 SettingsPageHeader/SettingsSectionCard、
  登录页 `identityPendingContext` 回流范式）→ 纯逻辑抽到 `identityBindingsPresentation.ts`
  供 node:test 直测、**零 JSX/副作用** → 页面只取数渲染。**零新依赖**。
- **点名天花板 + 升级路径**：页面 336 行（含 JSX）；纯逻辑 122 行。若后续加「绑定态轮询 /
  自动续 challenge」→ 复用 `identityBindingsApi` + `queryKeys.settings.identityBindings`，
  不新建 hooks 文件。OAuth 回站目前只处理了 Google 的 `state/challenge_id` 反查，
  其它 enter_code provider 走同页完成，无需回站；若新增「外部回调类」provider，复用
  `resolvePendingBinding` 即可。
- **跳过了什么 / 何时再加**：
  ① **未做 e2e/Playwright 覆盖**（仓内 `test:e2e` 属重活门禁，本卡只窄跑 node:test；
     且回站 OAuth 需真实 Google 凭证，无法离线跑）→ 交农场全量 `pnpm verify` 时补。
  ② **未做绑定列表分页/筛选**（后端 `GET /api/account/identity-bindings` 返回全量 `items`，
     无分页维度）→ 后端加分页时再接。
  ③ **`configured=false` 的 provider 不隐藏**（见下「判定依据」）→ 由后端 `start` 裁决并返回
     诚实错误，前端不擅自隐藏。如主代理裁定「前端也应隐藏未配置项」，再在
     `bindingReadyProviders` 增加 `configured` 过滤（一行 diff）。

---

## ① 定位结论（codegraph / 只读核实）

| 符号 | 位置 | 结论 |
|---|---|---|
| `identityBindingsApi.list/start/complete/unbind` | `shared/src/contracts/auth/identity/api.ts:179` | 全量存在；`unbind` 已带 `?confirmed=true` 闸 |
| `identityLoginApi.providers()` | `shared/src/contracts/auth/identity/api.ts:99` | 公开可用性列表，免会话 |
| `bindingReadyProviders` | `shared/src/contracts/auth/identity/mappers.ts:170` | 过滤 `enabled && bindingEnabled`（fail-closed） |
| `mapProviderAvailability` | `shared/src/contracts/auth/identity/mappers.ts` | `binding_enabled` 缺失 → `bindingEnabled=false`（不回落 enabled） |
| `queryKeys.settings.identityBindings/identityProviders` | `shared/src/query/keys.ts:57-58` | 已登记 |
| `IdentityBindingCompleteInput` | `shared/src/contracts/auth/identity/types.ts:92` | `challengeId` 必带，`code`/`providerSubject` 可选 |
| `AuthGuard` 包裹 `/settings/identity` | `host/src/app/router/index.tsx:99-187` | 路由继承 AuthGuard+AppShell，**未登录不放行**（验收①） |
| `SettingsPageHeader`/`SettingsSectionCard` | `host/src/pages/settings/components.tsx:21/42` | 既有，直接复用 |
| CSS 类 `softNotice/field/fieldHint/binding*` | `host/src/pages/settings/SettingsCenter.module.css` | 全部已定义 |

---

## ② RED → GREEN

### RED（卡要求三项 + 诚实错误）
- **RED① provider 可用性 fail-closed**：`mapProviderAvailability` 缺 `binding_enabled` →
  `bindingEnabled=false`；`bindingReadyProviders` 仅收 `enabled && bindingEnabled`。
  （shared 测试 `★mapProviderAvailability…` / `★bindingReadyProviders…`，2 条 ★ 用例）
- **RED② start/complete 成功往返**：`start` provider 进 path、`challenge_id` 原样返；
  `complete` provider 进 path、`challenge_id`/码逐字入体、返回新绑定、`onSuccess` 调
  `invalidateQueries(identityBindings)` 刷新列表（验收③）。
  （shared 测试 `★identityBindingsApi.start/complete`，2 条 ★ 用例）
- **RED③ 错误不假成功**：`complete` 过期 400 / 越权 403 / `start` 未启用 403 / `unbind`
  最后凭据 409 全部原样上抛页面经 `getErrorMessage` 展示（验收④）。
  （shared 测试 4 条 ★ 用例）

### GREEN（实现并已绿）
- host 纯逻辑 `partitionBindingProviders`：已绑定如实展示（provider 不在可用性列表也不丢）、
  `bindingEnabled=false`/`enabled=false` 不进可绑定列表（host 测试 3 条 ①）。
- `bindingCompleteRequest`：enter_code→`providerSubject`、external_callback→`code`，
  challengeId 恒取自对应 start，空码不编造字段（host 测试 3 条 ②）。
- 回流上下文 `remember/resolve/clearPendingBinding`：state=challengeId 反查 provider、
  sessionStorage 不可用不抛（host 测试 2 条 ③）。
- **Major-1 回站绑定修复**：`consumeOAuthCallback(search, onComplete)` 在回站 URL
  （`?code=..&state=..`，state=challengeId）与暂存上下文**严格匹配且有 code**时，
  返回 complete 入参并**真正调用** `completeMutation.mutate`（host 测试 4 条 ★，含
  「缺 code / state 不匹配 / 无暂存」三类不静默跳过）；页面发起 Google 绑定时传
  `redirectUri: window.location.href`（后端 start_oauth 用该值覆盖 configured
  redirect_uri），OAuth 锚点由 `target="_blank"` 改 `_self` 同标签跳转，回站落回
  `/settings/identity` 命中此 effect —— 验收③「回站会真正走 complete 绑定」。

---

## ③ 当次验证（原文）

```text
# host 单测（在 host/ 子目录执行，register 脚本位于 host/tests/）
$ cd host && node --import ./tests/register-aliases.mjs --test tests/identity-bindings-presentation.test.ts
ℹ tests 12  ℹ pass 12  ℹ fail 0  ℹ duration_ms 574

# shared 单测（在 shared/ 子目录执行，register 脚本位于 shared/tests/）
$ cd shared && node --import ./tests/register-resolver.mjs --test tests/identity-bindings.test.ts
ℹ tests 14  ℹ pass 14  ℹ fail 0  ℹ duration_ms 746

# host 类型检查（在 host/ 子目录执行）
$ cd host && FMBY_QUEUE_ALLOW_HEAVY_LOCAL=1 ./node_modules/.bin/tsc -p tsconfig.app.json --noEmit
EXIT=0

# shared 类型检查
$ FMBY_QUEUE_ALLOW_HEAVY_LOCAL=1 ./node_modules/.bin/tsc -p . --noEmit
EXIT=0
```

---

## ④ 跳过 / 待裁项

- **`configured=false` 是否前端隐藏**：当前前端不隐藏，交由后端 `start` 裁决并诚实报错
  （与「绝不伪造成功态」对齐，且 `bindingReadyProviders` 已在 shared 测试明确该语义）。
  **主代理待裁**：若要求前端同样隐藏，改 `bindingReadyProviders` 加 `configured` 一行过滤即可。
- **全量门禁未本机跑**：`pnpm verify`（含全量 tsc/构建/size/contracts/e2e）属重活，留农场。
  本卡仅验证本次改动涉及的 host+shared 类型与两组窄测。
- **e2e/Playwright** 未覆盖（理由见 ponytail 段③①）。

---

## ⑤ 验收对位

| 验收 | 落点 |
|---|---|
| ① 未登录不可访问 | `AuthGuard` 包裹 `/settings/identity`（router:99） |
| ② `binding_enabled` 缺失/false fail-closed | `mapProviderAvailability`/`bindingReadyProviders` 缺失即 false，列表过滤排除 |
| ③ challengeId/provider 不混淆、完成刷新 | `bindingCompleteRequest` 恒取对应 start；`onSuccess` 调 `invalidateQueries` |
| ④ complete 失败/过期/错误 provider 诚实态 | 4 类错误原样上抛 + `InlineBanner` 展示，无假成功 |
| ⑤ 移动/桌面不溢出 | `SettingsCenter.module.css` `@media (max-width:640px) .bindingRow{flex-start}` |
