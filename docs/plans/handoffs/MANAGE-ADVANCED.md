# HANDOFF：MANAGE-ADVANCED 前端对位修复（revoked_sessions NaN + settings 接线 + 假值回归）

- **owner**：w1（前端仓 worktree ws-zcode-writer1-web，分支 `fix/w1-manage-advanced` 自 fmby-web origin/main）
- **级别**：P2（VERIFY-SEMANTICS 同批诚实性）
- **后端对位**：GET /api/manage/advanced（w2，settings 组 7 项真值直出）
- **交付**：1 commit（4 文件 +31/−14）；未跑 pnpm 重活（纪律）

## 1. revoked_sessions NaN 风险（①裁决修法）

- **根因**：后端诚实省略 `security.revoked_sessions`（V2 吊销 = 对 `access_session`
  物理 DELETE，无行可数；RB-4 不伪造——后端 dto/manage_advanced.rs:43-46
  `Option` + `skip_serializing_if`）。而 `mapAdvanced` 无条件
  `raw.security.revoked_sessions + raw.security.expired_sessions` →
  `undefined + number = NaN` → UI 渲染「当前共有 NaN 个…」。
- **修法**（records.ts review-sessions 项）：`revoked_sessions === undefined` 时
  整体回落文案「过期会话可复核；已吊销会话计数后端暂无法统计。」——**不显示 0
  编造「无已吊销会话」**，两值齐备才渲染计数。
- **raw-types.ts**：`revoked_sessions` 必填 `number` → 可选 `?`，与 wire 真实形态
  对齐。

## 2. settings 组接线核对（②）

- 后端 `ManageAdvancedSettingsDto` **7 项**（含第 7 项
  `compat_legacy_session_fallback_enabled`，V1 逐字对位）。
- 前端 `mapAdvanced` 对 settings 的消费面（既有，无缺失）：
  - riskItems：`sensitive_action_confirmation` / `registration_enabled`；
  - configurationDrift：`user_session_ttl_seconds < admin_session_ttl_seconds`。
  → **settings 已接线**，后端真值直出后 UI 自动受益，无需新增映射。
- 前端 UI 无 settings 直出面板（`ManageAdvancedResponse` 仅
  health/riskItems/maintenanceActions 三组，前端契约结构如此）。
- raw-types.ts 补第 7 项 `compat_legacy_session_fallback_enabled?: boolean`
  （可选：旧后端可能省略）；`token_rotation_enabled` / `login_rate_limit_enabled`
  前端暂无消费位（类型保留，不扩 UI——超本卡范围）。

## 3. 过时假值回归检查（③）

- **version:"dev" / databaseStatus:"Healthy" / queueDepth:0 在本 main 线仍然
  存在**（records.ts:227-229）。背景：FE-HONESTY-P2（baf7cf1）修复在
  `w/zcode/writer1-fe-honesty` 线，**尚未合入本 main**；非「复活」而是两线
  差异。后端 wire 已核实无 version/databaseStatus/queueDepth 对应字段。
  → 本卡**顺带在同函数修掉**（同文件同口径）：三项省略 = undefined 由 UI
  显示「—」；`AdvancedSystemHealth` 三项改可选；ManageAdvancedPage 健康卡
  三格补 `?? "—"` 回落（databaseStatus 缺值不渲染状态徽章，避免
  `.toLowerCase()` 对 undefined 抛错）。
- 回归扫描：全仓无第二处 `"Healthy"` / `"dev"` 硬编码（mapping/page 层）。
- **登记不扩卡**：overview.ts:53 `environment_status ?? "healthy"` 恒回落——
  FE-HONESTY-P2 handoff 已登记的 A 类同型失真（跨仓缺口 X-2：后端 OverviewDto
  无此字段），待后端 X-2 一并处理。

## 4. 跨仓缺口登记（不是 bug，是设计决定）

**V2 `security.revoked_sessions` 永久无源**：V2 会话吊销 = 物理 DELETE
（access_session 无 status/revoked 列），吊销行不存在 → 无法计数。后端以
`Option + skip_serializing_if` 诚实省略；前端本卡回落文案。若未来产品需要
该计数，需 V2 后端引入会话状态列（迁移 + 保留策略），属产品决策非缺陷修复。

## 5. 验证

- `tsc --noEmit --noResolve` 对 4 个改动文件：零 TS1xxx 语法错（报出均为
  TS2792/TS2307 模块解析类，noResolve 模式预期）。
- 未跑 pnpm build/dev（纪律）；未做运行时验证。

## 6. .d.ts 伴生文件漂移（登记，非本卡）

`shared/src/contracts/manage/*.d.ts`（types.d.ts / mapping/records.d.ts）是
skeleton 期一次性生成后未再随 .ts 更新（单 commit 7f64b5a），本次 .ts 改动
未同步 .d.ts（历史惯例即不同步）。建议后续卡统一处理：生成或删除。
