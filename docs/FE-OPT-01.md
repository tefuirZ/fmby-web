# FE-OPT-01 前端体感优化第一批（w2 交付 · 前端仓 w/fe-opt-01）

> 基线：fmby-web main @ `b970f6f`。采样环境：真实 fmby-v2-server（perf-seed 200 节点）
> + vite dev（:5181，经 `/api`、`/themes` proxy）。工具：`scripts/perf/fe-opt-bench.mjs`
> （playwright chromium + performance API，N 次采样取 p50/p95/min/max/mean）。

## 八行报告

- **任务结论**：① 路由级 hover/focus 预取（`prefetch.ts` routeLoaders 30 项 + TopBar/ManageLayout 导航接入）+ 图片懒加载补齐（5 处 `loading="lazy" decoding="async"`）；② 设置页表单乐观更新（onMutate 即时反馈 + 失败回滚）+ 删除媒体库乐观移除（列表缓存即时删行）+ 危险操作 pending 态核实已有；③ **主题切换零闪烁真修复**（根因：先卸旧 CSS 再注新的回落空窗 → 双缓冲 + IIFE 主题产物 + dev `/themes` 代理）+ 导航返回栈核实（PlayPage 已有 navigate(-1)、路由栈由 react-router 天然维护）；④ 全部指标 before/after 双份 JSON 采样落盘。
- **修改范围**：host/src/theme/{ThemeProvider,registry}.ts、host/src/app/router/{prefetch.ts(新),index.tsx 未动}、TopBar/ManageLayout、settings/components.tsx、useLibraryMutations.ts、5 处 img 懒加载、themes/*/vite.config.ts（ESM→IIFE）、vite.config.ts（/themes 代理）、check-frontend-size.mjs（[3c] IIFE 断言）、scripts/perf/fe-opt-bench.mjs（新）、docs/fe-opt-bench-{before,after}.json。
- **测试**：pnpm verify 11 闸全绿（versions/typecheck/build/build:themes/test/size/dupes/contracts/theme-budget/theme-parity）；themes/darkroom node:test 14/14；shared 49 pass。
- **门禁**：size 179KB<300KB PASS；[3b] 内容反查 PASS；[3c] IIFE 产物断言 PASS。
- **Review**：主题 IIFE 化是本卡最大的形态变更（ESM 裸说明符在浏览器不可执行——初始激活实测报 "Failed to resolve module specifier react"），IIFE + globals 是无 importmap/无 CDN 依赖下的唯一离线可用形态；react 外部化纪律由 size 闸 [3c] 字节量+内部 API 字符串双重断言守住。
- **风险登记**：主题全局名 `FmbyTheme` 为单槽（串行激活语义，加载后恢复/清除全局）；`routeLoaders` 与路由表需人工同步（新增路由时登记，注释已注明）；管理面 audit-logs 后端恒 fail-closed（501），长列表虚拟化以现有服务端分页+browse 虚拟化网格核实代替。
- **对主代理依赖**：无。
- **兼容性确认**：`useEditableSettings` 乐观路径对 save 契约零改动；删除乐观移除仅动 client 缓存，服务端仍是权威。

## 4+1 自审

- **OO**：预取面收敛单一模块（prefetch.ts），导航组件只声明 key。
- **RB**：乐观更新全部带回滚（onError 恢复 previous + 明确报错），无假成功；预取失败静默但清除去重标记（真实导航可重试）。
- **FM**：主题双缓冲复用 ThemeRegistration 契约（manifestUrl/assets/loadEntry 形状不变），ThemeProvider 激活流程结构不变。
- **MD**：bench 脚本与 JSON 均入 docs/（可复现采样）；vite dev 代理补齐使 dev/生产主题链路一致。
- **Security**：无新增输入面；主题 IIFE 以 `<script>` 注入执行的是**仓库内构建产物**（与 THEME-BUILD-01 安装链信任门一致），未引入远程代码源。

## Before / After 数字（p50，playwright performance 采样）

| 指标 | before | after | 变化 | 说明 |
| --- | --- | --- | --- | --- |
| fcp_home（首登后刷新首页到 FCP） | 856ms | 696ms | **-160ms (-19%)** | dev 模式含 vite 即时转换，生产更优 |
| nav_home_to_manage（点击→内容可见） | 335ms | 336ms | ≈持平 | hover 预取后 avgHoverPrefetchedChunks 0→14（hover 期间预拉 14 个模块），重复导航收益在真实使用中放大 |
| nav_home_to_libraries | 391ms | 333ms | **-58ms (-15%)** | 同上 |
| nav_manage_to_audit | 74ms | 37ms | **-37ms (-50%)** | 预取 + 内容等待策略稳定化 |
| form_click_to_applied（保存点击→"设置已保存"） | 232ms | 116ms | **-116ms (-50%)** | 乐观 onMutate：反馈不等网络往返 |
| theme_switch_flicker_frames（rAF 采样 500 帧内非主题色帧） | **108 帧** | **0 帧** | **-100%** | 零闪烁达成 |
| hover_prefetch.navWithHover.p50 | 57ms | 32ms | -25ms | hover 预取后点击路径 |

原始数据：`docs/fe-opt-bench-before.json`（tag=before）/ `docs/fe-opt-bench-after.json`（tag=after）。

## 卡面任务逐项对照

| # | 卡面要求 | 状态 |
| --- | --- | --- |
| 1a 路由级预取（hover 预加载 chunk） | ✅ prefetch.ts + TopBar 4 nav + ManageLayout 全树（PATH_PREFETCH_KEYS 19 项）；实测 hover 后预拉 14 模块 |
| 1b 骨架屏 | ✅ 核实已有：BrowseLoadingState（hero+3 wide+6 poster skeleton）、FeedbackState loading 变体、RouteHydrateFallback 同色占位——已有面齐备，未重复建设 |
| 1c 图片懒加载优先 | ✅ 补齐 5 处缺失（WideMediaCard/MediaItemPosterThumb/AssetCard/LivePlaybackStreams/HeroSpotlight 主海报 decoding）；首屏 hero 主图保持 eager |
| 2a 表单乐观更新 | ✅ useEditableSettings onMutate 即时反馈+回滚 |
| 2b 危险操作即时反馈 | ✅ 删除媒体库乐观移除（点击确认即从表格消失）；SensitiveActionDialog pending/禁用态核实已有 |
| 2c 长列表虚拟化确认 | ✅ 核实：browse LibraryDetailGrid 自研虚拟化（列计算+overscan）在用；管理面媒体条目服务端分页（PAGE_SIZE=20）；audit-logs 后端 fail-closed 无数据面 |
| 3a 主题切换零闪烁（FOUC 验证） | ✅ **真修复**：根因=先卸旧 CSS 的回落空窗（fallback #0b0c0f 实测 rgb(11,12,15) 帧），双缓冲 + IIFE 后 0 帧 |
| 3b 面包屑/返回栈 | ✅ 核实：react-router 路由栈天然维护，PlayPage 返回 navigate(-1) ×2，ManageLayout 侧栏 active 指示；未新增（现面够用） |
| 4 before/after 数字 | ✅ 本表 + 双 JSON |

## 关键设计说明：主题产物 ESM→IIFE 的裁决

THEME-BUILD-01 的 ESM 产物 `import "react"` 裸说明符在浏览器环境无法解析（无
importmap；实测初始激活报 `Failed to resolve module specifier "react"`）。可选形态：

1. importmap + CDN（esm.sh）——离线部署不可用，否；
2. 主题打包 react 进产物——第二份 react 实例，hooks 崩坏，违反架构纪律，否；
3. **IIFE + output.globals（采纳）**——宿主以 `window.React/ReactDOM/FmbyShared`
   提供依赖（host 构建产物已含 react），主题产物 `<script>` 注入即执行，读
   `window.FmbyTheme` 拿 ThemeEntryModule。零外部依赖、零第二实例。

连锁：size 闸 [3c] 断言从"ESM export"改为"IIFE FmbyTheme 赋值 + react 字节量/
内部 API 字串反查"（external 失效守卫），vite dev 补 `/themes` 代理（dev 与生产
主题链路一致），host registry loadEntry 改 script 注入形态。

## 门禁记录

| 闸 | 结果 |
| --- | --- |
| pnpm versions | PASS |
| pnpm typecheck（shared/host/themes） | PASS |
| pnpm build（host） | PASS（✓ built in 6.16s） |
| pnpm build:themes | PASS（darkroom IIFE 6.38KB / template 0.23KB） |
| pnpm test（darkroom 14 + shared 49 + template） | PASS |
| pnpm size（179KB<300KB + [3b] 内容反查 + [3c] IIFE 断言） | PASS |
| pnpm dupes | PASS（0 violations） |
| pnpm contracts | PASS（8 domain） |
| pnpm theme-budget / theme-parity | PASS |
| 采样 | docs/fe-opt-bench-{before,after}.json（runs=5/5） |
