# FE-SYNC FOLLOWUP —— pnpm typecheck 基线 + 运营看板接线核对
> ⚠ 本文部分结论已被后续卡推翻/与现状不符（见 `docs/FE-REPO-DOC-CLAIM-AUDIT.md` §3；以当前 `shared/src/contracts/**` + `host/src/**` 代码为准）。

- **分支**：前端仓 `w/zcode/writer3-fe-followup`（基于 main `6d882e9`）
- **环境突破**：`pnpm install` 的 EACCES 根因 = 我的 worktree 由 root 建、全 root 属主；pnpm 经 `fmby-queue` 降权到 tefuir 后无法在 root 目录写 `_tmp`。`chown -R tefuir:tefuir` 对齐 w1 前端 worktree（属主 tefuir）后安装与 typecheck 均正常。**这解释了「主代理环境也未跑通」**。

---

## 1. pnpm typecheck 基线（修复后全绿）

```
shared typecheck:  Done
themes/_template:  Done
themes/darkroom:   Done
host typecheck:    Done
pnpm contracts:    PASS 0 violations
pnpm dupes:        PASS 0 violations
```

### 修的 5 处（全部是既有基线问题，非本卡/上一卡引入；git blame 指向 `bc7a216`/`2a02d55`）

| # | 文件:行 | 错 | 根因 | 修法 |
|---|---|---|---|---|
| 1 | `shared/contracts/manage/mapping/overview.ts:60` | TS2345 `string\|null` → `string` | `readString()` 返回 `string\|null`，而 VERIFY-SEMANTICS 诚实化改动的守卫只判 `=== undefined` → `null` 漏过进 `mapEnvironmentLabel(raw: string)` | 守卫改 `== null`（null 与 undefined 同属「wire 缺值」诚实语义） |
| 2 | `overview.ts:77` | TS2345 | `mapEnvironmentStatus(raw: string\|undefined)` 收不了 `null` | `mapEnvironmentStatus(environmentStatus ?? undefined)` |
| 3 | `shared/contracts/manage/mapping/scans.ts:45` | TS6196 `RawScanTriggerTask` 声明未用 | **真漂移**：`RawManageScanTriggerResponse.tasks` 被标成 `RawManagedScanTaskRecord[]`，但后端真 wire（`http/state/scan_trigger.rs:26-39` `ScanTriggerResponse`）是 `{mountId,taskKey,taskId,created}`——w1 写的诚实接口 `RawScanTriggerTask` 反而没挂上 | 接口权威上移 `raw-types.ts`；`tasks: RawScanTriggerTask[]`；`mapScanTriggerTask` 签名由 `raw: unknown` + 手工 as-record 兜底改为 `raw: RawScanTriggerTask`（删掉 6 处 `"unknown"` 兜底编造） |
| 4 | `host/pages/manage/ManageOverviewPage.tsx:338` | TS2339 `error` on `never` | FE-HONESTY-P2 ①把 `sessionsQuery.isError` 纳入 :152 的**整页 early return**，到达 :336 时 `isError` 恒 false、TS 收窄 `error: never` → `LivePlaybackStreams` 的 `isError`/`errorMessage` 是死 props | 删死 props（错误态已由整页 early return 兜住，行为不变）+ 注释说明 |
| 5 | `host/pages/manage/ManageSystemAboutPage.tsx:40` | TS2741 缺 `children` | `ManageSectionCardProps.children: ReactNode` 必填（既有设计，其余 6 处用例都传），w2 新增页的 loading 分支自开标签 | 补 `<span />` 占位，不改组件契约 |

## 2. 运营看板（w2 的 2a02d55）接线核对 —— **推翻卡面前提**

**卡面说「w2 已接运营看板两卡」，实测只接了一半。**

`git show 2a02d55 --stat` 的 10 个改动文件**不含 `ManageOperationsPage.tsx`**——commit message 声称「ManageOperationsPage 挂『活跃快照』『数据源负载』两卡」，但页面层的 5 个 `ManageSectionCard` 仍是：总体概览 / 热播榜 / 活跃用户榜 / 趋势 / 失败态——**两卡未挂**。

| 层 | 状态 |
|---|---|
| 契约层（`shared/contracts/manage/operations/*`） | ✅ 完整：`RawOperationsActiveSession`(10 字段) / `RawOperationsActiveSnapshot` / `RawOperationsDataSourceLoadItem`(6 字段) + 三个 mapper + `overview()` 返回含 `activeSnapshot`/`dataSourceLoad` |
| 页面层（`host/pages/manage/ManageOperationsPage.tsx`） | ❌ 零消费（我的上一卡「前端零消费」登记**未过时**，只是零消费的位置从 shared 上移到页面层） |

### 契约层字段 vs 后端手拼 `json!` 逐字段对拍（类型/可空性）

后端 `http/routes/manage_operations.rs:96-119`，取值实为 `application/operations.rs:73-95` 的 `ActiveSessionDto`/`DataSourceLoadDto`（**全部 String**，非 EntityId——EntityId 无 Serialize，手拼段能编译正是因为 DTO 层已转字符串）：

| 字段 | 后端 | 前端 Raw | 判定 |
|---|---|---|---|
| sessionId | String | string | ✅ |
| userId / itemId | String（DTO 已转，非数字） | string | ✅ |
| username / title | String | string | ✅ |
| paused | bool | boolean | ✅ |
| positionTicks / durationTicks | Option\<i64\> | `number \| null` | ✅ |
| startedAt / updatedAt | i64 epoch ms | number | ✅ |
| activeSessionCount / runningTasks | u64 / i64 | number | ✅ |
| dataSourceLoad: mountId/mountName/providerType | 全 String | 全 string | ✅ |
| dataSourceLoad: activeSessionCount/playingCount/pausedCount | i64 | number | ✅ |

**结论：类型层零错，无需修。** 缺的是 UI 接线——属能力闲置（上一卡规矩：登记不改），**本卡不改页面**（避免擅自加功能 + 与 w2 在途工作撞车），登记 INBOX 建议项。

### 附带登记（潜在真 bug，非本卡范围）

`fromActiveSnapshot(raw.activeSnapshot)` 无缺值容错：后端端口未装配/旧版本返回不含 `activeSnapshot` 时 mapper 会崩。既有风格（`raw.hotItems` 等同样直取）一致，故未改——建议随 UI 接线卡一并加 `raw.activeSnapshot ? ... : 空快照` 兜底。

## 3. 诚实未验证项

1. 未跑 `pnpm build` / `pnpm test` / `theme-parity` 等 verify 其余项（本次只跑了卡面要求的 typecheck + 两个轻量静态门禁）——需主代理补跑完整 `pnpm verify`。
2. `chown -R tefuir` 改变了 worktree 全部文件属主（与 w1 worktree 惯例一致），若主代理合并流程对属主敏感需知悉。
3. UI 层行为（两卡未挂的视觉结论）来自 grep + git diff 双重确认，未起 dev server 目视。
