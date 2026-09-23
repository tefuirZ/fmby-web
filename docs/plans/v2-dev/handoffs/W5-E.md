# W5-E 前端两张卡交付说明

仓库：`fmby-web-main`（分支 `w/zcode/writer1-w5e-realtime`，从 origin/main `53b15e3` 起）
判据：`pnpm verify` EXIT=0；host **294 pass / 0 fail**（卡1 +9 / 卡2 +16）；shared 94 pass；component-size **0 违规**；零新依赖。

## 卡 1：FE-OPS-REALTIME-WS（commit `0f55580`）

**背景**：后端无需补 SSE——已有 `GET /api/playback/realtime/ws`（playback.rs:264）推 `playback.active_snapshot` / `playback.source_load_snapshot`（事件名与 V1 逐字一致）。真剩余 = 前端零消费点。

**改动**：
- 新增 `host/src/features/operations/useOperationsRealtime.ts`（188 行）：订阅 WS（`?scope=admin`，快照仅 admin 可见），消费两快照事件；失败 fail-closed + **重连指数退避封顶 15s**（不无限快速重连）；卸载真关连接且 `mountedRef` 守卫使卸载后不再 setState；非 JSON 帧丢弃不崩。决策逻辑抽为纯函数 `reduceRealtimeFrame` / `backoffMs`（可无渲染器单测）。
- 复用既有契约 mapper（`fromActivePlaybackSession`/`fromMountLoadItem`）做 snake→camel，新增 `fromActiveSnapshotEvent`/`fromMountLoadEvent` 两个 WS 事件专用 mapper（WS 快照不携带 cache_status/totalReturned/sampledAt，按诚实口径补 `live`/`unknown` 默认，不伪造观测）。
- `OperationsGapSections` 接实时快照（优先实时 > REST 回退），加「实时 / 离线·REST 回退」状态徽标。
- 契约测试 9 项：active_snapshot/source_load 真映射更新、退避序列 1s→2s→4s→…→15s、卸载不误 setState、坏帧不崩、mapper 复用。
- **静态映射**：事件名来自后端 envelope `type` 字段（逐字）；**真跑**：9 项单测 + 复用既有 operations 端点。
- MountTable.tsx 未触碰（394/400）；OperationsGapSections 225 行（<400）。

## 卡 2：NIGHT-FE-CRED-REBIND-HONEST（commit `d8eed72`）

**背景**：W5-C 已登记的真实后端硬缺口——① `helpers.rs:155` 的 expires_at 匹配仅微软分支 ⇒ 139/AList 挂载 `credential_status` 恒 bound（expired 不可达）；② 挂载 config 无 profile/account 关联键 ⇒ 不知重绑哪个档案；③ 无凭据重绑录入 UI。

**改动**：
- 新增 `providerRebindSupport`（credentialPresentation）：`microsoft` | `unsupported-gap` | `none` 三态。
- 新增 `CredentialRebindGapSection`（抽屉内区块，74 行）：139/AList 的 expired/unbound 时给**诚实缺口提示**（需后端先决能力，当前不可用），**不伪造重绑按钮**；提供只读回退（打开连接配置查看）。
- 微软分支保持既有 `MicrosoftRebindSection` 专用入口不变（providerRebindSupport 对微软返回 'microsoft'）。
- 契约测试 16 项：四态×provider 矩阵——① 微软 expired⇒真入口在 ② 139/AList expired⇒缺口提示在、**伪造按钮不在**（supportsMicrosoftRebind=false）③ not_required/bound/未知⇒两者都不显示 ④ 四态文案不泄漏密钥/密封引用。
- MountTable.tsx 394、MountDrawer.tsx 398（均 <400）；零新依赖。

## 诚实边界
- 卡 1 的 WS 挂载/卸载生命周期因本仓无 jsdom/@testing-library（零新依赖红线）未在集成层跑 React 渲染，决策逻辑以纯函数 reducer + backoff + parseFrame 真断言覆盖；连接开关由 typecheck + reducer 组合保证。
- 卡 2 仅做诚实提示，未自造任何后端字段或关联键；139/AList 真重绑仍待后端先决卡（W5-C 已登记）。
