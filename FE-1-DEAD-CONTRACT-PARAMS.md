# FE-1 · 停发 3 个死契约参数 + mappers-enum live bug（P1）处置

> 席位 `/data/fmby-seats/rv3-frontend` ｜ 分支 `seat/rv3/fe-red`（本卡基于该分支续做）
> 本卡 commit：**`ffcd441`**（死参数停发 + 钉测试）。live bug 修复**已在同分支先行落地**：`55c8c6a`（W-A-RESUME）。
> 签名：`rv3-frontend` · glm · magpie/auto/glm-5.3-flash

---

## 结论

3 个死契约参数（mountStatus/hasPoster/hasSubtitle）已**停发并从契约删除**（后端连下划线名都不收、页面也无此筛选，纯假能力）；`mappers-enum.ts` 的 live bug（mounted/identified/configured/verified/maintenance 全落 default ⇒ 每行「缺失」）**已在同分支 55c8c6a 修复并有 5 条钉测试**。tsc（host+shared）双 EXIT=0。测试执行按本卡「禁本机 test」留 **web-verify/农场**。

---

## 1. 三个死契约参数（card 第 1-2 条）

### 定位（codegraph explore，1 次）
`ManageMediaItemsQuery`（types.ts:44）7 个消费方；`mapQueryParams`（mappers-payload.ts:20）唯一发参点（queries.ts getMediaItems 消费）；三个死键**零调用方赋值**（ManageMediaItemsPage 只发 page/pageSize/keyword/libraryId/mediaType/sourceStatus/metadataStatus/hasLocalOverride/sortBy/sortOrder）。

### 处置裁定（照 card「若页面确实需要这些语义 ⇒ 用对的下划线字段」）
**页面不需要**（MediaItemFilters 的 props 里没有 mount/poster/subtitle 筛选，W-FE-RED P2-1 已证）⇒ **直接停发 + 从契约删除**，不引下划线替换（后端 `MediaItemsQuery` 连 `mount_status/has_poster/has_subtitle` 都不接——`dto/manage.rs` 实测只有 page/pageSize/keyword/libraryId/mediaType/sortBy/sortOrder）。**发下划线名同样是静默丢弃**，只是换一种假。
`ponytail:` 后端（w3 CRUD-MEDIA-ITEMS）真加筛选时按当期 wire 名补回，不预留死映射（注释已写进 mappers-payload.ts）。

### 改动清单（`ffcd441`）
| 文件 | 改动 |
|---|---|
| `shared/.../api/mappers-payload.ts` | mapQueryParams 删 3 键 + mapMountStatusToApi import + ponytail 注释 |
| `shared/.../media-items/types.ts` | ManageMediaItemsQuery 删 3 字段（**记录侧** mountStatus/hasPoster/hasSubtitle 保留——它们是展示字段，mapListRecord 在读） |
| `shared/.../api/mappers-enum.ts` | 删 mapMountStatusToApi（唯一消费点消失，YAGNI） |
| `shared/tests/media-item-status-mappers.test.ts` | 新增 2 条钉测试（见 §3）；摘除对已删函数的断言 |

---

## 2. mappers-enum.ts live bug（card 第 3 条）——已在本分支修复，此处给复现+修复链

### 复现（RED，main 形态）
`git show origin/main:shared/.../mappers-enum.ts` 三个 fromWire 只有 V1 词表、default → `missing`；后端真值 `mounted/identified/configured/verified/maintenance` **一个都不认识**（文件 0 命中）；显示层同病（`formUtils.ts` default → 状态缺失/元数据缺失/挂载缺失）⇒ 列表每行说假话。完整原文已存档：`W-FE-RED.md` §1.0b（`git show origin/main:<path>` 当次输出）。
**定性**：main live bug（站长裁定二已确认 P1）。

### 修复（GREEN，`55c8c6a`，先于本卡落地）
- 三 union 换后端真值 + fromWire 补真实枚举 + default fail-soft 保留 + ToApi 不再吞 missing；
- 钉测试 `shared/tests/media-item-status-mappers.test.ts`（RED→GREEN 当次原文：修后 `5/5 PASS`、shared 全套 `166/166`，见 W-FE-RED §6）；
- 本卡又续 2 条钉测试（§3），tsc 双 EXIT=0。

---

## 3. 测试（card 第 4 条）

| card 要求 | 落点 | 内容 |
|---|---|---|
| ① 3 参数不再被发 | `media-item-status-mappers.test.ts`『query params 不再发死契约参』 | 键集**精确锁**（deepEqual 全键列表）+ 三死键逐一反断言 + 下划线名反断言 |
| ② 真实字段名被正确读 | 同文件『列表 mapper 读的是真实下划线 wire 名』 | mapListRecord：`source_status/mount_status/metadata_status/has_poster/has_subtitle` → 域值/布尔逐项 |
| ③ live bug 回归用例 | 同文件 5 条（W-A-RESUME 落地）+ host 4 条文案锁 | 已在 55c8c6a 交付 |

---

## 4. 验证状态（本卡纪律：禁本机 test ⇒ 留农场）

- ✅ 本机：`tsc --noEmit` host **EXIT=0**、shared **EXIT=0**（删除零涟漪；noUnusedLocals 会抓孤立 import/死代码）。
- ✅ 既有 GREEN 原文（live bug 修复当次，W-A-RESUME 卡）：`media-item-status-mappers 5/5`、shared 全套 `166/166`。
- ⏳ **需主代理投前端验证**：`web-verify`（或 farm3 `pnpm -r test`）——判据：shared **166+2=168/0**（新增 2 条钉测试）、host **895/0**、`pnpm --filter @fmby/v2-host typecheck` exit 0；RED→GREEN 的新增部分以 farm 输出为准。
- RED 原文（本卡新增两条钉测试视角）：修前 mapQueryParams 的 3 个死键见 `git show 55c8c6a^:shared/src/contracts/manage/media-items/api/mappers-payload.ts`（第 32/35/36 行）——钉测试在旧代码上必红（键集断言）。

## 5. ponytail 段（跳过了什么 / 何时再加）
- **没做**：给 mount/poster/subtitle 建「正确的下划线发参」——后端不收，发了也是假能力；等 w3 真加筛选再按 wire 名补（注释已锚在 mapQueryParams）。
- **没做**：保留 mapMountStatusToApi 备用——唯一消费点已消失，YAGNI；将来 /api/search 的 mount 筛选接 UI 时再写（当期白名单 configured/unavailable/maintenance/verified，无 missing）。
- **没动**：记录侧字段（mapListRecord 读数）——本来就是对的，只加了锁。
