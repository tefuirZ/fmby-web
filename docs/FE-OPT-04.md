# FE-OPT-04 管理面批量操作体感（w1 交付 · 前端仓 w/fe-opt-04）

> 基线：fmby-web main @ `a19e240`。分支 `w/fe-opt-04`。前端优化板块最后一张卡。
> 动机：管理面批量操作（多选 + 批量动作 + 逐条进度 + 失败重试）此前仅用户页
> 部分具备；本卡把「批量操作体感」收敛为共享内核并铺到 5 个适用页。

## 八行报告

- **任务结论**：① **共享批量内核**（`shared/src/batch/`）——选择集纯函数（全选/反选/范围选 shift/三态表头/prune）+ 逐条运行状态机（pending→running→ok/fail、部分失败不中断、失败可重试、并发度、abort）；② **共享 UI**（`BatchActionBar` 动作条 + `BatchProgressPanel` 进度面板：进度条 + 计数 + 失败项列表 + 单条/整批重试）；③ **5 页接入**：用户 / 注册码 / 媒体条目 / 挂载 / 合集；④ **真实栈 e2e 2 passed**（合集批量全选→删除→逐条进度→列表缩减；范围选/反选/清空）；⑤ **体感实数**（runs=5）：全选 113ms、面板 153ms、3 项端到端 110ms、列表生效 38ms。
- **修改范围**：`shared/src/batch/{selection,runner,index}.ts`（新）、`shared/src/hooks/useBatchOperation.ts`（新）、`shared/src/ui/common/BatchProgressPanel.{tsx,module.css}`（新）、`shared/src/{hooks,ui}/index.ts`、`shared/package.json`（`./batch` 导出）、`shared/tests/batch-operation.test.ts`（新，15 测试）、5 个 Manage*Page + `mounts/components/MountTable.tsx` + `media-items/components/MediaItemListTable.tsx`、`host/e2e/batch-operations.spec.ts`（新）、`scripts/perf/fe-opt-04-batch.mjs`（新）、`docs/evidence/fe-opt-04-batch.{json,md}`（新）。
- **测试**：`pnpm verify` **全绿（exit 0）**；shared node:test **64**（+15）、darkroom 19、host 14；真实栈 e2e `batch-operations` **2 passed**。
- **门禁**：size PASS / dupes PASS（0 violations）/ contracts PASS / theme-budget + theme-parity PASS / repo-size PASS / versions PASS。
- **Review**：批量 = **客户端逐条编排**（后端无批量端点，见 §三）；纯内核（selection/runner）不依赖 React，node:test 直接断言；React hook 仅搬运状态。
- **风险登记**：① 用户/注册码/媒体条目列表端点为 **501 stub**（无真实数据），其批量 UI 已就绪但需后端端点落地才可用；② 挂载删除受 **G-06 确认口径不一致** 阻断（见 §四，建议独立立卡）。
- **对主代理依赖**：无（前端仓单仓交付）。
- **兼容性确认**：用户页原有批量软删除改为**逐条编排**（语义不变，新增逐条状态 + 重试）；其余页为**新增**能力，未改既有单条操作路径。

## 一、共享内核（新增）

| 文件 | 内容 |
|---|---|
| `shared/src/batch/selection.ts` | `toggleOne` / `selectAll` / `clearVisible` / `invertVisible` / `toggleRange`（shift 锚点）/ `headerCheckState`（三态）/ `pruneSelection`。**跨页保留语义**：全选/清空只作用当前可见页，翻页不丢已选。 |
| `shared/src/batch/runner.ts` | `runBatch`（逐条执行 + 状态迁移 + 并发度 + abort）/ `summarize` / `failedItems` / `isBatchRunning`。**部分失败不中断**（一条 404 不回滚其余）→ "失败可单条重试"的语义基础。 |
| `shared/src/hooks/useBatchOperation.ts` | `useBatchSelection`（多选 + shift）/ `useBatchRunner`（run/retryOne/retryFailed/dismiss）。 |
| `shared/src/ui/common/BatchProgressPanel.tsx` | `BatchActionBar`（吸附底部动作条）+ `BatchProgressPanel`（progressbar + 计数 + 失败项列表 + 重试按钮）。 |

