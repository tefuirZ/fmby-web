# FE-CONTRACT-DENSITY 交付说明 · 补前端契约文件密度门禁

**仓库**：`fmby-web`　**分支**：`w/fe/contract-density`（自 `origin/main` 起，已含 v0.2.14）
**commits**：`7b0ef4d`（补契约端点密度门禁）

## ponytail 段

- **阶梯**：第 1/4 阶「不需要存在的东西删掉」+ 复用——**不另写新闸、不引依赖、不动 CI 接线、不改豁免/尺寸口径**，直接扩既有 `scripts/check-frontend-component-size.mjs`（FE-TSC-ARTIFACTS 的门禁脚本，`pnpm verify` → `pnpm component-size` 已串）。
- **落地点**：FE-TSC-ARTIFACTS 待裁决项 **#1**「契约 `.ts` 是否应按端点密度另设口径」——本卡落地。
- **结论**：对契约 `.ts` 增「端点密度」维度（density = 行数 / 端点数），仅对含 `httpClient` 端点的 `*.api.ts` 生效；**阈值与既有契约行数口径对称**：WARN >120 行/端点（非阻塞）、FAIL >250 行/端点（绝对硬顶）。当前存量最大密度 218，**3 WARN、0 FAIL**，不把历史基线一次性打红。
- **跳过了什么**：阈值（120/250）是否收紧交主代理裁定；本卡**不拆任何业务文件**；密度检查不进棘轮（与 [2b] 行数硬顶同思路——绝对阈值，新增即卡）。

## 变更清单

`scripts/check-frontend-component-size.mjs`：
- 新增 `countEndpoints(source)`：统计 `httpClient.(get|post|patch|put|delete)\s*[<(` 调用数（带类型/无类型一并计）。
- 新增常量 `CONTRACT_WARN_DENSITY = 120`、`CONTRACT_FAIL_DENSITY = 250`。
- 在 `[2b]` 后新增 **`[2c]` 契约 *.api.ts 端点密度**小节：
  - 扫描 `shared/src/contracts/**` 全部 `.ts`（**不限 [2b] 的 400 行过滤**——短密文件也要抓）。
  - 仅对 `countEndpoints > 0` 的文件计 `density = lines / endpoints`。
  - `density > 250` → `[FAIL]` 并 push `Contract Endpoint Density Over Hard Ceiling` 进既有 `violations`（触发 `exit(1)`）；
  - `density > 120` → `[WARN]` 仅打印不阻塞；
  - 0 端点文件（types/raw-types）密度无定义，跳过（仍走 [2b]）。
- **未动**：豁免清单 `EXEMPT_FILES`、棘轮基线 `--update-baseline`、[2b] 行数口径、CI 接线。

## codegraph 查证记录

本卡为前端口径门禁，无需改契约符号；用 codegraph 确认契约文件形态与门禁扫描面：

- `codegraph status` → 索引 768 文件 / 7573 节点；`shared/src/contracts/**` 全量在索引内（门禁 `walkTs` 覆盖）。
- `codegraph query "httpClient" -p .` 确认端点入口统一为 `shared/src/api/client.ts` 导出的 `httpClient`，契约 `*.api.ts` 经 `httpClient.<verb>` 调后端（端点计数口径可靠，与脚本正则一致）。

**字面量配置证据**（脚本内阈值，改动后）：
```js
const CONTRACT_CEILING_LINES = 1200;        // [2b] 契约行数硬顶
const CONTRACT_WARN_DENSITY = 120;          // [2c] NEW 密度 WARN（非阻塞）
const CONTRACT_FAIL_DENSITY = 250;          // [2c] NEW 密度 FAIL（绝对硬顶）
const CONTRACT_PREFIX = 'shared/src/contracts/';
```

## RED → GREEN 原文

### RED（缺口验证 · 临时探针，验后即删）
放 `shared/src/contracts/__probe_density.ts`：251 行 / 1 端点（`httpClient.get`），密度 251。
跑改动**前**脚本：
```
[2b] 契约 .ts 超 400 行：14 个（> 1200 行计 FAIL）
[2] 超线文件 3 个受管（另有 1 个豁免；新增/变胖计 FAIL，基线内未上升计 WARN 债务）...
[PASS] 0 违规；3 个存量超线文件在基线内且未上升（棘轮允许，须有拆分计划）。
EXIT=0
```
> 251 行 / 1 端点（`density=251 > 250`）的契约文件**完全不在输出里**——证明「密度维度缺位」的缺口真实存在 `[2b]` 只按行数，<400 行文件直接被过滤。

### GREEN（探针被密度硬顶捕获）
应用 `[2c]` 后重跑（探针仍在）：
```
[2c] 契约 *.api.ts 端点密度（行数/端点；> 120 warn，> 250 fail）：32 个含端点
  [FAIL] shared/src/contracts/__probe_density.ts: 251 行 / 1 端点 = 251 行/端点（超密度硬顶 250）
  [WARN] shared/src/contracts/browse/item/api.ts: 435 行 / 2 端点 = 218 行/端点（密度偏高，未超硬顶 250）
  [WARN] shared/src/contracts/browse/api.ts: 585 行 / 3 端点 = 195 行/端点（密度偏高，未超硬顶 250）
  [WARN] shared/src/contracts/manage/operations/api.ts: 456 行 / 3 端点 = 152 行/端点（密度偏高，未超硬顶 250）
[FAIL] 1 个组件行数违规：
  - [Contract Endpoint Density Over Hard Ceiling] shared/src/contracts/__probe_density.ts
    251 行 / 1 端点 = 251 行/端点，超契约密度硬顶 250 行/端点。...
GATE_EXIT=1
```

