# 交接 · FE-YUN139-ACCOUNT-POOLS（139 账号池前端面）

仓库 `/home/tefuir/rustproject/fmby-web`，分支 `w/w5/fe-yun139-account-pools`，
worktree `/data/wt-w5/fe-yun139-account-pools`（`git worktree add` 自 `origin/main` 新建）。

> 主签出当时有 **5 个非我改动**（他人 in-flight WIP + 2 个未跟踪文件）⇒ 按硬纪律**未提交他人 WIP**，
> 直接新建独立 worktree 从 `origin/main` 开工，主签出原样未动。

---

## 1. 先核实缺口为真（一律用 `origin/main` ref，不查工作区）

后端 **9 个** account-pools 端点已注册（`crates/fmby-v2-http/src/routes/yun139_accounts.rs`）：
```
段 A（池 CRUD 8 条）
  GET/POST        /api/manage/yun139/account-pools
  GET/PUT/DELETE  /api/manage/yun139/account-pools/{pool_id}
  GET/POST        /api/manage/yun139/account-pools/{pool_id}/members
  DELETE          /api/manage/yun139/account-pools/{pool_id}/members/{profile_id}
段 B（调度运维 2 条）
  POST /api/manage/yun139/account-pools/{pool_id}/lease
  POST /api/manage/yun139/account-pools/{pool_id}/report
```
前端取证（新 worktree = `origin/main`）：
- `/api/.../account-pool*` 路径调用：**0 处**；
- 唯一 `AccountPool` 命中是 `shared/src/contracts/manage/license/types.ts` 的
  `microsoftAccountPool: boolean` —— **授权权益开关**，与 139 账号池**无关**。
⇒ **缺口为真，非重复造**。

## 2. 本卡挑选范围：只做**段 B（调度运维 2 端点）**

卡面指示「挑内聚的 1-2 个做」⇒ 选 **段 B**：
- **内聚性最强**：`lease`（试租借）与 `report`（结果回写）是一条完整运维闭环，
  单独可测、单独可用；段 A 的 8 条 CRUD 需要一整套池/成员管理 UI 才成面。
- **段 A 本次不做**，登记为后续卡（见 §7）。

## 3. 后端 wire（`origin/main` 实测，逐字段对拍依据）

handler：`routes/yun139_accounts.rs`（能力门 **`MANAGE_MOUNT`**）
DTO：`crates/fmby-v2-http/src/state/yun139_accounts.rs`
```
POST .../lease   body Yun139LeaseRequest{ sticky_key? }
                 →    Yun139LeaseResponse{ pool_id?, lease_id, profile_id, display_name, expires_at }
POST .../report  body Yun139ReportRequest{ profile_id, lease_id?, success, cooldown_seconds? }
                 →    OkResponse{ ok }
```
- ★`expires_at` 是 **epoch 毫秒**（租借 TTL，过期视为自动归还）⇒ 前端**原样透传**，不转字符串。
- `cooldown_seconds` / `lease_id` / `sticky_key` 可省 ⇒ 省略时**不发送**（冷却缺省由池配置决定）。

## 4. 改动清单（最小，落在既有 `yun139` 子契约）

| 文件 | 内容 |
|---|---|
| `shared/src/contracts/manage/yun139/types.ts` | 新增 `Yun139LeaseInput` / `Yun139LeaseResult` / `Yun139ReportLeaseInput` |
| `shared/src/contracts/manage/yun139/api.ts` | 新增 `yun139Api.leaseFromPool` / `yun139Api.reportLease` + `RawYun139LeaseResponse`（复用既有 `RawOkResponse`、`BASE`） |
| `shared/tests/yun139-pool-lease.test.ts`（新） | 契约对拍 2 例 |

## 5. RED → GREEN

- **RED**：先写 2 例 → `yun139Api.leaseFromPool is not a function` / `...reportLease is not a function`（真红）。
- **GREEN**：加类型 + 2 方法后 **2/2 通过**。
- 中途 1 处**我的脚本**错：类型 import 的正则按双引号匹配，实际是单引号 ⇒  AssertionError；
  修正为按实际锚点替换。**未改实现、未弱化断言**。
- 测试锁死：路径、wire 仅 snake_case 字段、可选字段省略不发送、`expiresAt` 毫秒原样透传。

## 6. ★不造文案 / 语义要点

- 错误走既有 `getErrorMessage`（出后端 `message` 原文），本卡**未新增**错误码表。
- 可选字段一律**不臆造缺省**（`sticky_key` 省略不发；`cooldown_seconds` 省略让后端用池配置）。
- `poolId` 为 null 时如实呈现，不伪造空串。

## 7. 跳过项 / 待裁（明写）

- **段 A（池 CRUD 8 条）未做**：需整套池/成员管理 UI 才成面，超出「挑 1-2 个」范围 ⇒ **登记后续卡**。
- **`check-frontend-size` FAIL 为环境问题，非代码回归**：该闸读
  `host/dist/.vite/manifest.json`（`pnpm build` 产物）；新 worktree **从未构建**
  （`host/dist` 不存在），我的改动只在 `shared/src` + 1 个 shared 测试，不可能影响该产物。
  跑 `pnpm build` 属重活 ⇒ **登记跳过项，建议 CI 复跑确认**。
- 未做页面/交互（本卡只交付契约层）。
- 新 worktree 无 `node_modules`，验证时**临时软链**主签出的 `node_modules`
  （根/shared/host），**提交前已移除**，未进版本库。
- 未改后端、未造字段、未改契约仓/mirror、未引依赖、未跑全仓重活、不碰农场、
  未用 `git stash`、未用 `cargo fmt --all`。

## 8. 当次验证（原文级）

```
shared: ./node_modules/.bin/tsc -p . --noEmit   → exit 0（0 错）
host:   ./node_modules/.bin/tsc -p . --noEmit   → exit 0（0 错）
host:   npm test                                → tests 401 / pass 401 / fail 0
                                                  （node --test，非 vitest）
shared: node --import ./tests/register-resolver.mjs --test tests/yun139-pool-lease.test.ts
                                                → tests 2 / pass 2 / fail 0
shared: node --import ./tests/register-resolver.mjs --test tests/*.test.ts
                                                → tests 134 / pass 134 / fail 0
node scripts/check-frontend-component-size.mjs   → PASS
node scripts/check-contract-mappers.mjs          → PASS
node scripts/check-frontend-size.mjs             → FAIL（环境缺 pnpm build 产物，见 §7）
```

## 9. 提交

一原子项一提交：3 个类型 + 2 个 API 方法 + raw 接口 + 契约测试 2 例 + 本 handoff。

`Reviewed-by: pending-non-author-review`
