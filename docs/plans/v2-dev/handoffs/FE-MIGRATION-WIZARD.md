# FE-MIGRATION-WIZARD 交接（迁移向导面：接 inspect + export，import 为占位不接）

分支：`w/w/fe-migration-wizard` @ `origin/main`（worktree `/data/wt-yun-fe-migration`）。

## 1. 先核实：三个端点逐个判定（`origin/main` ref，未查落后活树）

| 端点 | 后端状态 | 处置 |
|---|---|---|
| `GET /api/manage/migration/inspect` | **真实实现**（`manage_migration.rs::migration_inspect`，体内无 `not_implemented`；能力门 `VIEW_AUDIT`；端口未装配 ⇒ fail-closed，不返空壳） | ✅ 本卡接 |
| `GET /api/manage/migration/export` | **真实实现**（`migration_export`，同上） | ✅ 本卡接 |
| `POST /api/manage/migration/import` | **`ErrorCode::NotImplemented` 占位**（“远程执行 DDL 本卡未实现；已拆独立卡单独设计鉴权/幂等/干跑校验”） | ❌ **不接**（按派卡「别接占位」） |

路由注册：`router_manage.rs:373-378`。前端取证：全仓 `manage/migration` / `migrationInspect` /
`migrationExport` 等 **零命中** ⇒ inspect/export 为真缺口。

## 2. 交付（ponytail：契约层，不新造范式）

新增 `shared/src/contracts/manage/migration/`：
- `types.ts`：`MigrationEntry{version,name,checksum,appliedAtMs}`、
  `MigrationInspectResponse{count,currentVersion,entries}`、`MigrationExportResponse{entries}`；
- `api.ts`：`migrationApi.inspect()` / `migrationApi.export()` —— 复用既有 `httpClient`；
  错误面复用 `shared/src/errors`（`isApiError`/`getErrorMessage`）；**无 import 方法**（占位不接线）；
- `index.ts` 与 `shared/src/contracts/manage/index.ts` 导出。

**wire 说明（易错点）**：后端 DTO 已用 `serde(rename=...)` 输出 **camelCase**
（`appliedAtMs` / `currentVersion`）⇒ 前端**不做** snake→camel 转换，字段名直接对拍（测试③锁定）。

未接向导 UI；未改后端/契约仓/mirror；未新迁移；未引依赖。

## 3. RED → GREEN（实测）

```
RED  : ENOENT —— shared/src/contracts/manage/migration/api.ts 不存在
修复  : 测试③原断言字段写在 api.ts，实际字段定义在 types.ts（单一事实源）⇒ 改为断言 types.ts
        + api.ts 不得出现 applied_at_ms（同前卡 expiryNotifications 的同类教训）
GREEN : ✔①复用 httpClient ✔②inspect/export 路径对拍且不含 import ✔③字段对拍（types.ts）
       ✔④错误面复用 shared/src/errors        → tests 4 / pass 4 / fail 0
```

## 4. 当次验证（派卡验收口径，全绿）

| 验证 | 结果 |
|---|---|
| `cd shared && npx tsc -p . --noEmit` | **exit 0** |
| `cd host && npx tsc -p . --noEmit` | **exit 0** |
| `cd host && npm test`（node --test） | **409 passed / 0 failed** |
| `check-frontend-component-size` / `check-contract-mappers` | **PASS** |
| `branch-gates` | **PASS=1 FAIL=0** |
| `check-frontend-size`（读 host/dist） | 跳过（派卡明示属环境问题，登记） |
| `check-frontend-dupes` | FAIL —— main 既有红（`useCollectionsList.ts:14` 的 `queryKeys` 越界），非本卡引入 |

依赖：`pnpm install --offline --frozen-lockfile` 17.8s 就绪（首次 attempt 卡顿属离线 store 偶发）。

## 5. 跳过项

- 未接 `import`（后端 NotImplemented 占位）——待其独立卡落地后再接。
- 未做向导 UI（契约先行；UI 另增量）。
- 未改 `useCollectionsList.ts`（dupes 红属既有，建议另卡修）。

Reviewed-by: pending-non-author-review