## 二、五页接入

| 页 | 选择 | 动作条 | 进度面板 | 重试 | 批量操作 |
|---|---|---|---|---|---|
| 用户 | ✅ | 现有 | ✅ 新 | ✅ | 软删除（逐条 `updateUserStatus disabled`） |
| 注册码 | ✅ | 现有 | ✅ 新 | ✅ | 批次删除（逐条 `batchDeleteRegistrationCodeBatches([id])`） |
| 媒体条目 | ✅ | ✅ 新 | ✅ 新 | ✅ | 删除媒体源（逐条：解析唯一来源→删） |
| 挂载 | ✅ | ✅ 新 | ✅ 新 | ✅ | 删除来源（逐条 `deleteMount`） |
| 合集 | ✅ | ✅ 新 | ✅ 新 | ✅ | 删除合集（逐条 `deleteCollection`） |

## 三、设计前提：客户端逐条编排（非后端批量端点）

**管理面无批量端点**——`/manage/users/batch/*`、`/manage/registration-codes/batch/delete` 等均为 501 stub；仅部分域有真实**逐条**端点（mounts/collections 删除）。故批量 = 客户端对既有单条 API 的**逐条编排**：
- 天然支持"逐条状态 + 失败单条重试"（后端批量端点无法给逐条粒度）；
- 后端批量端点落地后 UI 零改动（换 `runOne` 实现即可）；
- 真实端点缺失时**如实**呈现为逐条 `fail`（不伪装成功）。

## 四、实测发现的真 blocker（登记，非本卡范围）

**`DELETE /api/manage/{mounts,libraries,users}/{id}` 确认口径不一致（契约仓 G-06）**：
- 后端 `manage_mounts_delete` 要求 **query `?confirmed=true`**（`require_confirmed`，`manage.rs:212`）；
- 前端 `deleteMount` 只发 **body `{confirm_action}`**（`manage/api.ts:825`）；
- **实测**：body-only → **400**；`?confirmed=true` → **204**。
- 影响：挂载/媒体库/用户等所有 `ConfirmQuery` 端点的 UI 删除**恒 400**（单删 + 批删）。
- 本卡 e2e 改用**合集**（delete 无 confirmed 要求）验证批量内核。**建议独立立卡收口 G-06**（前端回显 query 或后端兼容 body）。

## 五、验证与体感

- 真实栈 e2e：`host/e2e/batch-operations.spec.ts` **2 passed**（9.0s）。
- 体感采样：`scripts/perf/fe-opt-04-batch.mjs`（runs=5）→ `docs/evidence/fe-opt-04-batch.json`：

| 阶段 | p50 | p95 |
|---|---|---|
| 全选 → 动作条可见 | 113 ms | 116 ms |
| 确认 → 进度面板可见 | 153 ms | 184 ms |
| 3 项逐条端到端 | 110 ms | 201 ms |
| 批量完成 → 列表生效 | 38 ms | 62 ms |

详见 `docs/evidence/fe-opt-04-batch.md`。

## 六、验证命令（复现）

```bash
# 门禁（全部）
pnpm verify

# 真实栈 e2e（需主仓二进制；避开共享端口用 FMBY_E2E_WEB_PORT）
cd host && FMBY_E2E_WEB_PORT=5199 FMBY_E2E_BACKEND_PORT=18199 \
  FMBY_E2E_SERVER_BIN=<main>/target/debug/fmby-v2-server \
  FMBY_E2E_SEED_BIN=<main>/target/debug/fmby-e2e-seed \
  node_modules/.bin/playwright test e2e/batch-operations.spec.ts

# 体感采样（真实栈运行时）
node scripts/perf/fe-opt-04-batch.mjs --base http://127.0.0.1:5199 --out docs/evidence/fe-opt-04-batch.json --runs 5
```
