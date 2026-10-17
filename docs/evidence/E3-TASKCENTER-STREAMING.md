# E3 前端半边 · 任务中心「可以慢，不能空」交付说明

> 卡：`E3-任务中心WS流式增量渲染` §5–9（前端半边，**只动 fmby-web**）
> 用户裁定红线：**可以慢，不能空** ✗ —— 点开什么也看不到 = 必被骂 ✗
> 分支：`feat/e3-task-center-streaming`（PR 分支；基 `origin/main` @ `591eb0a`）
> 原开发分支 `slim-unicorn` 已 rebase 到 main 后拆成两个 PR（本卡 = 其一）。

---

## 0. 一页结论

| 卡面条目 | 状态 | 证据 |
|---|---|---|
| §5 点开 ≤300ms 必出内容（骨架或首批） | ✅ 实测 | DOM `§5/验收a`（人为 5s 延迟仍 ≤300ms 出骨架） |
| §6 每批 append +「已加载 N 条 · 仍在加载…」/「共 N 条」 | ✅ 实测 | DOM `§6/验收c+d`（轨迹 `[0,1,3,4]` 逐批） |
| §6 进入动效可关闭 | ✅ | 单测 `§6 进入动效`（reduced-motion 关） |
| §7 3s 无数据 ⇒ 降级文案 + 重试 +「任务仍在后台执行」 | ✅ 实测 | DOM `§7/验收b` |
| §8 空态明确写「当前没有运行中的任务」+ 引导动作 | ✅ 实测 | DOM `§8/验收d` |
| §9 权限变更/启停等异步 job 实时可见（WS） | ⚠ **测不出** | 后端 WS 当前只推 playback 七类事件，**无 task-center 事件** ⇒ 本轮用注入式 seam + 分页轮询降级（卡面 §4 授权），真 WS 等后端补事件 |

---

## 1. 实现（7 文件，只动 fmby-web）

| 文件 | 作用 |
|---|---|
| `task-center/hooks/useTaskCenterStream.ts` | 六态机（loading/streaming/stalled/done/empty/error）+ 纯函数（`mergeBatch` / `nextStatusAfterBatch` / `buildStreamStatusText`） |
| `task-center/hooks/streamPolling.ts` | 卡面 §4 的**分页轮询降级**适配器（WS 不可用时仍分批出；封顶 5 页防分钟级空转） |
| `task-center/components/TaskCenterStreamBoard.tsx` | 流式壳：顶部计数条 + 骨架 + 降级块 + 空态块 + 行区（`children` 注入既有表格） |
| `task-center/components/TaskCenterStreamBoard.module.css` | 三档样式 + 骨架 + 动效（reduced-motion 可关） |
| `task-center/hooks/index.ts` / `components/index.ts` | 桶导出 |
| `ManageTaskCenterPage.tsx` | **接线**：删掉整页 loading 早退；首页走流式、翻页走既有分页 REST |
| `useTaskCenterQueries.ts` | `useListQuery` 增 `enabled`（首页交给流式，避免同一数据被两条路径各拉一次） |

### 为什么首页走流式、翻页仍走分页 REST
同一页数据不被两条路径各拉一次（`useListQuery` 在 `page===1` 时 `enabled:false`）。
翻页语义不变（既有 `TaskCenterList` 分页控件继续用），用户翻到第 2 页时不再流式重灌首页。

### 行区为什么用 `children` 注入而非自带行
`TaskCenterList` 被两个既有用例引用（`tablewrap-region-audit` 双向名单比对、`table-row-keynav` 真组件接线）⇒ 删它属跨卡改动。用 `children` 把「流式壳」与「行渲染」解耦：表格/移动卡双分支 + 行键盘漫游全保留。

---

## 2. 验收断言原文（DOM · 真 Chromium）

跑法：`node --import ./tests/register-aliases.mjs --test tests/task-center-streaming.dom.test.ts`

```
ok 1 - §5/验收a：后端 5s 才出首块，≤300ms 内必须有骨架内容（禁白屏/纯转圈）
ok 2 - §6/验收c+d：每批到达即 append（计数正确）+ 顶部「已加载 N 条 · 仍在加载…」
ok 3 - §7/验收b：3s 无任何数据 ⇒ 降级文案 + 重试按钮 +「任务仍在后台执行」
ok 4 - §8/验收d：空态必须写「当前没有运行中的任务」+ 给引导动作（不许空壳）
# tests 4
# pass 4
# fail 0
```

### 验收 a 的复现条件（人为 5s 延迟）
探针 `window.__SCENARIO__='slow'` ⇒ `loadFirstBatch` 用 `setTimeout(..., 5000)`。
断言只要求「骨架行在 DOM 里且非零」+「骨架有可读文案」，**不**要求数据到达。

### 逐批轨迹原文（§6/验收 c，`__HISTORY__` 实录）
```json
[{"n":0,"text":"正在装载任务…"},{"n":1,"text":"已加载 1 条 · 仍在加载…"},{"n":3,"text":"已加载 3 条 · 仍在加载…"},{"n":4,"text":"共 4 条"}]
```
⇒ `n` 单调不降（append 不是覆盖）、中间态可观察（1、3 都出现）、终态 4 条。

