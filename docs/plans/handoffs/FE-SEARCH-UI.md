# 交接 · FE-SEARCH-UI（前端搜索页残余 · 先证伪）

仓库 `/home/tefuir/rustproject/fmby-web`，分支 `w/fe2/fe-search-ui`（基于 `origin/main`）。
本卡用 **ponytail**（不造需求、不补不存在的功能）；找符号只用 **codegraph**。

---

## 0. 结论（复核前卡 zcode·2026-10-02 的结论：**成立**）

前端搜索消费面**完整且链路可达**；无真实残余缺口。**不写生产代码**，仅交付本取证结论。

## 1. codegraph 取证（本仓 post-commit hook 已接；本次另跑 `codegraph sync .`）

| 符号 / 面 | 位置 | 判定 |
|---|---|---|
| `searchApi` | `shared/src/contracts/browse/search/api.ts:6` | 存在；`GET /api/search?q=&limit=` |
| `useSearchOverlay` | `shared/src/viewmodels/useSearchOverlay.ts:46` | 存在（视图模型，WEB-B1） |
| `SearchOverlay` | `host/src/pages/browse/SearchOverlay.tsx:22` | 存在（208 行） |
| `SearchOverlay` 调用者 | `host/src/app/layouts/TopBar.tsx:1`、`host/src/pages/browse/index.ts:1` | **已挂载**，非死代码 |
| `useSearchOverlay` 调用者 | `SearchOverlay.tsx` | 闭环 |

- **契约路径笔误已修**（G-15）：`api.ts` 注释与实现均为 `/api/search`
  （旧笔误 `/api/browse/search` 后端从未注册），链路真实可达。
- **状态面完整**（逐项核）：无关键词提示 → `isSearching` 加载（`Loader2` + spin）
  → `state==='error' \| 'forbidden'` 错误态 → 按类型分组 → Esc 关闭 → 300ms 防抖
  → `mapArtwork` 海报/缩略占位兜底。**无缺口**。
- **快捷键**：`TopBar.tsx` 全局 `keydown`，`(ctrlKey \|\| metaKey) && key.toLowerCase()==='k'` 切换浮层。

## 2. 形态差异（登记，非缺陷 —— 复核仍成立）

1. **无独立 `/search` 路由页**：`router/index.tsx` 中 `path: '/search'` **不存在**；
   搜索为全局**浮层**形态，属设计选择，非遗漏。
2. **浮层只发 `q` + `limit`，未暴露后端 facets**：后端 `/api/search` 支持
   `libraryIds/mediaTypes/sourceStatus/metadataStatus/hasPoster/分页/sort`；
   同一组 facets 已有独立落地（`host/src/pages/manage/media-items/components/MediaItemFilters.tsx`
   + 管理媒体资源页走 `/api/search`）。浮层是否加 facets/pagination 属 **UX 决策**，
   不在本卡「残余补全」范围 —— 若要加，另开卡。

## 3. RED → GREEN

本卡**无生产代码改动**（证伪后无缺口可补），故无传统 RED→GREEN 环；
取证本身即「先证伪」环：假设「有残余可补」→ 逐项核链路/状态/挂载/路由后**证伪**。

## 4. 当次验证

```
git status --porcelain                    → 0（干净，基于 origin/main）
codegraph sync .                          → exit 0（索引已更新）
codegraph query searchApi                  → shared/src/contracts/browse/search/api.ts:6
codegraph query useSearchOverlay           → shared/src/viewmodels/useSearchOverlay.ts:46
codegraph query SearchOverlay              → host/src/pages/browse/SearchOverlay.tsx:22
codegraph callers SearchOverlay            → TopBar.tsx + browse/index.ts（已挂载）
router/index.tsx  '/search' 路由           → 不存在（浮层形态，形态差异①）
```

（前端闸 `check-frontend-size` / `check-frontend-component-size` / `check-contract-mappers`
在相邻卡上均为 PASS；本卡零源码改动 ⇒ 无回归风险，未重复全量跑。）

## 5. 跳过项（明写）

- 未补 facets / pagination UI（属**新功能**，非残余；见形态差异②）。
- 未改契约仓 / mirror；未引依赖；不碰农场；未跑全仓重活。
- 未改 `TopBar` / `SearchOverlay` / `useSearchOverlay`（无缺口）。

## 6. 提交

一原子项一提交：本 handoff 文档（docs only，零源码 diff）。

`Reviewed-by: pending-non-author-review`
