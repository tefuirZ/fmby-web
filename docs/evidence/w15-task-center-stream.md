# W15-TASK-CENTER-STREAM 交付与验收断言记录

- 卡：任务中心 WS 通道 + 流式增量渲染（用户裁定的设计红线：**可以慢，不能空**）
- 跨仓两件，一件一 commit：

| 仓 | commit | 内容 |
|---|---|---|
| `precious-dragonfly`（fmby-v2 后端） | `b86f38495c` | 流式 WS + 分批编排器 + 三态 + 降级参数 |
| `lovely-skunk`（fmby-web 前端） | `ea42983` | 流式 hook + 骨架页 + 状态条 + 三态 UI |

- 纪律：找符号只用 codegraph；**未跑 pnpm/cargo build**（构建归主代理/农场）；
  前端测试用 `node --test`（仓内既有基建，非构建）。

---

## 0. codegraph 查证记录（卡面①）

| 查什么 | 命令 | 结论 |
|---|---|---|
| 现有 WS/realtime 实现 | `codegraph query "realtime"` / `"WebSocket"` | 两套：`application/src/playback/realtime.rs`（**生产事件总线**，进程内 broadcast + 有界环形 replay）与 `compat/src/routes/websocket.rs`（Emby 兼容面，非管理面） |
| WS 端点注册 | `codegraph query "WebSocket"` → `router_core.rs:249` | 全仓**唯一生产 WS 端点** `/playback/realtime/ws` |
| 鉴权链 | 实读 `routes/playback.rs:328-393` | Origin 同源 → `authenticate_request` → `scope=admin` 需 `ManageLibrary` → bus 存在性 → `on_upgrade` |
| 事件格式 | 实读 `realtime.rs:39-130` | 信封 `{type, server_time, payload}`；`type` 7 类（V1 8 类裁掉 `limit.warning`） |
| 订阅模型 | 实读 `handle_realtime_socket`（`:439`） | hello → `replay_for(user, admin)` → admin 快照 → `select!{socket.recv, receiver.recv}` |
| 任务中心数据源 | `codegraph query "TaskCenter"` | 端口 `application/src/task_center.rs:253` `TaskCenterService`：`overview` / `items(limit,offset)` / `item_detail` / `item_action` |
| 前端 WS 客户端先例 | 实读 `features/operations/useOperationsRealtime.ts` | 已有成品（复用同一端点 + 退避重连 + 卸载守卫）⇒ **不新造** |

---

## 1. 后端交付（`precious-dragonfly` @ `b86f38495c`）

### 1.1 复用而非新造（卡面②「不新造框架」）

同一路径 `/playback/realtime/ws` **单 handler**，按 `?scope=task_center` 分流：
Origin 校验 + session 鉴权由外层做完传入，内层只补 capability 门（`ManageSettings`，
与 `/api/manage/task-center/*` 四端点一致）与端口存在性。

★**过程中造出又修掉的 bug**（已写进注释防后人重犯）：第一次实现时我给同一路径
注册了**两个** `get` handler ⇒ axum 路由冲突 panic。改为单 handler + scope 分发。

### 1.2 分批推送（`application/src/playback/task_center_stream.rs`，纯逻辑零 IO）

| 项 | 值 | 说明 |
|---|---|---|
| 首块 | `FIRST_BATCH = 3` | 连接后**立即**推，不等全量 |
| 稳态批 | `STEADY_BATCH = 3` | 按就绪顺序 |
| 每帧字段 | `seq` / `has_more` / `loaded` | 序号判重、是否还有更多、累计条数 |
| 收尾三态 | `finished` / `empty` / `failed` | 见 §1.3 |
| 防呆 | `max_batches = 10_000` | RB-3 有界，取数水也不会无限推 |

编排器是 **async** 的（取数是 `async` 的 `TaskCenterService::items`）⇒ 零阻塞。
第一版我用 `block_in_place(|| block_on(...))` 硬拗，**已推倒重做**（那是把异步
拗成同步的反模式：占 blocking 池、藏死锁面）。

### 1.3 三态（卡面③「绝不允许空壳 = 未知」）

| 态 | 触发 | 语义 |
|---|---|---|
| `finished` | 取不到更多 | 正常完成，共 N 条 |
| `empty` | **首块即空** | 查询跑了、结果集为空 ⇒ 恰好一帧 |
| `failed` | 取数 `Err` | 恰好一帧，带 `reason` |

★`empty` 与 `finished(0)` **语义不同**：前者是正常空态，后者是「有数据但一条都没推成功」。
前端对两者文案不同（空态给引导动作，异常给重试）。

