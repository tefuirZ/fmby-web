# FE-ADMIN-SURFACE 交接（admin 面：接 `api-tokens`，其余登记）

分支：`w/w/fe-admin-surface` @ `origin/main`（worktree `/data/wt-yun-fe-admin`）。

## 1. 先扫准：admin 五端点逐个取证（`origin/main` ref，未查落后活树）

| 端点（`/api/manage` 下） | 后端状态 | 前端调用 | 处置 |
|---|---|---|---|
| `admin/site-settings`（GET/PUT） | 真实实现 | **已接**（`SiteSettingsBrandSection.tsx` + `settings/siteSettings.api.ts` + `email-ui.contract.test.ts`） | 非缺口，排除 |
| `admin/api-tokens`（POST/GET）+ `/{id}`（DELETE） | **真实实现** | **零调用**（`developerApi/api.ts` 无任何 `/api/` 路径；`types.ts` 仅注释提及闸门） | ✅ **本卡做** |
| `admin/tasks`（GET） | `not_implemented` **501 占位**（“产品有意不实现，非故障”） | 零调用 | 登记不做：接了也只拿 501 |
| `admin/audit`（GET） | `not_implemented` **501 占位** | 零调用 | 同上 |
| `admin/media/{id}`（DELETE） | `not_implemented` **501 占位** | 零调用 | 同上 |

⇒ 按派卡「挑内聚的 1–2 个」+「低价值/不宜做别硬做」：**只做 api-tokens**，其余四个逐一给理由登记。

## 2. 交付（ponytail：只补契约层，不新造范式）

新增 `shared/src/contracts/manage/adminApiTokens/`：
- `types.ts`：`AdminApiToken{id,name,scopes,createdAtMs,expiresAtMs|null}`（camelCase）、
  `RawAdminApiToken{...,created_at_ms,expires_at_ms?}`（wire 逐字）、`AdminApiTokenCreateInput`；
- `api.ts`：`adminApiTokensApi.list()` / `create(input)` / `revoke(id)`
  —— 复用既有 `httpClient`（不新造请求层）；`mapAdminApiToken`（snake→camel，可空 `expires_at_ms ⇒ null`，
  **不伪造时间**）；错误面复用 `shared/src/errors` 的 `isApiError`/`getErrorMessage`；
- `index.ts` 与 `shared/src/contracts/manage/index.ts` 导出。

后端对位（`origin/main` 实证）：路由 `router_manage.rs:625-629`；handler `routes/admin.rs`
（`admin_create_api_token` / `admin_list_api_tokens` / `admin_revoke_api_token`）；能力门
`MANAGE_ACCESS`；端口未装配 ⇒ `Validation("api token service unavailable")`（fail-closed）；
DTO `dto/api_token.rs:33` = `{id,name,scopes,created_at_ms,expires_at_ms?}`（snake_case wire）。

未接 UI；未改后端/契约仓/mirror；未新迁移；未引依赖。

## 3. RED → GREEN（实测）

```
RED : ENOENT —— shared/src/contracts/manage/adminApiTokens/api.ts 不存在
GREEN: ✔① 复用 httpClient  ✔② 三方法路径/动词对拍  ✔③ snake→camel（含可空 expiresAtMs）
      ✔④ 错误面复用 shared/src/errors        → tests 4 / pass 4 / fail 0
```

## 4. 当次验证（派卡验收口径，全绿）

| 验证 | 结果 |
|---|---|
| `cd shared && npx tsc -p . --noEmit` | **exit 0** |
| `cd host && npx tsc -p . --noEmit` | **exit 0** |
| `cd host && npm test`（node --test） | **401 passed / 0 failed** |
| `check-frontend-component-size` / `check-contract-mappers` | **PASS** |
| `branch-gates` | **PASS=1 FAIL=0** |
| `check-frontend-dupes` | **FAIL —— main 既有红**（`shared/src/viewmodels/useCollectionsList.ts:14` 的 `queryKeys` 定义在 `shared/src/query/**` 之外），**非本卡引入** |

（依赖用 `pnpm install --offline --frozen-lockfile`，16.7s 就绪 —— 上一次 `/data` worktree 安装卡顿属偶发。）

## 5. 跳过项

- 未接 admin UI 页面（契约层先行；UI 另增量）。
- 未做 `site-settings`（前端已接）、未做 `tasks`/`audit`/`media`（后端 501 占位，接亦无实效）——按派卡登记理由，不硬做。
- 未改 `useCollectionsList.ts`（dupes 红属既有，建议另卡修）。

Reviewed-by: pending-non-author-review
