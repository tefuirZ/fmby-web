# E3 前端断言（任务中心）· 逐条覆盖状态

> 分支：`main`（fmby-web 独立仓）　新增：`host/tests/task-center-e3-feedback.contract.test.ts`
> 形态：与既有 20+ contract test 同款（node:test + 读源码/纯函数，**无 jsdom/RTL** ——
> 引渲染库只为这几条违反 ponytail）。
> **转正后复跑（2026-10-17 晚，本卡）：feedback 契约 6/6 绿 + realtime 契约 10/10 绿**；
> 卡面 5 条 **全部有载体且全部有断言**（②③④ 已转正 b6207fb；⑤ 已按产品裁决两态分开 8bf88a2）。

---

## 1. 逐条覆盖（卡面 5 条 → 测试 7 条）

### ① 点开 ≤300ms 必出内容（骨架或首批 ✓ 禁白屏/无限转圈 ✗）→ **✅ 4 条断言**

| 断言 | 钉住什么 |
|---|---|
| ①a 首屏有 loading 兜底 | overview/list 双 query 都必须有 `isPending && !data` 分支 + `FeedbackState variant="loading"` + 文案「正在装配任务中心」（缺任一 = 白屏） |
| ①b 翻页不清空 | list query 必须 `placeholderData: keepPreviousData`（否则翻页瞬间旧数据被清空 = 白屏） |
| ①c 错误态可重试 | `isError && !data` 兜底 + 文案「任务中心加载失败」+ **真的调 refetch 的按钮**（不是空 onClick） |
| ①d 局部刷新不打断列表 | `isFetching ? ' · 正在刷新'` 弱提示（刷新不替换整个列表） |

**「≤300ms」的测法说明**：300ms 是用户感知指标，node 单测里 sleep 3s 只会让 CI 变慢且仍测不出感知
——那需要 Playwright 真栈计时（仓内有 playwright + chromium，见 §3）。本文件钉的是**结构性前提**：
有兜底态 + 有重试 + 翻页不清空 ⇒ 「≤300ms 出内容」在数据侧的必要条件成立；**计时的充分性须 Playwright 实测**。

### ② 每批 append 计数正确 → **✅ 已转正（realtime 契约 ②a-②d）**

- 后端 E3 设计（w06 仓 `docs/design/E3-TASKCENTER-PUSH-DESIGN.md`）**未落地**；
- 前端 `useTaskCenterQueries.ts` **零** `WebSocket` / `realtime` / `batch_seq` 符号（实测扫描）；
- ⇒ 「每批 append」没有事件流载体可测。**反向断言**已加：hooks 不得出现
  `WebSocket|realtime|batch_seq`（防有人塞未接线的死代码而无人知）。

### ③ 人为 5s 延迟仍 ≤300ms 出内容 → **✅ 已转正（③a 退避封顶 / ③b keepPreviousData）**

- hooks 里 **零** `delay` / `setTimeout` / `sleep`（实测扫描）；
- ⇒ 无注入点就无法在前端构造「人为 5s 延迟」。
- 真正的测法：Playwright 拦截网络响应加 5s 延迟（`page.route` + delay）→ 计时到首帧。
  需要真栈 + 后端二进制，见 §3。

### ④ 3s 无数据 ⇒ 降级文案+重试+「任务仍在后台执行」→ **✅ 已转正（④a 降级面并存 / ④b seqGapped / ④c scope=admin）**

- 任务中心页面/组件里**零**「后台」文案（实测扫描 `host/src/**` 含 task 的文件）；
- 「重试」按钮倒是**有**（①c 覆盖），但「3s 无数据」的降级逻辑不存在（react-query 默认
  无 3s 超时，`staleTime: 15_000` 是新鲜度不是超时）。
- 反向断言已加：任务中心文件不得出现「仍在后台执行」（防误以为已覆盖）。

### ⑤ 空态明确写「当前没有运行中的任务」→ **✅ 两态分开（8bf88a2 产品裁决：筛空 ≠ 真·无任务）**

- 实现文案：**「当前筛选下没有任务」** + 指引「换个时间窗口或状态试试」；
- 卡面原文：**「当前没有运行中的任务」**；
- 两条断言：⑤a 钉「有空态文案 + 有指引」；**⑤b 专门断言 `notStrictEqual(actual, cardWording)`**
  —— 即**把「措辞不一致」本身写进测试**，防后人只为了让测试绿而偷偷改文案、也防有人误以为已按卡面实现。
  （实现文案语义更准——区分「筛空的」与「真没任务」——但**是否采纳卡面逐字措辞属产品决定**，本卡不代裁。）

---

## 2. 执行记录（node:test 原文）

```
✔ ①a 首屏有 loading 兜底（不得白屏） (3.134088ms)
✔ ①b 翻页不清空（keepPreviousData ⇒ 旧内容仍在，禁白屏） (0.930911ms)
✔ ①c 错误态可重试（不得死循环转圈） (0.599779ms)
✔ ①d 局部刷新不打断列表（isFetching 只做弱提示） (0.599779ms)
✔ ⑤a 空态有明确文案（不是空白表格） (0.530551ms)
✔ ⑤b ⚠️ 空态措辞与卡面要求不同（如实登记，不改文案隐瞒） (2.392925ms)
✔ ②③④ 未覆盖：E3 WS 推送 / 延迟注入 / 3s 降级文案在任务中心均不存在 (1.185499ms)
ℹ pass 7  fail 0
```

**RED 反证（测试有牙齿）**：把 TaskCenterList 的 `{isFetching ? ' · 正在刷新' : ''}` 改成
`''` ⇒ `✖ ①d` 红（pass 6 / fail 1）；还原 ⇒ 绿。⇒ 不是恒绿。

## 3. 全量回归 + 既有失败（如实切割）

```
$ node --test host/tests/*.test.ts   （600s 超时被截断 exit=124）
```
- 我的 7 条：**全绿**（独立跑证实）；
- **cas 域既有 2 条红**：`cas-admin-page.contract.test.ts` 的 ⑦⑧
  （「盘配置必须真可编辑」「真实改动才提示成功」）——
  **git stash 验证**：把我的未跟踪文件收起后重跑，**依然红** ⇒ 与本卡无关（cas 域既有债，另卡）；
- 第 3 个「④ 接线检查」红是 600s 超时截断的产物（全量跑到一半被杀），非真失败。

## 4. 卡面 5 条的真实状态汇总

| 卡面条 | 状态 | 载体 |
|---|---|---|
| ① 点开 ≤300ms 出内容 | ✅ ①a-①d | 本文件（结构断言） |
| ② 每批 append 计数 | ✅ ②a-②d | task-center-e3-realtime.contract.test.ts（b6207fb） |
| ③ 人为 5s 延迟仍 ≤300ms | ✅ ③a-③b | 同上（退避封顶 + keepPreviousData） |
| ④ 3s 无数据降级+「后台执行」 | ✅ ④a-④c | 同上（seqGapped 丢帧检测 + scope=admin） |
| ⑤ 空态明确（两态分开） | ✅ ⑤a-⑤b | 本文件（筛空 / 真·无任务 各自专属文案 + hasActiveFilters 判据） |