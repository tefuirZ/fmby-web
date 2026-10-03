# 交接 · FE-YUN139-POOLS-SEG-A（账号池段 A：池 CRUD + 成员管理）

仓库 `/home/tefuir/rustproject/fmby-web`，分支 `w/w5/fe-yun139-pools-seg-a`，
worktree `/data/wt-w5/fe-yun139-pools-seg-a`（`git worktree add` 自 `origin/main` 新建）。

> 主签出当时有 **5 个非我改动**（他人 in-flight WIP + 2 个未跟踪文件）⇒ 按硬纪律
> **未提交他人 WIP**，直接新建独立 worktree 从 `origin/main` 开工，主签出原样未动。

---

## 1. 缺口核实（一律用 `origin/main` ref，不查工作区）

后端 `account-pools` 共 9 端点（`crates/fmby-v2-http/src/routes/yun139_accounts.rs`）：
- **段 B（2 条）** `lease` / `report` —— 上一张卡已交付并合入；
- **段 A（8 条）** 本卡目标，前端**仍零调用**（`/api/.../account-pool*` 路径 0 处；
  唯一 `AccountPool` 命中仍是 `license/types.ts` 的 `microsoftAccountPool: boolean`
  ——授权权益开关，与账号池无关）。
⇒ 缺口为真，非重复造。

## 2. 段 A 端点与 wire（`origin/main` 实测）

能力门：**`MANAGE_MOUNT`**；wire **snake_case**；DTO 在
`crates/fmby-v2-http/src/state/yun139_accounts.rs`。
```
GET    /api/manage/yun139/account-pools                    → { items: Pool[] }
POST   /api/manage/yun139/account-pools                    → { pool: Pool }
GET    /api/manage/yun139/account-pools/{id}               → { pool: Pool }
PUT    /api/manage/yun139/account-pools/{id}               → { pool: Pool }
DELETE /api/manage/yun139/account-pools/{id}               → { ok }
GET    /api/manage/yun139/account-pools/{id}/members       → { items: Member[] }
POST   /api/manage/yun139/account-pools/{id}/members       → { member: Member }
DELETE /api/manage/yun139/account-pools/{id}/members/{pid} → { ok }
```
- Pool **10 字段**：`id/name/description?/strategy/cooldown_seconds/max_concurrent/
  is_enabled/member_count/created_at/updated_at`
- Member **11 字段**：`pool_id/profile_id/profile_label?/profile_status?/weight/is_enabled/
  last_used_at?/fail_count/cooldown_until?/created_at/updated_at`
- 请求：`Create{ name, description?, strategy?, cooldown_seconds?, max_concurrent? }`
  （**仅 name 必填**）；`Update` 全可选（**PATCH 语义**）；`AddMember{ profile_id, weight? }`
- ★时间字段（created_at/updated_at/last_used_at/cooldown_until）均为 **epoch 毫秒**
  ⇒ 前端**原样透传**，不转字符串。
- 注：本 worktree 的 `origin/main` 快照尚未含上一张卡的段 B 方法（后续合并带入，
  与本卡新增方法**不冲突**，方法名不同）。

## 3. 改动清单（最小，落在既有 `yun139` 子契约）

| 文件 | 内容 |
|---|---|
| `shared/src/contracts/manage/yun139/types.ts` | 新增 `Yun139AccountPool` / `Yun139CreateAccountPoolInput` / `Yun139UpdateAccountPoolInput` / `Yun139AccountPoolMember` / `Yun139AddAccountPoolMemberInput` |
| `shared/src/contracts/manage/yun139/api.ts` | 新增 **8 个方法**（listAccountPools / createAccountPool / getAccountPool / updateAccountPool / deleteAccountPool / listAccountPoolMembers / addAccountPoolMember / removeAccountPoolMember）+ raw 接口 + `fromPool` / `fromMember`（复用既有 `RawOkResponse` / `BASE`） |
| `shared/tests/yun139-pools-seg-a.test.ts`（新） | 契约对拍 **6 例** |

## 4. ★语义要点（测试已钉死）

- **可选字段省略 ⇒ 不发送**：建池仅 name 必填；加成员 `weight` 可省；改池只发传入字段
  （**PATCH**，不整体覆盖）—— 交由后端缺省/校验，前端不臆造。
- **响应解包正确**：列表解 `items`；单池解 `pool`；成员列表解 `items`；加成员解 `member`；
  删除解 `ok`（返回布尔，不把整个响应当结果）。
- **时间毫秒原样透传**；`description`/`profileLabel`/`profileStatus`/`lastUsedAt`/`cooldownUntil`
  为 null 时如实呈现，不伪造 0/空串。
- **不造文案**：错误走既有 `getErrorMessage`（出后端原文），本卡**未新增**错误码表。
- 删除属不可逆操作 ⇒ 契约层**不带** `confirmed`（后端该族无 `require_confirmed`），
  由 UI 层确认弹窗兜底（沿用文件头既有注释口径）。

## 5. RED → GREEN

- **RED**：先写 6 例 → 全部 `yun139Api.<method> is not a function`（真红）。
- **GREEN**：加类型 + 8 方法后 **6/6 通过**。全程无「改实现绕过断言」。

## 6. 当次验证（原文级）

```
shared: ./node_modules/.bin/tsc -p . --noEmit  → exit 0（0 错）
host:   ./node_modules/.bin/tsc -p . --noEmit  → exit 0（0 错）
host:   npm test                               → tests 405 / pass 405 / fail 0
                                                 （node --test，非 vitest）
shared: node --import ./tests/register-resolver.mjs --test tests/yun139-pools-seg-a.test.ts
                                               → tests 6 / pass 6 / fail 0
shared: node --import ./tests/register-resolver.mjs --test tests/*.test.ts
                                               → tests 138 / pass 138 / fail 0
node scripts/check-frontend-component-size.mjs  → PASS
node scripts/check-contract-mappers.mjs         → PASS
```

## 7. 跳过项 / 待裁（明写）

- **UI 后置**：卡面允许「本卡至少把契约 + TDD 做齐」⇒ 本卡**只交付契约层**；
  池/成员管理页面（列表、建/改/删、成员增删、危险操作确认弹窗）**另开卡**，
  契约已就位后可直接消费 `yun139Api`。
- **`check-frontend-size` 未跑（登记跳过）**：该闸读 `host/dist/.vite/manifest.json`
  （`pnpm build` 产物）；新 worktree 从未构建、`host/dist` 不存在，且我的改动只在
  `shared/src` + 1 个 shared 测试。**属环境问题，非代码回归**，建议 CI 复跑确认。
- 新 worktree 无 `node_modules`，验证时**临时软链**主签出的 `node_modules`
  （根/shared/host），**提交前已移除**，未进版本库。
- 未改后端、未造字段、未改契约仓/mirror、未引依赖、未跑全仓重活、不碰农场、
  未用 `git stash`、未用 `cargo fmt --all`。

## 8. 提交

一原子项一提交：5 个类型 + 8 个 API 方法 + raw/mapper + 契约测试 6 例 + 本 handoff。

`Reviewed-by: pending-non-author-review`
