# FE-HONESTY-P2 —— 前端诚实性两条（静默失真修复）

- **仓库**：`tefuirZ/fmby-web`（worktree `ws-zcode-writer1-web`）
- **分支**：`w/zcode/writer1-fe-honesty`（自 fmby-web `main` @ `e017a7c` 起）
- **owner**：w1
- **状态**：`ready`（待主代理 review）
- **不在本卡**：任何后端改动（跨仓缺口见 §3，请据此另立后端卡）

两条都是「后端有真值/请求会失败，但前端把它渲染成假的正常值」。

---

## ① `ManageOverviewPage.tsx` —— 会话失败被静默降级成「0 路」

**问题**：`sessionsQuery` 既不在 `isPending` 组（:129-135）也不在 `isError` 组（:143-148），
但**重试按钮却 refetch 它**（:169）——失败时 `sessionsQuery.data?.items ?? []` 把失败吞成空数组，
页面显示「0 路活跃流 · 无并发压力 · 待机中」，用户读到的是错误结论。

**修法（已做）**：

| 位置 | 改动 |
|---|---|
| `ManageOverviewPage.tsx:132` | `isPending` 组补 `sessionsQuery.isPending` |
| `ManageOverviewPage.tsx:148` | `isError` 组补 `sessionsQuery.isError`（与其余数据面同口径） |
| `ManageOverviewPage.tsx:164` | 错误文案链补 `sessionsQuery.error` |
| `ManageOverviewPage.tsx:234` | `activeStreamsCount` 失败时改 `null`（**不是** 0），表达「数据不可用」 |
| `OverviewKpiCapsules.tsx:7/33/36/40` | 类型改 `number \| null`；`null` 时主值显示 `—`、副文案改「会话数据不可用 · 无法判断」 |
| `LivePlaybackStreams.tsx` | 新增 `isError`/`errorMessage` props；错误态显示「在线会话数据不可用 · 无法判断当前是否有在线推流」，副标题改「（数据不可用）」而非「（0 个在线会话）」 |
| `ManageOverviewPage.tsx:330` | 把 `isError`/`errorMessage` 传给 `LivePlaybackStreams` |

`?? []` **保留**但语义已澄清（注释写明）：失败走上方 `isError` 短路返回错误态，
空数组只表达「尚未取到」，不再表达「真的 0 条」。

---

## ② `shared/.../mapping/records.ts` —— health 三项硬编码假值

**问题**：`version: "dev"` / `databaseStatus: "Healthy"` / `queueDepth: 0`。
其中 `databaseStatus: "Healthy"` 尤其危险——**后端数据库挂了前端也显示健康**。

**后端真值核实结果（2026-09-18）**：

1. 端点 `GET /api/manage/advanced` 在**契约仓** `features/implementation-status.md:105`
   登记为 **G-14「高级维护 —— 后端未实现」**；
2. 后端主仓全量 grep `manage/advanced` **零命中**（无任何路由/DTO）；
3. 前端 `RawManageAdvancedResponse` 的 raw 只有 `database` / `security` / `settings` /
   `refreshed_at` 四组，**没有** `version`、`database_status`、`queue_depth` 的对应字段。

→ 属「**没有真字段**」分支，按口径**不编**：

| 位置 | 改动 |
|---|---|
| `shared/.../manage/types.ts:467`（+ `types.d.ts` 同步） | `AdvancedSystemHealth` 三项改**可选**：`version?` / `databaseStatus?` / `queueDepth?`，注释写明「后端未提供，缺字段必须显示 —」 |
| `shared/.../mapping/records.ts:225` | 映射里**删除**三项硬编码，只保留 `lastBackupAt` + `configurationDrift`；注释写明后端 G-14 未实现 + 跨仓缺口指向本文 |
| `ManageAdvancedPage.tsx:75/79/86` | `version` → `?? '—'`；`databaseStatus` 缺值时不渲染 `StatusBadge`、改显示 `—`；`queueDepth` 非 number 时显示 `—` |

---

## ③ 自查清单：同型失真面（**本卡未改**，供你排期）

### A 类：硬编码/回落的「看起来正常」状态字符串

| 位置 | 现状 | 风险 |
|---|---|---|
| `shared/.../mapping/overview.ts:53` | `readString(raw.environment_status) ?? "healthy"` | **高**——后端 `/api/manage/overview` 真 DTO（`http/src/state/manage.rs:23` `OverviewDto`）**只有 5 个字段，不含 environment_status**，即该 raw 字段实际不存在 → 恒回落 `"healthy"`，与②同型 |
| `shared/.../mapping/shared.ts:17` | `mapEnvironmentStatus` 的 `default: "healthy"` | 同型（未知状态一律当健康） |
| `shared/.../mapping/shared.ts:29` | `mapEntityStatus` 的 `default: "attention"` | 中（回落为警告，比 healthy 保守，但仍非真值） |
| `ServerVitalsPanel.tsx:24-25` | 默认参数 `environmentLabel='生产环境'` / `environmentStatus='healthy'` | 中——调用方未传即显示「生产环境 + 健康」 |
| `overview.ts:66/79/86/93` | `totalItems > 0 ? "healthy" : "attention"` 等**由前端推导**的健康态 | 中——健康与否应由后端判定，前端按计数推导是伪真值 |

> 建议：**`environment_status` 那条优先级最高**（与②完全同型：后端字段不存在 → 前端恒显示健康）。

### B 类：`?? []` / `?? 0` 静默降级

已扫全部 `host/src/pages` 含 `useQuery` 的文件——**均有 `isError` 处理**（无「零 isError」文件），
本卡未发现第二处与 ① 完全同型的「query 不在 isError 组」。但以下值得排期复核（失败时回落到 0/空而非错误态）：

- `ManageOverviewPage.tsx:236` `totalMediaCount` 用 `?? 0`、`:237` 挂载 `!m.healthStatus` 视为 healthy
- 各列表页的 `(query.data?.items ?? [])` 形态较多，多数有 isError 短路，逐页复核属后续卡范围

---

## ④ 跨仓缺口清单（**请据此另立后端卡**）

| # | 缺口 | 前端现状 | 建议 |
|---|---|---|---|
| X-1 | `GET /api/manage/advanced` **后端未实现**（契约仓 G-14） | 前端页面已存在（`ManageAdvancedPage`），全部 health 字段只能显示 `—` | 后端补端点 + `version` / `database_status` / `queue_depth` 真字段 |
| X-2 | `GET /api/manage/overview` **不含** `environment_status` | 前端 `RawManageOverviewResponse` 声明了该字段但后端 `OverviewDto` 无此字段 → 恒回落 `"healthy"`（假健康） | 后端补 `environment_status`，或前端删除该字段声明（二选一，需裁决） |

---

## ⑤ 验证情况（如实登记）

- **未跑 pnpm 重活**（队列纪律，且本 worktree `node_modules` 未安装）。
- 轻量检查：用 npx 的 `tsc` 对 6 个改动文件做 `noResolve` 语法校验 →
  **零 TS1xxx 语法错误**；报出的全部是 `TS2307 Cannot find module`（无 node_modules
  导致的模块解析失败）与 JSX runtime 缺失，**与本卡改动无关**。
- **未做运行时验证**：无 node_modules，无法跑 dev/e2e。UI 文案与渲染需主代理在装好依赖的环境目视确认。
- 类型面：`AdvancedSystemHealth` 三项改可选后，`ManageAdvancedPage.tsx` 是唯一消费点，已同步改为「—」分支。

提交：**1 个 commit**（fmby-web）。