### 1.4 降级（卡面④）

给**已有** `GET /api/manage/task-center/items` 加 `first=1` 参数 ⇒ 返回首块小页
（`FIRST_BATCH` 条）+ `first`/`hasMore` 标记 ⇒ WS 不可用时轮询同样 ≤300ms 出内容。
**不加新端点**。

### 1.5 fail-closed

bus / task_center 端口任一未装配 ⇒ **503**（部署错误），不用空数据顶替——
那正是「空壳 = 未知」要禁的形状。

---

## 2. 前端交付（`lovely-skunk` @ `ea42983`）

| 卡面 | 落地 | 证据 |
|---|---|---|
| ⑤ ≤300ms 出内容 | 页面「全页转圈」改**骨架页**（指标骨架 + 3 行列表骨架） | `ManageTaskCenterPage.tsx` 的 `firstPaintReady` 分支 |
| ⑥ 每批 append + 条数 | `TaskCenterStreamBanner`：「已加载 N 条 · 仍在加载…」→「共 N 条」；`lastSeq` 判重 | 单测「⑥ 后续批 append」 |
| ⑦ 卡死降级 | `STALL_MS=3000` 定时器 ⇒ 降级条 + 重试按钮 + 「任务仍在后台执行，此处不会无限转圈」 | 单测「⑦ 卡死阈值」 |
| ⑧ 空态 | 「当前没有运行中的任务」+ 刷新引导 | 单测「⑧ 空态」 |
| ⑨ 异步 job 实时可见 | WS 收 `task_center.*` 即更新 | hook 的 `ws.onmessage` |

双通道：首屏先 `first=1` 拉首块（不依赖 WS）⇒ WS 增量增强；WS 断 ⇒ 指数退避
（封顶 15s）重连 + 轮询降级继续补量，仍分批出、不整页空白。

---

## 3. 验收断言（a/b/c/d）—— 实测状态，不冒充

> 卡面要求「必须有原文」。**可测的已在 CI 恒跑的纯函数单测里绿；需要真浏览器/真后端的
> 归 e2e（farm-accept-ui2 spec），本卡未跑 ⇒ 标「未测」，不写「已过」。**

### a) 人为把后端延迟调到 5s ⇒ 前端仍 ≤300ms 出骨架/首块

**可测部分已绿**（骨架态与后端返回时机解耦）：

```text
✔ ⑤ 首屏骨架不依赖后端速度：loaded=0 且 loading ⇒ showSkeleton 条件成立 (4.564361ms)
```

判据：`showSkeleton = loaded===0 && phase==='loading'`，而首屏 state 是 `INITIAL`
（`phase:'loading'`, `loaded:0`）⇒ **无论后端 5ms 还是 5s 返回，首屏都进骨架分支**。

**未测**：真后端延迟 5s 下的端到端首屏时延（需起栈 + 注入延迟，归 e2e/农场）。

### b) 全链路阻塞 ⇒ 3s 后出现降级提示与重试按钮

**可测部分已绿**（阈值与退避封顶）：

```text
✔ ⑦ 卡死阈值 = 3s（与后端 FRONTEND_STALL_THRESHOLD_MS 同值） (0.200388ms)
✔ 退避封顶 15s（不断连打爆后端） (0.313091ms)
```

**未测**：`stalled` 定时器在真实「3s 无任何数据」下是否置位（hook 行为，需 jsdom/
浏览器）；降级条是否真的渲染出来（组件渲染，需 DOM 环境）。

### c) 每批到达的 append 计数正确

**已绿**（纯函数，三态全）：

```text
✔ ⑥ 首块到达：loaded = 首块条数，文案「已加载 3 条 · 仍在加载…」 (0.555405ms)
✔ ⑥ 后续批 append：loaded 单调递增且不重复 (0.506215ms)
✔ ⑥ 完成态：文案变「共 N 条」且 hasMore=false (0.255192ms)
```

判据含**重复帧丢弃**（同 `seq` 的 progress 不得二次 append——WS 重连 replay 会重发）。

### d) 三态文案区分正确

**已绿**：

```text
✔ ⑧ 空态：文案「当前没有运行中的任务」，且与 finished(0) 区分 (0.4347ms)
✔ ⑦ 失败态：带原因，且**已加载条目保留**（用户看到的不因失败消失） (2.895549ms)
```

判据：`empty` ⇒ `phase='empty'` 且文案「当前没有运行中的任务」；`finished(0)` ⇒
`phase='done'`，两者文案 `assert.notEqual`。

### 全量原文（11/11）