---

## 3. 断言非空转证伪（红侧实测）

三处变异逐一打挂对应用例（改完即还原，`diff` 已核）：

| 变异 | 结果 | error 原文 |
|---|---|---|
| append → 覆盖（`[...appended]`） | ❌ `not ok 2` | `行数轨迹必须单调不降（append 不是覆盖），实际 [0,1,2,1]` |
| 骨架不渲染（`{false ? (`） | ❌ `not ok 1` | `≤300ms 必须出现骨架行（实际 0 条）——纯白屏/纯转圈都不算「有内容」` |
| 降级不触发（stall 判定改 no-op） | ❌ `not ok 3` | `page.waitForSelector: Timeout 8000ms exceeded. waiting for locator('[data-testid="tc-stalled"]')` |

---

## 4. ★本卡自查抓到的两个「谎报」口子（都在我自己写的代码里）

这是本卡比性能数字更重要的部分——**两个 bug 都是本卡自己造出来的，且都由轨迹自查抓到**：

1. **首帧谎报空态**：只按 `loaded===0 && !hasMore` 判空 ⇒ 首帧（骨架还在跑）就说「当前没有运行中的任务」。
   轨迹 `n=0` 那一格实测正是这句。**修法**：`buildStreamStatusText` 必须吃 `status`（loading/stalled 只能说明「正在装载」），
   「没有任务」只准由 `status==='empty'` 说。
2. **`total>0` 却 0 条的谎报**：`loaded=0 && total=5` 仍说「没有运行中的任务」，与后端自报的 `total` 自相矛盾。
   **修法**：done 且 loaded=0 但 total>0 ⇒ 说「未取回任务数据（后端口径共 5 条）」。

两个口子都有单测守卫（`★自查抓到的谎报…` / `★第二个谎报口子…`）。

---

## 5. 测不出 / 未做（诚实登记）

| 项 | 状态 |
|---|---|
| §9 真 WS task-center 推送 | **测不出**：后端 `PlaybackRealtimeEventType` 只有 7 类 playback 事件（`crates/fmby-v2-application/src/playback/realtime.rs:37`），无 task-center 事件 ⇒ 连不上就不是推送。已做成注入式 seam（`subscribeBatches`）+ 分页轮询降级，后端补事件后只换注入实现，UI/hook 零改 |
| 真后端下的首屏耗时 | **未测**：探针用假 loader 注入 5s 延迟，不测真实 HTTP 往返（不跑 `pnpm build`，构建归主代理；真栈首屏需农场 e2e） |
| 动效的「可关闭」UI 开关 | **未做**：走系统级 `prefers-reduced-motion`（YAGNI，不为一个提示动效造设置项） |
| 第 2 页起的流式 | **未做**：翻页语义已由既有分页 REST 覆盖，第 1 页才需要「尽快出内容」 |

---

## 6. ponytail 段

1. **没接真 WS**。后端没有 task-center 事件，接上去只会 3 秒后走进降级——那是骗人。卡面 §4 明写「WS 不可用自动退回分页轮询」，所以本轮直接把轮询当默认实现，WS seam 留着。等后端事件就位，只换 `subscribeBatches` 的注入内容。
2. **流式封顶 5 页**（≈100 条）。不封顶的话 5000 条 = 250 页 × 600ms ≈ 2.5 分钟空转，反而制造「无限转圈」。封顶后 done 文案如实写「已加载 N 条（后端口径共 M 条）」——两个数都给，不假装显示完了。
3. **`hasMore` 从 board props 里删了**。它和 `status==='streaming'` 冗余，传两个真源迟早对不上。文案只吃 `status + loaded(+total)`。
4. **`useListQuery` 加 `enabled`** 而不是删掉它：翻页还要用，只是首页交给流式。disabled 时 react-query 的 `isPending` 恒真 ⇒ 调用方不能再拿它做整页早退（这正是本卡拆掉的东西，注释里写明了）。

---

## 7. 验证记录

| 项 | 结果 |
|---|---|
| `task-center-streaming.unit.test.ts` + `.dom.test.ts` | **25/25 pass**（21 单测 + 4 真 Chromium DOM）——rebase 到 `591eb0a` 后重跑 |
| `tsc -p host/tsconfig.app.json --noEmit` | **本会话未跑**（席位纪律：类型检查/构建由编排侧执行）⇒ 交卡请求代跑，不得当作已绿 |
| `tablewrap-region-audit.test.ts` | **4/5**：A④「aria-label 名单」红，原因是名单里有 `ManageCasPage.tsx::盘配置（CAS 矩阵）` 而代码已无 ⇒ **main 存量红**，与本卡无关（本卡未触及任何 `cas*` 文件） |
| 全量 `tests/*.test.ts` | **824 tests / 820 pass / 4 fail**，4 条失败全为 main 存量红（`cas-admin-page.contract` ⑦⑧、`cas-drive-write-affordance` ④、`tablewrap-region-audit` A④） |
| `check-frontend-component-size` / `check-frontend-dupes` / `check-contract-mappers` / `check-versions` / `check-repo-size` | 本会话未重跑（原分支记录为 PASS）；请求编排侧随 PR 门禁复跑 |
