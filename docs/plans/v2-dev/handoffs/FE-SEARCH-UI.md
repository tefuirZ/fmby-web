# FE-SEARCH-UI 交接（取证 → 前端搜索消费面完整，登记形态差异）

## 写手交付（zcode · 2026-10-02）

### 结论：前端搜索消费面**完整**，后端链路可达；登记形态差异（非缺陷，不补代码）。

### codegraph 取证（找符号只用 codegraph）
- 后端链路：`crates/fmby-v2-http/src/routes/browse.rs:535` `search_media`（`GET /api/search`，返回 `Json<Vec<RootItemDto>>`），`routes/mod.rs:165` 已注册（api.ts 注释的 G-15 路径笔误已修正为 `/api/search`，链路真实可达）。
- 后端契约（`RootItemDto` @ `crates/fmby-v2-http/src/state/browse.rs:13`）：`id/title/kind/year/library_id`。前端 mapper `shared/src/contracts/browse/search/api.ts:18 mapSearchResult` 对缺失 `posterUrl`/`library_id` 用占位兜底（暗房 placeholder），形态兼容。
- 前端消费链（完整）：
  - `shared/src/contracts/browse/search/api.ts` `searchApi.search(q, limit=20)` → `GET /api/search?q=&limit=`；
  - `shared/src/viewmodels/useSearchOverlay.ts` 视图模型（WEB-B1，≥2 字符启用、30s staleTime、增量浮层语义）；
  - `host/src/pages/browse/SearchOverlay.tsx`（全局覆盖层：300ms 防抖、按类型分组、空/错误/加载态、Esc/遮罩关闭、海报占位）；
  - `host/src/app/layouts/TopBar.tsx:189` 挂载触发（`Ctrl/Cmd+K`，搜索入口）。

### 形态差异（登记，非缺陷）
1. **无独立 `/search` 路由页**：搜索为全局 `SearchOverlay`（浮层）形态，已是设计选择，非遗漏。
2. **全局覆盖层只发 `q`+`limit`，未暴露后端 facets**：后端 `/api/search` 支持 `libraryIds/mediaTypes/sourceStatus/metadataStatus/hasPoster/分页/sort`，而全局覆盖层仅关键词检索。同一组 facets 已有独立落地（`host/src/pages/manage/media-items/components/MediaItemFilters.tsx` + 管理媒体资源页走 `/api/search`）。全局覆盖层是否要加 facets/pagination 属 UX 决策，**不在本卡"残余补全"范围内**——若主代理认为需要，另开卡。

### 当次验证
- 无 Rust 改动；fmby-web 前端消费面经 codegraph 全链路核对，无断链。
- 未跑前端构建/单测（仅做静态 codegraph 取证 + 形态登记；无代码改动，无回归风险）。
- 本卡为取证+登记型，未产生源码 diff；fmby-web `w/fe/search-ui` 分支相对 `origin/main` 无改动。

### 跳过项（明写）
- 未引依赖；未改契约仓/mirror；不碰农场（写手纪律）。
- 未补 facets/pagination UI（属新功能，非残余；登记于形态差异①/②）。
- 保护并复原了仓库内既有未提交 `fe-opt-03` WIP（stash 还原到 `w/fe/mount-config-ui`），未触碰。

---

Reviewed-by: pending-non-author-review
