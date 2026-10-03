# FE-NOTIFICATION-PREFS 交接（到期通知设置契约层）

分支：`w/w/fe-notification-prefs` @ `origin/main`（worktree `/data/wt-yun-fe-notify`，干净、上尖）。

## 1. 先取证：缺口为真（用 `origin/main` ref，未查落后活树）

**后端（FMBY-V2 `origin/main`）**:
- 路由 `GET/PUT /api/manage/users/expiry-notifications/settings`
  （`crates/fmby-v2-http/src/routes/router_manage.rs:79-84`）；
  handler `routes/manage_expiry_notifications.rs:23`（GET）/ `:41`（PUT）；
- 能力门 `MANAGE_ACCESS`（`manage:users`）；
- DTO `dto/manage.rs:106` = `{ enabled: bool, threshold_days: Vec<i32> }`（**snake_case wire**）；
- KV `manage.user_expiry_notification.config`（与到期提醒 worker 同键）⇒ **零迁移**；
- 未持久化 ⇒ 诚实缺省 `enabled=true` / `threshold_days=[7,3,1]`；端口未装配 ⇒ **fail-closed 500**。

**前端**:全仓 `expiry_notification*` / `expiryNotification` / `expiry-notification` **零命中**，
`shared/src/contracts/manage/` 亦无对应模块 ⇒ **确为「后端已有、前端零调用」**，非重复工作。

## 2. 交付（ponytail：只补契约层，不新造范式）

新增 `shared/src/contracts/manage/expiryNotifications/`：
- `types.ts`：`UserExpiryNotificationSettings{enabled, thresholdDays}`（camelCase）、
  `RawUserExpiryNotificationSettings{enabled, threshold_days}`（wire 逐字）、
  `DEFAULT_EXPIRY_THRESHOLD_DAYS = [7,3,1]`（**单一事实源**）；
- `api.ts`：`expiryNotificationsApi.getSettings()` / `putSettings(input)`
  —— 复用既有 `httpClient`（不新造请求层）；`mapExpiryNotificationSettings`（snake→camel，
  缺字段回落诚实缺省，不伪造）；错误面**复用** `shared/src/errors` 的 `isApiError`/`getErrorMessage`；
- `index.ts` + `shared/src/contracts/manage/index.ts` 导出。

未接 UI（前端设置页面属下一增量）；未改后端/契约仓/mirror；未新迁移；未引依赖。

## 3. RED → GREEN（实测）

```
$ cd host && node --import ./tests/register-aliases.mjs --test tests/expiry-notifications.contract.test.ts
✔ ① 契约文件存在且走 httpClient
✔ ② GET 打到后端真实路径
✔ ③ snake_case → camelCase 映射字段对拍（enabled / thresholdDays）
✔ ④ 诚实缺省：未配置 ⇒ enabled=true / thresholdDays=[7,3,1]
✔ ⑤ 错误码按 shared/src/errors 对拍（不新造错误面）
ℹ tests 5 / pass 5 / fail 0
```
RED 阶段以 `ENOENT`（契约模块不存在）真实失败；GREEN 后 5/5 通过。
（过程中测试④原指向 api.ts，而缺省常量在 types.ts ⇒ 改为断言**单一事实源**，并加「api.ts 复用而非复制字面量」一条。）

## 4. 当次验证

| 验证 | 结果 |
|---|---|
| 契约测试（node --test，不依赖 node_modules） | **5 passed / 0 failed** |
| `branch-gates` | **PASS=1 FAIL=0** |
| `check-frontend-component-size` / `check-contract-mappers` | **PASS** |
| `check-frontend-dupes` | **FAIL —— main 既有红**（`shared/src/viewmodels/useCollectionsList.ts:14` 的 `queryKeys` 定义在 `shared/src/query/**` 之外），**非本卡引入** |
| `cd shared && npx tsc -p . --noEmit` / `cd host && npx tsc -p . --noEmit` | **未跑**：本 worktree `pnpm install --offline` 持续 ~7 分钟未产出 node_modules（疑似离线 store 争用），依赖未就绪 |
| `cd host && npm test`（全量） | 同上，未跑；本卡用例已单独以 node --test 通过 |

## 5. 跳过项

- 未接设置 UI 页面（契约层先行，UI 另增量）。
- 未跑 `tsc` / 全量 `npm test`（依赖安装未完成；非代码问题）——建议主代理在依赖就绪环境复跑这两项。
- 未改动 `useCollectionsList.ts`（dupes 红属既有，建议另卡修）。

Reviewed-by: pending-non-author-review
