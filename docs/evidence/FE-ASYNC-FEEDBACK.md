# FE-ASYNC-FEEDBACK —— 异步反馈 + 后台任务可见（用户裁定 · UI 卡）

> 用户原话：「点下去有反馈；前端文案要对应提示，包括后台任务展示；任务中心要展示后台在干什么，或日志里体现；不然用户懵逼，你直接卡死用户就傻了」。
> 纪律：只动 fmby-web ✓；不改后端契约 ✗（两处**前端契约层 bug** 属前端文件，已修，见 §3）；不跑 pnpm build ✓（e2e 栈内构建由 harness 执行）；一件一 commit ✓。
> 分支：`lovely-skunk`（共享 worktree；注意 w15-gateway 席同期在同 worktree 提交了任务中心流式 WIP，见 §5 协作记录）。

---

## §0 交付总览

| commit | 件 | 内容 |
|---|---|---|
| `8724655` | 反馈层 | `AsyncJobsProvider`（shared/ui/feedback）：submit 即 toast「已提交，正在后台执行（任务 #id）」+ 幂等（同 key running 拒绝）+ 成功/失败 toast + 429/503 高负载退避重试；AppShell 会话内挂载（发起人=当前用户） |
| `47c5c7d` | 任务中心 | 「后台任务」区（AsyncJobsSection）：任务名/发起人/状态/开始时间/耗时（走秒）/失败原因，进度列**有则显示**；失败可重试、已结束可移除；抽屉动作按钮接入反馈层并**解除共享 isPending 锁死** |
| `19153c6` | 权限变更 | 用户编辑保存走反馈层：提交即反馈 + 抽屉立即关闭（不再锁在表单）；重复提交幂等拒绝 |
| `733a872` | 契约修复①+验收 spec | updateUser 停发 `status`（后端 deny_unknown_fields 恒 422，见 §3）；UserEditForm 保存按钮解锁；e2e/async-feedback.spec.ts |
| `be6bafc` | 契约修复② | updateUser 兼容后端 **204 No Content**（原 mapUserRecord(undefined) 抛 `reading 'id'`）+ 取消按钮解锁 |
| （本提交） | 验收定稿 | spec 三用例全绿 + 本报告 |

## §1 E1 契约状态：**未落地 → 按模式设计，标注待对齐**

实测：后端 http 层现有 `job_id` 仅为域内专用（emby-import / upstream-sync），无通用「202 + job_id + jobs 列表」契约；前端 contracts 同样没有对应类型。

**已按 202+job_id 模式设计的前端形态**（E1 落地后逐项替换，Provider 对外语义不变）：

| 维度 | 当前实现（E1 未落地） | E1 对齐后 |
|---|---|---|
| 任务 id | 本会话本地序号 `job_<n>` | 服务端响应 `job_id` |
| 状态 | 前端 promise 生命周期推导 | 轮询/推送 jobs 端点 |
| 「后台任务」区数据源 | 本会话内存（整页刷新即失，已如实标注） | 服务端 jobs 列表（跨会话聚合） |
| 进度 | 无数据源，列「有则显示」恒隐藏 | 服务端 progress 字段 |
| 取消 | 未实现（模型留 `status: cancelled` 之外的路径：任务中心既有启停即服务端取消面） | cancel(job_id) |
| 提交请求 | 仍同步发真实请求（202 语义由前端「提交即反馈」模拟） | 服务端 202 + job_id |

## §2 验收断言与实测原文（e2e/async-feedback.spec.ts，真栈）

最终一轮：**3 passed (47.5s)**（chromium，真栈 = 农场二进制 + 真实 SQLite 种子 + vite 产物）。

断言要点（原文）与实测：

1. **① 提交即反馈 ≤200ms**：`expect(page.getByText(/已提交，正在后台执行（任务 #job_\d+）/)).toBeVisible({ timeout: 200 })` ✅（toast 同步入队，实测远低于 200ms）；
2. **按钮不被锁**：提交后 `保存修改` 按钮 `toBeHidden({ timeout: 2000 })` ✅（抽屉立即关闭，无转圈卡死）；
3. **② 任务中心可见**：SPA 导航到任务中心（goto 整页刷新会重置内存态——E1 边界，如实测得）→ `后台任务` 区 heading 可见 → 行含 `更新用户「e2e-async-job」` + 状态 `执行中` + 开始时间 `\d{2}:\d{2}:\d{2}` ✅；
4. **③ 完成状态变**：延迟 2.5s 的真实 PATCH 200 后 → 行状态 `已完成`、`执行中` 计数 0 ✅；且**落库断言**：用户列表出现新显示名「异步验收乙」✅（不是只改 UI）；
5. **幂等**：进行中重复提交 → `该操作已在执行中（任务 #job_\d+）` toast ≤200ms ✅、抽屉不关（submit 返回 null）✅、后台任务行**始终 1 行** ✅；
6. **④ 高负载**：route 注入 429 → `系统繁忙，已转后台执行，完成后通知你` toast ✅ → 反馈层 3s 退避自动重试 → 行 `已完成` 且无 `失败` ✅。

复现命令：

```bash
cd host
FMBY_E2E_SERVER_BIN=/data/fmby-e2e-bin/fmby-v2-server \
FMBY_E2E_SEED_BIN=/data/fmby-e2e-bin/fmby-e2e-seed \
FMBY_E2E_WEB_PORT=15180 FMBY_E2E_BACKEND_PORT=18199 FMBY_QUEUE_DISABLE=1 \
node node_modules/@playwright/test/cli.js test e2e/async-feedback.spec.ts \
  --project=chromium --reporter=list --timeout=90000
```

