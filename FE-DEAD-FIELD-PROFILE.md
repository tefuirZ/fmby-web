# FE-DEAD-FIELD-PROFILE · 删 profile 死字段全链 + thumb_url 死链（顺带）

> 席位 `/data/fmby-seats/rv3-frontend` ｜ 分支 `seat/rv3/fe-red`
> 本卡 commit：**`919120c`**（profile 链）+ **`a06940a`**（误删修复，如实列）+ **`0140bb3`**（thumb 链）
> 签名：`rv3-frontend` · glm · magpie/auto/glm-5.3-flash

---

## 结论

actor 级 `profile`（V1 NFO 人物资料页 URL）与 `thumb_url` 两条死链已全删（前端**恒 undefined**：V2 后端 metadata/list DTO 不产出 —— 本席对 backend main `7058761b30` 当次复核 + wb-studios 查实一致）；item 级 `thumb_url` 连同恒渲染「暂无缩略图」的空占位块一并删（后端 `ManagedMediaItemListDto` **无 thumb_url 字段**）。零 wire 变化；`tsc host EXIT=0`；shared 套件 **171/171**（含本会话各卡钉测试）；host 全量套件在本机跑完前 web-verify 为正式门（§5）。

---

## 1. `profile` 删除清单（commit `919120c` + `a06940a`）

| # | 文件:位置 | 删掉的内容 |
|---|---|---|
| 1 | `shared/src/contracts/manage/media-items/types.ts`（ManageMediaPerson） | `profile?: string` |
| 2 | 同文件（UpdateManageMediaPersonInput） | `profile?: string` |
| 3 | `shared/src/contracts/manage/media-items/api/types.ts`（RawManageMediaPerson） | `profile?: string \| null` |
| 4 | `shared/.../api/mappers-simple.ts`（mapMediaPerson） | `profile: raw.profile ?? undefined` |
| 5 | `shared/.../api/mappers-payload.ts`（mapUpdatePayloadToApi.actors） | `profile: actor.profile`（ToApi；后端 PATCH 本就整段丢弃 actors —— RV-D P1-1，另案） |
| 6 | `host/.../media-item-detail/useMetadataForm.ts` ×4 | draft 类型 / toFormState / isSameForm 比较 / buildPayload |

**渲染点核查（判据的一部分）**：全 manage 域**不存在** actor `profile` 的渲染点 —— 唯一的 `profile` 渲染是 **stream codec 配置档**（`browse/item-detail/formUtils.ts:174`、`probe-tasks/utils.ts:127`，来自媒体流探测 DTO），**另一字段、活链、保留**。⇒ 删 `profile` 零可见行为变化 ✓（它从未被渲染，只在类型/映射/表单死重里流转 `undefined`）。

### 1.1 如实披露：一次误删与修复
`919120c` 的删除脚本正则误吞了 4 个声明/函数**主体**（ManageMediaPerson / UpdateManageMediaPersonInput / RawManageMediaPerson / mapMediaPerson 整体被删，tsc 立刻 TS2304×2）；`a06940a` 恢复主体（保留 thumbUrl、去掉 profile）。**终态 = 只少了 profile 字段**，tsc EXIT=0。

---

## 2. `thumb_url` 顺带删除（commit `0140bb3`）—— 先查后动，两级都是死链

### 2.1 actor 级（与 profile 同链）
| # | 文件:位置 | 删掉的内容 |
|---|---|---|
| 1 | `types.ts`（ManageMediaPerson） | `thumbUrl?: string` |
| 2 | `api/types.ts`（RawManageMediaPerson） | `thumb_url?: string \| null` |
| 3 | `mappers-simple.ts`（mapMediaPerson） | `thumbUrl: raw.thumb_url ?? undefined` |
| 4 | `mappers-payload.ts`（actors ToApi） | `thumb_url: actor.thumbUrl` |
| 5 | `useMetadataForm.ts` ×4 | 同 §1 的四个位置 |
判据：metadata DTO 不产出 thumb_url（后端当次复核：media 域仅 stream codec `profile` 与 provider_people `profile_url` 两条无关链）；**编辑 UI 的演员行只有 姓名/角色 两个输入**（MediaItemMetadataSection.tsx:272-289），无 thumbUrl/profile 录入 ⇒ 前端没有任何途径让它非 undefined。

