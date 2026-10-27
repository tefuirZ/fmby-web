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
| ~~`metadataErrorMessage`~~ | ~~同族第四例~~ → **已裁决并执行（分支 A）**：编辑失败反馈由 `MediaItemMetadataSection.handleSubmit` 的 `onError → toast.error(getErrorMessage)` 承担（当次读码实证，本文件 §3.1）；读失败另有 `detailQuery.isError` 横幅 ⇒ 死横幅零职责，**已删**（4 处：横幅分支 + domain/raw/mapper，commit `7004abc`） | 已删 ✓ |
| `lastScanAt` | BE 字段**存在**（`last_scan_at: Option<String>`）但恒 null，BE 注释自证「V2 无物理列 → 恒 null，见 handoff 登记」 | 非 FE 死类型（wire 字段在）；登记观察 |
| `posterUrl` | BE 字段存在，convert.rs 恒 `None`（交付链未接；海报实际走 /assets 链） | **非 FE 死字段、不可删 —— 交付链未接是真缺口**，详见 §3.1；报主代理派后/全栈卡 |
| detail raw 族（13 字段：base/effective_metadata、local_metadata_override、metadata_status、sources、remote_assets、artwork_overrides、subtitle_overrides、latest_metadata_raw_content…） | 与 BE wire 一一对应（W-METAFAMILY 契约锁冻形状） | 无候选 ✓ |

### 3.1 分支 A 证据链（metadataErrorMessage）
- 编辑失败反馈：`MediaItemMetadataSection.tsx:42-50` —— `updateMutation.mutate(form.buildPayload(), { onError: (error) => toast.error({ title: '元数据保存失败', description: getErrorMessage(error) }) })`（当次读码原文）；成功路径同处 `toast.success`。
- 读失败反馈：`ManageMediaItemDetailPage.tsx:217-223` `detailQuery.isError` 横幅（仍在）。
- 死横幅：`item.metadataErrorMessage`（BE 无字段 ⇒ 恒 undefined ⇒ 永不渲染）—— 删 `ManageMediaItemDetailPage.tsx` 横幅分支 + domain/raw/mapper 三处（`7004abc`）。

### 3.2 posterUrl 交付链缺口（报主代理派后/全栈卡）
- **页面实际渲染结果**（判据＝渲染不是类型）：概览海报 `ArtImage src={item.posterUrl}`（MediaItemOverviewSection.tsx:100-104）；`item.posterUrl = raw.poster_url ?? undefined`（mappers-record mapSummaryRecord），而 BE `convert.rs::media_node_to_list_dto` 恒 `poster_url: None` ⇒ **概览海报恒「暂无海报」占位**（当次读码链全查，无其它充值路径——artwork overrides/远程资产走各自独立区块，不喂海报）。
- 背景图/缩略图同块已随本系列删除（DTO 无字段）；**海报与它们不同**：wire 字段存在、展示需求真实 ⇒ 不可删。
- ~~修法归属~~ **裁定① 已执行（前端优先，commit `c899769`）**：概览海报改投 `/api/assets/items/{id}/images/{poster,thumb}` 投机链 + `usePosterUrl` onError 降级（复用 browse 海报位同款机制，零后端改动）；`ArtImage` 增可选 `onSrcError`。**真实渲染契约**：DOM 测试 2/2（vite lib + Chromium：① img.src=投机 poster 链 ② error 循环 → 恒空占位）；真实字节渲染随 web-verify/e2e。
- ★实现注记（实测）：不可经 `mapArtwork{itemId}` 四 URL 全兜底 —— usePosterUrl 降级器会在 thumb↔backdrop 成环，二档（poster→thumb→占位）即止（`ponytail:` 注释已锚在组件里）；要 backdrop 档先修 usePosterUrl 终止条件。
- 若 web-verify/e2e 发现该链在真实例下仍无图 ⇒ 再派后端卡接 convert.rs 交付链。

## 4. 验证

- ✅ `tsc --noEmit` host **EXIT=0**（删后）；shared 套件 **171/171 PASS**（删后实跑）。
- ⏳ host 全量套件以 **web-verify** 为准（**本卡 + 上一卡 profile/thumb 合并跑一次**）——判据：shared **171/0**、host **895+/0**、typecheck exit 0。注：上卡本机 host 跑出的 2 个超时类红（CAS 态 B / 表格行漫游）在他席重活（load 25-35）下出现，且与删除域无交集；本机 load 已被你清到 1.7，web-verify 应复现干净跑。（补记：本机全量跑在停滞 ~3h 后已中止、未再推进，正式门以 web-verify 为准。）

## 5. ponytail 段
- 4 处全删（含渲染块）而非注释/保留死类型 —— 同 profile 卡方法，零新抽象。
- **没做**：metadataErrorMessage 的删除（有渲染点，删=移除错误提示槽，需你裁「删 or BE 补」）。
- **没做**：posterUrl/lastScanAt（wire 字段存在，非「无来源」形态）。
