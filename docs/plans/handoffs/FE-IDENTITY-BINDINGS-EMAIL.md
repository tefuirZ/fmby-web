# FE-IDENTITY-BINDINGS-EMAIL 交付说明 · 身份绑定 Email 输入面

**仓库**：`fmby-web`　**分支**：`w/fe/identity-bindings-email`（从 `origin/main` 起）
**基点**：`origin/main`
**前置合并**：`w/fe/identity-bindings-ui`（绑定管理基础面 + Major-1 回站修复，ref 保留，未删未回滚）
**提交**：`1ae3ba2`（承接）→ 本卡提交 `<sha>`

**判据（本地最小门禁）**：
- host `tests/identity-bindings-presentation.test.ts` **14/14 pass**
- host `tsc -p tsconfig.app.json --noEmit` **EXIT=0**
- shared `tests/identity-bindings.test.ts` **14/14 pass**
- shared `tsc -p . --noEmit` **EXIT=0**
- `node scripts/check-contract-mappers.mjs` **0 违规**

---

## ponytail 段

- **阶梯**：先 codegraph + 后端（`fmby-review/FMBY-V2`）核实 Email 绑定真实接口形态 →
  复用既有 `identityBindingsApi.start` / 既有 `enter_code` pending UI（收验证码完成）→
  仅补「email 多一步邮箱输入」的最小输入面 + 一个纯函数 `startInputForProvider` 构造 start 入参。
  **零新依赖、零新组件、零改后端/契约仓**。
- **点名天花板 + 升级路径**：email 输入面复用既有的 `styles.field` / `Input` / `bindingCodeForm`
  形态（与验证码输入同形）；若后续加「邮箱格式前端硬校验（RFC 级）」→ 在 `startInputForProvider`
  调用前加 `if (!isValidEmail(email))` 即可，不新建校验模块。

---

## ① 后端接口实证（codegraph + fmby-review/FMBY-V2 交叉核实，不猜）

| 项 | 真相（后端 `login_flow.rs`） | 前端处理 |
|---|---|---|
| `start_binding`(email) 入参 | `start_email(email, redirect_uri, intent=Bind, user_id)`：`email` 缺/空 → `AppError::Validation("邮箱登录需要 email")` 400（`login_flow.rs:344-348`）；SMTP 未装配（`email_sender` None）→ `DependencyUnavailable` 503（`login_flow.rs:333-339`）；邮箱已绑**其他**账号 → `Validation("该邮箱已绑定其他账号")` 400（`login_flow.rs:362-367`） | 前端邮箱输入面收邮箱后带 `{ email }` 调 start；错误经 `getErrorMessage` 原样展示 |
| `start` 返回形态 | `action: "enter_code"`、`authorizeUrl: null`、`delivery_status: "sent"`、`message: "邮箱绑定验证码已发送"`（`login_flow.rs:380-396`） | 命中既有 `enter_code` pending 分支（同页收验证码 → complete） |
| `complete`(email) | `resolve_intrinsic_identity`（challenge 自带验证物）；前端 `enter_code` 经 `providerSubject` 通道送验证码，后端桥接到 `verification_code`（Major-3 已对齐，本次不变） | `bindingCompleteRequest` 已正确分流 |
| google 回站 | `start_oauth` 用入参 `redirect_uri` 覆盖配置值（`login_flow.rs:256-266`） | `startInputForProvider('google', …, href)` 带 `redirectUri`（Major-1 保留） |

**结论**：后端 Email 绑定**接口完整可用**（前提是 SMTP 已装配）；真实缺口仅为前端**没有邮箱输入面**（S17 Major-2）。本卡补齐该输入面，无后端缺口需登记。

---

## ② RED → GREEN

### RED（卡要求 + 评审 Major-2）
- Email 被列为可绑定 provider，但绑定页无邮箱输入，直接 `start(provider)` 必 400（功能不可达）。
- 新增失败用例：`startInputForProvider('email','…')` 必须把邮箱带入 start；空邮箱不编造字段（交后端 400）。

### GREEN（实现并已绿）
- `startInputForProvider(provider, email, redirectUri)`（`identityBindingsPresentation.ts`）：
  `email`→`{ email }`（trim，空则 `undefined`）；`google`→`{ redirectUri }`（Major-1）；其余 `{}`。
- 页面 `startMutation` 改用 `startInputForProvider(provider, emailDraft, window.location.href)`，
  **保留 Major-1 的 google redirectUri**。
- 可绑定列表对 `email` provider 增加内联邮箱输入：`绑定`→展开 `Input[type=email]` + `发送验证码`
  按钮（提交即带邮箱 start）；非 email provider 仍是单按钮直接发起。
- 既有 `enter_code` pending UI 不变：收到验证码后 `complete` → `invalidateQueries` 刷新列表。
- host 测试新增 2 条 ★（`startInputForProvider` email/google/telegram 分流），8→14。

---

## ③ 当次验证（原文）

```text
# host 单测（host/ 子目录）
$ cd host && node --import ./tests/register-aliases.mjs --test tests/identity-bindings-presentation.test.ts
ℹ tests 14  ℹ pass 14  ℹ fail 0  ℹ duration_ms 458

# host 类型检查（host/ 子目录）
$ cd host && FMBY_QUEUE_ALLOW_HEAVY_LOCAL=1 ./node_modules/.bin/tsc -p tsconfig.app.json --noEmit
EXIT=0

# shared 单测（shared/ 子目录）
$ cd shared && node --import ./tests/register-resolver.mjs --test tests/identity-bindings.test.ts
ℹ tests 14  ℹ pass 14  ℹ fail 0

# shared 类型检查
$ cd shared && FMBY_QUEUE_ALLOW_HEAVY_LOCAL=1 ./node_modules/.bin/tsc -p . --noEmit
EXIT=0

# 契约对齐门禁（仓根）
$ node scripts/check-contract-mappers.mjs
[PASS] 0 contract violations found.
```

---

## ④ 跳过 / 待裁项

- **前端邮箱格式硬校验**：本卡仅做「非空」前置（空则按钮 disabled，交后端 400）；
  未做 RFC 级格式校验。若主代理要求前端拦截明显非法格式，在 `startInputForProvider` 调用前加
  一处正则即可（ponytail 已点名升级路径）。
- **SMTP 未装配（503）**：后端真实缺口，非前端范围；前端如实展示「邮箱登录发信面未接线」，不假成功。
- **e2e/Playwright**：未覆盖（属重活门禁，留农场；同前卡口径）。
- **后端缺口登记**：无（Email 绑定接口完整，仅前端输入面缺失，已补）。

## ⑤ 验收对位

| 验收 | 落点 |
|---|---|
| 邮箱格式非法 | 前端空邮箱禁用提交；非空但后端拒（如已绑他人/格式）经 `InlineBanner` 原样展示 |
| start/complete 往返刷新 | email→`{email}` start→enter_code→收码→complete→`invalidateQueries` |
| 失败/过期/provider 不符诚实态 | `startMutation`/`completeMutation` 错误经 `getErrorMessage` 展示，无假成功 |
| 复用既有 | `identityBindingsApi` / `InlineBanner` / `FeedbackState` / 既有 `enter_code` pending UI |
