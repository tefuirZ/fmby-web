# FE-SCANS-NO-TASKTYPE 交付说明 · 扫描列表停发 `taskType`

**仓库**：`ws-zcode-writer1-fe-scans-params`（新工作树）　**分支**：`w/zcode/writer1-fe-scans-params`
**基点**：`origin/main` = `485812e`（v0.2.12）→ **已同步 `origin/main` = `b5f6205`**（v0.2.13，含已合入的 FE-AI-INTERVENTIONS）
**提交**：`7daf1ed`（改码 + 防回归单测）→ `ecf5aae`（本 handoff）→ `fa5e2b9`（Merge origin/main）
**判据（合并后）**：`pnpm verify` **EXIT=0**（shared **101** / host **320** / component-size **0 违规**）。
**改动面（相对 `b5f6205`）**：**4 文件 / +201 −3**（零基点噪音）。

## ponytail 段

- **阶梯**：YAGNI（本卡只做一件事：让前端不再具备发 `taskType` 的能力）→ 删除既有声明（**删除优于新增**，未新增任何抽象/依赖）。
- **天花板 + 升级路径**：删的是 `ManageScansQuery.taskType` 与 `mapScansQueryToParams` 的一行；**未**触碰 `mapScanTaskTypeToApi`（`api.ts:816` 的 POST 触发 body 合法收 `taskType`，删它会误伤）。若将来后端真的补上 `task_type` 维度（需先有列），恢复方式 = 加回字段 + 一行映射 + 后端 wire 已就绪的 `taskType` 名。
- **跳过了什么/何时再加**：**没有**去写扫描列表 UI（产品缺口，主代理记入看板，不属本卡）；**没有**改名为 `status` 之类讨好门禁（历史明令禁止）。
- 简化标记：源码两处均留 `ponytail:` 注释，写明「为何不再声明/发送」+ 后端 fail-loud 的 file:line。

---

## ① 先核：判定依据（**前端是否会把 `taskType` 发出去？**）

**结论：根本不存在调用点 —— 不是「条件发送」，是「永不发送」。**

| # | 证据（file:line） | 结论 |
|---|---|---|
| 1 | `shared/src/contracts/manage/api.ts:957-966` `getScans()` | 是请求 `GET /api/manage/scans` 的**唯一**函数，且**全仓唯一一次出现**就是它自己的定义行 |
| 2 | `codegraph callers "getScans" -p .` | **No callers found** |
| 3 | 全仓字面扫描 `getScans`（含 `host/tests`、`scripts/e2e`、`*.md`，排除 node_modules/dist） | 只命中 `api.ts:957` 一处 |
| 4 | `shared/src/contracts/manage/mapping/query-params.ts:51-63` | 即便被调用，`taskType` 也**仅非空才映射**（`query.taskType ? … : undefined`），`httpClient` 跳过 `undefined` |
| 5 | `host/src` 下 `find -ipath "*scan*"` | 只有 `libraries/.../LibraryDrawerViewScanTasksSection.tsx`、`mounts/.../MountScanTasksSection.tsx`；二者取数自**库/挂载详情响应**，与 `GET /api/manage/scans` 无关 |
| 6 | 文案检索「扫描任务」 | 上述两个 section + `useLibraryMutations.ts:138`（触发提示），**无扫描列表筛选面板** |

**⇒ 该参数永远不可能被选出非空（连调用点都没有）**，按卡面决策树落入「不能 ⇒ 只登记死声明」支；**但主代理裁定改为「删」**（零调用点 ⇒ 删除零风险；且见 ④ 的埋雷时序）。

**后端 fail-loud 真源**：
- wire 层确实**声明**了 `taskType`（`crates/fmby-v2-http/src/routes/scan_trigger.rs:131`）；
- 但桥侧对非空值直接 `AppError::Validation`（`crates/fmby-v2-server/src/bridges/scan_trigger.rs:254`）：
  `"V2 扫描任务无 task_type 维度（V1 st.task_type 无对位列），该过滤不可用"`。
  ⇒ **该闸（`check-query-params.mjs`）抓不到这类 400**：它只校验「前端发参 ⊆ 后端接受名」，而 `taskType` 是被*接受*的（随后桥侧拒绝）。这是本次「先核」必须人读后端的原因。

## ② 后端 wire 参数名（**原文**，供后续扫描列表 UI 卡对接）

