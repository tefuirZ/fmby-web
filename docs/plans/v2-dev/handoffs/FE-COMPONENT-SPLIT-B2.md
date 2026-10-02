# FE-COMPONENT-SPLIT-B2 交接（w/fe/component-split-b2 · 重新派发续做）

> 本卡为 B2 的重新派发：前序 w1 的 B2（`1dad2c8`，已合入 `origin/main`）已拆
> `ManageCollectionsPage` / `UserDrawer` / `ManageUsersPage` + 收口 `mounts/formUtils`，
> 把超线债务从 20 → 2。本轮在 main 尖（`a1c13f9`）上清偿剩余 2 条债务之一：
> `host/src/pages/manage/runtimeLogPresentation.ts`（506 行）。

- 分支：`w/fe/component-split-b2`（基于 `origin/main` 尖，merge 后落后 0）
- 提交：`43f2cc5`（拆分 + 棘轮基线回收，单一 green commit）
- 门禁（fresh 本会话）：host typecheck exit 0；`component-size` PASS 0 违规；
  `check-frontend-dupes` / `check-contract-mappers` / `check-repo-size` 全 PASS；
  `branch-gates.sh` PASS=1 FAIL=0（后端专用闸前端无脚本 SKIP）

---

## 1. 一句话结论

`runtimeLogPresentation.ts`（506 行，component-size 棘轮债务）按职责拆为 3 个无环子模块
+ 桶入口 re-export，主文件 506 → 10 行（≤400），`--update-baseline` 回收基线。
**行为零变更、导出面零变更、调用方零改动**。受管超线债务 2 → 1（仅剩
`shared/src/api/client.ts`，非组件、本轮不擅动，见 §4）。

## 2. codegraph / 取证（先证伪，勿凭印象）

- 超线实证：`scripts/check-frontend-component-size.mjs` 输出 + 基线
  `docs/plans/v2-dev/evidence/fe-component-size-baseline.json` 双证——current 受管 2 个：
  `runtimeLogPresentation.ts`(506)、`shared/src/api/client.ts`(506)。前序 B1–B4 已将 20 → 2，
  本轮即清偿这 2 条。
- 引用面取证（python3 扫 import，非符号 grep）：全仓仅 **3 处**引用本文件——
  - `host/src/pages/manage/runtime-logs/components.tsx`：`formatRuntimeTargetLabel`（值）+ `RuntimeLogView`（类型）
  - `host/src/pages/manage/runtime-logs/RuntimeLogDetailDialog.tsx`：`RuntimeLogView`（类型）
  → 仅引用 2 个符号，主入口 re-export 即可保面，调用方零改动（未碰这两个文件）。
- 导出面（5 个，全部经主入口 re-export 保留，无隐式改名）：
  `RuntimeLogFieldView` / `RuntimeLogView`（接口）+ `buildRuntimeLogView` /
  `extractStructuredFields` / `formatRuntimeTargetLabel`（函数）。

## 3. RED → GREEN

- **RED（基线）**：拆前 `runtimeLogPresentation.ts` = 506 行 > 500 硬红线，在基线内且未上升
  → 棘轮 WARN 债务（不阻塞，但须有拆分计划）。component-size 受管 2 个。
- **GREEN**：拆后为 4 文件（主入口 10 / fields 181 / formatters 205 / labels 140），全 ≤400；
  `runtimeLogPresentation.ts` 506 → 10，脚本主动提示「可从基线移除」；
  `--update-baseline` 回收（棘轮只降不升：506 → 9，允许）。受管 2 → 1。
- 拆分拓扑（单向无环）：`runtimeLogLabels`（纯常量）← `runtimeLogFormatters`
  （format*/normalize*/cleanup，仅 import `HTTP_STATUS_LABELS`）← `runtimeLogFields`
  （extract*/build*/视图接口，import labels + formatters）← 主入口（re-export）。
- 复用范式：FE-MOUNT-AGGREGATE 的「桶 + 子模块、主入口 re-export、纯结构搬迁不新造抽象」。

## 4. 当次验证（fresh 输出，verification-before-completion）

| 验证 | 命令 | 结果 |
|---|---|---|
| host typecheck | `host/node_modules/.bin/tsc -p host/tsconfig.app.json --noEmit` | exit 0（首轮暴露跨模块符号缺 `export`：TS2306/2459/6133；补 `export` + 修正 fields import 后重跑 exit 0） |
| component-size | `node scripts/check-frontend-component-size.mjs` | PASS 0 违规；受管 1（client.ts）；runtimeLogPresentation 已移出基线 |
| 基线回收 | `… --update-baseline` | 写入（只降不升，506→9） |
| dupes | `node scripts/check-frontend-dupes.mjs` | PASS |
| contracts | `node scripts/check-contract-mappers.mjs` | PASS |
| repo-size | `node scripts/check-repo-size.mjs` | PASS |
| branch-gates | `bash /root/fmby-orchestra/branch-gates.sh <wt>` | PASS=1 FAIL=0（后端闸前端 SKIP） |

> 注：fmby-web 前端验证经 `host/node_modules/.bin/tsc` 直接跑（pnpm 被 fmby-queue 全局串行
> 排队，typecheck 卡等数分钟；直接 tsc 二进制绕过 pnpm 垫片即秒级出结果，等价 typecheck）。
> 未碰农场。

## 5. 跳过项（ponytail：跳过了什么 / 何时再加）

- **`shared/src/api/client.ts`（506）未拆**：它是 `shared` 核心 HTTP 客户端设施
  （`httpClient` / `RetryConfig` / `HttpInterceptors`），**非「组件」语义**，且影响面跨页，
  拆分风险高、需专门的 HTTP 客户端重构卡。本轮聚焦「页面呈现组件」runtimeLogPresentation，
  保持最小必要范围。→ 仍记为超线债务，待主代理裁决是否单列卡清偿。
- **未引依赖、未改 API 契约、未改 UI 文案、未改业务行为**：纯结构拆分。
- **未拆 `runtimeLogFields`/`formatters`/`labels` 更细**：已各自 ≤400，达标即可，
  过度拆分属 YAGNI；若后续某子模块涨过 400 再按需拆。

## 6. 提交

- `43f2cc5` refactor(fe): 拆分 runtimeLogPresentation.ts（506→≤400，回收棘轮基线）
  —— 4 文件（1 改 + 3 新）+ 基线 json，533 插入 / 512 删除。
- `git diff origin/main --stat` 仅含上述（不含 node_modules / 契约仓 / mirror）。

Reviewed-by: pending-non-author-review
