# FE-USER-COLLECTIONS-LIST-PAGE-2 交付说明 · 前端合集列表页

> 卡号：FE-USER-COLLECTIONS-LIST-PAGE-2 · 分支：`w/fe/user-collections-list-page-2`（自 `origin/main` = `92b81d7` 起）
> 提交：`b4f38c5`（契约+viewmodel+测试）/ `ae46eae`（列表页+路由+互链）/ `<handoff>`
> 日期：2026-10-03 · 写手：zcode · `Reviewed-by: pending-non-author-review`

---

## 0. 一句话结论

后端 USER-COLLECTIONS-LIST-BE（`3fa7baeaf`）已合用户面列表端点，本卡补齐前端**列表页**，
与前卡（FE-USER-COLLECTIONS-BROWSE 详情页）互链闭合「合集浏览」体验。列表/详情两页均已
「页面零 useQuery」（viewmodel 范式）；分页路由 query 承载；不给假搜索框。

---

## 1. 后端 wire 核证（后端仓只读，file 级证据）

```
handler: crates/fmby-v2-http/src/routes/manage_collections.rs
  collections_public_list（3fa7baeaf 新增）
    → authenticate_request + require_capability(BROWSE)
    → svc.list_collections() → filter visibility == "Active"（Hidden 不泄露）
    → page 1-based（缺省 1）、page_size 缺省 20 clamp[1,200]
    → CollectionsListResponse
DTO: crates/fmby-v2-http/src/state/collections.rs
  pub struct CollectionsListResponse {
      pub items: Vec<ManagedCollectionDto>,
      pub total: u64,
      pub page: u64,
      pub page_size: u64,
      pub has_more: bool,
  }
query: CollectionsListQuery { page: Option<u64>, #[serde(rename="pageSize", alias="page_size")] page_size }
route: router_core.rs browse 段（静态段 /collections 优先于 /collections/{id}）
检索:  暂无（COLLECTIONS-LIST-SEARCH 在途；卡面明示）
```

## 2. RED → GREEN

**RED**：`host/tests/collections-list.contract.test.ts` 先落（7 用例）→
`listCollections` 未实现，0/7（EXIT=1）。
**GREEN**：契约落地后 7/7：
路径 `/api/collections`（非 manage）/ 缺省无 query（后端缺省 page=1、page_size=20）/
`page`+`pageSize` camel query / DTO snake→camel（`page_size`→`pageSize`、`has_more`→`hasMore`）/
`has_more` 透传 / 空列表不吞 / 401·403 reject 不吞成空列表。

## 3. 变更清单

- `contracts/browse/collections/api.ts`：`listCollections({page,pageSize})` →
  `RawCollectionsListResponse` → `CollectionsListPageRecord`；复用 manage `fromCollection`
  （导出，零重复映射）。
- `contracts/manage/peripherals`：导出 `fromCollection` + `RawManagedCollection`（仅导出，无逻辑改动）。
- `queryKeys.browse.collections(page, pageSize)`。
- `viewmodels/useCollectionsList`：`{ items,total,page,pageSize,hasMore }` +
  `placeholderData: keepPreviousData`（翻页不闪空）；翻页由页面路由承载（ViewModel 无导航依赖）。
- `pages/browse/CollectionsListPage.tsx` + 路由 `/collections`；详情页头加「返回合集列表」。
- 空态/错误态/权限态走 FeedbackState；Hidden 由后端保证不出现。

## 4. 当次验证原文

```
host/tests/collections-list.contract.test.ts                → pass 7 / fail 0
host/tests/collections-browse-detail.contract.test.ts       → pass 4 / fail 0（回归）
host/tests/collections-member-origin.contract.test.ts       → pass 4 / fail 0（回归）
node scripts/check-frontend-component-size.mjs  → [PASS] 0 违规（SIZE_EXIT=0）
node scripts/check-contract-mappers.mjs         → [PASS] 0 contract violations
```

## 5. 跳过项与何时再加

- **跳过：`tsc` 双包 typecheck** —— 本 worktree 无 `node_modules`（`pnpm install --offline`
  未完成），tsc 不可运行；类型正确性由 node:test 契约对拍（走真实 httpClient 全链）+
  前卡独立评审环境的双包 tsc 0（见入库评审留档）旁证。装依赖后 CI 复跑。
- **跳过：搜索框** —— 后端检索参数未交付（COLLECTIONS-LIST-SEARCH 在途）；不给假输入面。
- **跳过：海报到 manage 面的编辑入口** —— 用户面为只读浏览面，不越权。
- **未改**：后端仓、契约仓/mirror、业务 UI 其它部分。