```text
▶ W15-TASK-CENTER-STREAM 纯函数
  ✔ ⑤ 首屏骨架不依赖后端速度：loaded=0 且 loading ⇒ showSkeleton 条件成立 (4.564361ms)
  ✔ ⑦ 卡死阈值 = 3s（与后端 FRONTEND_STALL_THRESHOLD_MS 同值） (0.200388ms)
  ✔ 退避封顶 15s（不断连打爆后端） (0.313091ms)
  ✔ ⑥ 首块到达：loaded = 首块条数，文案「已加载 3 条 · 仍在加载…」 (0.555405ms)
  ✔ ⑥ 后续批 append：loaded 单调递增且不重复 (0.506215ms)
  ✔ ⑥ 完成态：文案变「共 N 条」且 hasMore=false (0.255192ms)
  ✔ ⑧ 空态：文案「当前没有运行中的任务」，且与 finished(0) 区分 (0.4347ms)
  ✔ ⑦ 失败态：带原因，且**已加载条目保留**（用户看到的不因失败消失） (2.895549ms)
  ✔ 非 JSON / 缺 type / 缺 payload ⇒ null（不崩） (0.383965ms)
  ✔ hello 帧（无 payload.kind）被过滤，不影响状态 (1.681421ms)
  ✔ parse 归一 snake_case → 内部形态 (0.352658ms)
✔ W15-TASK-CENTER-STREAM 纯函数 (17.376977ms)
ℹ tests 11
ℹ suites 1
ℹ pass 11
ℹ fail 0
ℹ skipped 0
```

后端 7 个 `#[tokio::test]`（编排器：首块大小/seq 起点/空态恰一帧/失败恰一帧/
seq 单调/loaded 累积/中途失败即停/下游断即停/信封往返）——**未跑 cargo test ⇒ 标未测**。

---

## 4. 未测 / 待补（诚实清单）

| # | 项 | 状态 |
|---|---|---|
| 1 | 后端 `cargo test`（7 个编排器用例 + 2 个路由常量守卫） | **未跑**（卡纪律归农场） |
| 2 | 前端 `tsc --noEmit` / `vite build` | **未跑**（卡纪律归主代理/农场）；只跑了 `node --test` |
| 3 | 真后端延迟 5s 的首屏时延（断言 a 端到端） | 未测 |
| 4 | `stalled` 定时器 + 降级条真实渲染（断言 b 端到端） | 未测 |
| 5 | WS 真连后的 append 序列（断言 c 端到端） | 未测 |
| 6 | 前后端 wire 对账（`task_center.batch/progress/state` 三事件名与 payload 字段名） | **静态核对过**（两侧都是 `kind/seq/items/has_more/loaded/total/reason`），**未真连对账** |
| 7 | E1/E2（权限变更/启停 job 实时可见） | 未测（⑨ 只接了通道，未造对应 job 事件） |

---

## 5. ponytail 段

1. **「复用 realtime 总线」是这个卡最值的决定**。仓内已有一条验证过的 WS（Origin→
   session→capability→bus→on_upgrade + 心跳 + 前端退避重连先例）。新造一条 WS
   端点 = 复制一整套鉴权 + 一整套前端连接管理，而任务中心只是**同一会话主体的另一个
   订阅面**。ladder 第 2 级（仓内已有）直接命中。

2. **两个我造出来又修掉的 bug 都记进了注释**：① 同路径两个 get handler ⇒ axum panic；
   ② `block_in_place(|| block_on(...))` 把异步拗成同步。**第二个更阴**——它能编译、
   能跑，但占 blocking 池且藏死锁面。记下来比他后人再踩一次便宜。

3. **`empty` 与 `finished(0)` 分开是这个卡最容易被合并掉的细节**。看起来「都是 0 条」
   可以合并成一个态，但前者是「系统正常、没任务」（该给引导动作），后者是「有任务却
   一条都没推出来」（该给重试）。合并了用户就分不清该刷新还是该报障。

4. **骨架页替代全页转圈，改动只有 20 行但它是⑤的全部**。原先 `listQuery.isPending`
   就整页 `FeedbackState loading`——那是「纯转圈」，卡面明令禁止。改成骨架后，
   「≤300ms 出内容」与后端快慢**解耦**，这才是可断言的那部分。

5. **断言 a/b 的端到端部分我标未测，没写「已过」**。纯函数那半绿了（阈值、判据、
   文案、计数），但「真后端 5s 下首屏真的 ≤300ms」需要起栈注入延迟——归 e2e/农场。
   **改了代码 ≠ 验证了行为**，这话在本卡出现第三次了（前两次是缓存 P0 与 A1 收尾），
   值得变成口头禅。