### GREEN（删探针，真实仓库全绿，尺寸输出不变）
```
[2b] 契约 .ts 超 400 行：14 个（> 1200 行计 FAIL）
  [WARN] shared/src/contracts/manage/api.ts: 1005 行（契约天然长度，未超硬上限 1200）
  ...（14 个，与改动前一致）
[2c] 契约 *.api.ts 端点密度（行数/端点；> 120 warn，> 250 fail）：31 个含端点
  [WARN] shared/src/contracts/browse/item/api.ts: 435 行 / 2 端点 = 218 行/端点（密度偏高，未超硬顶 250）
  [WARN] shared/src/contracts/browse/api.ts: 585 行 / 3 端点 = 195 行/端点（密度偏高，未超硬顶 250）
  [WARN] shared/src/contracts/manage/operations/api.ts: 456 行 / 3 端点 = 152 行/端点（密度偏高，未超硬顶 250）
[2] 超线文件 3 个受管（另有 1 个豁免；新增/变胖计 FAIL，基线内未上升计 WARN 债务）...
  [WARN(>500)] host/src/pages/manage/mounts/formUtils.ts: 870 行（870 → 870）
  [WARN(>500)] host/src/pages/manage/runtimeLogPresentation.ts: 506 行（506 → 506）
  [WARN(>500)] shared/src/api/client.ts: 506 行（506 → 506）
=============================================
[PASS] 0 违规；3 个存量超线文件在基线内且未上升（棘轮允许，须有拆分计划）。
EXIT=0
```
> 密度维度新增 3 WARN、0 FAIL；[1][2b][2] 尺寸/棘轮输出与改动前逐字一致 → 未破坏既有合法豁免语义与行数门禁。

### 语法校验
```
node --check scripts/check-frontend-component-size.mjs   → SYNTAX_OK
```

## 阈值依据（为何 120 / 250）

- 端点计数口径：`httpClient\.(get|post|patch|put|delete)\s*[<(`（与脚本一致）。
- 存量实测（含端点契约文件，共 31 个）：
  - `manage/api.ts` 1005 行 / 53 端点 = **19**（端点多，绝对不密）；
  - `browse/item/api.ts` 435 / 2 = **218**（当前最密）；
  - `browse/api.ts` 585 / 3 = **195**；`manage/operations/api.ts` 456 / 3 = **152**；
  - 当前最大密度 **218** < 250 → 0 FAIL。
- 对称设计：行数口径「400 warn / 1200 硬顶」（3× 关系），密度口径取「120 warn / 250 硬顶」（≈2×）；WARN 阈值 120 略高于当前次密 195 之下半区，给存量留出下降空间，新代码单端点 >120 行即提示拆分。

## 待拆清单（本卡不拆，登记）

| 文件 | 行数 | 端点 | 密度 | 状态 |
|---|---|---|---|---|
| `shared/src/contracts/browse/item/api.ts` | 435 | 2 | 218 | WARN（密度偏高，未超硬顶） |
| `shared/src/contracts/browse/api.ts` | 585 | 3 | 195 | WARN |
| `shared/src/contracts/manage/operations/api.ts` | 456 | 3 | 152 | WARN |

三者密度未超 250 硬顶，当前非阻塞；若希望更早逼拆，下调 `CONTRACT_WARN_DENSITY` / `CONTRACT_FAIL_DENSITY` 即可（交主代理裁定）。

## 待裁决项（闭合/转交）

1. **FE-TSC-ARTIFACTS 待裁决项 #1 已落地**：契约 `.ts` 现按端点密度设口径（[2c]），非仅行数。闭合。
2. **密度阈值（120/250）是否收紧**：留主代理裁定；本卡未动业务文件，未引入新依赖，未改 CI 接线。
3. **密度检查是否进棘轮**：本卡与 [2b] 同思路采用绝对硬顶（新增即卡），不进棘轮——因为密度是「单端点承载过重映射」的信号，理应即时卡新增。若主代理希望「存量只降不升」语义，可后续加密度基线。

## 跳过项

- **未拆业务文件**：3 个 WARN 密度文件与 3 个棘轮债务文件本卡均不拆（避免与在途卡 FE-MOUNT-AGGREGATE / FE-API-AS-T 等撞车），仅登记。
- **未跑 `pnpm verify`（build/typecheck/test 全量）**：按本卡纪律「前端只执行仓内允许的最小静态/typecheck/test 命令」——门禁脚本为纯 Node 静态扫描，已用 `node --check` + 真实仓库 `node scripts/...` 全绿验证；完整 `pnpm verify`（含 vite build / playwright e2e）不在前端写手本次授权范围，由 CI 复跑。
- **未改契约仓 / mirror**：本卡仅动 `fmby-web` 门禁脚本，不触及后端 FMBY-V2 契约仓或 mirror。
- **未引依赖**：密度逻辑纯正则 + 行数，零新增依赖。
