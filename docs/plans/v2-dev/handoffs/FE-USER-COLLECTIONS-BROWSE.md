# FE-USER-COLLECTIONS-BROWSE 交付说明 · 用户面合集浏览/详情页

> 卡号：FE-USER-COLLECTIONS-BROWSE · 分支：`w/fe/user-collections-browse`（自 `origin/main` 起）
> 提交：`cba07d9`（契约）/ `686746d`（query key + viewmodel）/ `92e0c57`（页面 + 路由）/ `<handoff>`
> 日期：2026-10-02 · 写手：zcode · `Reviewed-by: pending-non-author-review`

---

## 0. 一句话结论

**先证伪结果（本卡最重要发现）**：后端用户面读面只有**详情**，没有**列表**。
- 详情 `GET /api/collections/{id}`（session + BROWSE，Active 可见性闸，Hidden ⇒ 404）✅ 前端可消费 → **本卡已实现详情页**。
- 列表**仅** compat `GET /emby/Collections`（+ `/collections`），其鉴权**只认 Emby api_key**
  （compat `extract_api_key` 枚举 `x-emby-token` / `apikey` / `Authorization: MediaBrowser…` / query `api_key`，
  **无 session 通道**；凭据表 `access_compat_credential` 与 WebUI session 无关）→ **WebUI session 不可达**。
  原生用户面列表端点不存在（后端卡 USER-COLLECTIONS-SURFACE-BE 明确「跳过：用户面列表端点新建」）。

⇒ 浏览**列表**页本卡**无法**用现有端点实现（真断链，见 §4 待裁决）。本卡交付**详情**页 + 完整证伪证据。

---

## 1. codegraph / 路由查证（原文）

**后端（只读，未改）**
```
route 扫描（全 crates .route("…collection…") 字面量）
  → compat: /Collections, /collections                   (fmby-v2-compat/src/routes/collections.rs)
  → http:   /collections/{id}  get(collections_public_get)  (router_core.rs:188，add_browse_items_routes)
  → http:   /manage/collections*, /manage/collections/{id}  (管理面，MANAGE_LIBRARY)
  → http:   /assets/collections/{collection_id}/images/{kind}
  ⇒ **无** `/api/collections`（原生用户面列表）

collections_public_get（fmby-v2-http/src/routes/manage_collections.rs）
  → authenticate_request + require_capability(BROWSE)
  → svc.get_collection(id) → ManagedCollectionDetailDto
  → visibility != "Active" ⇒ 404（Hidden 不泄露）

compat 鉴权（fmby-v2-compat/src/auth.rs）
  → authenticate_compat → authenticate_with_blocklist → extract_api_key(headers, query_api_key)
  → find_compat_credential_by_token_hash → 表 access_compat_credential
  ⇒ **只认 Emby api_key，无 session cookie 通道**

compat 挂载：Protocol::Emby.path_prefix() = "/emby"；vite dev 代理有 /emby，
但**前端零 /emby 消费**（全仓 fetch 字面量扫描：`/emby` 命中 0）。
```

**前端（只读，证伪）**
```
httpClient（shared/src/api/client.ts）
  → credentials: 'same-origin'（session cookie）；api_key / apiKey / x-emby-* / Authorization 命中 **0**
  ⇒ 无法向 /emby/Collections 提供 Emby api_key
前端 contracts 仅有 /api/manage/collections*（管理面），无用户面 collections 契约
路由：browse 面无 /collections（仅 manage/collections）
```

---

## 2. RED → GREEN

### 2.1 RED（先写失败测试）
`host/tests/collections-browse-detail.contract.test.ts`（4 用例）先于实现落地：
```
✖ tests/collections-browse-detail.contract.test.ts
  code: 'ERR_MODULE_NOT_FOUND'
  url: 'file:///…/shared/src/contracts/browse/collections/index.ts'
ℹ tests 1  ℹ fail 1   RED_EXIT=1
```

### 2.2 GREEN（最小实现）
- `contracts/manage/peripherals/api.ts`：`fromDetail` + `RawManagedCollectionDetail` 由私有转导出
  （用户面与 manage 面**同 DTO** `ManagedCollectionDetailDto` → 复用同一 mapper，零重复映射）。
- 新增 `contracts/browse/collections/{api,index}.ts`：`collectionsBrowseApi.getCollection(id)`
  → `GET /api/collections/{encodeURIComponent(id)}`。
- `queryKeys.browse.collection(id)`（与 `library(id)` 同形）。
- `shared/src/viewmodels/useCollectionDetail.ts`：`{ data, state, actions, layout }`；
  collectionId 无效 → `enabled:false` 不发请求。
- `host/src/pages/browse/CollectionDetailPage.tsx` + 路由 `collections/:collectionId`（lazy）。

### 2.3 当次验证原文
```
node --import ./tests/register-aliases.mjs --test tests/collections-browse-detail.contract.test.ts
ℹ tests 4  ℹ pass 4  ℹ fail 0     TEST_EXIT=0
  ✔ 详情：GET /api/collections/{id}（用户面路径，非 manage）
  ✔ 详情：id 走 encodeURIComponent
  ✔ 详情：snake_case → camelCase 映射（collection + members）
  ✔ 详情：Hidden ⇒ 404 透传（不吞成空、不泄露）

node scripts/check-frontend-component-size.mjs   → GATE_EXIT=0
```

---

## 3. ponytail 与口径

- **复用优先**：用户面复用 manage 的 DTO mapper（同 DTO），不复制映射、不新造类型、不引依赖。
- **诚实失败态**：Hidden ⇒ 404 原样透传为「不存在或不可见」，不伪造数据、不回落占位图；成员 0 给诚实空态。
- **空判定**：viewmodel 恒 `isEmpty=false`——「合集存在但无条目」属页面空态，不是全局 empty（避免丢详情）。

---

## 4. 待裁决项（真断链，需主代理裁定）

**列表页阻塞**：需后端补 **session + BROWSE 的原生用户面列表端点**
（建议复用 `list_collections` + Active 可见性 + 分页/检索），本卡才可补浏览列表页与导航入口。
三选一：
- **A**：后端另开卡补 `GET /api/collections`（原生列表）→ 本卡续做列表页 + 导航。
- **B**：裁定前端改用 manage 列表端点（需用户具 MANAGE 能力）→ 违背「用户面」语义，不推荐。
- **C**：前端保留详情页，列表暂不接（现状），登记为前端缺口待后端补齐。

---

## 5. 跳过项与何时再加

- **跳过：浏览列表页** —— 无 session 可达的用户面列表端点（见 §0/§4）；待后端补齐后另提交。
- **跳过：导航入口** —— 列表页缺失时详情页仅可深链到达；与列表页一并补。
- **跳过：`pnpm typecheck` / 全量 `pnpm test`** —— 本 worktree 无 `node_modules`
  （`pnpm install --offline` 未完成），tsc 不可运行；已验证范围 = 依赖无关的
  `node --test` 契约测试（4/4）+ 体积门禁（EXIT=0）。装依赖后由 CI 复跑 typecheck/e2e。
- **跳过：viewmodel 单测** —— `useCollectionDetail` 依赖 `@tanstack/react-query`，
  无 node_modules 不可跑；契约层已由 4 用例钉住。
- **未改**：业务 UI 其他部分、契约仓/mirror、后端仓库（全程只读）。
