# 交接 · FE-COMPONENT-SPLIT-B2（前端组件存量拆分 B2）

仓库 `/home/tefuir/rustproject/fmby-web`，分支 `w/fe2/fe-component-split-b2`（基于 `origin/main` `e0949213`）。
本卡用 **ponytail**（最懒可行解）：不新造范式，直接复用 FE-MOUNT-AGGREGATE 的「目录 + barrel + 子模块桶」。

---

## 1. 先证伪 / 取证（不凭印象）

门禁 `scripts/check-frontend-component-size.mjs` 实测（拆分前）：

- 硬红线 500、warn 400；当时 **2 个超线文件**在基线内且未上升：
  - `host/src/pages/manage/runtimeLogPresentation.ts`：**506**
  - `shared/src/api/client.ts`：506（本卡未动，留作下一张清偿）
- 目标文件**对外导出面仅 5 项**（逐字保住是硬约束）：
  `RuntimeLogFieldView`、`RuntimeLogView`、`buildRuntimeLogView`、`extractStructuredFields`、`formatRuntimeTargetLabel`
- **该文件此前零测试**（全仓 `*.test.*` 命中 0）⇒ 纯重构无法证「行为不变」⇒ 必须先补测试。

## 2. RED → GREEN（如实写）

- **RED**：先写 `host/tests/runtime-log-presentation.test.ts`，import 指向**尚未存在**的门面
  `.../runtimeLogPresentation/index`；运行 ⇒ `ERR_MODULE_NOT_FOUND`，exit 1（真红，非断言写错）。
- **GREEN**：建桶后同测试 6/6 通过，exit 0。
- 中途一次「红」是**我的断言写错**（`requestId` 会兜底注入 `request_id` 主字段，我却断言 0 字段）：
  按 TDD 纪律**改测试不改代码**（补一条 `requestId 兜底注入` 用例锁住既有行为），未弱化任何实现。

## 3. 拆分形态（复用 FE-MOUNT-AGGREGATE 范式）

`host/src/pages/manage/runtimeLogPresentation.ts`（506 行）→ 目录 + 三桶：

| 桶 | 行数 | 内容 |
|---|---|---|
| `labels.ts` | 145 | `TARGET_LABELS`/`EVENT_LABELS`/`FIELD_LABELS`/`PRIMARY_FIELD_ORDER`/`HTTP_STATUS_LABELS`（纯常量，无依赖） |
| `format.ts` | 186 | 全部 `format*` / `shortenValue` / `normalizeUnknown` / `prettifyKey` / `formatFieldValue`（只依赖 labels） |
| `view.ts` | 214 | 两个对外接口 + `buildRuntimeLogView` / `extractStructuredFields` / `formatRuntimeTargetLabel` + 私有辅助 |
| `index.ts` | 18 | barrel，**逐字保住 5 个对外导出** |

- 依赖方向 `view → format → labels`，**无环**。
- 消费方（`ManageRuntimeLogsPage.tsx`、`runtime-logs/components.tsx`、`runtime-logs/RuntimeLogDetailDialog.tsx`）
  的 `import ... from '.../runtimeLogPresentation'` **零改动**自动解析到新目录门面。

## 4. 棘轮基线回收（本卡核心收益）

`node scripts/check-frontend-component-size.mjs --update-baseline` 已执行：

- `host/src/pages/manage/runtimeLogPresentation.ts`：**基线 506 → 已 ≤400，从基线移除**
- 剩余债务：`shared/src/api/client.ts` 506（未动，留下一张卡清偿）
- 该更新脚本「只许减不许增」（某文件变胖则拒绝写入）⇒ 不会把债洗进基线。

## 5. 当次验证（原文级）

```
node scripts/check-frontend-component-size.mjs      → [PASS] 0 违规；1 个存量超线文件在基线内且未上升
node scripts/check-frontend-size.mjs                → All frontend size & chunking gates PASSED. (exit 0)
node scripts/check-contract-mappers.mjs             → [PASS] 0 contract violations found. (exit 0)
host: node --import ./tests/register-aliases.mjs --test tests/*.test.ts
                                                    → tests 369 / pass 369 / fail 0 (exit 0)
host: node --import ./tests/register-aliases.mjs --test tests/runtime-log-presentation.test.ts
                                                    → tests 6 / pass 6 / fail 0 (exit 0)
```

## 6. 跳过项 / 待裁决（明确不擅自扩大范围）

- **`shared/src/api/client.ts`（506）未拆** —— 一卡一清偿，避免大 diff；列为下一张 B3 卡。
- **两处 tsc 报错为既有基线错误，非本卡引入**（我未触碰这些文件，`git status` 可证）：
  - `shared/src/contracts/manage/peripherals/index.ts(11,43): TS2724` —— `RawManagedCollection` 已不存在（应为 `RawManagedCollectionDetail`）
  - `host/src/pages/browse/CollectionsListPage.tsx(20,23): TS6133` —— `setRefreshTick` 未使用
  ⇒ 二者在 `origin/main` 上即红，建议另派卡或主代理合并时统一修；我不顺手改无关文件。
- 未跑 e2e / 未跑全仓重编译（纪律所限）。

## 7. 提交

一原子项一提交：`feat(host): 拆 runtimeLogPresentation 为桶+门面（保导出面），回收棘轮基线`
（含新测试 + 三桶 + barrel + 删除旧单体 + 基线回收）。

`Reviewed-by: pending-non-author-review`
