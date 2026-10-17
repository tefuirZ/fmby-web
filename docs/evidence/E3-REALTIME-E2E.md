# E3 端到端断言转正 —— ②③④ DOM 级（WS 分批 + 降级 + 计数）

> 卡面：w06 已接线（edc81510c8 ✓ 任务状态推进后推分批事件）⇒ 前端把 ②③④ 反向断言转正，附 DOM 断言原文 + 人为延迟的注入方式（page.route ✓）。一件一 commit ✓。
> 分支：fmby-web `main`；commits `6ba962a`（接线）→ `3894cab`（e2e spec）。

---

## §0 交付总览

| 卡面条 | 载体 | 状态 |
|---|---|---|
| ② 每批 append 计数正确 | 页面接线（WS 批 → react-query 缓存合并 → DOM）+ 计数条 `data-testid=realtime-batch-counters` + e2e 断言 | ⚠️ **代码就绪，e2e skip**（前置闸如实：现 e2e 后端二进制不含推送，见 §3 卡点） |
| ③ 人为 5s 延迟仍 ≤300ms 出内容 | page.route 5s 注入 + goto waitUntil:'commit' + 浏览器内计时 | ✅ **e2e 绿**（首内容 223ms，探针实测） |
| ④ 3s 无数据降级+重试+「仍在后台执行」 | 首屏 loading 分支内挂降级条（stall 3s 计时）+ e2e 断言（出现→点重试→消失→表格渲染） | ✅ **e2e 绿** |

## §1 前端接线（`6ba962a`，ManageTaskCenterPage）

- **② 合并**：`useTaskCenterRealtime(true)` 消费 WS → `lastBatch` 到达时把 wire 行合并进当前列表 react-query 缓存：
  - 已有 `(category,id)` → **原地更新** `status`/`updatedAt`（②b，富形状不丢）；
  - 新行 → **头部插入**最小记录（②a，summary 诚实标「实时推送的新任务」，mediaTitle 不伪造）；
  - `wire.status` 经 7 值白名单显式收窄（未知值回落 `Queued`，不用 as 硬转 string→联合型）。
- **② 计数 DOM 面**：页头 meta 挂 `data-testid="realtime-batch-counters"`：「实时推送：N 批 · 追加 A · 更新 U」——每批计数 DOM 可观测（e2e 断言对象）。
- **④a 丢帧**：`seqGapped` ⇒ 全量重拉（降级轮询兜底）。
- **④b 3s 无数据**：`(isPending||isFetching) && !data` 持续 3s ⇒ `stalled=true` ⇒ 首屏 loading 分支内渲染降级条 `data-testid="task-center-stall"`：「响应较慢：任务数据**仍在后台执行**，已降级为本页轮询…」+ 重试按钮（双 refetch）。
  - ★实现要点：降级条必须挂在**早 return 的 loading 分支内**——首屏无数据时用户唯一可见的就是这屏，挂在主 JSX 里永远渲染不到（e2e 首轮即暴露此结构问题）。
- 零新依赖；WS 断线走 hook 内既有退避重连（1s→2s→…封顶 15s）；未连上时页面行为与接线前逐字一致。

## §2 验收原文（真栈 e2e，最终一轮）

```
$ FMBY_E2E_SERVER_BIN=/data/fmby-e2e-bin/fmby-v2-server … \
  node node_modules/@playwright/test/cli.js test e2e/task-center-e3-realtime.spec.ts \
  --project=chromium --reporter=list --timeout=90000

  ✓ 1 ③ 人为 5s 延迟仍 ≤300ms 出内容（禁白屏） (2.0s)
  ✓ 2 ④ 3s 无数据 ⇒ 降级文案+重试+「仍在后台执行」 (10.7s)
  1 skipped   ← ②（前置闸，见 §3）
  2 passed (26.3s)
```

**③ 的探针时序原文**（浏览器内计时，page.route 5s 注入）：

```json
{"commitMs":141, "firstContentMs":223.5, "what":"正在装配任务中心"}
```

首内容 = loading 兜底文案，commit 后 **223.5ms ≤ 300ms** ✅（禁白屏：数据 5s 后才到，期间始终有 loading → 降级条可见）。

**④ 的 DOM 链路**：stall 条出现（含「仍在后台执行」+ 重试）→ 点重试 → 解除延迟 → stall 消失 → 表格渲染 ✅。

## §3 卡点（如实）：② 的后端二进制缺失

- ② 需要后端 `item_action` 推 `task.center.batch`（w06 `edc81510c8`）。
- **该 commit 编译红**：`cargo build -p fmby-v2-server`（分支 `feat/w06-perf-capacity-3000` @ 908215e054）实测：
  - `E0432: unresolved import crate::playback::realtime::TaskCenterStatus`（`task_center_push.rs:22`，编译器提示应从 `crate::task_center::TaskCenterStatus` 导入）
  - `E0063: missing field 'realtime' in initializer of TaskCenterUseCase`（`task_center.rs:337`，`Self { tasks, audit }` 缺 `realtime`）
  - edc81510c8 之后无修复 commit（已核 `edc81510c8..908215e054` 两文件零改动）⇒ w06 分支 tip 同样编译不过（这也解释了它为何未进 main）。
- **本卡纪律**：不修后端生产代码 ✗（w15 返工卡误投已示范此边界）⇒ e2e 用**前置闸**：`strings $FMBY_E2E_SERVER_BIN | grep task.center.batch`，缺失 ⇒ `test.skip` 并打印原因——**不伪造绿**。
- **转正路径**（w06 修两处编译错后，本 spec 零改动重跑即转正）：
  1. E0432：`task_center_push.rs:22` 改 `use crate::task_center::TaskCenterStatus`（或 realtime 模块重导出）；
  2. E0063：`task_center.rs:337` `Self { tasks, audit, realtime: None }`；
  3. 重编二进制 → `FMBY_E2E_SERVER_BIN=<新二进制>` 重跑本 spec → ② 断言（计数条「更新 ≥1」+ 行状态在 refetch 延迟窗口内实时变）自动生效。

## §4 实现过程中踩掉的两个坑（记录防复发）

1. **包名写错**：本仓共享包别名是 `@fmby/v2-shared/*`（`@fmby` + `v2-shared`），不是 `@fmby-v2-shared/*`——同 specifier 在同文件一成一败的 traceResolution 迷惑行为浪费三轮；最终以 TaskCenterList.tsx 的既有 import 字节为准。
2. **composite + tsbuildinfo 缓存错乱**：文件高频重写期间 `tsconfig.app.tsbuildinfo` 把 L2 钉在假 TS2307；`--incremental false` 全量跑即自愈（本文件 0 错）。删除 tsbuildinfo 无副作用（构建产物）。

## §5 ponytail（跳过了什么 / 何时再加）

- **跳过**：② 的「新任务 append」e2e 变体——需要可控的新任务生成器（触发扫描等），种子任务全为系统任务不可推进；② 的 append 计数已有单测（realtime 契约 ②a-②c）钉纯函数，e2e 现覆盖 ②b 原地更新路径。
- **跳过**：WS 断线重连的 e2e——hook 内退避逻辑已被 ③a 契约断言钉住；真栈断线注入（关 WS proxy）属可选加固。
- **何时再加**：w06 修好编译 → 重编二进制 → 本 spec `②` 直接转正，无需改 spec。