## §3 顺手揪出并修复的**先行契约 bug**（用户编辑保存此前从未成功过）

| bug | 证据 | 修复 |
|---|---|---|
| updateUser 多发 `status` 字段 | 真栈 PATCH → `422: unknown field 'status'`（后端 `UpdateUserFullRequest` deny_unknown_fields，无 status/有 roles 数组） | 契约层停发 status（状态变更本就有专用端点 manage_users_status + 确认门） |
| 后端 PATCH 返回 **204 无 body** | curl 实测 `patch=204`、响应体空 | 契约层 204 兜底回读 GET 详情（原 `mapUserRecord(undefined)` 抛 `reading 'id'`） |
| 保存/取消按钮 `disabled={isPending}` | e2e 失败快照：按钮 disabled 卡 8s | 解锁（幂等键接管重复提交；抽屉提交即关） |

> 这三个 bug 意味着**修复前用户编辑保存（权限变更主链路）在任何构建里都是恒 422/失败**——不是本卡引入，是真栈 e2e 第一次把它跑通时暴露的。

## §4 边界与已知限制（如实）

- 「后台任务」区当前只聚合**本会话**发起的任务（内存态，整页刷新即失）——E1 对齐前无法做到跨会话/服务端聚合，空态文案已如实标注；
- 进度列暂不显示（无数据源）；
- 真取消（服务端 cancel）未接：任务中心既有启停/取消按钮本身就是服务端取消面，走同一反馈层可见；
- 用户编辑表单内的「状态」下拉改动仍会被忽略（该控件自始未工作——状态走专用确认流程）；本卡不扩大范围。

## §5 协作记录

本卡执行期间，w15-gateway 席在同一 worktree/分支提交了任务中心流式 WIP（`ea42983` feat + `a307749` docs）与未提交流文件（`useTaskCenterStream.ts` 等，其 tsc 错误与本卡无关）。本卡提交严格限定在自身文件（git add 逐文件）；一次 `--amend` 误叠到他席 commit 已用 reflog 还原（`a307749`）并独立重放，w15 内容零损失。

## §6 ponytail（跳过了什么 / 何时再加）

- **跳过**：AbortSignal 取消管道（模型取消需要 run fn 配合；E1 对齐时一并做）。
- **跳过**：批量编辑/批量停用接反馈层——批量已有 `BatchProgressPanel` 逐条进度（可见性已达标）；接法与单条相同，待有第二处真实卡点再统一。
- **跳过**：jobs 持久化到 sessionStorage——E1 落地后状态来自服务端，本地持久化是弃子工程。
- **未跑**：`pnpm verify`（他席 WIP 的 tsc 错会挡全量 typecheck；本卡文件单独 tsc 0 错 + e2e 真栈 3/3）。

---

## §7 降级路径 e2e 补录（2026-10-20 · task-center-degradation.spec.ts）

> 新增 `host/e2e/task-center-degradation.spec.ts`（4 用例）——补 async-feedback.spec 未覆盖的
> 「可以慢，不能空」红线两条：① 数据源 5s 延迟仍 ≤300ms 出内容；② WS 不可用 + >3s ⇒
> 降级文案 + 重试。真栈两轮复跑原文（农场二进制 2026-10-16 构建 + 真 SQLite 种子）：

```text
第 1 轮：4 passed (1.1m)
第 2 轮（复跑验证稳定性）：
  [①] click=199ms  click→h1可见=321ms  (预算 ≤300ms)
  ✓ 1 ① 数据源 5s 延迟 ⇒ 点开后 ≤300ms 仍出内容 (3.6s)
  ✓ 2 ② 数据源 >3s 且 WS 不可用 ⇒ 出现降级文案 + 重试按钮 (7.5s)
  ✓ 3 ③ WS 不可用但数据最终到达 ⇒ 降级态被真实数据取代 (8.7s)
  ✓ 4 ④ 点重试 ⇒ 重新拉取并出内容（降级不是死路） (11.2s)
  4 passed (34.9s)
```

复现命令：

```bash
cd host
FMBY_E2E_SERVER_BIN=/data/fmby-e2e-bin/fmby-v2-server \
FMBY_E2E_SEED_BIN=/data/fmby-e2e-bin/fmby-e2e-seed \
FMBY_E2E_WEB_PORT=15186 FMBY_E2E_BACKEND_PORT=18206 FMBY_QUEUE_DISABLE=1 \
node node_modules/@playwright/test/cli.js test e2e/task-center-degradation.spec.ts \
  --project=chromium --reporter=list --timeout=60000
```

诚实边界：
- 农场二进制早于后端 WS task_center 端点 commit ⇒ ①③④ 断言的是「WS 不可用降级正确性」
  （route.abort 全部 realtime/ws）；「WS 真推分批数据」需新二进制，标**测不出**；
- ① 的计时口径：click→h1 可见 = 321ms 超预算 300ms，但断言按用户感知段
  （tPaint - tClick，click 段 199ms 是 Playwright 可操作性等待）⇒ 122ms ✓；
  spec 注释里记了首版把 locator 解析算进计时的假红教训；
- hook 修复（armStallTimer 无条件 setStalled(false)）为**代码审查发现+防御性修正**：
  stale closure 使 fetchPage 路径永不复位 stalled；该场景未做 e2e 复现，不冒充实测结论。
