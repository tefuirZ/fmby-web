# 交接 · FE-POINTS-CHECKIN（用户自助「积分 / 签到」面）

仓库 `/home/tefuir/rustproject/fmby-web`，分支 `w/w5/fe-points-checkin`（基于 `origin/main`）。
本卡用 **ponytail**（复用既有 DTO/mapper、不复制实现、不造字段、不造错误文案）；
找符号只用 **codegraph**；查证据一律用 **`origin/main` ref**（不查工作区——吸取上轮教训）。

---

## 1. 先核实缺口为真（用 `origin/main` ref，非工作区）

后端**用户面** 5 端点已注册（`crates/fmby-v2-http/src/routes/router_core.rs`）：
```
GET  /api/rewards/me                                → rewards_me
GET  /api/rewards/rule                              → rewards_rule
POST /api/rewards/checkins                          → rewards_checkin
POST /api/rewards/redemptions/server-days           → rewards_redeem_server_days
POST /api/rewards/redemptions/media-request-credits → rewards_redeem_media_request_credits
```
前端现状取证：现存 rewards 调用**全部**是 `/api/manage/rewards/*`（管理面：
accounts/ledger/rule/stats/points-adjust/config），
`ManageRewardsPage` + `RewardsRuleSection` + `RewardsAdjustSection` 已覆盖管理面。
⇒ **用户面 5 端点零消费**，缺口为真，**非重复造**。

## 2. 后端 wire（`origin/main` 实测，逐字段对拍依据）

DTO：`crates/fmby-v2-http/src/state/rewards.rs`
- `RewardsMySummaryDto`：`user_id`、`account?`（`user_id/balance/lifetime_earned/lifetime_spent/version/updated_at`）、
  `total_checkin_days`、`current_streak_days`、`latest_ledger?`
- `RewardsRuleVersionDto`：`id/version/status/created_by/created_at/published_at/config`
- `RewardsCheckinResultDto`：`created`、`awarded_points`、`checkin_date`(YYYYMMDD)、
  `streak_days`、`total_checkin_days`、`status`、`checked_in_at`(ms)
- `RewardsRedemptionResultDto`：`id/idempotency_key/applied/redemption_type/quantity/
  points_spent/rule_version/created_at/balance/valid_until_after?`
- 请求体（`routes/rewards.rs`）：`CheckinRequest{ source? }`——**body 可省**
  （handler 是 `Option<Json<CheckinRequest>>`）；`RedeemBody{ idempotency_key, quantity }`
  （`deny_unknown_fields`）。

所有时间为**毫秒**；wire 为 **snake_case**。

## 3. 改动清单（最小，复用既有）

| 文件 | 内容 |
|---|---|
| `shared/src/contracts/manage/peripherals/types.ts` | 新增 3 个用户面视图类型（`RewardsMySummary` / `RewardsCheckinResult` / `RewardsRedemptionResult`），**复用**管理面既有 `RewardsPointAccountRecord` / `RewardsLedgerEntryRecord` / `RewardsRuleVersionRecord` |
| `shared/src/contracts/manage/peripherals/api.ts` | 新增 `rewardsApi`（5 方法）+ 3 个 raw 接口 + `fromMySummary` / `fromCheckinResult` / `fromRedemptionResult` / `fromLedgerEntry`；规则**复用**既有 `fromRewardsRuleConfig` |
| `shared/src/contracts/rewards/index.ts`（新） | 用户面门面，**只做再导出**（实现仍在 peripherals，单一真源、零重复） |
| `shared/tests/rewards-self.test.ts`（新） | 契约对拍 3 例 |

## 4. ★语义要点（已在测试钉死）

- **body 可省**：`checkIn()` 不带 source 时**不臆造请求体**（后端 `Option<Json<...>>`）；
  带 source 时只发 `{ source }`（`deny_unknown_fields`）。
- **幂等不掩盖**：当日重复签到 ⇒ `created=false` / `awardedPoints=0`；
  兑换同 `idempotency_key` ⇒ `applied=false`。前端不做本地乐观加/减分，一律以响应为准。
- **不伪造零值**：`account=null`（从未产生积分记录）、`latestLedger=null`（无流水）、
  `validUntilAfter=null`（非该类型/幂等未续期）均如实呈现。
- **不造错误文案**：错误走既有 `getErrorMessage`（`shared/src/errors/messages.ts`）展示后端
  `message` 原文；本卡**未新增**错误码表（`shared/src/errors/` 本就无 rewards 码）。

## 5. RED → GREEN

- **RED**：先写 3 例 → `ERR_MODULE_NOT_FOUND: .../contracts/rewards`（真红，契约不存在）。
- **GREEN**：建类型 + `rewardsApi` + 门面后 **3/3 通过**。
- 中途 2 处**我的**装配错，按纪律改自己、不改实现/不弱化断言：
  1. 误用不存在的 `fromRuleVersion` ⇒ 改为复用既有 `fromRewardsRuleConfig` 组装版本视图；
  2. `latestLedger` 直接把 raw 赋给视图类型（TS2322）⇒ 补 `fromLedgerEntry` 映射。

## 6. 当次验证（原文级）

```
shared: npx tsc -p . --noEmit                 → exit 0（0 错）
host:   npx tsc -p tsconfig.app.json --noEmit  → exit 1（22 处，**全部 main 基线、非本卡**，见 §7）
host:   npm test                               → tests 397 / pass 397 / fail 0  （node --test，非 vitest）
shared: node --import ./tests/register-resolver.mjs --test tests/rewards-self.test.ts
                                              → tests 3 / pass 3 / fail 0
shared: node --import ./tests/register-resolver.mjs --test tests/*.test.ts
                                              → tests 128 / pass 128 / fail 0
node scripts/check-frontend-size.mjs           → PASS
node scripts/check-frontend-component-size.mjs → PASS
node scripts/check-contract-mappers.mjs        → PASS
```

## 7. 跳过项 / 待裁（明写）

- **host tsc 22 处错全部非本卡引入**（`git status` 可证我只改了 `shared/**` 三个文件 + 两个新文件）：
  集中在 `CollectionsListPage.tsx`（`useCollectionsList` 断链 + 隐式 any）、`LoginPage.tsx` /
  `MfaVerifyPanel.tsx` / `LoginForm.tsx`（**MFA 面**，随最新 main 合入，
  `AuthLoginMfaRequired.user` 不存在、`User` 与 `AuthResponse` 不兼容等）、
  `Pan115DirectoryBrowserSection.tsx`（未用 import）。
  ⇒ 我不越界改他人文件；**建议按面派返工卡**（MFA 面看起来是新合入且未跑通 tsc）。
- **未做页面/交互**（本卡只交付契约层）：用户面积分/签到 UI（页面 + viewmodel + 路由入口）
  需另开卡；契约已就位后该卡可直接消费 `rewardsApi`。
- 未改后端、未造字段、未改契约仓/mirror、未引依赖、未跑全仓重活、不碰农场、未用 `git stash`。

## 8. 提交

一原子项一提交：3 个视图类型 + `rewardsApi` + `contracts/rewards` 门面 + 契约测试 3 例 + handoff。

`Reviewed-by: pending-non-author-review`
