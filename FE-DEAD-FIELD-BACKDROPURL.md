# FE-DEAD-FIELD-BACKDROPURL · 删 backdropUrl 死链 + 第三轮同族扫

> 席位 `/data/fmby-seats/rv3-frontend` ｜ 分支 `seat/rv3/fe-red`
> 本卡 commit：**`dd704ee`**（backdropUrl 死链 4 处）。上一卡（profile/thumb）commit 链见 `FE-DEAD-FIELD-PROFILE.md`。
> **web-verify：本卡 + 上一卡（profile/thumb）合并跑一次**（同分支）。
> 签名：`rv3-frontend` · glm · magpie/auto/glm-5.3-flash

---

## 结论

`backdropUrl` 与 thumb_url 同形态死链已删（4 处，`dd704ee`）：后端 `ManagedMediaItemListDto` **无 backdrop_url 字段**、convert.rs 不设 ⇒ FE 恒 `undefined` ⇒ 概览页「背景图」ArtImage 恒渲染「暂无背景图」空占位 ⇒ 连占位一并删。**artwork 链的 backdrop（`/assets/items/{id}/images/backdrop`）是活链，未动** ✓。`tsc` host EXIT=0；shared 套件 **171/171**（删后实跑）。第三轮同族扫出 **1 条新候选（`metadataErrorMessage`，报你裁）** + 2 条「BE 字段存在但值恒空」的观察项。

---

## 1. backdropUrl 删除清单（4 处）

| # | 文件:位置 | 删掉的内容 |
|---|---|---|
| 1 | `shared/src/contracts/manage/media-items/types.ts`（列表记录） | `backdropUrl?: string` |
| 2 | `shared/src/contracts/manage/media-items/api/types.ts`（Raw 列表 DTO） | `backdrop_url?: string \| null` |
| 3 | `shared/src/contracts/manage/media-items/api/mappers-record.ts`（mapListRecord） | `backdropUrl: raw.backdrop_url ?? undefined` |
| 4 | `host/.../media-item-detail/components/MediaItemOverviewSection.tsx` | **整个「背景图」artSecondary 块**（ArtImage + 题注） |

## 2. 判据（零可见行为变化？—— 如实说：唯一 delta 是恒空占位框消失）

- **无来源实证**：`crates/fmby-v2-contracts/src/dto/manage.rs` 的 `ManagedMediaItemListDto` 字段集里**没有** `backdrop_url`（当次逐字段核对）；`convert.rs::media_node_to_list_dto` 也不设（该函数只设 `poster_url: None`）。
- **渲染点核查**：`MediaItemOverviewSection.tsx:110` 是 `backdropUrl` 的**唯一**消费点，恒 `undefined` ⇒ 该 ArtImage 走占位分支 ⇒ 页面上是一个**永不变化**的「暂无背景图」空框。
- **可见 delta（与 profile 卡「零可见变化」的差别，如实）**：profile 从未被渲染 ⇒ 零 delta；backdrop **有**一个渲染点但恒空 ⇒ 删除后这个恒空占位框消失。零信息损失（它从未有过内容），语义与 thumb 卡的「连占位一并删」一致（你已裁「照做」）。
- **活链保留 ✓**：`/assets/items/{id}/images/backdrop`（artwork 三档回落）与其全部 FE 消费（assets/index.ts、usePosterUrl、playbackPresentation、LibraryShowcaseCard）零改动。

## 3. 第三轮同族扫（card 第 5 条：只列清单，不删）

| 候选 | 形态 | 建议处置 |
|---|---|---|
| **`metadataErrorMessage`**（`types.ts:262` + `api/types.ts:243` + `mappers-record.ts:91` + **渲染点 `ManageMediaItemDetailPage.tsx:225-227`**） | **同族第四例**：BE `ManagedMediaItemListDto` 无 `metadata_error_message` 字段 ⇒ mapper 恒读 undefined ⇒ **错误横幅永不渲染**。与前三例的差别：它有渲染点（一个永远不出现的错误提示槽） | **报你裁**：删（4 处，含横幅分支）或后端补（若「元数据错误信息」是想要的读面） |
| `lastScanAt` | BE 字段**存在**（`last_scan_at: Option<String>`）但恒 null，BE 注释自证「V2 无物理列 → 恒 null，见 handoff 登记」 | 非 FE 死类型（wire 字段在）；登记观察 |
| `posterUrl` | BE 字段存在，convert.rs 恒 `None`（交付链未接；海报实际走 /assets 链） | 非 FE 死类型；若长期不接交付链，概览海报块与 backdrop 同问 |
| detail raw 族（13 字段：base/effective_metadata、local_metadata_override、metadata_status、sources、remote_assets、artwork_overrides、subtitle_overrides、latest_metadata_raw_content…） | 与 BE wire 一一对应（W-METAFAMILY 契约锁冻形状） | 无候选 ✓ |

## 4. 验证

- ✅ `tsc --noEmit` host **EXIT=0**（删后）；shared 套件 **171/171 PASS**（删后实跑）。
- ⏳ host 全量套件以 **web-verify** 为准（**本卡 + 上一卡 profile/thumb 合并跑一次**）——判据：shared **171/0**、host **895+/0**、typecheck exit 0。注：上卡本机 host 跑出的 2 个超时类红（CAS 态 B / 表格行漫游）在他席重活（load 25-35）下出现，且与删除域无交集；本机 load 已被你清到 1.7，web-verify 应复现干净跑。（补记：本机全量跑在停滞 ~3h 后已中止、未再推进，正式门以 web-verify 为准。）

## 5. ponytail 段
- 4 处全删（含渲染块）而非注释/保留死类型 —— 同 profile 卡方法，零新抽象。
- **没做**：metadataErrorMessage 的删除（有渲染点，删=移除错误提示槽，需你裁「删 or BE 补」）。
- **没做**：posterUrl/lastScanAt（wire 字段存在，非「无来源」形态）。