`crates/fmby-v2-http/src/routes/scan_trigger.rs:127-142`：

```rust
#[derive(Debug, serde::Deserialize)]
pub struct ScanListRequest {
    pub status: Option<String>,
    /// V1 `ManageScansQuery.task_type`（`dto/scans.rs:26-28`）。
    #[serde(rename = "taskType", alias = "task_type")]
    pub task_type: Option<String>,
    #[serde(rename = "libraryId", alias = "library_id")]
    pub library_id: Option<String>,
    #[serde(rename = "mountId", alias = "mount_id")]
    pub mount_id: Option<String>,
    #[serde(rename = "librarySourceId", alias = "library_source_id")]
    pub library_source_id: Option<String>,
    pub page: Option<u64>,
    #[serde(rename = "size", alias = "pageSize", alias = "page_size")]
    pub size: Option<u64>,
}
```

**逐名核对结果（零改动）**：前端 `mapScansQueryToParams` 发的 `page / pageSize / status / libraryId / mountId / librarySourceId` 与后端**逐名一致**——后端是 **camelCase 主名 + snake alias**，`pageSize` 命中 `size` 的 alias；`status` 前端发 PascalCase（`mapScanStatusToApi: 'running'→'Running'`），后端 `parse_scan_state`（`scan_trigger.rs:146`）双收 snake slug 与 PascalCase。
⇒ **无需对齐**（本卡的规则 3 检查项通过）。

## ③ 改动（最小）

```diff
--- a/shared/src/contracts/manage/types.ts        (ManageScansQuery)
-  taskType?: ManageScanTaskType;
+  // ponytail: 无 `taskType` —— 后端 GET /api/manage/scans 无 task_type 维度
+  // （crates/fmby-v2-http/src/routes/scan_trigger.rs:131 声明、
+  //  crates/fmby-v2-server/src/bridges/scan_trigger.rs:254 fail-loud 400）。
+  // 非空即 400，故前端不声明、不发送（FE-SCANS-NO-TASKTYPE）。

--- a/shared/src/contracts/manage/mapping/query-params.ts
   mapScanStatusToApi,          # 随之未使用 ⇒ 删该 import
-  mapScanTaskTypeToApi,
-    taskType: query.taskType ? mapScanTaskTypeToApi(query.taskType) : undefined,
+    // ponytail: 不发 `taskType`（后端 fail-loud 400，见 ManageScansQuery 注释）。
```

**未动**（显式核对）：`mapScanTaskTypeToApi` 仍被 `api.ts:816`（**POST 触发** body）使用 ⇒ `mapping/shared.ts` 与其导出**保持原样**；`ManageScanTaskType` 类型仍在 `types.ts:575/718` 使用 ⇒ 导出保留。

### 防回归单测（TDD RED → GREEN）
新增 `shared/tests/scans-query-params.test.ts`（纯函数，无网络）：
- ① 即便**绕过类型**（`as never`）传入 `taskType`，映射器运行期也**不透出**（纵深防御）；
- ② 其余参数与后端 wire 名逐名一致（`status` → `Running`）。

**RED（临时回退两处源码改动后）**：
```
✖ FE-SCANS-NO-TASKTYPE ①：映射器不输出 taskType（含绕过类型的运行期调用） (1.581129ms)
✖ FE-SCANS-NO-TASKTYPE ②：其余参数与后端 wire 名逐名一致 (0.246209ms)
ℹ tests 2 / ℹ pass 0 / ℹ fail 2
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: true !== false
EXIT=1
```
**GREEN（恢复改动后）**：
```
✔ FE-SCANS-NO-TASKTYPE ①：映射器不输出 taskType（含绕过类型的运行期调用） (2.345177ms)
✔ FE-SCANS-NO-TASKTYPE ②：其余参数与后端 wire 名逐名一致 (0.248803ms)
ℹ tests 2 / ℹ pass 2 / ℹ fail 0
EXIT=0
```

## ④ 已核实的产品缺口（**仅登记事实，不开卡、不写 UI**）

`GET /api/manage/scans` 在前端**零消费**：无调用点（证据见 ①的 1-3）、无筛选面板（①的 5-6）；现有两个「最近扫描任务」section 从**库/挂载详情响应**取数。
**时序风险（本次删声明的动机）**：后端 v0.1.148 刚补齐的 3 个过滤（`libraryId`/`mountId`/`librarySourceId`）**正是为前端消费而加**（`scan_trigger.rs:150-153` 注释「对位 V1 `ManageScansQuery`」）⇒ 扫描列表 UI 落地在即，若保留该字段，UI 一接即 400。

