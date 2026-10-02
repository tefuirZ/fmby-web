# FE-OPS-REALTIME-WS 交接（w/fe/ops-realtime-ws · 证伪）

## 1. 一句话结论

**本卡已在 `origin/main` 完整实现并合入** —— commit `0f55580`
`feat(operations): 运营看板接入实时 WS（FE-OPS-REALTIME-WS，W5-E 卡1）`
（`git merge-base --is-ancestor 0f55580 origin/main` = YES）。**无残余缺口，不新造实现**；
本分支仅补写缺失的交接文档（实现提交当时未落 handoff）。

## 2. 先证伪 / 取证（codegraph + 直读）

| 卡面要求 | 现状（已存在） | 位置 |
|---|---|---|
| 接播放实时 WS `/api/playback/realtime/ws` | `WS_PATH = '/api/playback/realtime/ws?scope=admin'` | `host/src/features/operations/useOperationsRealtime.ts:20` |
| 显示运营快照 | 消费 `playback.active_snapshot` / `playback.source_load_snapshot` → 活跃播放 / 数据源负载 | 同上 `reduceRealtimeFrame` |
| 复用 httpClient/契约 mapper（不造第二套） | `operationsApi.fromActiveSnapshotEvent` / `fromMountLoadEvent`（与 REST 读法同一 mapper） | `shared/src/contracts/manage/operations/api.ts:430/445` |
| 诚实错误态（不白屏） | 实时快照优先、REST 作首屏与回退；`实时` / `实时离线·REST 回退` badge + 错误卡 | `host/src/pages/manage/operations/OperationsGapSections.tsx:57-95` |
| 测试 | `host/tests/operations-realtime.test.ts`（9 例：快照映射/退避/非 JSON 不崩/mapper 复用） | 同上 |

codegraph 佐证：`useOperationsRealtime` 调用方 = `OperationsGapSections`（codegraph callers 命中
`host/src/pages/manage/operations/OperationsGapSections.tsx:41`）；`fromActiveSnapshotEvent` /
`fromMountLoadEvent` codegraph 定位到 `shared/.../operations/api.ts`。**无第二套 WS 客户端**
（全仓 `WS_PATH` 仅此一处；`WebSocket` 符号仅 `SkinRealtime` 接口无关命中）。

后端权威对位：`crates/fmby-v2-http/src/routes/playback.rs` 的 `playback_realtime_ws`
（`GET /playback/realtime/ws`，`scope=admin` 需 `ManageLibrary`）；事件信封 `{type, server_time, payload}`
与 7 类事件类型在 `fmby-v2-application/src/playback/realtime.rs` 定义——前端 `parseFrame` 逐字对齐。

## 3. 当次验证（fresh；verification-before-completion）

| 验证 | 命令 | 结果 |
|---|---|---|
| 本卡单测 | `cd host && node --import ./tests/register-aliases.mjs --test tests/operations-realtime.test.ts` | **tests 9 / pass 9 / fail 0**（duration 1.27s） |
| host typecheck | `host/node_modules/.bin/tsc -p host/tsconfig.app.json --noEmit` | **exit 0** |
| component-size | `node scripts/check-frontend-component-size.mjs` | **[PASS] 0 违规**（2 个存量债务在基线内，与本卡无关：`runtimeLogPresentation.ts` / `shared/src/api/client.ts`） |
| dupes | `node scripts/check-frontend-dupes.mjs` | PASS |
| contracts | `node scripts/check-contract-mappers.mjs` | PASS |
| 基线 | `git merge-base --is-ancestor 0f55580 origin/main` | YES（已在 main） |

> 依赖安装：worktree 新树 `pnpm install --offline --frozen-lockfile`（exit 0）；typecheck 经直调
> `tsc` 二进制（pnpm 被 fmby-queue 全局串行，直调 tsc 秒级、等价）。


### RED→GREEN：**不适用**（证伪卡，零代码改动）

本卡经取证判定「能力已在 `origin/main` 完整实现并合入（`0f55580`）」⇒ **无新功能要实现**，
故无 RED→GREEN 循环可写（写测试→看它失败→写实现 在本卡不成立：实现已存在且测试已绿 9/9）。
按 ponytail「不新造实现」纪律，本卡**不动生产代码**，只补缺失的交接文档。
若强行造一个 RED→GREEN，等于在已绿的实现上重复造轮子（且会制造第二套 WS 客户端）。

## 4. 跳过项（ponytail：跳过了什么 / 何时再加）

- **不新造实现**：卡面所述能力 `0f55580` 已全量落地；重复实现 = 违反 ponytail 且制造第二套 WS 客户端。
- **不改既有实现**：hook/mapper/页面均已在 main 且测试绿；本卡无必要改动。
- **不引依赖、不改契约仓/mirror/V1**：证伪卡，零代码改动。
- **本卡范围外**：`shared/src/api/client.ts`、`runtimeLogPresentation.ts` 两条 component-size 存量债务
  由其他拆分卡清偿（不在本卡范围）。

## 5. 待主代理 / 裁决

- 若编排台账把本卡记为「待实现」→ 请改记为**已完成（`0f55580` 已合 main）**，避免重复派卡。
- 无代码改动可合并；本分支仅新增本文档。

Reviewed-by: pending-non-author-review