### 2.2 item 级（`MediaItemOverviewSection.tsx:120` 的「缩略图」）
| # | 文件:位置 | 删掉的内容 |
|---|---|---|
| 1 | `types.ts`（列表记录） | `thumbUrl?: string` |
| 2 | `api/types.ts`（Raw 列表 DTO） | `thumb_url?: string \| null` |
| 3 | `mappers-record.ts`（mapListRecord） | `thumbUrl: raw.thumb_url ?? undefined` |
| 4 | `MediaItemOverviewSection.tsx` | **整个「缩略图」artSecondary 块**（ArtImage + 题注） |

判据：后端 `ManagedMediaItemListDto`（contracts/dto/manage.rs）**没有 thumb_url 字段**（convert.rs 也不设；连 backdrop_url 都没有，poster_url 恒 None）⇒ 该 ArtImage 恒 `src=undefined` ⇒ **恒渲染「暂无缩略图」空占位**。
**可见行为 delta（如实）**：唯一的可见变化 = 这个**恒空的占位框消失**（海报/背景图两块保留）。删一个永不有内容的占位不是信息损失；将来真要缩略图，按 wb-studios 判据走 **artwork 三档回落派生**（override→remote→scraped，零新列）—— 那是读面派生小卡，不是补列。

### 2.3 保留未动（防误伤清单）
- stream codec `profile`（item-detail/probe-tasks 两处渲染）—— 活字段。
- browse person 的 `thumb_url`→PersonCard 头像链 —— 另一域（卡面已声明无关 ✓）。
- artwork 链 `thumbUrl`（assets/index.ts、usePosterUrl、playbackPresentation、LibraryShowcaseCard）—— 活的三档回落链 ✓。
- `backdropUrl`（列表 DTO 亦无 wire 来源，概览恒「暂无背景图」占位）—— **同族观察**：与本卡 thumb 同形态，但不在卡面范围；报你裁是否下一张同款卡。

---

## 3. 验证

- ✅ `tsc --noEmit`（host，含 shared）**EXIT=0**（两次：profile 链修复后、thumb 链后）。
- ✅ shared 套件 **171/171 PASS**（含各卡钉测试：状态词表 7、弹窗文案 3、detail wire 4 等）。
- ⏳ host 全量套件（895+）在本机跑——机上他席重活导致 playwright DOM 用例 90-130s/个，出现 2 个超时类红（CAS 态 B 文案、表格行漫游 Enter；两者在早前干净跑 895/895 中均 PASS，且与本卡改动域〔media-items person 字段〕无交集）⇒ **以 web-verify 为准**。

## 4. 需主代理投前端验证
「**需主代理投前端验证**：`web-verify`」——判据：`pnpm --filter @fmby/v2-shared test`（171/0）、`pnpm --filter @fmby/v2-host test`（895+/0）、`pnpm --filter @fmby/v2-host typecheck`（exit 0）、shared `typecheck`（exit 0）。

## 5. ponytail 段
- 删优于注释：4 个类型字段 + 2 个 mapper 读 + 1 个 ToApi 写 + 表单 8 处 + 1 个恒空渲染块，**全部删除**而非注释掉。
- **没做**：给 thumb「从 artwork 三档派生」——那是读面功能（需把 override/remote/scraped 数据接进概览），零新列但不是本卡；需要时立卡。
- **没做**：动 `directors/actors/originalTitle` 的编辑面（RV-D P1-1：后端 PATCH 丢整段）——与本卡相邻但属数据丢失修复，需产品裁定（后端补字段 vs 前端砍编辑器），未动。
- **没做**：backdropUrl 同款清理（同形态、不在卡面）——已登记 §2.3 待裁。