## ⑤ 当次验证原文

**（A）合并前（基点 `485812e`）**：
```
$ pnpm verify          # EXIT=0
[PASS] 版本门禁通过（四层独立版本 + 契约对齐）。
shared test: ℹ pass 101 / ℹ fail 0
host test:   ℹ pass 308 / ℹ fail 0
[PASS] 仓库二进制产物在预算内。
[PASS] 0 violations found. All frontend architectural boundaries clean.
[PASS] 0 contract violations found.
[PASS] 主题质量门禁通过（无 God File；总量不设限）。
[PASS] 0 违规；3 个存量超线文件在基线内且未上升（棘轮允许，须有拆分计划）。
[PASS] All declared domain skins satisfy required capabilities。
```

**（B）同步 `origin/main` = `b5f6205`（v0.2.13）后重跑（本卡最终判据）**：
```
$ git merge origin/main --no-edit   # fa5e2b9，0 冲突（提交号冲突零）
$ git status --short | wc -l        # 0
$ git diff --stat origin/main..HEAD # 4 文件 / +201 −3（恰为本卡）
$ pnpm verify                       # EXIT=0
[PASS] 版本门禁通过（四层独立版本 + 契约对齐）。
shared test: ℹ pass 101 / ℹ fail 0
host test:   ℹ pass 320 / ℹ fail 0      # 308(main 基线) + 12(FE-AI-INTERVENTIONS 已合入)
[PASS] 仓库二进制产物在预算内（策略见 docs/evidence-policy.md）。
[PASS] 0 violations found. All frontend architectural boundaries clean.
[PASS] 0 contract violations found. All contracts & domain mappers cleanly aligned.
[PASS] 主题质量门禁通过（无 God File；总量不设限）。
[PASS] 0 违规；3 个存量超线文件在基线内且未上升（棘轮允许，须有拆分计划）。
[PASS] All declared domain skins satisfy required capabilities。
```
> 同步时机说明：开工时 `origin/main` = `485812e`；交付后（写作期）远端已推进到 `b5f6205`
> （`9154317 Merge w5: FE-AI-INTERVENTIONS` + v0.2.13），按已确立的「分支落后就同步、让评审看到干净 diff」纪律合并。

**旁证（非裁决依据）**：后端仓的查询参数闸指向本工作树——
```
$ cd /home/tefuir/rustproject/FMBY-V2
$ FMBY_WEB_DIR=/home/tefuir/rustproject/ws-zcode-writer1-fe-scans-params node scripts/check-query-params.mjs
=== check-query-params（前端发参 ⊆ 后端 Query 接受名）===
QUERY-PARAMS CHECK PASSED: 无「前端发参被后端静默忽略」的缺口。
EXIT=0
```
> 该闸的**权威运行处是后端仓**（前端仓无同名脚本：`scripts/` 下只有 component-size / contract-mappers / dupes / size / theme-* / versions 等）；本地指向前端树仅为旁证 ✓。注意它**不覆盖**本卡形态——`taskType` 是被 wire 接受的，只在桥侧被拒（见 ①）。

## ⑥ codegraph 查证记录

```
$ codegraph callers "getScans" -p .            → No callers found            # 零消费决定性证据
$ codegraph callers "mapScansQueryToParams" -p . → getScans (api.ts:957)      # 仅该 mapper 的唯一调用方
$ codegraph query "scans" -p .                  → mapping/scans.ts、libraries.ts:9、mounts.ts:17（均为详情映射，非列表）
$ codegraph query "ScanListQuery" -p FMBY-V2    → state/scan_trigger.rs:158（结构体）、
                                                   routes/scan_trigger.rs:291（测试假体）、
                                                   bridges/scan_trigger.rs:248（实现，400 在此）
```

## 红线遵守
零新依赖 / 未碰 `themes/` / 未碰 `/manage` 授权面 / 未动任何 `shared/src/**/*.d.ts`（已随 FE-TSC 删除，本树 `.d.ts` 仅 `global.d.ts`）/ 未并 integration·BATCH / 未 push main / **未开卡、未写扫描列表 UI**。
FE-AI-INTERVENTIONS（`9b81f46`）全程未触碰，仍冻结待 glm 评审。
