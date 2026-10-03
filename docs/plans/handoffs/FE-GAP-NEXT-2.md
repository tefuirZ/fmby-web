# 交接 · FE-GAP-NEXT-2（用户安全 / 凭据投递）

仓库 `/home/tefuir/rustproject/fmby-web`，分支 `w/w5/fe-gap-next-2`，
worktree `/data/wt-w5/fe-gap-next-2`（`git worktree add` 自 `origin/main` 新建）。

> 主签出当时有 **6 个非我改动**（他人 in-flight WIP）⇒ 按硬纪律**未提交他人 WIP**，
> 直接新建独立 worktree 从 `origin/main` 开工，主签出原样未动。

---

## 1. 取哪个面（先说清，避撞车）

**取「用户安全 / 凭据投递」**：`/api/manage/users/{id}` 下两条管理员危险操作
—— `mfa/totp/reset` 与 `telegram-password-reset`。

避撞车核查：
- 已扫描到 **`/data/wt-lib/gap-sweep-2` 在做 migration wizard**（`/api/manage/migration/*`）
  ⇒ 本卡**不碰**该面。
- 本会话/本席已做面：rewards、media-reprocess、yun139 pools（段 A/段 B）、
  points-checkin、collections、direct-registration ⇒ 均不重复。

## 2. 严格判据（三条全满足，附证据）

| 判据 | 结论 | 证据 |
|---|---|---|
| 后端**真实实现非 501** | ✅ | `router_core.rs`：`/manage/users/{id}/mfa/totp/reset` → `auth_mfa::post_reset_user_totp`（`MANAGE_ACCESS` + `DANGEROUS_ACTION` + `require_confirmed`）；`/manage/users/{id}/telegram-password-reset` → `manage_users::manage_users_schedule_telegram_password_reset`（`require_dangerous_manage`；端口未装配 ⇒ **503**，非假成功）。两者均非 501 占位。 |
| 前端**零调用** | ✅ | 逐条核实：`mfa/totp/reset` **0 命中**、`telegram-password-reset` **0 命中**；同族的 `reset-password` / `approve-registration` / `reject-registration` / `login-risk/reset` **都已接**（用 `` `/api/manage/users/${userId}/...` `` 模板串），**仅这两条漏**。 |
| 与在做面不撞车 | ✅ | 见 §1 |

> ⚠ 过程中的一次**误判（已纠正，如实记）**：我先做了一次「后端路径 − 前端路径」全量比对，
> 把 `reset-password` / `approve-registration` / `reject-registration` / `login-risk/reset`
> 也列成了「零调用」——**错**，它们用模板字符串 `` ${userId} ``，我按字面量归一化比对漏了。
> 逐条复核后才锁定真正的两条缺口。结论：**扫描结论必须逐条复核才能报**。

## 3. 后端 wire（`origin/main` 实测）

```
POST /api/manage/users/{id}/mfa/totp/reset
  → MfaOkResponse{ ok: bool }     （?confirmed=true 必带）
POST /api/manage/users/{id}/telegram-password-reset
  → TelegramPasswordResetReceiptDto{
      operation_id, user_id, username, replayed, delivery_status, payload_expires_at }
  （?confirmed=true；幂等键取请求头 x-idempotency-key，缺省按日派生）
```
- `delivery_status`：`pending/delivering/retry_waiting/delivered/failed/expired`。
- `payload_expires_at`：**epoch 毫秒**（载荷有效期）。
- ★**安全红线**：后端注释明写「明文密码绝不在此回执出现——只经 Telegram 私聊投递」
  ⇒ 前端契约层**不声明/不透出任何密码字段**。
- `replayed=true` = 同 actor + 同幂等键重复提交（幂等复用），前端不掩盖。

## 4. 改动清单

| 文件 | 内容 |
|---|---|
| `shared/src/contracts/manage/types.ts` | 新增 `TelegramPasswordResetReceipt`（6 字段视图类型） |
| `shared/src/contracts/manage/api.ts` | 新增 `manageApi.resetUserTotp` / `manageApi.scheduleTelegramPasswordReset` + `RawMfaOkResponse` / `RawTelegramPasswordResetReceipt` |
| `shared/tests/user-security-ops.test.ts`（新） | 契约对拍 2 例 |

## 5. ★语义要点（测试钉死）

- **危险操作必带 `?confirmed=true`**（两条都是 `require_dangerous_manage` / `require_confirmed`）
  ⇒ 不在前端静默降级提交。
- **幂等键走请求头** `x-idempotency-key`：**不传时不发明该头**（交给后端按日派生），
  **也不塞进 body**。`RequestConfig extends Omit<RequestInit,'body'|'signal'>` ⇒ `headers` 合法。
- **回执不含明文**：测试遍历回执键名断言不得出现 `password|plaintext|secret|token`。
- 不造错误文案：错误走既有 `getErrorMessage`（出后端原文），本卡**未新增**错误码表。

## 6. RED → GREEN

- **RED**：2 例先红（`resetUserTotp is not a function` / `scheduleTelegramPasswordReset is not a function`）。
- **GREEN**：加类型 + 2 方法后 **2/2 通过**。
- 中途 1 处**我的**装配错：`RawOkResponse` 在 manage 契约里**未定义**（它定义在 yun139 子契约），
  直接引用 ⇒ `TS2304`；改为在 manage 内定义 `RawMfaOkResponse`（对齐后端 `MfaOkResponse{ok}`），
  **未改实现绕过**。

## 7. 当次验证（原文级）

```
shared: ./node_modules/.bin/tsc -p . --noEmit  → exit 0（0 错）
host:   ./node_modules/.bin/tsc -p . --noEmit  → exit 0（0 错）
host:   npm test                               → tests 409 / pass 409 / fail 0
                                                 （node --test，非 vitest）
shared: node --import ./tests/register-resolver.mjs --test tests/user-security-ops.test.ts
                                               → tests 2 / pass 2 / fail 0
shared: node --import ./tests/register-resolver.mjs --test tests/*.test.ts
                                               → tests 142 / pass 142 / fail 0
node scripts/check-frontend-component-size.mjs  → PASS
node scripts/check-contract-mappers.mjs         → PASS
```

## 8. 跳过项 / 待裁

- **`check-frontend-size` 未跑（登记跳过）**：读 `host/dist/.vite/manifest.json`（`pnpm build` 产物）；
  新 worktree 从未构建、`host/dist` 不存在，改动只在 `shared/src` + 1 个测试 ⇒ **环境问题非回归**，
  建议 CI 复跑。
- **UI 不做**（契约层交付）：两条都是管理员危险操作，UI 需配确认弹窗（危险确认语义）
  ⇒ 另开卡，契约已就位可直接消费。
- 未改后端、未造字段、未改契约仓/mirror、未引依赖、未跑全仓重活、不碰农场、
  未用 `git stash`、未用 `cargo fmt --all`。验证时临时软链的 `node_modules` 提交前已移除。

## 9. 提交

一原子项一提交：1 个类型 + 2 个 API 方法 + 2 个 raw 接口 + 契约测试 2 例 + 本 handoff。

`Reviewed-by: pending-non-author-review`
