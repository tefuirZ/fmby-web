# FE-OPT-04 证据：管理面批量操作体感

日期：2026-09-15｜分支：`w/fe-opt-04`｜前端仓
工具：`scripts/perf/fe-opt-04-batch.mjs`（playwright performance API，真实栈）
原始数据：`docs/evidence/fe-opt-04-batch.json`（runs=5，items=3）

---

## 1. 真实栈 e2e（批量流程）

`host/e2e/batch-operations.spec.ts` —— 真实 `fmby-v2-server`（E2E seed）+ 真实 SQLite + 真实产物：**2 passed**（9.0s）。

| 用例 | 断言链 |
|---|---|
| 合集全选 → 批量删除 | 预置 3 合集（真实 POST）→ 全选（动作条「已选择 3 项」）→ 批量删除确认（会话级输入 `delete-managed-collection`）→ 进度面板（progressbar + 逐条）→ **列表缩减为 0**（真实逐条 DELETE）+ 面板「成功 3」 |
| 合集范围选/反选/清空 | 首项点击 + 末项 shift → 范围选全覆盖 → 反选（全不选，动作条消失）→ 全选 → 清空本页 → 动作条消失 |

> 选 **合集** 作 e2e 载体：`POST/GET/DELETE /api/manage/collections` 全部已接线（实测 create→list→delete=200），可完整跑通批量链。

## 2. 体感指标（可感知响应时间，runs=5 × 3 项）

| 阶段 | 语义 | p50 | p95 | max |
|---|---|---|---|---|
| `select_all_to_bar` | 点「全选」→ 批量动作条可见（选择即时反馈） | **113 ms** | 116 ms | 116 ms |
| `batch_confirm_to_panel` | 确认批量删除 → 进度面板首次可见（乐观/即时反馈） | **153 ms** | 184 ms | 184 ms |
| `batch_run_total` | 进度面板出现 → 3 项逐条 DELETE 全部处理完（端到端） | **110 ms** | 201 ms | 201 ms |
| `batch_list_applied` | 批量完成 → 列表已缩减（真实生效） | **38 ms** | 62 ms | 62 ms |

**结论**：批量操作全程「可感知即时有反馈」——选择 113ms、进度面板 153ms（点击后即出现，不等后端）、3 项端到端 110ms、列表生效 38ms。无长时冻结（旧形态是"点击后无反馈直到整批响应返回"）。

## 3. 关键实现选择

- **逐条编排（非后端批量端点）**：管理面**无批量端点**（`/manage/users/batch/*` 等为 501 stub），故批量 = 客户端对既有单条 API 的**逐条编排**（`shared/src/batch/runner.ts`），天然支持"逐条状态 + 失败单条重试"，且在后端批量端点落地后无需改 UI。
- **纯内核 + node:test**：选择集（`selection.ts`）+ 运行状态机（`runner.ts`）为纯函数，15 条单测覆盖（全选/反选/范围选/三态表头/prune/状态迁移/部分失败/并发/abort）；React hook 仅做搬运。
- **跨页选择保留**：全选/清空只作用于当前可见页，翻页不丢已选（避免分页丢失）。

## 4. 实测发现的真 blocker（登记，非本卡范围）

**`DELETE /api/manage/mounts/{id}` 确认口径不一致（契约仓 G-06）**：
- 后端要求 **query `?confirmed=true`**（`require_confirmed(&query)`，`routes/manage.rs:212`）；
- 前端 `deleteMount` 只发 **body `{confirm_action}`**（`shared/src/contracts/manage/api.ts:825`）；
- **实测**：body-only → **400 always**；`?confirmed=true` → 204。

→ 挂载页**单删与批删在 UI 上恒 400**（真实 blocker，影响 mounts/libraries/users 等所有 `ConfirmQuery` 端点）。本卡 e2e 因此改用**合集**（其 delete 无 confirmed 要求，`manage_collections.rs:96`）验证批量内核。**建议独立立卡收口 G-06**（改前端回显 query 或后端兼容 body；契约仓已登记）。

## 5. 适用页覆盖（任务 4：5 页）

| 页 | 多选 | 批量动作条 | 逐条进度 | 失败重试 | 后端真实可用性 |
|---|---|---|---|---|---|
| 用户 | ✅（复用既有选择） | ✅ | ✅（面板） | ✅ | 列表/单条/批量端点均 **501 stub** |
| 注册码 | ✅（复用既有批次选择） | ✅（既有条 + 面板） | ✅ | ✅ | 列表/批量 **501 stub** |
| 媒体条目 | ✅ | ✅ | ✅ | ✅ | 列表 **501 stub**；子资源端点未实现 |
| 挂载 | ✅ | ✅ | ✅ | ✅ | 列表/删除**真实**（但 G-06 阻断 UI 删除） |
| 合集 | ✅ | ✅ | ✅ | ✅ | 列表/创建/删除**真实**（e2e 验证） |

> 五页均接入同一套 `useBatchSelection` + `useBatchRunner` + `BatchProgressPanel/BatchActionBar`；真实可用性受后端端点进度制约（逐条失败会**如实**呈现为 `fail`，不伪装成功）。
