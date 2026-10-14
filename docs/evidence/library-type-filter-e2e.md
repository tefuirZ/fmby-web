# LIBRARY-FILTER-E2E：库详情「类型筛选」E2E（配对 w01 后端 mediaType 修复）

## 卡目标
库详情「类型筛选」的 E2E，配对 w01 后端对等补齐（`mediaType` 被端口静默丢弃的修复）。
核心纪律：**先证明 spec 在后端未合时真能红**（防「前端空壳」回归），后端合后转绿，两次原文都记。

## 考古 V1
V1 `web-gallery/tests/e2e/library-detail-filters.smoke.spec.ts`：断言「切换类型 ⇒ 请求 query 含 mediaType」（route mock 范式，不依赖真后端）。
本 spec 多一条**结果真的变化**断言（防空壳）——fmby-web e2e 打真 V2 后端（无 route mock 范式）。

## 前端改动（fe02）
当前 fmby-web 库详情类型筛选是**前端本地 filter**（`useLibraryDetail` items useMemo filter mediaType，不发 query）=「前端空壳」。
改动（3 处，行为对齐 V1「真发 query 走后端」）：
1. `queryKeys.browse.library(id, mediaType?)` 加可选 mediaType 参数（queryKey 含筛选，向后兼容）。
2. `useLibraryDetail` queryFn 发 mediaType（`'all'` → undefined 不发）给 `browseApi.getLibraryDetail`（api 层早已支持 mediaType param）。
3. `useLibraryDetail` items useMemo **移除 mediaType 本地 filter**（mediaType 走后端过滤；resolution/watched 仍本地，卡范围聚焦类型筛选）。

## spec 断言（host/e2e/library-type-filter.spec.ts）
切 `template` 主题（无 `browse.library` skin ⇒ 回落 host 默认页 `LibraryDetailPage`，才有「媒体类型筛选」select；darkroom 走 LibrarySkin 卡墙不渲染筛选）。
1. **① baseline**：默认（mediaType=all ⇒ undefined）请求 query 不含 mediaType；响应含混合 kind（库 1：movie + series + season + episode）。
2. **② 切换媒体类型=movie** ⇒ 请求 query 含 `mediaType=movie`（前端真发，非空壳）。
3. **③ 结果真的变化**：后端响应 items **只含 movie**（不含 series/season/episode）。
   - 防「前端空壳」：前端把 mediaType 塞进 query，但结果变化是本地 filter 补的，或后端丢弃 mediaType 不过滤。

## 红原文（当前后端未修，已核验·稳定复现）
当前 V2 后端 `browse_library_detail` handler（`crates/fmby-v2-http/src/routes/browse.rs:132`）：
- `LibraryDetailQuery` 只有 `page`/`pageSize`/`cursor`，**不含 mediaType**。
- handler 调 `service.get_library_detail(id, cursor, page_size, user_id, is_governance_viewer)` **没传 mediaType**。
⇒ 后端**丢弃 mediaType**（serde 忽略未知字段），返回全部 items（不按 mediaType 过滤）。

spec 红原文（当次，`FMBY_E2E_WEB_PORT` 避让 + local-target binary Oct 13 / w06 binary Oct 12 均未修）：
```
✘ 1 [chromium] › e2e/library-type-filter.spec.ts:23:3 › ... 切换媒体类型 ⇒ 请求 query 含 mediaType 且后端响应真的只返回该类型（防前端空壳） (6.8s)
  Error: expect(received).toBe(expected) // Object.is equality
  Expected: true
  Received: false
1 failed
```
诊断（response 监听）：后端响应 items kind = `["movie","series","season","episode","episode","episode"]`（全部 6，没过滤）⇒ ③断言失败（`latest.every(k => k === 'movie')` = false）。

⇒ **后端未修 ⇒ spec 红（③失败）**，验证「防前端空壳」断言有效（后端不过滤时 spec 真能红）。

## 绿待验证（等 w01 修后端）
w01 修复点（后端，非本卡前端范围）：
1. `LibraryDetailQuery` 加 `media_type: Option<String>`（`#[serde(rename = "mediaType")]`）。
2. handler 把 `query.media_type` 传给 `service.get_library_detail`（service + projection 层按 mediaType 过滤 items）。
3. rebuild binary。

后端修后 spec 转绿（响应只含 movie）。**绿原文待 w01 交付修复 binary 后补记**（fe02 据实跟进）。

## 待评审
fe02 不自合，等非作者独立评审。
